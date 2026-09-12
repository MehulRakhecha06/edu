#!/usr/bin/env python3
"""
EduMock AI — end-to-end regression suite.

Run against a FRESH app (restart the app first so the demo store is clean):

    python3 scripts/e2e-check.py

Covers: public pages, auth + role boundaries, registration (anti-enumeration),
upload/parse, UUID guards, delete guards, test creation + validation windows,
student test-taking + server-side grading, answer-leak protection, attempts,
notices, admin user management + CSV import, practice-mode stats exclusion,
and page rendering with content markers (catches partial SSR failures).

Requires: `requests` (pip install requests).
"""

import json
import sys
import uuid

import requests

BASE = "http://localhost:3000"
P = F = 0


def check(name, cond, extra=""):
    global P, F
    mark = "✓" if cond else "✗"
    print(f"  {mark} {name}" + ("" if cond else f"  [{str(extra)[:140]}]"))
    P, F = P + (1 if cond else 0), F + (0 if cond else 1)


def login(email, pw):
    s = requests.Session()
    tok = s.get(f"{BASE}/api/auth/csrf").json()["csrfToken"]
    s.post(
        f"{BASE}/api/auth/callback/credentials",
        data={
            "email": email,
            "password": pw,
            "csrfToken": tok,
            "redirect": "false",
            "callbackUrl": "/",
            "json": "true",
        },
        allow_redirects=False,
    )
    return s


def sess_email(s):
    raw = s.get(f"{BASE}/api/auth/session").text
    return (json.loads(raw) or {}).get("user", {}).get("email")


ADMIN = ("mehulrakhecha@gmail.com", "Admin@123")
TEACHER = ("tanisharakhecha2@gmail.com", "Teacher@123")
STUDENT = ("student@edumock.local", "Student@123")

SAMPLE_BANK = """Physics Practice — Chapter 1

1. What is the SI unit of force?
A) Joule
B) Newton
C) Watt
D) Pascal
Answer: B

2. Which quantity is a vector?
A) Mass
B) Temperature
C) Velocity
D) Time
Answer: C

3. 2 + 2 = ?
A) 3
B) 4
C) 5
D) 6
Answer: B
"""

print("== 1. Public pages ==")
r = requests.get(BASE + "/")
check("landing renders", r.status_code == 200 and "mock test" in r.text, r.status_code)
check("login renders", requests.get(BASE + "/login").status_code == 200)
check("register renders", requests.get(BASE + "/register").status_code == 200)
check("unauthorized renders", requests.get(BASE + "/unauthorized").status_code == 200)

print("== 2. Health ==")
h = requests.get(f"{BASE}/api/health").json()
check("health ok", h.get("ok") is True, h)
check("health reports mode", "mode" in h, h)
check("health reports ai provider", "provider" in h.get("ai", {}), h.get("ai"))

print("== 3. Auth ==")
bad = login(*STUDENT[:1] if False else (STUDENT[0], "WrongPassword123"))
check("wrong password rejected", sess_email(bad) is None)
adm = login(*ADMIN)
check("admin signs in", sess_email(adm) == ADMIN[0])
tea = login(*TEACHER)
check("teacher signs in", sess_email(tea) == TEACHER[0])
stu = login(*STUDENT)
check("student signs in", sess_email(stu) == STUDENT[0])

print("== 4. Role boundaries ==")
r = stu.get(f"{BASE}/teacher", allow_redirects=False)
loc = (r.headers.get("location") or "").lower()
check("student blocked from /teacher", r.status_code in (302, 307) and ("unauthorized" in loc or "login" in loc), f"{r.status_code} {loc}")
check("student blocked from teacher API", stu.get(f"{BASE}/api/documents").status_code == 403)
check("student cannot create tests", stu.post(f"{BASE}/api/tests", json={"title": "x"}).status_code == 403)
check("teacher blocked from admin users API", tea.get(f"{BASE}/api/admin/users").status_code == 403)
check("student blocked from admin users API", stu.get(f"{BASE}/api/admin/users").status_code == 403)

print("== 5. Registration (anti-enumeration) ==")
email = f"e2e_{uuid.uuid4().hex[:8]}@school.edu.np"
r1 = requests.post(f"{BASE}/api/auth/register", json={"name": "E2E Student", "email": email, "password": "E2ePass@123"})
r2 = requests.post(f"{BASE}/api/auth/register", json={"name": "E2E Student", "email": email, "password": "Different@456"})
check("new email accepted", r1.status_code == 200 and r1.json().get("ok") is True, r1.text[:80])
check("taken email -> same generic ok", r2.status_code == 200 and r2.json().get("ok") is True and r2.json() == r1.json(), r2.text[:80])
new = login(email, "E2ePass@123")
check("registered account signs in", sess_email(new) == email)
check("attacker password does NOT work", sess_email(login(email, "Different@456")) is None)
check("bad payload still validated", requests.post(f"{BASE}/api/auth/register", json={"name": "x", "email": "not-an-email", "password": "1"}).status_code == 400)

print("== 6. Upload + parse ==")
r = tea.post(f"{BASE}/api/documents", files={"file": ("bank.txt", SAMPLE_BANK.encode(), "text/plain")}, data={"subject": "Physics"})
doc = r.json().get("document", {})
check("upload ok", r.status_code == 200 and doc.get("id"), r.text[:100])
doc_id = doc["id"]
p = tea.post(f"{BASE}/api/documents/{doc_id}/parse").json()
check("parse extracts 3 questions", p.get("count") == 3, json.dumps(p)[:140])
check("parse source is parser", p.get("source") == "parser", p.get("source"))
stems = " | ".join(q.get("questionText", "")[:30] for q in p.get("questions", []))
check("questions copied verbatim", "SI unit of force" in stems and "vector" in stems, stems)
by_stem = {q.get("questionText", ""): q.get("correctAnswer") for q in p.get("questions", [])}
unit_q = next((k for k in by_stem if "SI unit of force" in k), "")
check("answer key preserved", by_stem.get(unit_q) == "B", by_stem)
check("parse requires teacher role", stu.post(f"{BASE}/api/documents/{doc_id}/parse").status_code == 403)

print("== 7. UUID / injection guards ==")
check("bogus doc id -> 404", tea.delete(f"{BASE}/api/documents/not-a-uuid").status_code == 404)
check("sqli-ish id -> 404", tea.post(f"{BASE}/api/documents/1%27%20OR%20%271%3D1/parse").status_code == 404)
r = adm.get(f"{BASE}/api/admin/users")
check("users intact after bogus ids", r.status_code == 200 and len(r.json().get("users", [])) >= 3, r.status_code)

print("== 8. Delete guards ==")
tea2_email = f"teacher2_{uuid.uuid4().hex[:6]}@edumock.local"
r = adm.post(f"{BASE}/api/admin/users", json={"name": "Second Teacher", "email": tea2_email, "password": "Teach@12345", "role": "TEACHER"})
check("admin creates second teacher", r.status_code == 200, r.text[:80])
tea2 = login(tea2_email, "Teach@12345")
r = tea2.delete(f"{BASE}/api/documents/{doc_id}")
check("other teacher cannot delete doc", r.status_code == 403, r.status_code)
r = tea.delete(f"{BASE}/api/documents/{doc_id}")
check("owner deletes own doc", r.status_code == 200, r.text[:80])

print("== 9. Test creation + validation ==")
r = tea.post(f"{BASE}/api/documents", files={"file": ("bank2.txt", SAMPLE_BANK.encode(), "text/plain")}, data={"subject": "Physics"})
doc2 = r.json()["document"]["id"]
tea.post(f"{BASE}/api/documents/{doc2}/parse")
ap = tea.post(f"{BASE}/api/documents/{doc2}/approve").json()
check("questions approved for test building", ap.get("ok") or ap.get("approved"), ap)
r = tea.post(f"{BASE}/api/tests", json={"title": "E2E Physics Test", "documentIds": [doc2], "questionCount": 3, "timeLimitMinutes": 10, "passingPercentage": 40})
test = r.json().get("test", {})
check("test created", r.status_code == 200 and test.get("id"), r.text[:120])
test_id = test["id"]
check("test has 3 questions", test.get("questionCount") == 3, test)
future = "2100-01-01T00:00:00.000Z"
past = "2000-01-01T00:00:00.000Z"
r = tea.post(f"{BASE}/api/tests", json={"title": "Bad window", "documentIds": [doc2], "questionCount": 3, "timeLimitMinutes": 10, "passingPercentage": 40, "availableFrom": future, "availableTo": past})
check("invalid window rejected (closes before opens)", r.status_code == 400, r.text[:100])

# timezone: a naive datetime-local string must be read as NEPAL wall clock
# (13:20 NPT), so the STUDENT DASHBOARD shows 1:20 PM — not 7:05 PM (+5:45 bug)
r = tea.post(f"{BASE}/api/tests", json={"title": "TZ window test", "documentIds": [doc2], "questionCount": 2, "timeLimitMinutes": 10, "passingPercentage": 40, "availableFrom": "2030-01-01T13:20"})
check("tz test created", r.status_code == 200, r.text[:120])
page = stu.get(f"{BASE}/student").text
check("student dashboard shows 1:20 PM (Nepal wall clock)", "1:20 PM" in page and "7:05 PM" not in page,
      "window not found on dashboard" if "1:20 PM" not in page else "old +5:45 shift still visible")
r = tea.post(f"{BASE}/api/tests", json={"title": "Too many", "documentIds": [doc2], "questionCount": 101, "timeLimitMinutes": 10, "passingPercentage": 40})
check("101 questions rejected", r.status_code == 400, r.text[:100])

print("== 10. Student takes the test ==")
r = stu.get(f"{BASE}/api/tests/{test_id}")
check("student fetches test", r.status_code == 200, r.status_code)
body = r.json()
test_obj = body.get("test", body)
questions = body.get("questions") or test_obj.get("questions") or []
check("test serves questions", len(questions) >= 1, list(body.keys()))
leak = "correctAnswer" in json.dumps(body)
check("correct answers NOT leaked before submit", not leak)
if questions:
    ans = [{"questionId": q["id"], "selected": "B"} for q in questions]  # key is B,C,B -> 2/3
    r = stu.post(f"{BASE}/api/tests/{test_id}/submit", json={"answers": ans})
    res = r.json()
    check("submit graded", r.status_code == 200 and "score" in res, r.text[:140])
    check("score correct (2/3)", res.get("score") == 2, res.get("score"))
    check("pass/fail vs criteria", res.get("passed") is (res.get("score", 0) / max(res.get("total", 1), 1) * 100 >= 40), res)
    r2 = stu.post(f"{BASE}/api/tests/{test_id}/submit", json={"answers": ans})
    check("second attempt blocked (1 attempt)", r2.status_code in (400, 403, 409, 429), r2.status_code)
    check("student cannot submit for a test twice", "error" in r2.json())

print("== 11. Teacher sees results ==")
r = tea.get(f"{BASE}/api/attempts")
check("teacher lists attempts", r.status_code == 200, r.status_code)
r = stu.get(f"{BASE}/api/attempts")
check("student lists own attempts", r.status_code == 200 and isinstance(r.json().get("attempts", r.json()), (list, dict)), r.status_code)

print("== 12. Notices ==")
r = tea.post(f"{BASE}/api/notices", json={"title": "E2E notice", "body": "Test on Friday"})
check("teacher posts notice", r.status_code == 201 and r.json().get("notice", {}).get("id"), r.text[:80])
html = stu.get(f"{BASE}/student").text
check("student sees notice", "E2E notice" in html)

print("== 13. Admin: users + CSV ==")
r = adm.get(f"{BASE}/api/admin/users")
users = r.json().get("users", [])
check("admin lists users", r.status_code == 200 and len(users) >= 4, len(users))
csv_rows = "name,email,password\nNepal Student,nepal_{0}@school.edu.np,Np@12345\nBad Row,not-an-email,x\n".format(uuid.uuid4().hex[:6])
r = adm.post(f"{BASE}/api/admin/users/import", files={"file": ("class.csv", csv_rows.encode(), "text/csv")})
imp = r.json()
check(
    "CSV with a bad row: good row imported, bad row reported",
    r.status_code == 200 and imp.get("createdCount") == 1 and imp.get("skippedCount") == 1 and imp.get("skipped", [{}])[0].get("row") == 3,
    r.text[:140],
)
csv_ok = "name,email,password\nNepal Student,nepal_{0}@school.edu.np,Np@12345\n".format(uuid.uuid4().hex[:6])
r = adm.post(f"{BASE}/api/admin/users/import", files={"file": ("class.csv", csv_ok.encode(), "text/csv")})
check("valid CSV imports", r.status_code == 200, r.text[:120])
check("teacher cannot import CSV", tea2.post(f"{BASE}/api/admin/users/import", files={"file": ("c.csv", csv_ok.encode(), "text/csv")}).status_code == 403)

print("== 14. Pages render with real content markers ==")
for path, sess, marker in [
    ("/teacher", tea, "Upload a question bank"),
    ("/teacher/tests", tea, "Publish test"),
    ("/teacher/students", tea, "Student progress"),
    ("/student", stu, "Available tests"),
    ("/admin", adm, "Admin Dashboard"),
    ("/admin/ai", adm, "AI"),
    (f"/teacher/documents/{doc2}", tea, "Review"),
]:
    html = sess.get(f"{BASE}{path}").text
    check(f"{path} renders fully", "Aimmers" in html and marker in html and "Application error" not in html, marker + " missing")

print("== 15. Practice mode excluded from stats ==")
r = tea.post(f"{BASE}/api/tests", json={"title": "E2E Practice", "documentIds": [doc2], "questionCount": 3, "timeLimitMinutes": 10, "passingPercentage": 40, "isPractice": True, "maxAttempts": 0})
ptest = r.json().get("test", {})
check("practice test created", ptest.get("id"), r.text[:120])
r = stu.get(f"{BASE}/api/tests/{ptest['id']}")
pq = r.json().get("questions") or r.json().get("test", {}).get("questions") or []
if pq:
    stu.post(f"{BASE}/api/tests/{ptest['id']}/submit", json={"answers": [{"questionId": q["id"], "selected": "B"} for q in pq]})
r = tea.get(f"{BASE}/api/teacher/students")
stats = r.json() if isinstance(r.json(), list) else r.json().get("students", [])
sam = next((row for row in stats if row.get("email") == STUDENT[0]), {})
check("practice attempt not counted in stats", sam.get("testsTaken") == 1, sam)

print("== 16. Ask your materials (teacher grounded chat) ==")
r = stu.post(f"{BASE}/api/assistant/grounded", json={"query": "What is the SI unit of force?"})
check("grounded chat blocked for students", r.status_code == 403, r.status_code)
r = tea.post(f"{BASE}/api/assistant/grounded", json={"query": "SI unit of force"})
g = r.json()
check("grounded chat works for teacher", r.status_code == 200 and bool(g.get("reply")), json.dumps(g)[:120])
check("grounded chat finds the bank passage", any("bank2" in (p2.get("filename") or "") for p2 in g.get("passages", [])), json.dumps(g.get("passages", []))[:160])
r = tea.post(f"{BASE}/api/assistant/grounded", json={"query": "zzqqxx nothingmatches"})
g = r.json()
check("no-match reply is graceful", r.status_code == 200 and g.get("source") == "none", json.dumps(g)[:100])

print()
print("=" * 52)
print(f"E2E CHECK: {P} passed, {F} failed")
sys.exit(1 if F else 0)

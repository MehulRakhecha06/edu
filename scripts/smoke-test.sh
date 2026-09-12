#!/usr/bin/env bash
# ============================================================================
# EduMock AI — smoke test
#
# Runs a full end-to-end check against a RUNNING app:
#   login for all 3 roles → teacher upload → parse → create test →
#   student takes test → grading → AI explain → teacher results →
#   admin user management → AI settings round-trip →
#   (optional) Python AI service on :8000
#
# Usage:
#   npm run smoke-test          # or: bash scripts/smoke-test.sh
#
# Requirements:
#   - the web app is running in DEMO MODE on http://localhost:3000
#     (npm run dev, no .env.local needed — demo data resets on restart,
#      so this script never harms real data)
#   - curl + python3
#   - the Python AI service is OPTIONAL (section auto-skipped if :8000 is down)
#
# Expected result: all checks pass. A few checks depend on which AI backend
# is active — the script adapts (it only asserts behaviour that must hold in
# every configuration).
# ============================================================================
set -u

BASE="${1:-http://localhost:3000}"
AI_BASE="${2:-http://localhost:8000}"
JAR_ADMIN="$(mktemp)"; JAR_TEACHER="$(mktemp)"; JAR_STUDENT="$(mktemp)"
BANK="$(mktemp --suffix=.txt)"
PASS=0; FAIL=0; SECTION=""

ok()   { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad()  { FAIL=$((FAIL+1)); echo "  ✗ $1"; echo "      ${2:0:220}"; }
section() { SECTION="$1"; echo; echo "== $1 =="; }

# --- helpers -----------------------------------------------------------------
# jget '<python-expr on json>' <<<data  → prints result or '' on error
jget() {
  local expr="$1"; shift
  python3 -c "
import json,sys
try:
    d=json.load(sys.stdin)
    print($expr)
except Exception:
    print('')
" 2>/dev/null
}

# api METHOD PATH JAR [json-body] — prints response body
api() {
  local method="$1" path="$2" jar="$3" body="${4:-}"
  if [ -n "$body" ]; then
    curl -s -X "$method" -b "$jar" -H 'Content-Type: application/json' -d "$body" "$BASE$path"
  else
    curl -s -X "$method" -b "$jar" "$BASE$path"
  fi
}

# login EMAIL PASSWORD JAR — performs the NextAuth credentials handshake
login() {
  local email="$1" password="$2" jar="$3"
  rm -f "$jar"
  local csrf
  csrf=$(curl -s -c "$jar" "$BASE/api/auth/csrf" | jget 'd["csrfToken"]')
  [ -z "$csrf" ] && return 1
  curl -s -b "$jar" -c "$jar" -X POST "$BASE/api/auth/callback/credentials" \
    -H 'Content-Type: application/x-www-form-urlencoded' \
    --data-urlencode "csrfToken=$csrf" \
    --data-urlencode "email=$email" \
    --data-urlencode "password=$password" \
    --data-urlencode "redirect=false" \
    -o /dev/null
  # verify the session actually exists
  local who
  who=$(curl -s -b "$jar" "$BASE/api/auth/session" | jget 'd.get("user",{}).get("email","")')
  [ "$who" = "$email" ]
}

trap 'rm -f "$JAR_ADMIN" "$JAR_TEACHER" "$JAR_STUDENT" "$BANK"' EXIT

# --- 0. app up? ---------------------------------------------------------------
section "App is running ($BASE)"
health=$(curl -s "$BASE/api/health")
[ -n "$health" ] && ok "GET /api/health responds" || { bad "app not reachable on $BASE" "$health"; echo "Start it with: npm run dev"; exit 1; }
mode=$(echo "$health" | jget 'd.get("mode","")')
[ -n "$mode" ] && ok "mode reported: $mode" || bad "health payload missing mode" "$health"
if [ "$mode" != "demo" ]; then
  echo "  ⚠ Not in demo mode — the script will still run, but it will"
  echo "    create REAL data (a document, a test, a temp account)."
fi

# --- 1. auth -------------------------------------------------------------------
section "Authentication (all roles, one sign-in page)"
login "mehulrakhecha@gmail.com" "Admin@123" "$JAR_ADMIN"    && ok "admin login"    || bad "admin login" "session missing"
login "tanisharakhecha2@gmail.com" "Teacher@123" "$JAR_TEACHER" && ok "teacher login" || bad "teacher login" "session missing"
login "student@edumock.local" "Student@123" "$JAR_STUDENT"  && ok "student login" || bad "student login" "session missing"
# wrong password: full CSRF handshake, wrong credentials → must NOT create a session
JAR_BAD="$(mktemp)"
rm -f "$JAR_BAD"
badcsrf=$(curl -s -c "$JAR_BAD" "$BASE/api/auth/csrf" | jget 'd["csrfToken"]')
curl -s -b "$JAR_BAD" -c "$JAR_BAD" -X POST "$BASE/api/auth/callback/credentials" \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode "csrfToken=$badcsrf" \
  --data-urlencode "email=student@edumock.local" \
  --data-urlencode "password=WRONG" \
  --data-urlencode "redirect=false" -o /dev/null
badwho=$(curl -s -b "$JAR_BAD" "$BASE/api/auth/session" | jget 'd.get("user",{}).get("email","")')
[ -z "$badwho" ] && ok "wrong password rejected (no session created)" || bad "wrong password created a session!" "$badwho"
rm -f "$JAR_BAD"

# --- 2. teacher: upload + parse -------------------------------------------------
section "Teacher: upload question bank + extract questions"
cat > "$BANK" << 'EOB'
1. What is the capital city of Nepal?
A) Pokhara
B) Kathmandu
C) Biratnagar
D) Lalitpur
Answer: B

2. Which planet is known as the Red Planet?
A) Venus
B) Mars
C) Jupiter
D) Saturn
Answer: B

3. 2 + 2 equals:
A) 3
B) 4
C) 5
D) 6
Answer: B
EOB
upload=$(curl -s -b "$JAR_TEACHER" -F "file=@$BANK" -F "subject=Smoke Test" "$BASE/api/documents")
doc_id=$(echo "$upload" | jget 'd["document"]["id"]')
[ -n "$doc_id" ] && ok "document uploaded (id $doc_id)" || bad "upload failed" "$upload"

parse=$(api POST "/api/documents/$doc_id/parse" "$JAR_TEACHER")
count=$(echo "$parse" | jget 'd.get("count",0)')
src=$(echo "$parse" | jget 'd.get("source","")')
if [ "${count:-0}" -ge 2 ] 2>/dev/null; then ok "questions extracted: $count (source: $src)"; else bad "parse returned <2 questions" "$parse"; fi

# review queue: extracted questions are pending until approved
if [ "${count:-0}" -ge 1 ] 2>/dev/null; then
  appr=$(api POST "/api/documents/$doc_id/approve" "$JAR_TEACHER")
  appr_n=$(echo "$appr" | jget 'd.get("approved",-1)')
  if [ "${appr_n:--1}" -ge 1 ] 2>/dev/null; then ok "review queue: $appr_n question(s) approved"; else bad "approve-all failed" "$appr"; fi
fi

# --- 3. teacher: create the test ------------------------------------------------
section "Teacher: create test (timer + passing %)"
create=$(api POST "/api/tests" "$JAR_TEACHER" \
  "{\"title\":\"Smoke Test 101\",\"documentIds\":[\"$doc_id\"],\"questionCount\":$(( ${count:-2} > 3 ? 3 : ${count:-2} )),\"timeLimitMinutes\":10,\"passingPercentage\":50}")
test_id=$(echo "$create" | jget 'd["test"]["id"]')
[ -n "$test_id" ] && ok "test created (id $test_id)" || bad "create test failed" "$create"

# --- 4. student: take + submit ---------------------------------------------------
section "Student: take test (answers must be hidden) + submit"
stest=$(api GET "/api/tests/$test_id" "$JAR_STUDENT")
qids=$(echo "$stest" | jget '",".join(q["id"] for q in d["test"]["questions"])')
[ -n "$qids" ] && ok "student fetched test" || bad "student fetch failed" "$stest"
case "$stest" in *correctAnswer*|*correct_answer*) bad "LEAK: correct answers visible to student" "$stest";; *) ok "correct answers hidden from student";; esac

# build a perfect answer sheet using the TEACHER view (has the key)
ttest=$(api GET "/api/tests/$test_id" "$JAR_TEACHER")
answers=$(python3 -c "
import json
t=json.loads('''$ttest''')
qs=t['test']['questions']
print(json.dumps({'answers':[{'questionId':q['id'],'selected':q['correctAnswer']} for q in qs]}))
" 2>/dev/null)
[ -n "$answers" ] && ok "built answer key from teacher view" || bad "teacher view missing answer key" "$ttest"

submit=$(api POST "/api/tests/$test_id/submit" "$JAR_STUDENT" "$answers")
score=$(echo "$submit" | jget 'd.get("score",-1)')
total=$(echo "$submit" | jget 'd.get("total",-1)')
passed=$(echo "$submit" | jget 'd.get("passed",None)')
if [ "${score:--1}" = "${total:--2}" ] && [ "${score:--1}" != "-1" ] && [ "$score" != "0" ]; then
  ok "graded server-side: $score/$total (100%)"
else
  bad "expected perfect score, got $score/$total" "$submit"
fi
[ "$passed" = "True" ] && ok "student PASSED (passing 50%)" || bad "passed flag wrong: $passed" "$submit"

# --- 5. AI explain ---------------------------------------------------------------
section "AI explanation (any backend)"
explain=$(api POST "/api/ai/explain" "$JAR_STUDENT" "{\"questionId\":\"$(echo "$qids" | cut -d',' -f1)\",\"testId\":\"$test_id\"}")
expl=$(echo "$explain" | jget 'd.get("explanation","")')
[ -n "$expl" ] && ok "explanation returned (${#expl} chars)" || bad "no explanation" "$explain"

# --- 6. teacher reviews results ---------------------------------------------------
section "Teacher: results"
attempts=$(api GET "/api/attempts" "$JAR_TEACHER")
case "$attempts" in
  *student@edumock.local*|*Smoke\ Test\ 101*) ok "teacher sees the student's attempt";;
  *) bad "attempt missing from teacher results" "$attempts";;
esac

# --- 7. admin: user management -----------------------------------------------------
section "Admin: account management"
tmp_email="smoke-$RANDOM@edumock.local"
newuser=$(api POST "/api/admin/users" "$JAR_ADMIN" "{\"name\":\"Smoke Temp\",\"email\":\"$tmp_email\",\"password\":\"Temp@12345\",\"role\":\"TEACHER\"}")
case "$newuser" in *'"ok":true'*|*'"ok": true'*) ok "temp teacher account created";; *) bad "create user failed" "$newuser";; esac
users=$(api GET "/api/admin/users" "$JAR_ADMIN")
tmp_id=$(echo "$users" | jget 'next((u["id"] for u in d.get("users",[]) if u.get("email")=="'"$tmp_email"'"),"")')
[ -n "$tmp_id" ] && ok "temp account listed" || bad "temp account not in list" "$users"
if [ -n "$tmp_id" ]; then
  del=$(api DELETE "/api/admin/users/$tmp_id" "$JAR_ADMIN")
  case "$del" in *'"ok":true'*|*'"ok": true'*) ok "temp account deleted";; *) bad "delete user failed" "$del";; esac
fi

# --- 8. AI settings round-trip -------------------------------------------------------
section "Admin: AI settings (switch provider at runtime)"
save=$(api POST "/api/admin/ai/settings" "$JAR_ADMIN" '{"provider":"auto","local":{"baseUrl":"","model":""},"huggingface":{"model":"","apiKey":""}}')
case "$save" in *'"ok":true'*|*'"ok": true'*) ok "settings saved (reset to Automatic)";; *) bad "save settings failed" "$save";; esac
test_conn=$(api POST "/api/admin/ai/test" "$JAR_ADMIN" '{"provider":"local","baseUrl":"http://localhost:9999/v1","model":"nope"}')
case "$test_conn" in *unreachable*|*failed*|*'"ok":false'*) ok "dead provider reported as unreachable";; *) echo "  (info) test-connection reply: ${test_conn:0:120}";; esac

# --- 8b. Photo question bank (vision) — needs the Python service ----------
if curl -s --max-time 2 "$AI_BASE/health" | grep -q edumock-ai-service; then
  section "Photo question bank (AI vision)"
  # point the app at the service
  api POST "/api/admin/ai/settings" "$JAR_ADMIN" "{\"provider\":\"local\",\"local\":{\"baseUrl\":\"$AI_BASE/v1\",\"model\":\"edumock-service\"},\"huggingface\":{\"model\":\"\",\"apiKey\":\"\"}}" > /dev/null
  # generate a tiny valid PNG
  PHOTO="$(mktemp --suffix=.png)"
  python3 -c "
import struct, zlib, sys
w = h = 32
raw = b''.join(b'\x00' + b'\xaa' * (w * 3) for _ in range(h))
def ch(t, d):
    c = t + d
    return struct.pack('>I', len(d)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)
png = b'\x89PNG\r\n\x1a\n' + ch(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)) + ch(b'IDAT', zlib.compress(raw)) + ch(b'IEND', b'')
open(sys.argv[1], 'wb').write(png)
" "$PHOTO"
  uphoto=$(curl -s -b "$JAR_TEACHER" -F "file=@$PHOTO;type=image/png" -F "subject=Vision Check" "$BASE/api/documents")
  photo_id=$(echo "$uphoto" | jget 'd["document"]["id"]')
  [ -n "$photo_id" ] && ok "photo uploaded" || bad "photo upload rejected" "$uphoto"
  if [ -n "$photo_id" ]; then
    pphoto=$(api POST "/api/documents/$photo_id/parse" "$JAR_TEACHER")
    pcount=$(echo "$pphoto" | jget 'd.get("count",0)')
    if [ "${pcount:-0}" -ge 1 ] 2>/dev/null; then
      ok "questions read from the photo (vision): $pcount"
    else
      bad "vision parse failed" "$pphoto"
    fi
  fi
  rm -f "$PHOTO"
  # restore automatic provider
  api POST "/api/admin/ai/settings" "$JAR_ADMIN" '{"provider":"auto","local":{"baseUrl":"","model":""},"huggingface":{"model":"","apiKey":""}}' > /dev/null
else
  section "Photo question bank — skipped (Python AI service not running)"
  echo "  Start it with:  npm run ai   (vision needs the service + a vision backend)"
fi

# --- 9. Python AI service (optional) ---------------------------------------------------
if curl -s --max-time 2 "$AI_BASE/health" | grep -q edumock-ai-service; then
  section "Python AI service ($AI_BASE) — detected"
  svc=$(curl -s "$AI_BASE/health")
  backend=$(echo "$svc" | jget 'd.get("backend","")')
  version=$(echo "$svc" | jget 'd.get("version","")')
  ok "service v$version, backend: $backend"
  pparse=$(curl -s -X POST "$AI_BASE/edumock/parse-questions" -H 'Content-Type: application/json' -d '{"text":"1. Q?\nA) x\nB) y\nAnswer: A"}')
  pcount=$(echo "$pparse" | jget 'd.get("count",0)')
  [ "${pcount:-0}" -ge 1 ] 2>/dev/null && ok "parse-questions endpoint works ($pcount question)" || bad "parse-questions failed" "$pparse"
  pchat=$(curl -s -X POST "$AI_BASE/edumock/chat" -H 'Content-Type: application/json' -d '{"message":"hello","history":[]}')
  preply=$(echo "$pchat" | jget 'd.get("reply","")')
  [ -n "$preply" ] && ok "chat endpoint works" || bad "chat failed" "$pchat"
  # is the web app actually wired to it?
  wah=$(echo "$health" | jget 'd.get("ai",{}).get("pythonService",None)')
  [ "$wah" != "None" ] && [ -n "$wah" ] && ok "web app sees the python service" || echo "  (info) web app not pointed at the service yet — Admin → AI Settings → local $AI_BASE/v1"
else
  section "Python AI service — skipped (not running on $AI_BASE)"
  echo "  Start it with:  npm run ai"
fi

# --- summary ----------------------------------------------------------------------------
echo
echo "================================================================"
echo "SMOKE TEST: $PASS passed, $FAIL failed"
echo "================================================================"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1

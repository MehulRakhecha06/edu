# Security Audit — Aimmers Nepal (EduMock AI)

**Date:** 11 Sep 2026 · **Scope:** full white-box review of all 26 API routes,
middleware, auth, stores, AI service + 16 live black-box probes against the
running app · **Method:** manual agent-driven audit (same checklist Strix's
agents use: auth, IDOR, injection, XSS, secrets, rate limits, upload abuse,
grading integrity)

---

## Scorecard

| Area | Result |
| --- | --- |
| Authentication & session handling | ✅ Pass |
| Authorization / role checks (all routes) | ✅ Pass |
| Answer-key leakage to students | ✅ Pass (verified live) |
| Server-side grading, windows, attempt limits | ✅ Pass |
| XSS / injection | ✅ Pass (probes negative) |
| Secrets handling | ✅ Pass (no hardcoded secrets) |
| Upload abuse | ✅ Pass (1 issue found → **fixed** in this audit) |
| Rate limiting | ✅ Pass on all sensitive endpoints |
| Security headers | ✅ Pass (1 hardening note) |
| AI service exposure | ⚠️ 1 hardening recommendation (below) |

**Critical/High findings: 0.** One robustness bug found and fixed during the
audit; two low-severity hardening recommendations.

---

## Verified during this audit

**Access control (every route individually checked):**
- All 26 API routes have session + role checks except the deliberately public
  ones (`/api/health`, `/api/ai/chat` guest assistant, `/api/auth/*`).
- Edge middleware (`proxy.js`) adds a second layer: `/admin/**` and
  `/api/admin/**` are ADMIN-only at the edge before route code even runs.
- Registration hardcodes the STUDENT role (no self-promotion possible),
  is rate-limited (20/15 min/IP) and anti-enumeration safe (same response
  and timing for taken/unused emails).
- Login has per-IP brute-force rate limiting with reset on success.
- Admin cannot delete their own account; role changes are admin-only.
- Students see only their own attempts; teachers/admins see the class.
- Document deletion is owner-or-admin (verified in E2E); other teachers can
  use a bank but not destroy it.

**Exam integrity (the money path):**
- The student test payload **never contains `correctAnswer`** — verified in
  code AND live (student JSON vs teacher JSON for the same test).
- Grading is 100 % server-side; submit enforces the availability window and
  the teacher's attempt limit server-side.
- Practice tests are flagged and excluded from progress stats.

**Injection / XSS:**
- All `id` params are UUID-validated (SQLi-shaped ids → 404, in E2E); all DB
  access goes through the parameterized Supabase client.
- Stored-XSS probe (`<script>`, `<img onerror>`) renders escaped everywhere —
  React auto-escaping, zero `dangerouslySetInnerHTML` in the codebase, plus
  CSP (`default-src 'self'`, `frame-ancestors 'none'`, `connect-src 'self'`).
- Headers: `X-Frame-Options: DENY`, `nosniff`, Referrer-Policy,
  Permissions-Policy, `poweredByHeader` off.

**Secrets:**
- No hardcoded keys/tokens anywhere (scanned); `.env*` excluded from the
  distribution zip; examples contain placeholders only.
- `AUTH_SECRET` is enforced (fail-loud) in Supabase mode; the fixed secret is
  demo-mode-only. Supabase RLS is on with no public policies; the
  service-role key never leaves the server.

**Upload abuse:**
- 10 MB cap (verified: 11 MB → 400), extension + MIME allowlist, and
  magic-byte sniffing (`%PDF` / `PK`) in `lib/pdf.js`.
- **Found & fixed in this audit:** a corrupt/fake PDF (e.g. an `.exe` renamed
  to `.pdf`) returned an ugly `500 Upload failed`. Now a clean
  `400 "This file could not be read…"` (nothing was ever stored — verified).

**Rate limits present on:** login, register, document upload, parse
(12/10 min), AI chat (guest 20/5 min), grounded chat (20/10 min), CSV import.

---

## Recommendations (no action urgently required)

1. **AI service on a shared network (Medium, config not code):**
   `ai-service` defaults to `WEB_ORIGINS=*` and no `SERVICE_API_KEY`. On your
   own laptop that's fine (it binds localhost). If you ever run it on a
   machine others can reach (school LAN/server), set both in
   `ai-service/.env`:
   ```
   SERVICE_API_KEY=<long random string>   # the web app auto-handshakes it
   WEB_ORIGINS=http://localhost:3000      # your app origin(s) only
   ```
   and bind to `127.0.0.1` unless it must serve other machines.
2. **CSP `unsafe-inline`/`unsafe-eval` (Low):** required by the Next.js dev
   server; documented in `next.config.mjs`. Consider tightening for the
   production build later.
3. **Deployment checklist (process):** demo mode must never be public — it
   seeds known accounts and uses a fixed session secret. Always deploy with
   Supabase env vars + `AUTH_SECRET` set (the deployment guide covers this).
4. **Note (design, not a bug):** any teacher can parse/approve and edit
   questions in ANY bank (shared-library design); only deletion is
   owner-restricted. If banks should be private per teacher, say the word and
   ownership checks will be added.
5. JWT sessions last 30 days — standard, but can be shortened if you want
   students to sign in more often.

---

## Running Strix yourself (recommended before/after public launch)

The open-source Strix CLI (usestrix/strix) needs **Docker** and an **LLM API
key** — that's why it couldn't run in this workspace. On your machine:

```bash
# 1. Install (needs Docker running)
curl -sSL https://strix.ai/install | bash

# 2. Point it at an LLM you have a key for (LiteLLM model id), e.g.
#    Mistral:  export STRIX_LLM="mistral/mistral-small-latest"
#    OpenRouter free tier also works
export STRIX_LLM="mistral/mistral-small-latest"
export LLM_API_KEY="your-key"

# 3a. White-box scan of the codebase (quick mode ≈ 15–30 min)
strix -n -t ./edumock-ai --scan-mode quick --max-budget 10

# 3b. Or black-box against the RUNNING app (start the app first):
strix -n -t http://localhost:3000 \
  --instruction "Test using credentials — teacher: tanisharakhecha2@gmail.com / Teacher@123, student: student@edumock.local / Student@123 (demo mode)"
```

Tips: always use `-n` (headless); findings land in `strix_runs/` with PoCs;
a standard scan takes 1–4 h. Without Docker or an LLM key,
`OWASP ZAP` (baseline scan) or `nuclei` are the free no-AI alternatives.

---

## Probe log (this audit)

Unauth 401s on `/api/tests`, `/api/documents`, `/api/admin/users`,
`/api/attempts`, `/api/assistant/grounded` ✓ · student test JSON contains no
`correctAnswer` while teacher's does ✓ · XSS payloads render escaped ✓ ·
student blocked (403) from documents/teacher-students/questions ✓ · 11 MB
upload → 400 ✓ · fake PDF → 400 (was 500 — fixed) ✓ · `/api/health` leaks no
keys ✓ · AI service open without key on localhost (hardening note) ·
no hardcoded secrets ✓

---

## Round 2 — attack simulation & load test (11 Sep 2026, later same day)

Ran an adversarial pass against the RUNNING app: 13 attack probes + a
30-thread load test. Findings:

| Probe | Result |
| --- | --- |
| Login timing enumeration (nonexistent vs existing email) | ⚠️ **FOUND & FIXED** — see below |
| Prototype pollution via register (`__proto__.role`) | ✅ cannot escalate |
| **Race condition: 6 concurrent submits, maxAttempts=1** | ✅ exactly 1 accepted, 1 attempt recorded |
| IDOR: student → parse/approve/answer-key on teacher docs | ✅ 403 everywhere |
| Teacher → admin APIs | ✅ 403 |
| Forged session cookie (bad signature) | ✅ rejected 401 |
| Security headers on live responses | ✅ present |
| 50,000-deep nesting upload / null bytes / 1 MB chat message | ✅ handled (400/200) |
| Load: 450 req, 30 concurrent threads | ✅ **0 errors, 0 5xx, no crash** (p95 ≈ 1 s on the 2-GB sandbox CPU; real hardware will be far faster) |

**Fixed in this round:**
1. **Login timing enumeration** — a nonexistent email returned ~30 ms
   (no bcrypt run) while an existing email took ~100-300 ms, letting an
   attacker discover which emails have accounts. Now a dummy cost-12 bcrypt
   compare runs on the no-user path; measured Δ after fix: **5 ms** (351 vs
   345 ms). Demo-mode seed hashes were also aligned from cost 10 → 12 to
   match every production path.
2. (Earlier same day) corrupt-file upload 500 → clean 400.

**Deployment-relevant notes for Vercel (serverless):**
- The in-memory rate limiter is per-instance — on serverless, limits are
  per-warm-instance rather than global. At this school's scale that is
  acceptable; if you ever need strict global limits, add Upstash Redis
  (@upstash/ratelimit) behind the same `rateLimit()` interface.
- Demo mode (no Supabase env) must NEVER be public: known seeded accounts
  and a fixed session secret. Always deploy with the env vars below.
- Vision parsing (photos/scans) needs the Python service — on Vercel, use
  text-based banks or a cloud provider for text AI only.

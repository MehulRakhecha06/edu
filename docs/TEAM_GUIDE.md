# Aimmers Nepal — Team Guide

Everything a new developer needs to be productive on day one.
Estimated setup time: **10 minutes**.

## What this project is

Aimmers Nepal is an exam-preparation platform: teachers upload question banks
(PDFs, Word files, or photos/scans of papers), AI extracts the MCQs, teachers
build timed tests, students take them and get AI explanations, teachers review
class results. Built for ~200 students / 50 teachers / 1 admin on free-tier
infrastructure.

Two services, two languages, one repo:

| Service | Tech | Port | Runs where |
| --- | --- | --- | --- |
| Web app (`/`) | Next.js 16, **JavaScript only** | 3000 | Vercel free tier |
| AI service (`/ai-service`) | Python 3.10+, FastAPI | 8000 | Any host (your laptop, a VPS, Render/Fly free tier) |

## Quick start (demo mode — no accounts, no keys)

Terminal 1 — web app:

```bash
npm install
npm run dev          # http://localhost:3000
```

Terminal 2 — AI service (optional; the app works without it):

```bash
cd ai-service
python3 -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python3 -m uvicorn app.main:app --port 8000 --reload
```

Demo mode gives you a seeded in-memory database with three accounts
(resets on every restart):

| Role | Email | Password |
| --- | --- | --- |
| ADMIN | xyz@gmail.com | Admin@123 |
| TEACHER | abc@gmail.com | Teacher@123 |
| STUDENT | student@edumock.local | Student@123 |

The login page has quick-fill buttons for all three.
**Demo accounts only exist when the app runs WITHOUT Supabase env vars.**

## Environment variables

Copy `.env.local.example` → `.env.local` and fill what you need.
**Every variable is optional** — the more you add, the more "real" it gets:

| Variable | Purpose |
| --- | --- |
| *(none)* | **Demo mode** — in-memory DB, deterministic built-in AI |
| `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` | Real Postgres (run `supabase/schema.sql` once) |
| `AI_BASE_URL` | Default local/OpenAI-compatible AI URL, e.g. `http://localhost:8000/v1` (our Python service) or `http://localhost:11434/v1` (Ollama) |
| `HUGGINGFACE_API_KEY` (+ `HUGGINGFACE_MODEL`) | Hugging Face Inference API as default AI |
| `AUTH_SECRET` | Required in production (any long random string) |
| `NEXT_PUBLIC_APP_URL` | Public URL in production |

AI service variables live in `ai-service/.env` — see `ai-service/.env.example`
(`AI_BACKEND`, `OLLAMA_URL`, `HF_TOKEN`, `TRANSFORMERS_MODEL`, `SERVICE_API_KEY`, …).

## Repo layout (what lives where)

```
edumock-ai/
├── app/                        # Next.js App Router — pages + APIs
│   ├── login/  student/  teacher/  admin/
│   ├── api/
│   │   ├── auth/               # NextAuth credentials provider
│   │   ├── documents/          # upload, list, parse, review+approve, answer-key
│   │   ├── tests/              # create, fetch, submit, results
│   │   ├── questions/          # manual entry + edit/delete single questions
│   │   ├── notices/            # teacher announcements -> student dashboard
│   │   ├── teacher/students/   # student progress overview + history
│   │   ├── admin/users/import/ # CSV student import
│   │   ├── attempts/           # teacher results view
│   │   ├── ai/                 # explain + chat proxies (uses AI service)
│   │   └── admin/              # user management, AI settings
│   └── (page components live next to their folder, .js only)
├── ai-service/                 # PYTHON AI MICROSERVICE — all AI logic
│   ├── app/
│   │   ├── main.py             # FastAPI app, all HTTP endpoints
│   │   ├── config.py           # env parsing, backend auto-detect
│   │   ├── prompts.py          # ★ ALL LLM prompts in ONE file
│   │   ├── schemas.py          # request/response models (public contract)
│   │   ├── providers/          # mock, ollama, huggingface, transformers
│   │   └── services/           # parser, explainer, assistant
│   └── tests/                  # pytest suite (22 tests)
├── components/                 # shared UI components
├── lib/                        # server-side helpers
│   ├── auth.js  store-supabase.js  store-memory.js
│   ├── ai.js                   # provider resolution + AI service client
│   ├── mcq.js  validators.js  rate-limit.js  pdf.js
├── docs/                       # you are here
├── supabase/                   # schema.sql + migration .sql files
├── proxy.js                    # route protection (runs on the edge)
└── scripts/smoke-test.sh       # full end-to-end check (see below)
```

## Golden rules — read before writing code

1. **Web app = JavaScript only.** `.js`/`.jsx` everywhere under the repo root.
   Python is allowed **only** inside `ai-service/`.
2. **All AI logic lives in the Python service** — prompts, JSON parsing, model
   calls. The web app (`lib/ai.js`) is just a client. Don't add AI logic to the
   Next.js side.
3. **LLM copies questions VERBATIM from the PDF.** It must never invent,
   reword or "improve" questions — it only extracts and explains. This rule is
   a client requirement and is baked into every parsing prompt
   (`ai-service/app/prompts.py`).
4. **Never expose correct answers before submission.** Grading happens
   server-side in `app/api/tests/[id]/submit/route.js`. Check any new endpoint
   that returns questions.
5. **Every API route re-checks the role.** `proxy.js` is a convenience guard,
   not the security boundary.
6. **Change DB via migration files.** Edit `supabase/schema.sql` for fresh
   installs *and* add `supabase/add-<thing>.sql` for existing databases.
7. **Validate on both sides.** AI output is validated in Python
   (`services/parser.py`) *and* re-validated in JS (`lib/mcq.js`). If you
   change question rules, update both.
8. **Secrets only in `.env*` files** (git-ignored). The only key the browser
   ever sees is none — Supabase is accessed server-side with the service-role
   key exclusively.
9. **Never call `toLocaleDateString()`/`toLocaleString()` in components** —
   server and browser locales differ and React throws a hydration mismatch.
   Always use `formatDate()` / `formatDateTime()` from `lib/format.js`
   (deterministic, Nepal time).
10. **UI conventions.** Icons come from `lucide-react` (never emoji in the app
    UI), the font is Plus Jakarta Sans via `next/font` in `app/layout.js`,
    motion/animation classes live in `app/globals.css` (`fade-in-up`,
    `card-lift`, `skeleton` — all respect `prefers-reduced-motion`), and
    loading states use skeleton blocks, not "Loading…" text. Slate/indigo is
    the design system — don't introduce new colors ad hoc.

## Working on the AI service

```bash
cd ai-service
source .venv/bin/activate
python3 -m pytest tests/ -v                  # 35 tests, must be green
python3 -m uvicorn app.main:app --port 8000 --reload
curl http://localhost:8000/health            # {"status":"ok","backend":...}
```

- Backend auto-detects: `AI_BACKEND` env wins; else Ollama if `OLLAMA_URL`
  reachable → Hugging Face if `HF_TOKEN` → mock (no setup, deterministic).
- **Add a new backend**: create `app/providers/<name>.py` implementing
  `BaseProvider.chat()` (return `None` on failure — never raise), register it
  in `app/providers/__init__.py`. Nothing else to touch.
- **Change a prompt**: edit `app/prompts.py` only.
- When the web app's local-AI URL points at this service, the app auto-detects
  it (via `/health`) and uses the dedicated `/edumock/*` endpoints.

## Verifying your changes (before you open a PR)

- **Web app:** restart it (fresh demo store), then run the end-to-end suite:
  `python3 scripts/e2e-check.py` — 63 checks covering auth, roles, parsing,
  grading, admin and page rendering. It must be 63/63.
- **AI service:** `npm run ai:test` — 35 pytest checks.

```bash
npm run build                    # must compile clean
cd ai-service && python3 -m pytest tests/ -v   # 35/35 must pass
./scripts/smoke-test.sh          # boots demo mode + mock AI + runs E2E flow
```

The smoke test covers: register/login for all roles, upload → AI parse,
create test → student takes it → grade → pass/fail vs passing %, AI explain,
admin user management, AI settings switching. Expect **~40 checks, 3 known
artifacts** (documented inside the script) — they are test-harness quirks,
not bugs.

## Deploying (free tier)

- **Web app**: push to GitHub → import to Vercel → set env vars → deploy.
- **AI service**: any always-on host near your model. With Ollama on the same
  machine it's fully free and unlimited. Set `SERVICE_API_KEY` if the service
  is reachable beyond localhost, and make sure `WEB_ORIGINS` includes your
  Vercel domain.
- **Supabase**: create project → run `supabase/schema.sql` in the SQL editor.

## FAQ

**I get "Invalid email or password" but the account exists.**
In the embedded preview iframe cookies are blocked — open the app in a real
browser tab. If it persists in a real tab, the demo store probably restarted
(seeded accounts are in-memory unless Supabase is configured).

**The AI is answering with mock/explanations look canned.**
No real backend is configured. Start Ollama (`ollama pull llama3.2:1b`) or set
`HF_TOKEN` in `ai-service/.env` — the `/health` endpoint tells you which
backend is live.

**A student saw the correct answers in the page source.**
That would be a real bug — see golden rule 4 and open an issue immediately.

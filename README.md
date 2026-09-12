# 🎓 Aimmers Nepal

A mock-test platform for schools (formerly *EduMock AI*): **teachers upload
question banks — PDFs, Word files, or even photos/scans of question papers —
students take timed mock tests, and an AI explains every answer** — with the
guarantee that questions are always asked **exactly as written** in the source.

Built to run **anywhere for free**: a **Next.js web app** (App Router,
JavaScript only) + a **Python AI microservice** (`ai-service/`), Supabase
Postgres, NextAuth credentials login. The web app deploys to Vercel's free
tier; the AI service runs next to your model (Ollama/Hugging Face) anywhere.

> 👥 **Working on this project?** Read [`docs/TEAM_GUIDE.md`](docs/TEAM_GUIDE.md)
> (developer onboarding) and [`CONTRIBUTING.md`](CONTRIBUTING.md) first — they
> cover the golden rules, the repo layout, and how to verify your changes.

---

## ✨ Features

| Area | What it does |
| --- | --- |
| **Auth** | One sign-in page for everyone. Students self-register; the admin adds/removes teachers, admins and students, and can change roles inline. Passwords hashed with bcrypt (12 rounds). JWT sessions via NextAuth v5. |
| **Question banks** | Teachers upload **PDF, DOCX, TXT/MD — or photos & scanned PDFs** (PNG/JPG/WEBP). Text files are parsed directly; photos and scans are **read by a vision-capable AI** that copies the questions out verbatim. **Hybrid extraction:** a deterministic detector finds the numbered questions and options **verbatim and instantly** (including the bare-letter `A Halved` / `B Doubled` format and distant `1. B` answer-key lists) — the AI is only asked to complete missing answer keys, one cheap call per 100 questions. Only when a layout is too unusual for the detector does the full AI parse run (large banks are parsed in ~9000-character chunks and merged). |
| **Mock tests** | Teacher picks **one or many question banks** (different subjects AND chapters — e.g. only "Chapter 2"), a question count (**1–100**, default 10), a time limit (max 180 min) and a **passing percentage**. Questions are chosen randomly, **balanced evenly across the selected banks** (10 questions from 2 banks → 5+5) and **duplicates across banks are skipped automatically**. Each question carries 1 mark. Teachers set how many **retakes** students get (1–10 or unlimited). |
| **Practice mode** | Any test can be published as a 🧪 **practice test**: unlimited retakes, clearly marked for students, and excluded from progress statistics. |
| **Notices** | Teachers post announcements (test schedules, reminders) — they appear on every student's dashboard. |
| **Review queue & editing** | Extracted questions land as *pending* — the teacher reviews them (edit text/options/answers, delete, fix AI mistakes) and approves before they can be used in tests. Photos/scans included. |
| **AI answer-key completion** | Bank has questions but no "Answer: B" lines? They're saved as drafts and the AI picks the best option — the teacher approves. The AI also receives the document's own answer-key lines as context when completing a key. |
| **Ask your materials** | Teachers ask plain questions ("what does the book say about magnetic flux?") and get answers **grounded in the uploaded banks** — BM25 retrieval (no external service, works offline) finds the passages and the AI answers only from them, citing the file each passage came from. Without an AI configured, the matching passages are listed on their own. |
| **Manual questions** | No file needed: create a manual bank and type questions directly, or mix manual + uploaded ones. |
| **Duplicate detection** | Exact duplicates across banks are flagged at extraction (and skipped when building tests). |
| **Scheduling** | Tests can have an availability window (e.g. Fri 5–8 PM) — enforced server-side, dashboard shows "Not open yet"/"Closed". |
| **CSV import** | Admin imports a whole class of students from a CSV (name, email, password) with per-row error reporting. |
| **Student progress** | Teachers see how each student is doing: tests taken, average score, pass rate, last activity — plus a full per-student attempt history. |
| **Grading & results** | Done **server-side** — correct answers never reach the browser before submission. Students see PASS/FAIL against the teacher's criteria; teachers see per-student passed/failed results for the class. |
| **AI explanations** | After submitting, students can request a short explanation for each question — from your **locally hosted model** (Ollama/LM Studio/llama.cpp) or Hugging Face. |
| **Assistant** | A little 🤖 helper in the bottom-right answers questions about the app (works for guests too, shows which AI is answering). |
| **Admin** | Add or remove anyone — students, teachers, admins — change roles inline in the accounts table, search/filter accounts, switch the AI provider from the dashboard, and **manage every uploaded file** (see who uploaded what, question counts, which tests use it — and delete any of them). |
| **Demo mode** | With **zero configuration** the app runs on an in-memory database with seeded accounts and a sample test — perfect for showing a client. |
| **Polished UI** | Plus Jakarta Sans (self-hosted, CSP-safe), crisp **lucide-react** icons everywhere, subtle fade-in/hover motion (respects `prefers-reduced-motion`), skeleton loading states and a confetti celebration when a student passes. |

## 🚀 Quick start (zero setup — Demo Mode)

```bash
npm install
npm run dev
```

Open http://localhost:3000 and sign in with any demo account:

| Role | Email | Password |
| --- | --- | --- |
| Admin | `mehulrakhecha@gmail.com` | `Admin@123` |
| Teacher | `tanisharakhecha2@gmail.com` | `Teacher@123` |
| Student | `student@edumock.local` | `Student@123` |

(The generic `admin@edumock.local` / `teacher@edumock.local` accounts also
exist with the same passwords, handy for testing.)

> Demo mode keeps everything in memory — data resets when the server restarts.
> An amber banner is shown while it is active.

**Optional, recommended:** also start the Python AI service (terminal 2):

```bash
npm run ai          # = cd ai-service && uvicorn app.main:app --port 8000
```

Then in the app: Admin → AI Settings → *Locally hosted model* →
`http://localhost:8000/v1` → **Test connection** → **Save**. Extraction,
explanations and the assistant now run through the Python service (mock
backend by default — see [`ai-service/README.md`](ai-service/README.md) to
plug in Ollama or Hugging Face).

## 🗄️ Switch to a real database (Supabase, free tier)

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor → New query**, paste the contents of
   [`supabase/schema.sql`](supabase/schema.sql) and **Run**.
3. Copy `.env.example` to `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL` — Project URL (Settings → API)
   - `SUPABASE_SERVICE_ROLE_KEY` — the **service_role** secret (Settings → API)
   - `AUTH_SECRET` — a long random string (e.g. from `openssl rand -base64 32`)
4. Create the first admin:

   ```bash
   npm run seed
   ```

5. Restart `npm run dev` — the amber banner should be gone.

**RLS note:** the schema enables Row Level Security on every table with **no
policies**, so the public anon key can access nothing. The app only talks to
Supabase from the server with the service-role key — never from the browser.
You do not need to write any RLS policies, and you should **not** disable RLS.

## 🧠 AI options — local model **or** Hugging Face, switchable by the admin

The AI is pluggable. **The admin chooses the provider at runtime from
Admin → AI Settings** (stored in the database — no redeploy, no code changes).
Environment variables act as the bootstrap defaults. Resolution priority:
**admin's choice → environment → built-in fallback**, with local taking
priority over Hugging Face in "Automatic" mode.

| Provider | How to enable | Best for |
| --- | --- | --- |
| **Python AI service** (recommended) | Run `ai-service/` (see Option A) + Admin → AI Settings → local `http://localhost:8000/v1` | Full control — all AI logic in one place, team-friendly, any backend behind it |
| **Local model** (self-hosted, direct) | Admin → AI Settings → *Locally hosted model* (or `AI_BASE_URL` env) | "Our own AI on our own server" — no cloud, no costs, unlimited — recommended for a whole class |
| **Hugging Face** (free tier) | Admin → AI Settings → *Hugging Face* (or `HUGGINGFACE_API_KEY` env) | Vercel deployments, short demos |
| **Built-in fallback** | nothing configured | instant demo, never breaks |

The settings page also has a **Test connection** button per provider and shows
exactly which AI is active (and whether that comes from the admin setting or
the environment). The assistant badge and `/api/health` reflect the choice too.

**Costs, honestly:** Hugging Face's free plan includes only ~$0.10/month of
inference credits with rate limits — fine for trying it and short demos; a
whole class needs HF PRO ($9/month) or, better, a locally hosted model which
is unlimited and free.

### Which model should I use?

**Hugging Face — nothing to download.** You never download a model there;
one access token reaches hosted models through HF's router. The defaults are
already wired in: `Qwen/Qwen2.5-7B-Instruct` (text) and
`Qwen/Qwen2.5-VL-72B-Instruct` (vision). Change them in Admin → AI Settings.
The hosted catalog **rotates** — if you ever see `HTTP 404`, the model you
picked was retired; choose another one from huggingface.co/models
(filter: Inference Providers).

**Local (Ollama) — download once with `ollama pull <tag>`:**

| Model tag | Download | Needs | Used for |
| --- | --- | --- | --- |
| `llama3.2:1b` *(default)* | ~1.3 GB | ~2 GB RAM | parsing text PDFs + explanations — runs on almost anything |
| `llama3.1:8b` or `qwen2.5:7b` | ~5 GB | 8 GB RAM | noticeably better parsing of messy/unusual layouts |
| `llama3.2-vision:11b` | ~7 GB | a GPU with 8 GB+ VRAM | **only needed** to read photos & scanned PDFs |

The model name in Admin → AI Settings must match the pulled tag exactly
(e.g. `llama3.1:8b`). Text PDFs never need the vision model.

### Option A — the Python AI service (recommended)

`ai-service/` is our own FastAPI microservice that owns **all AI logic**:
prompts, verbatim question parsing, provider calls. The web app auto-detects
it (via `/health`) and routes extraction/explanations/assistant to its
dedicated `/edumock/*` endpoints — with an OpenAI-compatible
`/v1/chat/completions` as the generic fallback.

```bash
cd ai-service
python3 -m venv .venv && source .venv/bin/activate    # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python3 -m uvicorn app.main:app --port 8000
```

```bash
curl http://localhost:8000/health   # shows which backend is live
```

The model backend auto-detects: `AI_BACKEND` env → Ollama (if reachable) →
Hugging Face (if `HF_TOKEN`) → mock (zero setup, deterministic — good for
demos and CI). Configure via `ai-service/.env` (copy `.env.example`) — see
[`ai-service/README.md`](ai-service/README.md) for the full API and tests.

Why a separate service? Your team can iterate on prompts, parsing and models
**without touching the web app** — and swap the entire AI stack by changing
one URL.

### Option B — point directly at a local model (Ollama, LM Studio, llama.cpp, vLLM…)

Anything exposing an **OpenAI-compatible API** works. With
[Ollama](https://ollama.com) (free, Windows/Mac/Linux):

```bash
ollama pull llama3.2:1b     # a light 1B model — fine for a demo server
ollama serve                # usually already running after install
```

Then either set it in `.env.local`:

```env
AI_BASE_URL=http://localhost:11434/v1
AI_MODEL=llama3.2:1b
```

…or skip the env file entirely: sign in as admin → **AI Settings** →
*Locally hosted model* → enter the URL + model → **Test connection** → **Save**.
The assistant badge, `/api/health` and the admin dashboard immediately show
**local AI · llama3.2:1b**. Bigger models (`qwen2.5:3b`, `mistral:7b`…)
extract questions more reliably if your server has the RAM.

> ⚠️ **Vercel note:** a model running on *your* machine isn't reachable from
> Vercel. Either run the whole app locally with a local model, host the model
> somewhere reachable (a VPS / school server / tunnel like ngrok or Tailscale)
> and point the settings/env at it, or use Hugging Face for the cloud
> deployment. If the chosen endpoint is unreachable, the app automatically
> falls back to the other provider (if configured) or built-in answers.

### Option C — Any free OpenAI-compatible cloud API (Mistral, Groq, Gemini, OpenRouter…)

The "Local model / other provider" card accepts ANY OpenAI-compatible
endpoint — paste the Base URL, model and API key in Admin → AI Settings:

| Provider | Base URL | Example model | Free tier |
| --- | --- | --- | --- |
| Mistral | `https://api.mistral.ai/v1` | `open-mistral-nemo` | ~1B tokens/mo, ~1 req/s (console.mistral.ai) |
| Groq | `https://api.groq.com/openai/v1` | `llama-3.3-70b-versatile` | free, very fast, no card (console.groq.com) |
| Google Gemini | `https://generativelanguage.googleapis.com/v1beta/openai` | `gemini-2.0-flash` | generous free tier (aistudio.google.com) |
| OpenRouter | `https://openrouter.ai/api/v1` | models marked `:free` | ~50 free requests/day |

"Test connection" shows the result right under the button, with the exact
HTTP error and what to do about it if anything is wrong.

### Option D — Hugging Face

1. Create a free token at <https://huggingface.co/settings/tokens>.
2. Either put it in `.env.local` as `HUGGINGFACE_API_KEY=hf_...`, or paste it
   straight into Admin → AI Settings → Hugging Face.
3. Restart (only needed for the env-file route).

Change the hosted model with `HF_MODEL` / the settings field
(default `mistralai/Mistral-7B-Instruct-v0.3`).

Without any provider everything still works — explanations and the assistant
fall back to built-in responses, and PDF parsing uses the deterministic
parser (which needs an answer key like `Answer: B` in the document).

## 📄 Question bank formats

**Text files (PDF, DOCX, TXT, MD)** — the parser understands the common
textbook layout:

```
1. What is the capital city of Nepal?
A) Pokhara
B) Kathmandu
C) Biratnagar
D) Lalitpur
Answer: B
```

Option labels can be **any consecutive letters** — `A) B) C) D)`, lowercase
`a) b) c) d)`, or even banks that label from other letters like
`(p) (q) (r) (s)`; answer keys written with those labels (`Answer: Q`,
`1. R`) are mapped automatically. The bare-letter layout (options with no
punctuation after the letter) and answer keys written elsewhere in the
document also work:

```
Q001 The pole strength of each piece will be:
A Halved
B Doubled
C One-fourth
D Same

… (more questions) …

ANSWER KEY
1. C
2. A
```

**Photos & scanned PDFs (PNG, JPG, WEBP)** — many real question banks are
pictures (math with diagrams, photographed papers). Upload them as-is: the
Python AI service renders the pages and a **vision-capable model reads the
questions straight from the images**, copying them verbatim. For real
extraction use a vision backend:

```bash
ollama pull llama3.2-vision:11b    # ~8 GB — needs a decent machine
```

Rules of thumb:

- Text files: number your questions (`1.` `2.` …) and options (`A)` `B)` …).
- Answer key line (`Answer: B`) is ideal but optional — without it questions
  are saved as drafts and the AI can complete the key for teacher review.
- Photos: clear, upright, one paper per photo works best. Max 10 MB per file.
- Scanned PDFs (no selectable text) are auto-detected and routed to vision.
- Upload **multiple files** — tag each with its subject (Math, Science…) and
  combine any of them into one balanced multi-subject test.

## ☁️ Deploy to Vercel (free)

> Full guide — including how the frontend, the API and the Python AI service
> fit together online — is in **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**.

1. Push this folder to a GitHub repo (make sure `.env.local` is **not**
   committed — it's in `.gitignore`).
2. [vercel.com](https://vercel.com) → **Add New → Project** → import the repo.
3. Framework preset: **Next.js** (auto-detected). No build settings needed.
4. Add the environment variables (`AUTH_SECRET`, `NEXT_PUBLIC_SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY`, `HUGGINGFACE_API_KEY`) in
   **Project → Settings → Environment Variables**.
5. Deploy. 🎉

> If you don't configure any variables, the deployed site simply runs in
> demo mode — handy for a client preview link.

## 🔒 Security checklist (what's already done)

- ✅ Secrets only in server-side env vars — no keys in client code
- ✅ Passwords hashed with **bcrypt (12 rounds)**, never stored/logged in plain text
- ✅ Role-based route protection in `proxy.js` **and** re-checked in every API route
- ✅ All inputs validated & sanitized (zod schemas + text cleaning)
- ✅ Grading server-side — students can't see correct answers before submitting
- ✅ Rate limiting on login, registration, uploads, AI endpoints
- ✅ Security headers (CSP, X-Frame-Options, nosniff, Referrer-Policy…)
- ✅ RLS enabled on all tables, no public policies, anon grants revoked
- ✅ `.env*` files git-ignored; `.env.example` documents every variable
- ✅ UUID validation on every `:id` route — malformed/injected ids get a clean 404
- ✅ Documents can only be deleted by the uploading teacher or an admin (shared use stays open)
- ✅ Brute-force protection: login is rate-limited (20 tries / 5 min / IP) — after the limit even the correct password is refused
- ✅ AI service: optional `SERVICE_API_KEY`, payload size caps on all endpoints, CORS allowlist
- ✅ Rate limiting on login, register, uploads, parse, submit, notices, CSV import, AI endpoints
- ✅ No account enumeration — registration answers identically (incl. timing) whether an email is new or taken
- ✅ No debug logging of sensitive data; `poweredByHeader` off

**If a secret ever leaked into git history** (e.g. you committed `.env` earlier):
rotate the secret (Supabase lets you regenerate the service key, HF tokens can
be revoked), then rewrite history with `git filter-repo` or start a fresh repo.

## 📁 Project structure

```
edumock-ai/
├── app/                            # ── WEB APP (Next.js, JavaScript only)
│   ├── page.js                     # Landing / role router ("Smart Hub")
│   ├── login/ register/            # Auth pages (one sign-in for all roles)
│   ├── unauthorized/               # 403 page
│   ├── teacher/                    # Dashboard, upload, tests + results
│   ├── student/                    # Dashboard + take-test UI
│   ├── admin/                      # Accounts management + AI settings (/admin/ai)
│   └── api/
│       ├── auth/[...nextauth]/     # NextAuth handlers
│       ├── auth/register/          # Student self-signup
│       ├── documents/              # Upload / list / delete + [id]/parse
│       ├── tests/                  # Create / list / take / submit
│       ├── attempts/               # History (role-aware)
│       ├── admin/users/            # Create / list / delete accounts
│       ├── admin/ai/               # AI provider settings + connection test
│       ├── ai/explain, ai/chat     # AI endpoints (with fallbacks)
│       └── health/                 # Mode + status
├── ai-service/                     # ── PYTHON AI MICROSERVICE (all AI logic)
│   ├── app/main.py                 # FastAPI endpoints (/health, /edumock/*, /v1/*)
│   ├── app/prompts.py              # ★ ALL LLM prompts in one file
│   ├── app/schemas.py              # Request/response models (API contract)
│   ├── app/providers/              # mock | ollama | huggingface | transformers
│   ├── app/services/               # parser (verbatim MCQs), explainer, assistant
│   └── tests/                      # pytest suite (22 tests)
├── public/logo.png                 # Aimmers Nepal logo (header, login, favicon)
├── components/                     # Header, SignOutButton, AssistantWidget
├── lib/                            # ── SERVER HELPERS (web app)
│   ├── auth.js / auth.config.js    # NextAuth (split for edge proxy)
│   ├── db.js                       # Mode switch: Supabase vs demo memory
│   ├── store-supabase.js           # Service-role queries (server only)
│   ├── store-memory.js             # Demo-mode store + seeds
│   ├── mcq.js                      # Verbatim MCQ parser (mirrors ai-service parser)
│   ├── ai.js                       # AI client: detects Python service, falls back
│   ├── pdf.js                      # PDF text extraction
│   ├── validators.js               # zod schemas + sanitization
│   └── rate-limit.js               # Sliding-window limiter
├── docs/                           # ── TEAM DOCUMENTATION
│   ├── TEAM_GUIDE.md               # Developer onboarding (read this first)
│   ├── ARCHITECTURE.md             # System map + design decisions
│   └── FINISH_GUIDE.md             # Fixing your original broken project
├── proxy.js                        # Next.js 16 route protection (was middleware.js)
├── supabase/schema.sql             # Fresh database schema (incl. app_settings)
├── supabase/add-*.sql              # Migrations if your DB predates a feature
│                                   #   (latest: add-image-files.sql — photo banks)
├── supabase/migrate-existing-db.sql# ALL migrations in ONE idempotent script — run this
│                                   #   if an old DB throws "column … does not exist"
├── scripts/seed.js                 # Creates the first admin
├── scripts/smoke-test.sh           # Full end-to-end verification
├── CONTRIBUTING.md                 # Rules + PR checklist for the team
└── .env.example                    # Every web-app variable, documented
```

## 🧭 Suggested demo script (for your client)

1. Open the site as a **guest** — landing page + assistant chat.
2. Sign in as the **teacher**: upload a PDF (tag it with subject + chapter) → *Extract questions* → create a test → post a notice about it.
3. Sign out, sign in as a **student**: take the test, watch the timer, submit,
   click *Explain with AI* on a question.
4. Sign in as **admin**: show account creation and class results.

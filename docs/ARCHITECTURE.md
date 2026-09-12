# Aimmers Nepal — Architecture

A visual map of the system for current and future developers.

## System overview

```
                        ┌──────────────────────────────────────────┐
                        │                 BROWSER                  │
                        │  Students / Teachers / Admin / Guests    │
                        └───────────────────┬──────────────────────┘
                                            │ HTTPS
                                            ▼
┌───────────────────────────────────────────────────────────────────────┐
│  WEB APP — Next.js 16 (JavaScript, App Router)   [Vercel, free tier] │
│                                                                       │
│  app/            pages & UI (login, teacher, student, admin)         │
│  app/api/        route handlers (auth, documents, tests, admin, ai)  │
│  proxy.js        edge route protection (role rules)                  │
│  lib/            auth, db, validators, rate-limit, ai client         │
└────────────┬──────────────────────────────────┬─────────────────────┘
             │                                  │
             │  service-role key                │  AI_BASE_URL / admin setting
             │  (server only, never browser)    │  (http://<host>:8000/v1)
             ▼                                  ▼
┌────────────────────────────┐    ┌────────────────────────────────────┐
│  SUPABASE (Postgres)       │    │  AI SERVICE — Python / FastAPI     │
│  [Supabase, free tier]     │    │  ai-service/   [any host]          │
│                            │    │                                    │
│  users, pdf_documents,     │    │  /edumock/parse-questions          │
│  questions, tests,         │    │  /edumock/explain                  │
│  test_attempts,            │    │  /edumock/chat                     │
│  attempt_answers,          │    │  /v1/chat/completions  (OpenAI-compatible)
│  app_settings              │    │                                    │
│                            │    │  providers: mock | ollama |        │
│  RLS ON, zero policies —   │    │  huggingface | transformers        │
│  only the server can talk  │    │  (swap via env vars only)          │
└────────────────────────────┘    └──────────────┬─────────────────────┘
                                                 │
                                    ┌────────────┴────────────┐
                                    ▼                         ▼
                          ┌──────────────────┐    ┌─────────────────────┐
                          │ Ollama (local,   │    │ Hugging Face API    │
                          │ free, unlimited) │    │ (free tier / PRO)   │
                          └──────────────────┘    └─────────────────────┘
```

## Key design decisions (and why)

| Decision | Why |
| --- | --- |
| **One Next.js app for everything web** | One free deployment, one language for the web layer, no CORS between our own services. |
| **AI as a separate Python microservice** | All AI logic (prompts, parsing, validation, model choice) lives in `ai-service/` — the team can update AI behaviour without touching the web app, and vice versa. |
| **OpenAI-compatible interface** | The web app treats the AI service like any OpenAI-compatible server, so you can swap the whole service for Ollama/LM Studio/vLLM by changing one URL. |
| **Smart-endpoint auto-detection** | When the web app's "local AI" URL points at our Python service (detected via `/health`), parsing/explanations/assistant route to the dedicated `/edumock/*` endpoints automatically. No config flag needed. |
| **Demo mode** | With zero env vars the app runs on an in-memory seeded database — anyone can clone and `npm run dev` instantly. |
| **RLS on, zero policies, service-role only** | The browser never talks to Supabase directly, so there are no RLS policies to maintain and no anon-key leaks to worry about. |
| **Server-side grading & answer hiding** | Correct answers never reach the browser before submission. |

## Data flow: the life of a test

```
1. TEACHER uploads a bank       app/api/documents (POST)
      │                         PDF/DOCX/TXT -> text extracted
      │                         photo/scan  -> bytes kept for AI vision
      ▼                         stored in pdf_documents (subject-tagged)
2. "Extract questions"          app/api/documents/[id]/parse
      │                         └─> AI service /edumock/parse-questions
      │                         └─> photos/scans: /edumock/parse-vision
      │                             (LLM copies questions VERBATIM → JSON,
      │                              validated on BOTH sides)
      ▼                         stored in questions (stable IDs)
3. TEACHER creates the test     app/api/tests (POST)
      │                         1–100 questions, timer, passing %,
      │                         balanced round-robin across selected banks
      ▼                         stored in tests (question_ids order kept)
4. STUDENT takes the test       app/api/tests/[id] (answers stripped!)
      │                         countdown timer, auto-submit
      ▼
5. SUBMIT                       app/api/tests/[id]/submit
      │                         graded server-side, 1 mark per question,
      │                         PASSED/FAILED vs teacher's criteria
      ▼                         stored in test_attempts + attempt_answers
6. AI EXPLANATIONS              app/api/ai/explain
      │                         └─> AI service /edumock/explain
      ▼
7. TEACHER reviews results      /teacher/tests/[id] — who passed/failed,
                                class average, per-question answer key
```

## Provider resolution (web app side)

`lib/ai.js → resolveProvider()`:

1. **Admin's saved choice** (Admin → AI Settings, stored in `app_settings`):
   `local` → use the saved local URL/model · `huggingface` → saved key/model ·
   `auto` → fall through to environment
2. **Environment**: `AI_BASE_URL` (local/OpenAI-compatible) has priority over
   `HUGGINGFACE_API_KEY`
3. **Nothing configured** → built-in deterministic fallback (demo never breaks)

If the chosen provider fails at request time, the app tries the other one,
then falls back — a dead AI never breaks a class test.

## Authentication model

- NextAuth v5 (Auth.js) with credentials login; passwords hashed with bcrypt (12 rounds).
- JWT session cookie carries `id`, `email`, `role` (STUDENT / TEACHER / ADMIN).
- **Every page is guarded twice**: `proxy.js` (edge, fast redirect) *and* each
  API route re-checks the role server-side. Never rely on the proxy alone.
- Role changes require sign-out/sign-in (role is inside the JWT).

## Where the code lives (quick map)

| I want to… | File(s) |
| --- | --- |
| Change an AI prompt | `ai-service/app/prompts.py` (one file, all prompts) |
| Switch AI backend / model | `ai-service/.env` (`AI_BACKEND`, `OLLAMA_MODEL`, …) |
| Add a new AI backend | new file in `ai-service/app/providers/` + register in `__init__.py` |
| Change validation rules for questions | `ai-service/app/services/parser.py` **and** `lib/mcq.js` (keep in sync) |
| Add/modify an API endpoint | `app/api/<route>/route.js` (+ validators in `lib/validators.js`) |
| Add a page | `app/<folder>/page.js` |
| Change role rules | `proxy.js` + re-check inside the route/page |
| Change the database | `supabase/schema.sql` + a migration file `supabase/add-*.sql` |
| Adjust rate limits | `lib/rate-limit.js` |

See `docs/TEAM_GUIDE.md` for the full developer handbook.

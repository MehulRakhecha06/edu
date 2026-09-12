# 🏁 How to finish YOUR project with this code

> 📌 **2025 update — the AI now has its own Python service.** This guide
> originally said "no Python needed". That changed: all AI logic now lives in
> the **`ai-service/` folder** (a small FastAPI microservice that comes with
> this repo). The **old `backend/` folder from your original project is still
> obsolete** — do not copy it back. Everything else in this guide still
> applies. See *"Step 3¾ — the Python AI service"* below.

This guide takes you from the state your `edumock-ai` folder is in right now
(mixed `.ts/.tsx/.js` files, deleted dashboards, login redirecting to a
missing `/dashboard`, RLS disabled in Supabase) to a **finished, working,
deployable app**.

---

## What was actually wrong (so you can explain it to your client/teacher)

1. **Two auth systems were mixed.** Your login used **NextAuth**
   (`lib/auth.ts` + bcrypt + the `users` table), but the dashboards checked
   **Supabase Auth** (`supabase.auth.getSession()`). A NextAuth login never
   creates a Supabase session, so the "Smart Hub" always bounced you back to
   the login page — that was the loop you couldn't get out of.
2. **The login redirected to `/dashboard`**, a page you deleted → 404.
3. **Middleware vs proxy.** Next.js 16 renamed `middleware.js` to `proxy.js`
   (and the export to `proxy`). That caused the
   *"Middleware must export a `middleware` or default function"* error.
4. **TypeScript files kept breaking** because parts of the project assumed TS.
5. **RLS got disabled** to make queries work — that's a security hole.

This rebuild fixes all of it: **one** auth system (NextAuth), strict
JavaScript only, `proxy.js` written for Next.js 16, and Supabase accessed
**only from the server** with the service-role key — so RLS can stay enabled
and you never fight it again.

---

## Step 1 — Replace your local project

> You don't need the old `backend/` (Python) folder anymore — but keep the new
> **`ai-service/` folder** that comes with this repo: it's the home of all AI
> logic (prompts, parsing, model calls). The web app itself (PDF handling,
> grading, everything else) still runs entirely inside Next.js — that's what
> lets it deploy free on Vercel with one click.

1. In `C:\Users\TUF\OneDrive\Desktop\vs code\edumock-ai`, **delete** the old
   app files (or safer: rename the whole folder to `edumock-old` and create a
   fresh `edumock-ai` folder).
2. Copy **all files from this project** into the new `edumock-ai` folder.
   Do **not** copy `node_modules` or `.next` — you'll install fresh.
3. Open the folder in VS Code and run:

   ```powershell
   npm install
   npm run dev
   ```

4. Open http://localhost:3000 — you are in **Demo Mode** (amber banner).
   Sign in with `teacher@edumock.local / Teacher@123` and try everything:
   upload a PDF, extract questions, create a test, take it as a student.
   **No database needed for this.**

## Step 2 — Re-wire your Supabase (5 minutes)

Your Supabase project already exists; we just clean the tables and enable RLS.

1. Supabase Dashboard → **SQL Editor → New query**.
2. Paste `supabase/schema.sql` from this project.
3. **Important:** it contains a commented-out `DROP TABLE ... CASCADE` block at
   the top. **Uncomment it** (remove the leading `--` on those two lines) so
   your old messy tables (`users`, `pdf_documents`, `questions`, `profiles`,
   …) are wiped first, then run the query.
4. In the same project go to **Settings → API** and copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **service_role** key (secret!) → `SUPABASE_SERVICE_ROLE_KEY`

## Step 3 — Create your `.env.local`

In the project root, create `.env.local`:

```env
AUTH_SECRET=paste-a-long-random-string-here
NEXT_PUBLIC_SUPABASE_URL=your-project-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
HUGGINGFACE_API_KEY=hf_your_free_token
```

- Generate `AUTH_SECRET` in PowerShell:
  `[Convert]::ToBase64String((1..32|%{Get-Random -Maximum 256}))`
- Free HF token: https://huggingface.co/settings/tokens
- Everything except `AUTH_SECRET` is optional — but with Supabase set you get
  real, persistent data.

Then create your admin and restart:

```powershell
npm run seed
# then Ctrl+C and:
npm run dev
```

The amber banner should be gone. Sign in with your admin email and the
password you set (`SEED_ADMIN_PASSWORD` in `.env.local`, or the default
`ChangeMeImmediately!` — change it!).

## Step 3½ — Later: host the AI locally ("our own AI on our own server")

**Recommended: run our Python AI service** (see Step 3¾) and point the app at
it — it's already written for you and keeps all AI logic in one place.

The app also supports **any** OpenAI-compatible server out of the box —
**the admin switches AI providers at runtime from the dashboard**
(Admin → AI Settings): choose *Locally hosted model* or *Hugging Face*, enter
the details, hit **Test connection**, save. No code changes, no redeploy.
Anything OpenAI-compatible works (Ollama, LM Studio, llama.cpp, vLLM).
With Ollama for example:

```powershell
# one-time setup on your server/PC
ollama pull llama3.2:1b
```

Then in the app: sign in as admin → **AI Settings** → select *Locally hosted
model* → Base URL `http://localhost:11434/v1`, model `llama3.2:1b` →
**Test connection** → **Save**. Question extraction, answer explanations and
the bottom-right assistant now use **your** model (the assistant badge shows
"local AI · llama3.2:1b"). If your local server is unreachable it
automatically falls back to Hugging Face (if a key is set) or built-in answers.

> 💡 The same page answers "is Hugging Face free?": its free plan only has
> ~$0.10/month of inference credits (rate-limited) — fine for demos, not for
> a whole class. The local model is unlimited and free; HF PRO is $9/month.

> ⚠️ **If you set up your database before these updates:** run the
> migration files once in the Supabase SQL editor:
> `supabase/add-ai-settings.sql` (admin AI provider choice),
> `supabase/add-subjects-passing.sql` (subjects, multi-bank tests, passing
> criteria) and `supabase/add-image-files.sql` (photo/scanned question banks).
> Fresh installs that run the latest `supabase/schema.sql` already
> have everything.

> Vercel can't reach a model on your home/school PC. For the cloud deployment
> either keep Hugging Face, or host the model somewhere reachable and point
> the AI Settings at that URL. Full details in the README section "🧠 AI options".

## Step 3¾ — The Python AI service (recommended AI setup)

All AI logic (prompts, question parsing, model calls) lives in `ai-service/` —
a small FastAPI microservice. It's optional (the web app works without it) but
it's the professional setup: your team can update AI behaviour without
touching the web app.

```bash
cd ai-service
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python3 -m uvicorn app.main:app --port 8000
```

Then in the app: sign in as admin → **AI Settings** → *Locally hosted model*
→ Base URL `http://localhost:8000/v1` → **Test connection**. You should see
*"EduMock Python AI service v1.0.0 detected"* — question extraction,
explanations and the assistant now all go through Python.

**Which model does it use?** Auto-detected, easiest first:
`AI_BACKEND` env var (if set) → Ollama if running → Hugging Face if
`HF_TOKEN` set → **mock** (built-in, zero setup — fine for demos).
To use a real model, create `ai-service/.env` (copy from `.env.example`):

```env
AI_BACKEND=ollama            # or huggingface | transformers | mock
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2:1b
# or:
# AI_BACKEND=huggingface
# HF_TOKEN=hf_your_token
```

Restart the service and check `http://localhost:8000/health` — it tells you
which backend is live. If the service is ever down, the web app automatically
falls back, so a class test never breaks.

Deploying it: the service must run somewhere always-on (a VPS, school server,
or free-tier host like Render/Fly). Set `SERVICE_API_KEY` there if it's
reachable beyond localhost, then point AI Settings at
`https://your-service-host/v1`.

## Step 4 — Deploy to Vercel

1. Push the folder to GitHub. **Check first** that `.env.local` is NOT in the
   repo: `git status` should not list it (`.gitignore` already excludes it).
2. vercel.com → **Add New → Project** → import the repo.
3. Add the same four environment variables in
   **Settings → Environment Variables**.
4. Deploy → you get a live `https://your-app.vercel.app` link to send to your
   client.

> Optional: point a custom domain in Vercel → Settings → Domains.

## Step 5 — Old secrets hygiene

- If you **ever committed** `.env` or keys to git in the old project: rotate
  them (regenerate the Supabase service key, revoke the HF token) — git
  history keeps old versions forever.
- The old repo probably contains the old keys — since you're starting a fresh
  folder/repo anyway, just don't reuse those secrets.

---

## Changing someone's role

The sign-in page is the same for everyone — what a user can do is decided by
the `role` value (`STUDENT` / `TEACHER` / `ADMIN`).

**Easiest way:** Admin → **All accounts** table → pick a new role in the row's
dropdown → confirm. The admin can add or remove students, teachers, and other
admins the same way (Add an account form + Delete buttons).

**Via the database** (no UI needed):

```sql
-- Supabase Dashboard -> SQL Editor
UPDATE users SET role = 'TEACHER' WHERE email = 'someone@school.edu';
UPDATE users SET role = 'ADMIN'   WHERE email = 'you@school.edu';
```

> ⚠️ The role is baked into the login session (JWT), so the user must
> **sign out and sign in again** after the change for it to take effect.
> New accounts can also be inserted via SQL, but their password must be a
> bcrypt hash — creating accounts from the Admin page (or `npm run seed` for
> the first admin) handles that for you automatically.

## Quick reference — demo accounts

| Mode | Where | Accounts |
| --- | --- | --- |
| Demo (no env) | automatic | `mehulrakhecha@gmail.com / Admin@123` (admin) · `tanisharakhecha2@gmail.com / Teacher@123` (teacher) · `student@edumock.local / Student@123` (student) |
| Supabase | `npm run seed` creates the admin | `.env.local` presets `SEED_ADMIN_EMAIL=mehulrakhecha@gmail.com` — set the password there, then create the teacher from the Admin page |

## Common errors and the fix

| Error you saw before | Why | Fix (already done here) |
| --- | --- | --- |
| `GET /dashboard 404` after login | login pointed at a deleted page | login now goes to `/`, which routes by role |
| back to `/login` after signing in | dashboards used `supabase.auth.getSession()` but login was NextAuth | everything uses NextAuth's session now |
| `Middleware must export a 'middleware' or 'default' function` | Next 16 renamed it | the file is `proxy.js` at the project root |
| `Expected ',', got '!'` in `client.js` | TypeScript `!` syntax in a `.js` file | project is 100% JavaScript |
| `column pdf_documents.created_at does not exist` | wrong column name | schema + code agree (`uploaded_at`) |
| data only visible with RLS off | client used the anon key | server uses the service-role key; RLS stays ON |
| `[auth][error] JWTSessionError` on every page | the browser holds a session cookie signed with a *different* secret than the server is using now (you added/changed `AUTH_SECRET`, or switched demo ↔ Supabase mode) | harmless — the user is just treated as signed out. Set ONE permanent `AUTH_SECRET` in `.env.local`, restart, and sign out+in once (or clear the site's cookies) |
| `No multiple-choice questions found` on a big PDF | old builds only sent the first 9,000 characters to the AI — big banks never reached the questions | fixed: parsing is chunked (whole file, ~9K at a time) and the parser understands `(1)…(4)` options; books with unusual layouts still need the AI running (`npm run ai` + a model) |
| "Ask your materials" replies with a passage list instead of an AI answer | no AI provider is active (mock backend is deliberately ignored) — the passages are still the real search results | configure Ollama or a HF token in Admin → AI Settings for AI-written answers |
| `[ai] huggingface provider failed (an HTTP error occurred…)` | the default HF model was retired from the Inference Providers catalog (the lineup rotates), or credits/token issues — the app now reports the exact HTTP status and hint | pick a served model (Admin → AI Settings / `HF_MODEL=Qwen/Qwen2.5-7B-Instruct`) |
| `[ai] local provider failed … HTTP 401` while the AI service clearly runs | the service has `SERVICE_API_KEY` set in `ai-service/.env`, but the web app sends no key (or a different one). `/health` is unprotected, so the health check looks fine | either empty the `SERVICE_API_KEY` line (fine on localhost) or set the same value as `AI_API_KEY` in the web app\'s `.env.local`; restart whichever side you changed |
| `[auth][error] MissingSecret` | Supabase mode is on but `AUTH_SECRET` is not set | add `AUTH_SECRET=<long random string>` to `.env.local` and restart (the app now prints this exact advice at startup) |

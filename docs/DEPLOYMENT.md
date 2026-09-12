# Deployment — how the pieces fit together

```
                    GitHub (one repo: "tution")
                    stores the code, runs nothing
                              │
            ┌─────────────────┴──────────────────┐
            ▼                                    ▼
   ┌─────────────────┐                 ┌─────────────────┐
   │  VERCEL (free)  │                 │     SUPABASE    │
   │  runs the web   │◄─── talks ─────►│   (free tier)   │
   │  app AND its    │     server-side │  the database   │
   │  API routes     │                 │                 │
   └─────────────────┘                 └─────────────────┘
            │
            ▼  (only when the AI is Hugging Face)
     huggingface.co API  — called directly, no extra host

   ┌─────────────────────────────────────────────────────┐
   │  OPTIONAL, LATER: your own machine (school PC/VPS)  │
   │  npm run ai  (Python AI service)  +  Ollama model   │
   │  → unlimited, free, private — admin switches the    │
   │    provider on /admin/ai, no redeploy needed        │
   └─────────────────────────────────────────────────────┘
```

## The mental model

**"Frontend and backend" in this project means three things, not two:**

| Piece | What it is | Where it runs online |
| --- | --- | --- |
| Web app (pages) | Next.js in the repo root | **Vercel** — free |
| App API (`app/api/**`) | Login, uploads, grading — part of the SAME Next.js app | **Vercel** — deploys together with the pages automatically, nothing extra to do |
| AI service (`ai-service/`) | Python FastAPI — prompts/parsing | **Not needed online** if the AI provider is Hugging Face (the app calls HF directly). Run it locally when you switch to a local model |

That third row is the one that surprises people: the Python service is the *local-model* path. It's designed to sit next to Ollama on an always-on machine. Online, pick Hugging Face in **Admin → AI Settings** and the service stays dormant in the repo.

## One repo or two?

**One repo (what we have).** The Next.js app is at the root and `ai-service/` is a subfolder — Vercel auto-detects the root app and ignores the Python folder; Render/Railway can build `ai-service/` later by setting its *Root Directory* (no repo split needed). For a team of a few people, a monorepo means one clone, one `npm install`, one place for docs.

## Step-by-step: put it online (≈15 minutes, all free)

### 1. Push to GitHub
```bash
cd edumock-ai
git init
git add .
git commit -m "EduMock AI — web app + Python AI service"
git remote add origin https://github.com/<you>/tution.git
git push -u origin main
```
`.env.local` is in `.gitignore` — secrets never leave your machine.

### 2. Database — Supabase
1. [supabase.com](https://supabase.com) → New project (free).
2. SQL Editor → run `supabase/schema.sql` (fresh database — all tables created).
   Existing old database? Run `supabase/migrate-existing-db.sql` instead.
3. Settings → API → copy the **Project URL** and **service_role key**.
   (The anon/publishable key is NOT used by this app.)

### 3. Web app — Vercel
1. [vercel.com](https://vercel.com) → **Add New → Project** → import the `tution` repo.
2. Framework: Next.js (auto-detected). Leave build settings alone.
3. Settings → Environment Variables:
   | Name | Value |
   | --- | --- |
   | `AUTH_SECRET` | long random string (`node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`) |
   | `NEXT_PUBLIC_SUPABASE_URL` | from Supabase step 2 |
   | `SUPABASE_SERVICE_ROLE_KEY` | from Supabase step 2 |
   | `HUGGINGFACE_API_KEY` | optional — only for the HF AI path |
4. Deploy. Every future `git push` auto-deploys.

Students now use `https://your-app.vercel.app`. Demo accounts do NOT exist in
Supabase mode — create real ones: sign up a student normally; admin/teacher
accounts via the seeded admin or directly in Supabase (see FINISH_GUIDE).

### 4. AI — pick one
- **Hugging Face (online, zero extra hosting):** paste a key on **Admin → AI
  Settings**. Free tier ≈ demo-level usage — fine to try, rate-limited.
- **Local model (school PC / VPS, unlimited + free):** on that machine run
  `npm run ai` + Ollama; then on **Admin → AI Settings** set the local base
  URL to `http://<machine-ip>:8000/v1`. The Vercel app calls it — the machine
  must stay on and reachable. (Tailscale/Cloudflare Tunnel works if the IP
  isn't public.)

## Managing it as a team

| I changed… | What happens |
| --- | --- |
| Pages / API routes (`app/**`) | push → Vercel redeploys the whole app |
| `ai-service/**` | nothing online (it runs where the model runs) — restart it on that machine |
| `supabase/schema.sql` | only affects FRESH databases — also add a `supabase/add-*.sql` and run it in the SQL Editor for the live DB |
| docs | nothing to deploy |

Golden rule: the **live database changes only through SQL files run in the
Supabase SQL Editor** — never by clicking around the table editor, or the repo
and reality drift apart.

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| Deployed site shows demo accounts | Supabase env vars missing on Vercel → app fell back to demo mode |
| `JWTSessionError` after changing `AUTH_SECRET` | expected once — sign out/in (see FINISH_GUIDE) |
| Big PDF parse times out on Vercel (~60s function limit) | run that bank locally with `npm run ai`, or split the PDF |
| AI settings test says service not reachable | the Python service isn't running on the machine you pointed at |

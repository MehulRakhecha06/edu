# Contributing to EduMock AI

Thanks for helping! This file is the 2-minute version of
[`docs/TEAM_GUIDE.md`](docs/TEAM_GUIDE.md) — read that for the full picture.

## Setup

```bash
npm install
npm run dev                          # web app on :3000 (demo mode, no keys needed)

cd ai-service
pip install -r requirements.txt
python3 -m uvicorn app.main:app --port 8000 --reload    # optional, :8000
```

## The rules that matter most

1. **Web app is JavaScript only** (`.js`/`.jsx`). Python only inside `ai-service/`.
2. **All AI logic goes in the Python service** — prompts in
   `ai-service/app/prompts.py`, parsing in `ai-service/app/services/parser.py`.
   `lib/ai.js` is a client, not a home for AI logic.
3. **Questions are copied VERBATIM from the PDF** — the LLM never invents or
   rewords questions. Non-negotiable client requirement.
4. **Correct answers never reach the browser before submission.**
5. **Every API route re-checks the caller's role** — `proxy.js` is not the
   security boundary.
6. **DB changes = edit `supabase/schema.sql` + add a `supabase/add-*.sql`
   migration** for existing databases.
7. **Question validation rules live twice** (Python `services/parser.py` +
   JS `lib/mcq.js`) — change them together.
8. Secrets stay in `.env*` (git-ignored). Never commit keys.

## Before you open a pull request

```bash
npm run build                                  # clean compile
cd ai-service && python3 -m pytest tests/ -v   # 35/35 green
./scripts/smoke-test.sh                        # E2E flow green (3 known artifacts OK)
```

- Conventional commits help reviews: `feat:`, `fix:`, `docs:`, `chore:`.
- Keep PRs small and described in plain language — reviewers may be junior.
- Screenshots/GIFs for any UI change.

## Adding things (quick pointers)

| Adding… | Do this |
| --- | --- |
| An AI backend | new `ai-service/app/providers/<name>.py` (implement `chat()`, return `None` on failure) + register in `providers/__init__.py` |
| A prompt change | edit `ai-service/app/prompts.py` only |
| An API endpoint | `app/api/<route>/route.js` + validation in `lib/validators.js` + role check inside the route |
| A page | `app/<folder>/page.js` (+ add to `proxy.js` if role-restricted) |
| A test | add checks to `scripts/e2e-check.py` (restart the app first — the demo store must be fresh) |
| An icon | import it from `lucide-react` — don't paste emoji into the UI |
| Motion / loading | reuse the classes in `app/globals.css` (`card-lift`, `fade-in-up`, `skeleton`) |
| A DB column | `supabase/schema.sql` + `supabase/add-<thing>.sql` + both stores (`lib/store-*.js`) |

## Getting help

Check `docs/TEAM_GUIDE.md` (FAQ at the bottom) and `docs/ARCHITECTURE.md`
(system map) first. If you're stuck for more than 30 minutes, ask — nobody
expects you to reverse-engineer intent.

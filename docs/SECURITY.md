# Security model — Aimmers Nepal

A short map of WHAT protects WHAT, for reviewers and new developers.

## Trust boundaries

```
Browser (untrusted)  →  Next.js server (trusted)  →  Supabase (service-role key)
                                             ↘  Python AI service (semi-trusted, own key)
```

The browser NEVER talks to Supabase or the AI service directly. RLS is enabled
on every table with zero policies — the anon key can do nothing, and the
service-role key lives only in server env vars.

## Controls in place

| Threat | Control |
| --- | --- |
| Password brute force | `lib/rate-limit.js` — 20 login attempts / 5 min / IP, enforced inside the NextAuth `authorize()` (refuses even correct passwords once tripped) |
| Unauthorized access | Every API route re-checks the session role — `proxy.js` is only the first layer |
| Object guessing / IDOR | UUID ids; every `:id` route validates the format (`isUuid`) → 404; documents can be deleted only by their uploader or an admin |
| SQL injection | No raw SQL anywhere — parameterized queries via Supabase client; ids validated |
| XSS | React auto-escaping; no `dangerouslySetInnerHTML` in the codebase; strict CSP (`script-src 'self'`) |
| Clickjacking | `X-Frame-Options: DENY` + `frame-ancestors 'none'` (headers in `next.config.mjs`) |
| Answer leaking | Correct answers are stripped server-side from every student-facing response; grading happens only in `submit` |
| Account enumeration | Registration returns an identical response (status, body and timing) whether the email is new or already taken; login errors are generic. Admin-side flows report duplicates explicitly — trusted role |
| Malicious uploads | Extension + MIME + magic-byte checks, 10 MB cap, no SVG/HTML, PDF/DOCX parsed (never executed), images re-validated in the AI service |
| Oversized AI payloads | Pydantic caps on the service (`max_length` everywhere), zod caps in the app |
| Secret leakage | Secrets only in `.env*` (git-ignored); no keys in client bundles; `poweredByHeader` off |
| DoS-ish abuse | Rate limits on login, register, uploads, parse, submit, notices, CSV import, AI endpoints; in-memory buckets with auto-cleanup |

## Known limitations (honest list)

- **Rate limits are per server instance** (in-memory). On Vercel serverless the
  limits hold per warm lambda — good enough for a school; for stronger limits
  swap in Upstash Redis (same interface in `lib/rate-limit.js`).
- `/api/health` publicly shows the mode + active AI provider name (no secrets).
  Used by the UI; acceptable for now.
- No password reset by email yet — the admin resets passwords manually.

## If a secret leaks

Rotate it (Supabase: regenerate service key; HF: revoke token), update
`.env.local` + Vercel env vars. See README → "Security checklist".

# 🧠 Aimmers Nepal — AI service (Python)

All AI logic for the Aimmers Nepal app lives here: **prompts, verbatim
question parsing (text AND images), provider calls, fallbacks.** The Next.js
web app calls this service over HTTP; nothing AI-related lives in the web app.

```
┌────────────┐   HTTP (OpenAI-compatible + /edumock/*)   ┌─────────────┐
│  Next.js   │ ─────────────────────────────────────────▶ │  ai-service │ ──▶ Ollama / HF / …
│  web app   │ ◀───────────────────────────────────────── │  (this)     │
└────────────┘            JSON responses                  └─────────────┘
```

## Quick start

```bash
cd ai-service
python3 -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python3 -m uvicorn app.main:app --port 8000 --reload
```

(From the repo root you can also use `npm run ai`.)

No configuration needed for development — the service auto-selects the
**mock** backend (deterministic, instant, offline).

Then point the web app at it: **Admin → AI Settings → Locally hosted model →
`http://localhost:8000/v1` → Test connection**. The web app auto-detects the
service and routes extraction/explanations/assistant to the `/edumock/*`
endpoints.

## Choosing a real backend

Copy `.env.example` → `.env` and set **one** of these:

| Backend | Env vars | Notes |
| --- | --- | --- |
| `mock` *(default)* | — | Deterministic answers, zero setup. For demos/CI. |
| `ollama` | `OLLAMA_URL` (default `http://localhost:11434`), `OLLAMA_MODEL` (default `llama3.2:1b`) | **Recommended** — free, unlimited, private. `ollama pull llama3.2:1b` |
| `huggingface` | `HF_TOKEN`, `HF_MODEL` (default `mistralai/Mistral-7B-Instruct-v0.3`) | Free tier ≈ $0.10/mo credits — demos only. |
| `transformers` | `TRANSFORMERS_MODEL` (default `HuggingFaceTB/SmolLM2-1.7B-Instruct`) | Runs the model in-process (needs `pip install transformers torch`) — heavy, no HTTP hop. |

Leave `AI_BACKEND` empty to **auto-detect**: Ollama reachable → ollama;
`HF_TOKEN` set → huggingface; otherwise mock.
`GET /health` always tells you what's live.

Other settings: `SERVICE_API_KEY` (require `Authorization: Bearer <key>` or
`x-api-key` on everything except `/health`), `WEB_ORIGINS` (CORS),
`AI_TIMEOUT_SECONDS`, `PARSER_MAX_CHARS`.

## API

Interactive docs run at **http://localhost:8000/docs** (Swagger UI).

| Endpoint | Body | Returns |
| --- | --- | --- |
| `GET /health` | — | `{status, service, version, backend, model}` — used by the web app for auto-detection |
| `POST /edumock/parse-questions` | `{text}` — raw PDF text | `{questions: [{question_text, options, correct_answer}], count, source}` — questions copied **verbatim** |
| `POST /edumock/parse-vision` | `{content, mime}` — base64 image or scanned PDF | same shape — questions read from the pictures, copied **verbatim** |
| `POST /edumock/answer-key` | `{questions: [{question_text, options}]}` | `{answers: [{index, correct_answer}], source}` — AI picks the best option |
| `POST /edumock/explain` | `{question, options, correct_answer}` | `{explanation, source}` |
| `POST /edumock/chat` | `{message, history: [{role, content}]}` | `{reply, source}` — the in-app assistant |
| `POST /v1/chat/completions` | OpenAI-shaped request | OpenAI-shaped response (no streaming — `stream:true` → 400) |

`source` tells you what answered: `mock`, `ollama:llama3.2:1b`,
`huggingface:…`, or `fallback` (template answer when the model fails — the
service never raises on model errors).

## The verbatim rule (important!)

The client requirement: **questions must be asked exactly as written in the
PDF.** The LLM is only allowed to *extract* and *explain*, never reword or
invent. This rule is baked into every prompt in `app/prompts.py`, enforced by
the parser in `app/services/parser.py`, and re-validated by the web app
(`lib/mcq.js`). If you touch any of these, keep the rule intact.

## Project layout

```
ai-service/
├── app/
│   ├── main.py            FastAPI app + all endpoints (factory: create_app)
│   ├── config.py          Settings from env vars, backend auto-detection
│   ├── prompts.py         ★ ALL LLM prompts — change AI wording HERE
│   ├── schemas.py         Pydantic models = the public API contract
│   ├── providers/         one file per backend, pluggable:
│   │   ├── base.py        BaseProvider ABC — chat() returns None on failure
│   │   ├── mock.py ollama.py huggingface.py transformers_backend.py
│   │   └── __init__.py    get_provider() factory — register new backends here
│   └── services/
│       ├── parser.py      JSON extraction + question validation (mirrors lib/mcq.js)
│       ├── explainer.py   explanation + template fallback
│       ├── assistant.py   assistant reply + keyword fallbacks
│       └── vision.py      images/scans -> base64 images (renders PDFs via pypdfium2)
├── tests/                 pytest suite (35 tests)
├── requirements.txt       runtime deps
├── requirements-dev.txt   + pytest
└── .env.example           every variable, documented
```

## Tests

```bash
pip install -r requirements-dev.txt
python3 -m pytest tests/ -v        # 35 tests, run from ai-service/
```

Also `npm run ai:test` from the repo root. Tests use the mock backend — no
network, no keys, fast.

## Adding a new backend (e.g. vLLM, OpenRouter, a local llama.cpp)

1. Create `app/providers/<name>.py`:

   ```python
   from .base import BaseProvider

   class MyProvider(BaseProvider):
       name = "myname"
       model = "my-model"

       def chat(self, messages, *, max_tokens=250, temperature=0.3):
           ...call your model...   # messages = [{"role": ..., "content": ...}]
           return reply_text       # or None on ANY failure — never raise
   ```

2. Register it in `app/providers/__init__.py` (`PROVIDERS` dict).
3. Add a test in `tests/test_providers.py`.

No other file needs to change — prompts, parsing and endpoints stay as-is.

## Deploying

The service must run somewhere always-on and reachable from the web app
(Vercel can't reach your laptop). Options: a VPS / school server, or free-tier
hosts like Render/Fly Railway. Then:

- set `SERVICE_API_KEY` and put the same value in the web app's
  `AI_API_KEY` env var (or the admin AI Settings),
- for photo/scanned banks also pull a vision model: `ollama pull llama3.2-vision:11b`,
- set `WEB_ORIGINS` to your Vercel domain(s),
- point Admin → AI Settings at `https://your-host/v1`.

If the service is ever down, the web app automatically falls back — a class
test never breaks because of AI.

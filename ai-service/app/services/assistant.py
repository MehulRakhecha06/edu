"""
The bottom-right assistant. Knows the app's feature set (see prompts.py) and
degrades to keyword-matched fallback replies when the model is unavailable.
"""

from __future__ import annotations

import re

from .. import prompts
from ..providers.base import BaseProvider

MAX_HISTORY = 4  # recent turns sent to the model (keeps prompts small)

FALLBACK_REPLIES: list[tuple[re.Pattern[str], str]] = [
    (
        re.compile(r"(what|about).*(edumock|app|site|this)", re.I),
        "Aimmers Nepal is a platform for schools: teachers upload question banks "
        "students take timed mock tests (1 mark per question), and an AI explains "
        "every answer afterwards.",
    ),
    (
        re.compile(r"(create|make|new).*(test|exam|quiz)", re.I),
        'Teachers create tests: upload a PDF question bank, click "Extract questions", '
        "then choose a title, question count (1-100), time limit and passing percentage. "
        "Select multiple banks to get a balanced multi-subject test.",
    ),
    (
        re.compile(r"(pass|fail|marks|mark|score|criteria|percent)", re.I),
        "Each question carries 1 mark. The teacher sets a passing percentage per test; "
        "students see PASSED/FAILED right after submitting, and teachers see who passed "
        "in the results table.",
    ),
    (
        re.compile(r"(account|register|sign ?up|login|log in|password|role)", re.I),
        "Students self-register on the Register page. Teachers and admins are created "
        "by the admin, who can also change roles and remove accounts.",
    ),
    (
        re.compile(r"(locally|local|offline|own server|self.?host|ollama|llama|python)", re.I),
        "The AI runs as a separate Python service. It can use a local model (Ollama or "
        "in-process transformers) or Hugging Face — switched with environment variables, "
        "no code changes.",
    ),
    (
        re.compile(r"(ai|explain|explanation|hugging|llm|model)", re.I),
        "The AI is a Python (FastAPI) microservice: it structures questions from PDFs "
        "verbatim, explains answers after tests, and powers this assistant. Backends: "
        "Ollama (free, unlimited), transformers (in-process), or Hugging Face.",
    ),
]

DEFAULT_FALLBACK = (
    "I can tell you about Aimmers Nepal: how tests work, marks and passing criteria, "
    "uploading question banks, accounts and roles, or the Python AI service. Ask me "
    "about any of those!"
)


def assistant_reply(message: str, history: list[dict], provider: BaseProvider) -> dict[str, str]:
    messages: list[dict] = [{"role": "system", "content": prompts.ASSISTANT_SYSTEM}]
    for item in history[-MAX_HISTORY:]:
        role = "user" if item.get("role") == "user" else "assistant"
        messages.append({"role": role, "content": str(item.get("content", ""))[:400]})
    messages.append({"role": "user", "content": message[:500]})

    reply = provider.chat(messages, max_tokens=180, temperature=0.5)
    if reply:
        return {"reply": reply, "source": "ai"}

    for pattern, text in FALLBACK_REPLIES:
        if pattern.search(message):
            return {"reply": text, "source": "fallback"}
    return {"reply": DEFAULT_FALLBACK, "source": "fallback"}

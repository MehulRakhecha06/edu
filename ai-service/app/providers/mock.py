"""
Mock backend — deterministic replies, no model required.

Used for development, CI and the demo so the whole stack works before any
model is installed. The replies intentionally include one malformed question
so the parser's validation logic is exercised end-to-end.
"""

from __future__ import annotations

import json
from typing import Sequence

from .base import BaseProvider

MOCK_QUESTIONS = [
    {
        "question_text": "Mock question one: what is 2+2?",
        "options": ["3", "4", "5", "6"],
        "correct_answer": "B",
    },
    {
        "question_text": "Mock question two: color of the sky?",
        "options": ["Blue", "Green", "Red", "Black"],
        "correct_answer": "A",
    },
    # deliberately malformed — the validator must drop this one
    {"question_text": "", "options": ["only", "two"], "correct_answer": "Z"},
]

# Returned by chat_vision() — different wording so tests can tell the
# text-parse and vision paths apart.
MOCK_VISION_QUESTIONS = [
    {
        "question_text": "MOCK-VISION question one (read from your image): what is 5+3?",
        "options": ["6", "7", "8", "9"],
        "correct_answer": "C",
    },
    {
        "question_text": "MOCK-VISION question two (read from your image): how many days in a week?",
        "options": ["5", "6", "7", "8"],
        "correct_answer": "C",
    },
]


class MockProvider(BaseProvider):
    name = "mock"
    model = "mock-model"

    def chat_vision(self, prompt, images, *, max_tokens=1200, temperature=0.1):
        # Demo behaviour: pretend we "read" the images and return canned
        # questions so the whole photo->test flow works without a real model.
        return json.dumps(MOCK_VISION_QUESTIONS)

    def chat(
        self,
        messages: Sequence[dict],
        *,
        max_tokens: int = 250,
        temperature: float = 0.3,
    ) -> str | None:
        messages = list(messages)
        system = next((m["content"] for m in messages if m["role"] == "system"), "")
        last_user = next(
            (m["content"] for m in reversed(messages) if m["role"] == "user"), ""
        )

        if "exam parser" in system.lower():
            return json.dumps(MOCK_QUESTIONS)
        if "answer-key expert" in system.lower():
            # deterministic: cycle A/B/C/D by position
            n = 0
            for m in messages:
                if m["role"] == "user":
                    try:
                        parsed = json.loads(m["content"])
                        if isinstance(parsed, list):
                            n = len(parsed)
                    except Exception:
                        pass
            return json.dumps(
                [{"index": i, "correct_answer": "ABCD"[i % 4]} for i in range(max(n, 1))]
            )
        if "friendly school teacher" in system.lower():
            return (
                "MOCK-EXPLANATION (Python AI service): the chosen option matches the "
                "key fact from the lesson — review the chapter to see why the others "
                "do not fit."
            )
        return (
            f"MOCK-REPLY (Python AI service): you said “{last_user[:80]}”. "
            "Connect a real backend (Ollama / Hugging Face) to get real answers."
        )

"""
Explanations — why the correct answer is correct (used after a student
submits a test). Falls back to a helpful deterministic sentence when the
model is unavailable, so the web app never shows an empty box.
"""

from __future__ import annotations

from .. import prompts
from ..providers.base import BaseProvider

LETTERS = ["A", "B", "C", "D", "E", "F"]

FALLBACK_TEMPLATE = (
    "The correct answer is {answer}) {answer_text}. To understand why, review this "
    "topic in your class notes — and ask your teacher if any part is still unclear. "
    "(The AI service is currently unreachable.)"
)


def explain(
    question: str, options: list[str], correct_answer: str, provider: BaseProvider
) -> dict[str, str]:
    lettered = "\n".join(f"{LETTERS[i]}) {option}" for i, option in enumerate(options))

    reply = provider.chat(
        [
            {"role": "system", "content": prompts.EXPLAIN_SYSTEM},
            {
                "role": "user",
                "content": prompts.explain_user_prompt(question, lettered, correct_answer),
            },
        ],
        max_tokens=180,
    )

    if reply:
        return {"explanation": reply, "source": "ai"}

    index = LETTERS.index(correct_answer) if correct_answer in LETTERS else -1
    answer_text = options[index] if 0 <= index < len(options) else correct_answer
    return {
        "explanation": FALLBACK_TEMPLATE.format(answer=correct_answer, answer_text=answer_text),
        "source": "fallback",
    }

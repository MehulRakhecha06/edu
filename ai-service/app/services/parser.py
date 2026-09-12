"""
Question parsing — turns raw question-bank text into structured MCQs.

The provider (LLM) is instructed to copy questions VERBATIM; this module
then validates every item defensively because models do make mistakes.
These rules mirror the web app's `lib/mcq.js` so both sides agree on what
a valid question is:

  - 2–6 non-empty options
  - a valid answer LETTER within the option range
  - sensible length limits
  - no duplicates
"""

from __future__ import annotations

import json
import re
from typing import Any, Sequence

from .. import prompts
from ..providers.base import BaseProvider

LETTERS = ["A", "B", "C", "D", "E", "F"]


def _loads_lenient(candidate: str) -> Any | None:
    """json.loads with the two mistakes small models make most often fixed:
    trailing commas before ]/} and smart quotes."""
    candidate = candidate.replace("\u201c", '"').replace("\u201d", '"')
    candidate = re.sub(r",\s*([\]}])", r"\1", candidate)
    try:
        return json.loads(candidate)
    except json.JSONDecodeError:
        return None


def extract_json_array(text: str) -> list[Any] | None:
    """Pull the JSON payload out of a model reply.

    Tolerates: ```json fences, prose around the JSON, trailing commas,
    and a single object `{...}` (wrapped into a one-item list) — all common
    with small local models.
    """
    if not text:
        return None
    fenced = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    raw = fenced.group(1) if fenced else text

    arr_start, arr_end = raw.find("["), raw.rfind("]")
    obj_start, obj_end = raw.find("{"), raw.rfind("}")

    # Decide which structure comes FIRST in the reply — a lone object
    # {"question_text":…, "options":[…]} must not be mistaken for the array
    # (its inner options list would otherwise be returned as the questions).
    array_first = arr_start != -1 and arr_end > arr_start and (obj_start == -1 or arr_start < obj_start)

    if array_first:
        parsed = _loads_lenient(raw[arr_start : arr_end + 1])
        if isinstance(parsed, list):
            return parsed

    # a lone object {"question_text": ...} -> treat as a 1-item list
    if obj_start != -1 and obj_end > obj_start:
        parsed = _loads_lenient(raw[obj_start : obj_end + 1])
        if isinstance(parsed, dict):
            return [parsed]

    if not array_first and arr_start != -1 and arr_end > arr_start:
        parsed = _loads_lenient(raw[arr_start : arr_end + 1])
        if isinstance(parsed, list):
            return parsed

    return None


def answer_letter(raw: str, options: Sequence[str]) -> str | None:
    """Best-effort extraction of the correct-answer letter from whatever the
    model wrote: "B", "(B)", "Option D", "Answer: C", "D — Same", "2" (digit),
    or the full option text."""
    s = str(raw or "").strip()
    if not s:
        return None
    m = re.match(r"^\(?([A-Fa-f])\)?[\s.,;:\u2014-]*$", s)
    if m:
        return m.group(1).upper()
    # "D — Same" / "B: four" — leading letter, separator, then the option text
    m = re.match(r"^\(?([A-Fa-f])\)?\s*[\u2014:\u2013;-]\s*\S", s)
    if m:
        return m.group(1).upper()
    m = re.search(r"(?:option|answer|ans|key)\s*[:\-]?\s*\(?\s*([A-Fa-f])\s*\)?", s, re.IGNORECASE)
    if m:
        return m.group(1).upper()
    # "Option 3" / "Answer: 2" — digit after the word (1-6, positional)
    m = re.search(r"(?:option|answer|ans|key)\s*[:\-]?\s*\(?\s*([1-6])\s*\)?", s, re.IGNORECASE)
    if m:
        i = int(m.group(1)) - 1
        return "ABCDEF"[i] if i < len(options) else None
    # exact option-text match BEFORE digit interpretation: for numeric options
    # ["3","4","5","6"] the answer "4" means the option TEXT "4" (B), not
    # "4th option" (D).
    for i, o in enumerate(options):
        if str(o).strip().lower() == s.lower():
            return LETTERS[i]
    m = re.match(r"^\(?([1-6])\)?$", s)
    if m:
        i = int(m.group(1)) - 1
        return LETTERS[i] if i < len(options) else None
    return None


def validate_questions(items: Sequence[Any]) -> list[dict[str, Any]]:
    """Filter a list of raw parsed items down to well-formed questions."""
    seen: set[str] = set()
    valid: list[dict[str, Any]] = []

    for item in items:
        if not isinstance(item, dict):
            continue

        question_text = str(item.get("question_text") or item.get("questionText") or "").strip()
        options = item.get("options")
        raw_answer = str(item.get("correct_answer") or item.get("correctAnswer") or "").strip()

        if not 4 <= len(question_text) <= 1500:
            continue
        if not isinstance(options, list) or not 2 <= len(options) <= 6:
            continue

        options = [re.sub(r"\s+", " ", str(o)).strip()[:300] for o in options]
        if any(not o for o in options):
            continue

        letter = answer_letter(raw_answer, options)
        if letter is None or LETTERS.index(letter) >= len(options):
            continue

        key = question_text.lower()[:120]
        if key in seen:  # duplicate question
            continue
        seen.add(key)

        valid.append(
            {"question_text": question_text, "options": options, "correct_answer": letter}
        )

    return valid


def parse_questions(text: str, provider: BaseProvider, max_chars: int) -> dict[str, Any]:
    """Extract MCQs from raw bank text using the configured provider."""
    chunk = text[:max_chars]

    reply = provider.chat(
        [
            {"role": "system", "content": prompts.PARSE_QUESTIONS_SYSTEM},
            {"role": "user", "content": chunk},
        ],
        max_tokens=1500,
        temperature=0,
    )

    if reply is None:
        # The model backend itself failed (Ollama down, HF 404, timeout…).
        # "none" would mean "ran fine, no MCQs found" — a very different thing.
        return {"questions": [], "count": 0, "source": "provider-failed"}

    parsed = extract_json_array(reply)
    if not parsed:
        return {"questions": [], "count": 0, "source": "none"}

    questions = validate_questions(parsed)
    return {"questions": questions, "count": len(questions), "source": "ai"}

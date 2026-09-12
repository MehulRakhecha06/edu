"""Unit tests for question validation and JSON extraction."""

from __future__ import annotations

from app.services.parser import extract_json_array, validate_questions


def test_valid_questions_pass_through():
    items = [
        {
            "question_text": "What is the capital of Nepal?",
            "options": ["Pokhara", "Kathmandu", "Biratnagar", "Lalitpur"],
            "correct_answer": "B",
        }
    ]
    result = validate_questions(items)
    assert len(result) == 1
    assert result[0]["correct_answer"] == "B"


def test_malformed_items_are_dropped():
    items = [
        {"question_text": "", "options": ["a", "b"], "correct_answer": "A"},  # empty text
        {"question_text": "Only one option?", "options": ["a"], "correct_answer": "A"},  # 1 option
        {"question_text": "Bad letter?", "options": ["a", "b"], "correct_answer": "Z"},  # bad letter
        {"question_text": "Too many options?", "options": list("abcdefg"), "correct_answer": "A"},  # 7 options
        "not-a-dict",
    ]
    assert validate_questions(items) == []


def test_answer_text_mapped_back_to_letter():
    items = [
        {
            "question_text": "Pick the red planet",
            "options": ["Venus", "Mars"],
            "correct_answer": "Mars",  # full text instead of letter
        }
    ]
    result = validate_questions(items)
    assert result[0]["correct_answer"] == "B"


def test_duplicates_removed():
    q = {
        "question_text": "Same question here?",
        "options": ["a", "b", "c", "d"],
        "correct_answer": "A",
    }
    assert len(validate_questions([q, dict(q)])) == 1


def test_extract_json_array_plain():
    assert extract_json_array('[{"a": 1}]') == [{"a": 1}]


def test_extract_json_array_fenced_with_prose():
    text = 'Here you go:\n```json\n[{"q": "x"}]\n```\nHope that helps!'
    assert extract_json_array(text) == [{"q": "x"}]


def test_extract_json_array_garbage():
    assert extract_json_array("no json here") is None
    assert extract_json_array("") is None
    assert extract_json_array("{not an array}") is None

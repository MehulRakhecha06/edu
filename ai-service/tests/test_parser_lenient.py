"""Small-model tolerance: messy JSON and unusual answer forms must survive."""

from app.services.parser import extract_json_array, validate_questions


def test_trailing_commas_survive():
    reply = '[{"question_text":"What is 2+2?","options":["3","4","5","6"],"correct_answer":"B",},]'
    parsed = extract_json_array(reply)
    assert parsed and validate_questions(parsed)


def test_single_object_wrapped():
    reply = 'Here you go: {"question_text":"Sky color?","options":["Blue","Red"],"correct_answer":"A"}'
    parsed = extract_json_array(reply)
    assert isinstance(parsed, list) and len(parsed) == 1


def test_fenced_with_prose():
    reply = "Sure!\n```json\n[{\"question_text\":\"Q?\",\"options\":[\"a\",\"b\"],\"correct_answer\":\"A\"}]\n```\nDone."
    assert extract_json_array(reply)


def test_answer_forms():
    base = {"question_text": "What is 2+2?", "options": ["3", "4", "5", "6"]}
    assert validate_questions([{**base, "correct_answer": "Option B"}])[0]["correct_answer"] == "B"
    assert validate_questions([{**base, "correct_answer": "(B)"}])[0]["correct_answer"] == "B"
    assert validate_questions([{**base, "correct_answer": "Answer: B"}])[0]["correct_answer"] == "B"
    assert validate_questions([{**base, "correct_answer": "2"}])[0]["correct_answer"] == "B"
    assert validate_questions([{**base, "correct_answer": "B — four"}])[0]["correct_answer"] == "B"
    assert validate_questions([{**base, "correct_answer": "4"}])[0]["correct_answer"] == "B"  # full option text
    assert validate_questions([{**base, "correct_answer": "four"}]) == []  # matches no option -> dropped


def test_answer_out_of_range_rejected():
    base = {"question_text": "What is 2+2?", "options": ["3", "4"]}
    assert validate_questions([{**base, "correct_answer": "D"}]) == []
    assert validate_questions([{**base, "correct_answer": "9"}]) == []


from app.services.parser import parse_questions


class _DeadProvider:
    """Simulates a model backend that cannot be reached (chat -> None)."""

    name = "dead"
    model = "x"

    def chat(self, messages, *, max_tokens=250, temperature=0.3):
        return None


def test_provider_failure_is_reported_distinctly():
    result = parse_questions("Q1 What?\nA) a\nB) b\nAnswer: A", _DeadProvider(), 9000)
    assert result["source"] == "provider-failed"
    assert result["questions"] == []


def test_answer_letter_option_digit_forms():
    from app.services.parser import answer_letter
    opts = ["Newton", "Joule", "Watt", "Pascal"]
    assert answer_letter("Option 2", opts) == "B"
    assert answer_letter("Answer: 1", opts) == "A"
    assert answer_letter("option 5", opts) is None  # beyond option count
    assert answer_letter("Joule", opts) == "B"  # option text
    assert answer_letter("(b)", opts) == "B"

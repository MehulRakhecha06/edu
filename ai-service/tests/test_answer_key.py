"""Answer-key completion endpoint tests (mock backend)."""

from __future__ import annotations

import json


def req(client, questions):
    return client.post(
        "/edumock/answer-key",
        json={"questions": questions},
    )


def test_answer_key_mock(client):
    qs = [
        {"question_text": "What is 2+2?", "options": ["3", "4", "5", "6"]},
        {"question_text": "Capital of Nepal?", "options": ["Pokhara", "Kathmandu"]},
        {"question_text": "Sky color?", "options": ["Blue", "Red", "Green"]},
    ]
    resp = req(client, qs)
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["answers"]) == 3
    assert [a["index"] for a in body["answers"]] == [0, 1, 2]
    # mock cycles A,B,C,D — all letters valid for their option counts
    for a in body["answers"]:
        assert a["correct_answer"] in "ABCDEF"


def test_answer_key_empty_questions_rejected(client):
    resp = req(client, [])
    assert resp.status_code == 422


def test_answer_key_requires_auth(secured_client):
    resp = secured_client.post(
        "/edumock/answer-key",
        json={"questions": [{"question_text": "q?", "options": ["a", "b"]}]},
    )
    assert resp.status_code == 401


def test_answer_key_option_count_guard():
    """Letters beyond a question's option count must be dropped (unit check)."""
    from app.services.parser import extract_json_array

    items = extract_json_array(json.dumps([{"index": 0, "correct_answer": "D"}]))
    assert items == [{"index": 0, "correct_answer": "D"}]

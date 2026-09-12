"""API-level tests using the mock backend (fast, no model needed)."""

from __future__ import annotations


def test_health(client):
    res = client.get("/health")
    assert res.status_code == 200
    body = res.json()
    assert body["service"] == "edumock-ai-service"
    assert body["status"] == "ok"
    assert body["backend"] == "mock"


def test_parse_questions_via_api(client):
    res = client.post("/edumock/parse-questions", json={"text": "1. Question?\nA) a\nB) b\nAnswer: A"})
    assert res.status_code == 200
    body = res.json()
    # mock returns 3 items, 1 is deliberately malformed -> 2 survive
    assert body["count"] == 2
    assert body["source"] == "ai"
    assert body["questions"][0]["question_text"].startswith("Mock question one")
    assert body["questions"][0]["correct_answer"] in "ABCDEF"


def test_parse_questions_empty_text_rejected(client):
    res = client.post("/edumock/parse-questions", json={"text": ""})
    assert res.status_code == 422  # pydantic validation


def test_explain(client):
    res = client.post(
        "/edumock/explain",
        json={
            "question": "What is 2+2?",
            "options": ["3", "4", "5", "6"],
            "correct_answer": "b",  # lowercase on purpose
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert body["source"] == "ai"
    assert "MOCK-EXPLANATION" in body["explanation"]


def test_assistant_chat(client):
    res = client.post("/edumock/chat", json={"message": "what is this app?", "history": []})
    assert res.status_code == 200
    body = res.json()
    assert body["source"] == "ai"
    assert "MOCK-REPLY" in body["reply"]


def test_openai_compatible_completions(client):
    res = client.post(
        "/v1/chat/completions",
        json={"messages": [{"role": "user", "content": "hi"}]},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["object"] == "chat.completion"
    assert body["choices"][0]["message"]["role"] == "assistant"
    assert body["choices"][0]["message"]["content"]


def test_streaming_rejected(client):
    res = client.post(
        "/v1/chat/completions",
        json={"messages": [{"role": "user", "content": "hi"}], "stream": True},
    )
    assert res.status_code == 400


# ------------------------------------------------- service API key tests


def test_api_key_required_when_configured(secured_client):
    res = secured_client.get("/health")  # /health stays public
    assert res.status_code == 200

    res = secured_client.post(
        "/edumock/chat", json={"message": "hi"}, headers={"Authorization": "Bearer wrong"}
    )
    assert res.status_code == 401

    res = secured_client.post(
        "/edumock/chat",
        json={"message": "hi"},
        headers={"Authorization": "Bearer test-key-123"},
    )
    assert res.status_code == 200

    res = secured_client.post("/edumock/chat", json={"message": "hi"})
    assert res.status_code == 401


def test_x_api_key_header_also_accepted(secured_client):
    res = secured_client.post(
        "/edumock/chat", json={"message": "hi"}, headers={"x-api-key": "test-key-123"}
    )
    assert res.status_code == 200

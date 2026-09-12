"""
Request/response models (Pydantic). These define the public API contract of
the AI service — the Next.js app and any other client rely on these shapes.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


# --------------------------------------------------------------- requests


class ParseQuestionsRequest(BaseModel):
    """Raw text of a question bank -> structured MCQs."""

    text: str = Field(..., min_length=1, max_length=20000, description="Raw text extracted from the PDF")


class ParseVisionRequest(BaseModel):
    """An image (or scanned PDF) of a question bank -> structured MCQs."""

    content: str = Field(
        ..., min_length=8, description="Base64-encoded file bytes (image or PDF)"
    )
    mime: str = Field(
        ...,
        description="File MIME type: image/png, image/jpeg, image/webp or application/pdf",
    )


class AnswerKeyItem(BaseModel):
    question_text: str = Field(..., min_length=1, max_length=1500)
    options: list[str] = Field(..., min_length=2, max_length=6)


class AnswerKeyRequest(BaseModel):
    questions: list[AnswerKeyItem] = Field(..., min_length=1, max_length=100)
    # answer-ish lines from the document (distant key sections) — optional
    answer_context: str = Field("", max_length=4000)


class AnswerKeyAnswer(BaseModel):
    index: int = Field(..., ge=0)
    correct_answer: str = Field(..., pattern="^[A-Fa-f]$")


class AnswerKeyResponse(BaseModel):
    answers: list[AnswerKeyAnswer]
    source: str


class ExplainRequest(BaseModel):
    question: str = Field(..., min_length=1)
    options: list[str] = Field(..., min_length=2, max_length=6)
    correct_answer: str = Field(..., pattern="^[A-Fa-f]$")


class HistoryItem(BaseModel):  # capped below via max_length on the list
    role: Literal["user", "assistant"]
    content: str


class AssistantChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=1000)
    history: list[HistoryItem] = Field(default_factory=list, max_length=20)


class ChatMessage(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str


class ChatCompletionRequest(BaseModel):
    # payload caps keep a public deployment safe from oversized bodies
    """OpenAI-compatible /v1/chat/completions body (subset we support)."""

    model: str | None = None
    messages: list[ChatMessage] = Field(..., min_length=1, max_length=40)
    max_tokens: int = Field(default=250, ge=1, le=4000)
    temperature: float = Field(default=0.3, ge=0, le=2)
    stream: bool = False  # streaming is not supported — we return plain JSON


# -------------------------------------------------------------- responses


class Question(BaseModel):
    question_text: str
    options: list[str]
    correct_answer: str


class ParseQuestionsResponse(BaseModel):
    questions: list[Question]
    count: int
    source: Literal["ai", "none", "provider-failed"]


class ExplainResponse(BaseModel):
    explanation: str
    source: Literal["ai", "fallback"]


class AssistantChatResponse(BaseModel):
    reply: str
    source: Literal["ai", "fallback"]


class HealthResponse(BaseModel):
    status: str = "ok"
    service: str = "edumock-ai-service"
    version: str
    backend: str
    model: str | None


class ChatCompletionChoice(BaseModel):
    index: int = 0
    message: ChatMessage
    finish_reason: str = "stop"


class ChatCompletionResponse(BaseModel):
    id: str
    object: str = "chat.completion"
    model: str
    choices: list[ChatCompletionChoice]

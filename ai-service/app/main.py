"""
Aimmers Nepal AI service — FastAPI application.

Endpoints
---------
GET  /health                     Service status + active backend/model
POST /v1/chat/completions        OpenAI-compatible chat (drop-in for any tool)
POST /edumock/parse-questions    Raw bank text  -> validated MCQ JSON (verbatim)
POST /edumock/parse-vision       Photo/scan     -> validated MCQ JSON (verbatim)
POST /edumock/answer-key          Questions w/o key -> AI-picked answers
POST /edumock/explain            Question       -> short explanation
POST /edumock/chat               Message        -> assistant reply

The Next.js app connects to this service through Admin -> AI Settings (set
the base URL to http://<host>:8000/v1). It auto-detects this service and
routes the /edumock/* tasks here directly.
"""

from __future__ import annotations

import json
import uuid
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security.utils import get_authorization_scheme_param

from . import prompts
from .config import SERVICE_NAME, VERSION, Settings, load_settings
from .providers import get_provider
from .schemas import (
    AnswerKeyRequest,
    AnswerKeyResponse,
    AnswerKeyAnswer,
    AssistantChatRequest,
    AssistantChatResponse,
    ChatCompletionRequest,
    ChatCompletionResponse,
    ChatCompletionChoice,
    ChatMessage,
    ExplainRequest,
    ExplainResponse,
    HealthResponse,
    ParseQuestionsRequest,
    ParseQuestionsResponse,
    ParseVisionRequest,
    Question,
)
from .services import assistant as assistant_service
from .services import explainer, parser
from .services.vision import VisionInputError, images_from_upload


def create_app(settings: Settings | None = None) -> FastAPI:
    """App factory — lets tests build isolated instances with custom settings."""
    settings = settings or load_settings()
    provider = get_provider(settings)

    app = FastAPI(
        title="Aimmers Nepal AI Service",
        description="AI microservice for Aimmers Nepal: question parsing "
        "(text, photos and scans), explanations and the assistant chat.",
        version=VERSION,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.web_origins),
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.state.settings = settings
    app.state.provider = provider

    # ------------------------------------------------------------ security

    def verify_key(request: Request) -> None:
        """Optional shared-secret check (only when SERVICE_API_KEY is set)."""
        key = request.app.state.settings.service_api_key
        if not key:
            return
        scheme, token = get_authorization_scheme_param(
            request.headers.get("Authorization", "")
        )
        supplied = token if scheme.lower() == "bearer" else request.headers.get("x-api-key", "")
        if supplied != key:
            raise HTTPException(status_code=401, detail="Invalid or missing API key")

    KeyDep = Annotated[None, Depends(verify_key)]

    # -------------------------------------------------------------- routes

    @app.get("/health", response_model=HealthResponse, tags=["meta"])
    def health() -> HealthResponse:
        return HealthResponse(
            status="ok",
            service=SERVICE_NAME,
            version=VERSION,
            backend=provider.name,
            model=provider.model,
        )

    @app.post(
        "/v1/chat/completions",
        response_model=ChatCompletionResponse,
        tags=["openai-compatible"],
        dependencies=[Depends(verify_key)],
    )
    def chat_completions(body: ChatCompletionRequest) -> ChatCompletionResponse:
        if body.stream:
            raise HTTPException(status_code=400, detail="Streaming is not supported.")

        reply = provider.chat(
            [m.model_dump() for m in body.messages],
            max_tokens=body.max_tokens,
            temperature=body.temperature,
        )
        if reply is None:
            raise HTTPException(status_code=502, detail="The model backend is unreachable.")

        return ChatCompletionResponse(
            id=f"chatcmpl-{uuid.uuid4().hex[:12]}",
            model=body.model or provider.model or provider.name,
            choices=[ChatCompletionChoice(message=ChatMessage(role="assistant", content=reply))],
        )

    @app.post(
        "/edumock/parse-questions",
        response_model=ParseQuestionsResponse,
        tags=["edumock"],
        dependencies=[Depends(verify_key)],
    )
    def parse_questions(body: ParseQuestionsRequest) -> ParseQuestionsResponse:
        result = parser.parse_questions(
            body.text, provider, settings.parser_max_chars
        )
        return ParseQuestionsResponse(
            questions=[Question(**q) for q in result["questions"]],
            count=result["count"],
            source=result["source"],
        )

    @app.post(
        "/edumock/parse-vision",
        response_model=ParseQuestionsResponse,
        tags=["edumock"],
        dependencies=[Depends(verify_key)],
    )
    def parse_vision(body: ParseVisionRequest) -> ParseQuestionsResponse:
        """Photos / scanned PDFs of question papers -> validated MCQ JSON."""
        try:
            images = images_from_upload(body.content, body.mime, settings.vision_max_pages)
        except VisionInputError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc

        reply = provider.chat_vision(prompts.PARSE_IMAGES_SYSTEM, images)
        if reply is None:
            raise HTTPException(
                status_code=502,
                detail=(
                    "The current AI backend cannot read images "
                    f"('{provider.name}'). Use a vision-capable backend — "
                    "Ollama with a vision model (e.g. llama3.2-vision) or "
                    "Hugging Face."
                ),
            )

        items = parser.extract_json_array(reply) or []
        questions = parser.validate_questions(items)
        return ParseQuestionsResponse(
            questions=[Question(**q) for q in questions],
            count=len(questions),
            # 'ai' = extracted by the AI (vs 'none'); the web app keys off this
            source="ai" if questions else "none",
        )

    @app.post(
        "/edumock/answer-key",
        response_model=AnswerKeyResponse,
        tags=["edumock"],
        dependencies=[Depends(verify_key)],
    )
    def answer_key(body: AnswerKeyRequest) -> AnswerKeyResponse:
        """Complete a missing answer key: pick the best option per question."""
        user_payload = json.dumps(
            [
                {"question_text": q.question_text, "options": q.options}
                for q in body.questions
            ]
        )
        if body.answer_context:
            user_payload += (
                "\n\nAnswer-key excerpt from the document:\n"
                + body.answer_context
            )
        reply = provider.chat(
            [
                {"role": "system", "content": prompts.ANSWER_KEY_SYSTEM},
                {"role": "user", "content": user_payload},
            ],
            max_tokens=1500,
            temperature=0,
        )
        if reply is None:
            raise HTTPException(
                status_code=502, detail="The model backend is unreachable."
            )

        items = parser.extract_json_array(reply) or []
        # Models wrap the array in many shapes — unwrap {"answers": […]}
        if (
            len(items) == 1
            and isinstance(items[0], dict)
            and isinstance(items[0].get("answers"), list)
        ):
            items = items[0]["answers"]

        answers = []
        seen = set()
        for it in items:
            if not isinstance(it, dict):
                continue
            idx = it.get("index", it.get("n"))
            if isinstance(idx, str) and idx.strip().isdigit():
                idx = int(idx)
            if not isinstance(idx, int) or idx < 0 or idx >= len(body.questions):
                continue
            if idx in seen:
                continue
            raw = it.get("correct_answer") or it.get("answer") or it.get("letter")
            if raw is None:
                continue
            # "B", "(b)", "Option D", "Answer: C", "Option 3", digit or the
            # option text — answer_letter maps them all to a positional letter
            letter = parser.answer_letter(str(raw), body.questions[idx].options)
            if not letter:
                continue
            if "ABCDEF".index(letter) >= len(body.questions[idx].options):
                continue  # beyond the option count
            seen.add(idx)
            answers.append(AnswerKeyAnswer(index=idx, correct_answer=letter))

        if not answers:
            raise HTTPException(
                status_code=502,
                detail="The model could not produce a usable answer key.",
            )
        return AnswerKeyResponse(answers=answers, source=provider.name)

    @app.post(
        "/edumock/explain",
        response_model=ExplainResponse,
        tags=["edumock"],
        dependencies=[Depends(verify_key)],
    )
    def explain(body: ExplainRequest) -> ExplainResponse:
        result = explainer.explain(
            body.question, body.options, body.correct_answer.upper(), provider
        )
        return ExplainResponse(**result)

    @app.post(
        "/edumock/chat",
        response_model=AssistantChatResponse,
        tags=["edumock"],
        dependencies=[Depends(verify_key)],
    )
    def chat(body: AssistantChatRequest) -> AssistantChatResponse:
        result = assistant_service.assistant_reply(
            body.message, [h.model_dump() for h in body.history], provider
        )
        return AssistantChatResponse(**result)

    return app


app = create_app()

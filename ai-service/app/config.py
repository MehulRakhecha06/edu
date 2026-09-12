"""
Configuration for the Aimmers Nepal AI service.

Every setting comes from environment variables (or a `.env` file placed next
to this folder). The LLM backend is auto-detected unless `AI_BACKEND` is set
explicitly.

Backends
--------
mock          Deterministic replies for development / CI (no model needed)
ollama        A local Ollama server            -> http://localhost:11434
huggingface   Hugging Face Inference API       -> needs HF_TOKEN
transformers  Loads a model in-process         -> needs `transformers` extra

Team tip: you never edit code to switch backends — only environment
variables. See ai-service/.env.example.
"""

from __future__ import annotations

import os
from dataclasses import dataclass

from dotenv import load_dotenv

# Load ai-service/.env (and ai-service/.env.local) if present
load_dotenv()
load_dotenv(".env.local")

VERSION = "1.1.0"
SERVICE_NAME = "edumock-ai-service"


def _get(key: str, default: str = "") -> str:
    return os.getenv(key, default).strip()


def _detect_backend() -> str:
    """Pick the LLM backend: explicit AI_BACKEND wins, otherwise sniff the env."""
    explicit = _get("AI_BACKEND").lower()
    if explicit:
        return explicit
    if _get("OLLAMA_URL") or _get("AI_BASE_URL"):
        return "ollama"
    if _get("HF_TOKEN") or _get("HUGGINGFACE_API_KEY"):
        return "huggingface"
    return "mock"


@dataclass(frozen=True)
class Settings:
    """Immutable service settings resolved once at startup."""

    # mock | ollama | huggingface | transformers
    backend: str

    # Optional shared secret. When set, callers must send
    # `Authorization: Bearer <key>` (or `x-api-key: <key>`).
    service_api_key: str

    # Comma-separated list of allowed CORS origins ("*" = allow all).
    web_origins: tuple[str, ...]

    # Per-request timeout (seconds) for LLM calls.
    timeout_seconds: float

    # --- ollama -----------------------------------------------------
    ollama_url: str
    ollama_model: str

    # --- hugging face -----------------------------------------------
    hf_token: str
    hf_model: str

    # --- transformers (in-process model, optional install) ----------
    transformers_model: str

    # --- vision (photo / scanned-PDF question extraction) -----------
    # Ollama model used to READ images (must be a vision-capable model).
    ollama_vision_model: str
    # Hugging Face vision-language model for the same job.
    hf_vision_model: str
    # Max PDF pages rendered & sent per request (each page = 1 image).
    vision_max_pages: int

    # Max characters of question-bank text sent to the parser in one call.
    parser_max_chars: int


def load_settings() -> Settings:
    return Settings(
        backend=_detect_backend(),
        service_api_key=_get("SERVICE_API_KEY"),
        web_origins=tuple(
            origin.strip() for origin in _get("WEB_ORIGINS", "*").split(",") if origin.strip()
        ),
        timeout_seconds=float(_get("AI_TIMEOUT_SECONDS", "180") or 180),
        ollama_url=_get("OLLAMA_URL", "http://localhost:11434").rstrip("/"),
        ollama_model=_get("OLLAMA_MODEL", "llama3.2:1b"),
        hf_token=_get("HF_TOKEN") or _get("HUGGINGFACE_API_KEY"),
        hf_model=_get("HF_MODEL", "Qwen/Qwen2.5-7B-Instruct"),
        transformers_model=_get(
            "TRANSFORMERS_MODEL", "HuggingFaceTB/SmolLM2-1.7B-Instruct"
        ),
        ollama_vision_model=_get("OLLAMA_VISION_MODEL", "llama3.2-vision:11b"),
        hf_vision_model=_get("HF_VISION_MODEL", "Qwen/Qwen2.5-VL-72B-Instruct"),
        vision_max_pages=int(_get("VISION_MAX_PAGES", "8") or 8),
        parser_max_chars=int(_get("PARSER_MAX_CHARS", "9000") or 9000),
    )

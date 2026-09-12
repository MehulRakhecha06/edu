"""
Shared test fixtures. Sets a deterministic environment BEFORE the app is
imported, and exposes an app factory for per-test settings.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest

# Make `app` importable when pytest runs from the repo root or ai-service/
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

os.environ.setdefault("AI_BACKEND", "mock")

from app.config import Settings  # noqa: E402
from app.main import create_app  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402


def make_settings(**overrides) -> Settings:
    """Build mock-backend settings with optional overrides."""
    base = dict(
        backend="mock",
        service_api_key="",
        web_origins=("*",),
        timeout_seconds=5.0,
        ollama_url="http://localhost:11434",
        ollama_model="llama3.2:1b",
        hf_token="",
        hf_model="Qwen/Qwen2.5-7B-Instruct",
        transformers_model="HuggingFaceTB/SmolLM2-1.7B-Instruct",
        ollama_vision_model="llama3.2-vision:11b",
        hf_vision_model="Qwen/Qwen2-VL-7B-Instruct",
        vision_max_pages=8,
        parser_max_chars=9000,
    )
    base.update(overrides)
    return Settings(**base)


@pytest.fixture()
def client() -> TestClient:
    return TestClient(create_app(make_settings()))


@pytest.fixture()
def secured_client() -> TestClient:
    return TestClient(create_app(make_settings(service_api_key="test-key-123")))

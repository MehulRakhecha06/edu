"""Provider tests: factory selection and mock behaviour."""

from __future__ import annotations

import pytest

from app.config import Settings
from app.providers import get_provider
from app.providers.base import BaseProvider
from app.providers.mock import MockProvider
from app.providers.ollama import OllamaProvider

from conftest import make_settings


def test_factory_returns_mock_by_default():
    provider = get_provider(make_settings())
    assert isinstance(provider, MockProvider)
    assert provider.name == "mock"


def test_factory_returns_ollama_when_configured():
    provider = get_provider(make_settings(backend="ollama"))
    assert isinstance(provider, OllamaProvider)
    assert provider.model == "llama3.2:1b"


def test_factory_rejects_unknown_backend():
    with pytest.raises(RuntimeError, match="Unknown AI_BACKEND"):
        get_provider(make_settings(backend="does-not-exist"))


def test_mock_provider_parse_reply_is_valid_json():
    provider = MockProvider()
    import json

    reply = provider.chat(
        [{"role": "system", "content": "You are an exam parser..."},
         {"role": "user", "content": "text"}]
    )
    parsed = json.loads(reply)
    assert isinstance(parsed, list) and len(parsed) == 3


def test_provider_interface():
    assert issubclass(MockProvider, BaseProvider)
    # must return None, not raise, on failure — OllamaProvider with a dead URL
    dead = OllamaProvider(base_url="http://localhost:9", model="x", timeout_seconds=0.5)
    assert dead.chat([{"role": "user", "content": "hi"}]) is None


def test_settings_dataclass_is_immutable():
    s = make_settings()
    with pytest.raises(Exception):
        s.backend = "changed"  # type: ignore[misc]

"""
Provider interface — every LLM backend implements `chat()`.

Adding a new backend (vLLM, llama.cpp server, OpenRouter, your own GPU box…):
1. Create a new module in this package implementing BaseProvider.
2. Register it in app/providers/__init__.py (PROVIDERS + factory).
That's it — no other file changes.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Sequence


class BaseProvider(ABC):
    """A synchronous chat-completion backend."""

    name: str = "base"
    model: str | None = None

    @abstractmethod
    def chat(
        self,
        messages: Sequence[dict],
        *,
        max_tokens: int = 250,
        temperature: float = 0.3,
    ) -> str | None:
        """Run a chat completion. Returns the reply text, or None on failure.

        Implementations must NOT raise for ordinary failures (network down,
        bad credentials, timeouts) — return None and let the caller decide.
        """
        raise NotImplementedError

    def chat_vision(
        self,
        prompt: str,
        images: Sequence[dict],
        *,
        max_tokens: int = 1200,
        temperature: float = 0.1,
    ) -> str | None:
        """Read images and answer the prompt about them (multimodal).

        `images` is a list of {"b64": str, "mime": str} dicts. Returns the
        reply text or None. The base implementation returns None — backends
        without vision support fall through automatically, so callers can
        always attempt the call and handle None.
        """
        return None

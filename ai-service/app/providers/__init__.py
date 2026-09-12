"""
Provider factory. Register new backends in PROVIDERS below.
"""

from __future__ import annotations

from functools import lru_cache

from ..config import Settings
from .base import BaseProvider
from .huggingface import HuggingFaceProvider
from .mock import MockProvider
from .ollama import OllamaProvider
from .transformers_backend import TransformersProvider

PROVIDERS: dict[str, type[BaseProvider]] = {
    "mock": MockProvider,
    "ollama": OllamaProvider,
    "huggingface": HuggingFaceProvider,
    "transformers": TransformersProvider,
}


@lru_cache(maxsize=1)
def get_provider(settings: Settings) -> BaseProvider:
    """Build the configured LLM provider (cached — models load once)."""
    backend = settings.backend

    if backend not in PROVIDERS:
        raise RuntimeError(
            f"Unknown AI_BACKEND '{backend}'. Valid options: {', '.join(PROVIDERS)}"
        )

    if backend == "ollama":
        return OllamaProvider(
            base_url=settings.ollama_url,
            model=settings.ollama_model,
            timeout_seconds=settings.timeout_seconds,
            vision_model=settings.ollama_vision_model,
        )
    if backend == "huggingface":
        if not settings.hf_token:
            raise RuntimeError(
                "AI_BACKEND=huggingface needs HF_TOKEN (or HUGGINGFACE_API_KEY)."
            )
        return HuggingFaceProvider(
            token=settings.hf_token,
            model=settings.hf_model,
            timeout_seconds=settings.timeout_seconds,
            vision_model=settings.hf_vision_model,
        )
    if backend == "transformers":
        return TransformersProvider(model_name=settings.transformers_model)

    return MockProvider()


__all__ = ["BaseProvider", "get_provider", "PROVIDERS"]

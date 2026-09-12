"""
Ollama backend — talks to a local Ollama server (https://ollama.com).

Setup on the machine running this service:
    ollama pull llama3.2:1b
    ollama serve                # usually already running after install
"""

from __future__ import annotations

import httpx
from typing import Sequence

from .base import BaseProvider


class OllamaProvider(BaseProvider):
    name = "ollama"

    def __init__(
        self,
        base_url: str,
        model: str,
        timeout_seconds: float,
        vision_model: str = "",
    ):
        self.base_url = base_url.rstrip("/")
        self.model = model
        # Vision-capable model for reading images (e.g. llama3.2-vision:11b).
        self.vision_model = vision_model or "llama3.2-vision:11b"
        self.timeout = timeout_seconds

    def chat_vision(self, prompt, images, *, max_tokens=1200, temperature=0.1):
        try:
            response = httpx.post(
                f"{self.base_url}/api/chat",
                json={
                    "model": self.vision_model,
                    "messages": [
                        {
                            "role": "user",
                            "content": prompt,
                            # Ollama expects raw base64 strings
                            "images": [img["b64"] for img in images],
                        }
                    ],
                    "stream": False,
                    "options": {
                        "temperature": temperature,
                        "num_predict": max_tokens,
                    },
                },
                timeout=max(self.timeout, 120.0),  # vision is slow — allow more
            )
            response.raise_for_status()
            data = response.json()
            return (data.get("message") or {}).get("content") or None
        except Exception:  # noqa: BLE001 — never crash the service
            return None

    def chat(
        self,
        messages: Sequence[dict],
        *,
        max_tokens: int = 250,
        temperature: float = 0.3,
    ) -> str | None:
        try:
            response = httpx.post(
                f"{self.base_url}/api/chat",
                json={
                    "model": self.model,
                    "messages": list(messages),
                    "stream": False,
                    "options": {
                        "temperature": temperature,
                        "num_predict": max_tokens,
                    },
                },
                timeout=self.timeout,
            )
            response.raise_for_status()
            data = response.json()
            return (data.get("message") or {}).get("content") or None
        except Exception:  # noqa: BLE001 — never crash the service
            return None

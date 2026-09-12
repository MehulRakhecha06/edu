"""
Hugging Face backend — hosted Inference API (best when the service runs in
the cloud without its own GPU).

Free-plan note: HF's free tier only includes a small monthly credit amount
with rate limits — fine for demos. For a whole class prefer the Ollama
backend (unlimited, free, local).
"""

from __future__ import annotations

from typing import Sequence

from .base import BaseProvider


class HuggingFaceProvider(BaseProvider):
    name = "huggingface"

    def __init__(self, token: str, model: str, timeout_seconds: float, vision_model: str = ""):
        from huggingface_hub import InferenceClient

        self._client = InferenceClient(model=model, token=token)
        self._vision_client = InferenceClient(model=vision_model, token=token)
        self.model = model
        self.vision_model = vision_model
        self.timeout = timeout_seconds

    def chat_vision(self, prompt, images, *, max_tokens=1200, temperature=0.1):
        """Read images via a vision-language model (OpenAI-style content parts)."""
        try:
            content = [{"type": "text", "text": prompt}]
            for img in images:
                content.append(
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:{img['mime']};base64,{img['b64']}"},
                    }
                )
            result = self._vision_client.chat_completion(
                messages=[{"role": "user", "content": content}],
                max_tokens=max_tokens,
                temperature=temperature,
            )
            return result.choices[0].message.content.strip() or None
        except Exception:  # noqa: BLE001
            return None

    def chat(
        self,
        messages: Sequence[dict],
        *,
        max_tokens: int = 250,
        temperature: float = 0.3,
    ) -> str | None:
        try:
            result = self._client.chat_completion(
                messages=list(messages),
                max_tokens=max_tokens,
                temperature=temperature,
            )
            return result.choices[0].message.content.strip() or None
        except Exception as exc:  # noqa: BLE001
            # Say WHY — retired models (404), missing credits (402) and bad
            # tokens (401) all look identical ("it failed") when swallowed.
            print(f"[hf] chat failed on model '{self.model}': {exc}")
            return None

"""
Transformers backend — loads a model directly inside this process.

Heaviest option, but zero extra infrastructure: the service itself holds the
model in memory. Install the optional extras first:

    pip install "transformers>=4.44" torch accelerate

...and set AI_BACKEND=transformers plus TRANSFORMERS_MODEL. A small
instruct model (e.g. HuggingFaceTB/SmolLM2-1.7B-Instruct) runs on CPU for
demos; bigger models need a GPU.
"""

from __future__ import annotations

from typing import Sequence

from .base import BaseProvider


class TransformersProvider(BaseProvider):
    name = "transformers"

    def __init__(self, model_name: str):
        try:
            import torch
            from transformers import pipeline
        except ImportError as exc:  # pragma: no cover - depends on extras
            raise RuntimeError(
                "The transformers backend needs extra packages. Run: "
                'pip install "transformers>=4.44" torch accelerate'
            ) from exc

        device = "cuda" if torch.cuda.is_available() else "cpu"
        self._pipe = pipeline(
            "text-generation",
            model=model_name,
            device=device,
        )
        self.model = model_name
        self._tokenizer = self._pipe.tokenizer

    def chat(
        self,
        messages: Sequence[dict],
        *,
        max_tokens: int = 250,
        temperature: float = 0.3,
    ) -> str | None:
        try:
            prompt = self._tokenizer.apply_chat_template(
                list(messages), tokenize=False, add_generation_prompt=True
            )
            outputs = self._pipe(
                prompt,
                max_new_tokens=max_tokens,
                temperature=max(temperature, 0.01),
                do_sample=temperature > 0,
                return_full_text=False,
            )
            return (outputs[0].get("generated_text") or "").strip() or None
        except Exception:  # noqa: BLE001
            return None

"""
Vision input handling — turn an uploaded file into a list of base64 images.

Handles two shapes:
  * plain images (PNG / JPEG / WebP)   -> passed through as one image
  * PDFs (usually scans of papers)     -> every page rendered to a PNG via
                                          pypdfium2, capped at VISION_MAX_PAGES

The heavy PDF rendering dependency (pypdfium2) is optional at import time so
the service still boots without it — PDF vision then returns a clear error.
"""

from __future__ import annotations

import base64
import binascii

IMAGE_MIMES = {"image/png", "image/jpeg", "image/webp"}
PDF_MIME = "application/pdf"


class VisionInputError(ValueError):
    """Raised for anything wrong with the uploaded content (-> HTTP 422)."""


def images_from_upload(content_b64: str, mime: str, max_pages: int) -> list[dict]:
    """Return [{"b64": str, "mime": "image/png"}, ...] ready for a vision model."""
    try:
        raw = base64.b64decode(content_b64, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise VisionInputError("content is not valid base64.") from exc

    if len(raw) == 0:
        raise VisionInputError("content is empty.")

    mime = (mime or "").split(";")[0].strip().lower()

    if mime in IMAGE_MIMES:
        is_png = raw.startswith(b"\x89PNG\r\n\x1a\n")
        is_jpeg = raw.startswith(b"\xff\xd8")
        is_webp = raw[:4] == b"RIFF" and raw[8:12] == b"WEBP"
        if not (is_png or is_jpeg or is_webp):
            # The declared mime and the actual bytes disagree.
            raise VisionInputError("content does not look like a PNG/JPEG/WebP image.")
        return [{"b64": content_b64, "mime": mime}]

    if mime == PDF_MIME:
        if not raw.startswith(b"%PDF"):
            raise VisionInputError("content does not look like a PDF file.")
        try:
            import pypdfium2 as pdfium  # optional dependency
        except ImportError as exc:
            raise VisionInputError(
                "PDF rendering needs the 'pypdfium2' package "
                "(pip install pypdfium2 pillow)."
            ) from exc

        try:
            import io

            doc = pdfium.PdfDocument(io.BytesIO(raw))
        except Exception as exc:  # noqa: BLE001 — corrupted/unreadable PDF
            raise VisionInputError("Could not open the PDF — it may be corrupted.") from exc

        pages = min(len(doc), max(1, max_pages))
        images: list[dict] = []
        try:
            for i in range(pages):
                bitmap = doc[i].render(scale=2.0)  # ~150 DPI, readable for OCR
                pil = bitmap.to_pil()
                buf = io.BytesIO()
                pil.save(buf, format="PNG")
                images.append(
                    {"b64": base64.b64encode(buf.getvalue()).decode("ascii"), "mime": "image/png"}
                )
        finally:
            doc.close()
        return images

    raise VisionInputError(
        f"Unsupported mime '{mime}'. Use PNG, JPEG, WebP or PDF."
    )

"""Vision endpoint tests — photo & scanned-PDF question extraction.

Uses the mock backend (no real model needed). Images/PDFs are built inline
so the suite stays dependency-free and deterministic.
"""

from __future__ import annotations

import base64
import struct
import zlib

import pytest

MINIMAL_PDF = b"""%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 100]/Contents 4 0 R>>endobj
4 0 obj<</Length 44>>stream
BT /F1 12 Tf 20 50 Td (Hello) Tj ET
endstream
endobj
trailer<</Root 1 0 R>>"""


def make_png(width: int = 8, height: int = 8) -> bytes:
    """Hand-build a tiny valid PNG (white RGB) — no PIL needed."""
    raw = b"".join(b"\x00" + b"\xff" * (width * 3) for _ in range(height))

    def chunk(tag: bytes, data: bytes) -> bytes:
        c = tag + data
        return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c) & 0xFFFFFFFF)

    ihdr = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", ihdr)
        + chunk(b"IDAT", zlib.compress(raw))
        + chunk(b"IEND", b"")
    )


def png_b64() -> str:
    return base64.b64encode(make_png()).decode("ascii")


def pdf_b64() -> str:
    return base64.b64encode(MINIMAL_PDF).decode("ascii")


# --------------------------------------------------------------- endpoints


def test_parse_vision_png_returns_mock_questions(client):
    resp = client.post(
        "/edumock/parse-vision",
        json={"content": png_b64(), "mime": "image/png"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["count"] == 2
    assert all("MOCK-VISION" in q["question_text"] for q in body["questions"])
    assert body["source"] == "ai"


def test_parse_vision_misdeclared_mime_still_works(client):
    # declared jpeg but bytes are a PNG — valid image bytes are accepted
    # regardless of the declared mime (clients get this wrong all the time)
    resp = client.post(
        "/edumock/parse-vision",
        json={"content": png_b64(), "mime": "image/jpeg"},
    )
    assert resp.status_code == 200


def test_parse_vision_garbage_bytes_rejected(client):
    resp = client.post(
        "/edumock/parse-vision",
        json={"content": base64.b64encode(b"just some text, not an image").decode(), "mime": "image/png"},
    )
    assert resp.status_code == 422


def test_parse_vision_invalid_base64(client):
    resp = client.post(
        "/edumock/parse-vision",
        json={"content": "!!!not-base64!!!", "mime": "image/png"},
    )
    assert resp.status_code == 422


def test_parse_vision_unsupported_mime(client):
    resp = client.post(
        "/edumock/parse-vision",
        json={"content": png_b64(), "mime": "text/html"},
    )
    assert resp.status_code == 422


def test_parse_vision_pdf_renders_pages(client):
    pytest.importorskip("pypdfium2")
    resp = client.post(
        "/edumock/parse-vision",
        json={"content": pdf_b64(), "mime": "application/pdf"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["count"] == 2  # mock vision replies regardless of pixels
    assert body["source"] == "ai"


def test_parse_vision_pdf_bytes_not_pdf(client):
    resp = client.post(
        "/edumock/parse-vision",
        json={"content": png_b64(), "mime": "application/pdf"},
    )
    assert resp.status_code == 422


def test_parse_vision_requires_auth(secured_client):
    resp = secured_client.post(
        "/edumock/parse-vision",
        json={"content": png_b64(), "mime": "image/png"},
    )
    assert resp.status_code == 401


def test_images_from_upload_max_pages():
    from app.services.vision import images_from_upload

    # 1-page PDF with max_pages=8 -> 1 image
    imgs = images_from_upload(pdf_b64(), "application/pdf", 8)
    assert len(imgs) == 1
    assert imgs[0]["mime"] == "image/png"
    # decoded bytes must be a real PNG now
    assert base64.b64decode(imgs[0]["b64"]).startswith(b"\x89PNG")

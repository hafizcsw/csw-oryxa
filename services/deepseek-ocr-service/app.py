# ─────────────────────────────────────────────────────────────────────────────
# CSW-controlled DeepSeek-OCR service
#
# This is the OCR service that DEEPSEEK_OCR_ENDPOINT must point to.
# It is NOT https://api.deepseek.com/chat/completions — that is the DeepSeek
# Chat LLM API and must never be used as an OCR provider.
#
# Runtime: FastAPI + Uvicorn. Designed to run on a CSW-controlled GPU host.
# Model wiring (DeepSeek-OCR / DeepSeek-OCR-2 via Torch + vLLM/FlashAttention)
# is intentionally isolated in `run_deepseek_ocr` below so this skeleton can
# boot, serve /health, and return a structured `model_not_configured` failure
# from /v1/ocr until the actual inference code is enabled.
#
# Boundaries (do NOT cross):
#   - No CRM writes.
#   - No Supabase writes.
#   - No persistence of student files beyond the per-request temp file.
#   - No external OCR providers (Mistral / Google Vision / Textract / OpenAI).
#   - Returns OCR text/markdown only.
# ─────────────────────────────────────────────────────────────────────────────
from __future__ import annotations

import logging
import os
import tempfile
import time
import uuid
from contextlib import contextmanager
from typing import List, Literal, Optional

import httpx
from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

# ─── Config ──────────────────────────────────────────────────────────────────
SERVICE_NAME = "deepseek-ocr-service"
SERVICE_VERSION = "0.1.0"
ENGINE_ID = "deepseek_ocr_2"

DEEPSEEK_OCR_SERVICE_KEY = os.getenv("DEEPSEEK_OCR_SERVICE_KEY", "")
MODEL_DEVICE = os.getenv("MODEL_DEVICE", "cuda")
MODEL_NAME = os.getenv("MODEL_NAME", "deepseek-ai/DeepSeek-OCR-2")
MAX_FILE_MB = int(os.getenv("MAX_FILE_MB", "25"))
REQUEST_TIMEOUT_SECONDS = int(os.getenv("REQUEST_TIMEOUT_SECONDS", "120"))
LOG_LEVEL = os.getenv("LOG_LEVEL", "info").upper()

ALLOWED_MIME = {
    "application/pdf",
    "image/jpeg",
    "image/jpg",
    "image/png",
}

# ─── Logging ─────────────────────────────────────────────────────────────────
# Note: we intentionally never log full signed URLs or full OCR text.
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
log = logging.getLogger(SERVICE_NAME)


# ─── Model loader (placeholder) ──────────────────────────────────────────────
# Replace this with real model load once Torch / vLLM / FlashAttention and the
# DeepSeek-OCR weights are installed in the container. Keep the public surface
# (`MODEL_LOADED` + `run_deepseek_ocr`) stable so the API contract does not
# change when the real implementation lands.
MODEL_LOADED: bool = False


def _try_load_model() -> bool:
    """Attempt to load the DeepSeek-OCR model. Skeleton returns False."""
    # TODO(deepseek-ocr): import torch, load weights for MODEL_NAME on
    # MODEL_DEVICE, warm up vLLM / FlashAttention, then set MODEL_LOADED=True.
    return False


MODEL_LOADED = _try_load_model()


class OcrPage(BaseModel):
    page: int
    text: str
    markdown: str
    confidence: Optional[float] = None
    method: str = ENGINE_ID


def run_deepseek_ocr(
    file_path: str,
    mime_type: str,
    document_type_hint: str,
    trace_id: str,
) -> dict:
    """
    Run DeepSeek-OCR against a local file path.

    This is the ONLY function that should know about the underlying model.
    Until the real model is wired, it raises a structured ModelNotConfigured
    exception so the HTTP layer can return the contracted failure shape.
    """
    if not MODEL_LOADED:
        raise ModelNotConfigured()

    # TODO(deepseek-ocr): real inference goes here.
    # Expected return shape:
    # {
    #   "ocr_text": "...",
    #   "markdown": "...",
    #   "pages": [OcrPage(...).model_dump(), ...],
    #   "quality_flags": [],
    # }
    raise ModelNotConfigured()


class ModelNotConfigured(Exception):
    pass


# ─── HTTP models ─────────────────────────────────────────────────────────────
class HealthResponse(BaseModel):
    ok: bool
    service: str
    engine: str
    model_loaded: bool
    device: str
    version: str


class OcrRequest(BaseModel):
    signed_url: str = Field(..., min_length=1)
    mime_type: str
    file_name: str
    document_type_hint: Literal[
        "passport", "certificate", "transcript", "ielts", "unknown"
    ] = "unknown"
    trace_id: str


class OcrSuccess(BaseModel):
    ok: Literal[True] = True
    engine: str = ENGINE_ID
    ocr_text: str
    markdown: str
    pages: List[OcrPage]
    quality_flags: List[str] = []
    trace_id: str


class OcrFailure(BaseModel):
    ok: Literal[False] = False
    reason: str
    trace_id: str
    detail: Optional[str] = None


# ─── App ─────────────────────────────────────────────────────────────────────
app = FastAPI(title=SERVICE_NAME, version=SERVICE_VERSION)


def _require_auth(authorization: Optional[str]) -> None:
    if not DEEPSEEK_OCR_SERVICE_KEY:
        # Misconfiguration: refuse rather than allowing unauthenticated traffic.
        raise HTTPException(status_code=503, detail="service_key_not_configured")
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="missing_bearer")
    token = authorization.split(" ", 1)[1].strip()
    if token != DEEPSEEK_OCR_SERVICE_KEY:
        raise HTTPException(status_code=401, detail="invalid_bearer")


@contextmanager
def _temp_download(signed_url: str, mime_type: str):
    """
    Download the file from the short-lived signed URL into a temp path.
    Deletes the file on context exit. Never logs the URL.
    """
    suffix = ""
    if mime_type == "application/pdf":
        suffix = ".pdf"
    elif mime_type in ("image/jpeg", "image/jpg"):
        suffix = ".jpg"
    elif mime_type == "image/png":
        suffix = ".png"

    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    tmp_path = tmp.name
    tmp.close()
    try:
        max_bytes = MAX_FILE_MB * 1024 * 1024
        written = 0
        with httpx.stream(
            "GET", signed_url, timeout=REQUEST_TIMEOUT_SECONDS, follow_redirects=True
        ) as r:
            if r.status_code != 200:
                raise HTTPException(
                    status_code=502,
                    detail=f"download_failed_status_{r.status_code}",
                )
            with open(tmp_path, "wb") as f:
                for chunk in r.iter_bytes():
                    written += len(chunk)
                    if written > max_bytes:
                        raise HTTPException(
                            status_code=413, detail="file_too_large"
                        )
                    f.write(chunk)
        yield tmp_path
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(
        ok=True,
        service=SERVICE_NAME,
        engine=ENGINE_ID,
        model_loaded=MODEL_LOADED,
        device=MODEL_DEVICE,
        version=SERVICE_VERSION,
    )


@app.post("/v1/ocr")
def ocr(
    body: OcrRequest,
    request: Request,
    authorization: Optional[str] = Header(default=None),
):
    _require_auth(authorization)

    trace_id = body.trace_id or f"svc-{uuid.uuid4()}"

    if body.mime_type not in ALLOWED_MIME:
        return JSONResponse(
            status_code=415,
            content=OcrFailure(
                reason="unsupported_mime_type",
                trace_id=trace_id,
                detail=body.mime_type,
            ).model_dump(),
        )

    started = time.time()
    log.info(
        "ocr_request_received trace_id=%s file_name=%s mime=%s hint=%s",
        trace_id,
        body.file_name,
        body.mime_type,
        body.document_type_hint,
    )

    try:
        with _temp_download(body.signed_url, body.mime_type) as file_path:
            try:
                result = run_deepseek_ocr(
                    file_path=file_path,
                    mime_type=body.mime_type,
                    document_type_hint=body.document_type_hint,
                    trace_id=trace_id,
                )
            except ModelNotConfigured:
                latency_ms = int((time.time() - started) * 1000)
                log.warning(
                    "ocr_model_not_configured trace_id=%s file_name=%s latency_ms=%d",
                    trace_id,
                    body.file_name,
                    latency_ms,
                )
                return JSONResponse(
                    status_code=503,
                    content=OcrFailure(
                        reason="model_not_configured",
                        trace_id=trace_id,
                        detail="DeepSeek-OCR model is not wired in this build.",
                    ).model_dump(),
                )

        pages = [OcrPage(**p) for p in result.get("pages", [])]
        success = OcrSuccess(
            ocr_text=result.get("ocr_text", ""),
            markdown=result.get("markdown", ""),
            pages=pages,
            quality_flags=result.get("quality_flags", []),
            trace_id=trace_id,
        )
        latency_ms = int((time.time() - started) * 1000)
        log.info(
            "ocr_request_ok trace_id=%s file_name=%s pages=%d chars=%d latency_ms=%d",
            trace_id,
            body.file_name,
            len(pages),
            len(success.ocr_text),
            latency_ms,
        )
        return success

    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        latency_ms = int((time.time() - started) * 1000)
        log.error(
            "ocr_request_failed trace_id=%s file_name=%s latency_ms=%d error=%s",
            trace_id,
            body.file_name,
            latency_ms,
            exc.__class__.__name__,
        )
        return JSONResponse(
            status_code=500,
            content=OcrFailure(
                reason="deepseek_ocr_failed",
                trace_id=trace_id,
                detail=exc.__class__.__name__,
            ).model_dump(),
        )

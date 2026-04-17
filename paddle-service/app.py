"""Thin FastAPI wrapper around PaddleOCR PP-StructureV3.

Endpoint contract is documented in paddle-service/README.md and must
match the mapper in src/features/documents/document-ai/paddle-output-mapper.ts.

Fail-closed behavior:
  * Any model error returns a structured error JSON; the calling edge
    function will translate it into reason='service_error' and the engine
    will fall back to browser_heuristic.
  * Files are streamed from the supplied signed_url and discarded after
    structuring. Nothing is persisted.
"""
from __future__ import annotations

import os
import io
import time
import tempfile
from typing import Any, Optional

import httpx
from fastapi import FastAPI, HTTPException, Header
from pydantic import BaseModel, Field

# PaddleOCR import is intentionally lazy — keeps cold-start small for
# health checks and lets the container start even without weights.
_PIPE: Any = None
_PIPE_INIT_ERROR: Optional[str] = None


def _get_pipeline() -> Any:
    global _PIPE, _PIPE_INIT_ERROR
    if _PIPE is not None:
        return _PIPE
    try:
        # Import here so /healthz still works if paddleocr is partially broken.
        from paddleocr import PPStructure  # type: ignore
        _PIPE = PPStructure(
            show_log=False,
            ocr=True,
            table=True,
            layout=True,
            recovery=False,
            use_gpu=False,
            lang="en",
        )
        return _PIPE
    except Exception as e:  # noqa: BLE001
        _PIPE_INIT_ERROR = f"{type(e).__name__}: {e}"
        raise


API_KEY = os.environ.get("PADDLE_API_KEY")
DOWNLOAD_TIMEOUT = float(os.environ.get("DOWNLOAD_TIMEOUT_S", "20"))
MAX_BYTES = int(os.environ.get("MAX_BYTES", str(25 * 1024 * 1024)))  # 25 MB

app = FastAPI(title="paddle-structure", version="1.0.0")


class StructureRequest(BaseModel):
    signed_url: str = Field(..., min_length=1)
    mime_type: str
    file_name: str
    url_ttl_seconds: int = 60


@app.get("/healthz")
def healthz() -> dict[str, Any]:
    return {
        "ok": True,
        "pipeline_loaded": _PIPE is not None,
        "pipeline_init_error": _PIPE_INIT_ERROR,
    }


def _classify_role(layout_type: str) -> str:
    t = (layout_type or "").lower()
    if t in {"title"}:
        return "title"
    if t in {"header", "page_header"}:
        return "header"
    if t in {"footer", "page_footer", "page_number"}:
        return "footer"
    if "table" in t:
        return "table"
    if t in {"figure", "image"}:
        return "figure"
    return "text"


def _structure_pdf_or_image(local_path: str) -> dict[str, Any]:
    pipe = _get_pipeline()
    t0 = time.perf_counter()
    raw_pages = pipe(local_path)
    # paddleocr returns either a list (single image) or list of lists (PDF pages).
    if raw_pages and isinstance(raw_pages[0], dict):
        raw_pages = [raw_pages]

    out_pages: list[dict[str, Any]] = []
    for idx, page in enumerate(raw_pages, start=1):
        blocks: list[dict[str, Any]] = []
        tables: list[dict[str, Any]] = []
        text_chunks: list[str] = []
        for region in page:
            rtype = _classify_role(region.get("type", "text"))
            res = region.get("res") or {}
            if rtype == "table":
                # PP-Structure returns html under res['html']; we send a 2D grid
                # for the mapper. Fall back to splitting the rendered text rows.
                html = res.get("html") if isinstance(res, dict) else None
                cells: list[list[str]] = []
                if html:
                    cells = _html_table_to_cells(html)
                tables.append({
                    "cells": cells,
                    "confidence": float(region.get("score", 0) or 0),
                })
            else:
                # Text-ish block. PP-Structure returns res as list of dicts
                # with 'text' and 'confidence'.
                if isinstance(res, list):
                    chunk = "\n".join(
                        (item.get("text") or "").strip()
                        for item in res
                        if isinstance(item, dict)
                    ).strip()
                else:
                    chunk = str(res.get("text", "") if isinstance(res, dict) else "").strip()
                if chunk:
                    text_chunks.append(chunk)
                    blocks.append({
                        "role": rtype,
                        "text": chunk[:5000],
                        "confidence": float(region.get("score", 0) or 0),
                    })
        out_pages.append({
            "page_number": idx,
            "text": "\n".join(text_chunks)[:50_000],
            "blocks": blocks,
            "tables": tables,
        })

    return {
        "pages": out_pages,
        "reading_order": [p["page_number"] for p in out_pages],
        "build_time_ms": int((time.perf_counter() - t0) * 1000),
    }


def _html_table_to_cells(html: str) -> list[list[str]]:
    """Very small regex-free HTML row/cell splitter to avoid extra deps."""
    rows: list[list[str]] = []
    lower = html.lower()
    i = 0
    while True:
        tr_start = lower.find("<tr", i)
        if tr_start == -1:
            break
        tr_end = lower.find("</tr>", tr_start)
        if tr_end == -1:
            break
        row_html = html[tr_start:tr_end]
        cells: list[str] = []
        j = 0
        rl = row_html.lower()
        while True:
            cell_start = rl.find("<td", j)
            if cell_start == -1:
                cell_start = rl.find("<th", j)
            if cell_start == -1:
                break
            gt = rl.find(">", cell_start)
            cell_close = rl.find("</td>", gt)
            if cell_close == -1:
                cell_close = rl.find("</th>", gt)
            if cell_close == -1:
                break
            cell_text = row_html[gt + 1:cell_close]
            # strip any inner tags crudely
            stripped = []
            in_tag = False
            for ch in cell_text:
                if ch == "<":
                    in_tag = True
                elif ch == ">":
                    in_tag = False
                elif not in_tag:
                    stripped.append(ch)
            cells.append("".join(stripped).strip())
            j = cell_close + 5
        rows.append(cells)
        i = tr_end + 5
    return rows


@app.post("/v1/structure")
def structure(req: StructureRequest, authorization: Optional[str] = Header(default=None)) -> dict[str, Any]:
    # Optional bearer auth
    if API_KEY:
        if not authorization or not authorization.lower().startswith("bearer "):
            raise HTTPException(status_code=401, detail="missing_bearer")
        token = authorization.split(" ", 1)[1].strip()
        if token != API_KEY:
            raise HTTPException(status_code=401, detail="invalid_bearer")

    # Fetch the file via the short-lived signed URL.
    try:
        with httpx.Client(timeout=DOWNLOAD_TIMEOUT, follow_redirects=True) as client:
            r = client.get(req.signed_url)
            r.raise_for_status()
            data = r.content
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"fetch_failed: {type(e).__name__}")

    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="file_too_large")

    suffix = ".pdf" if req.mime_type == "application/pdf" else ".png"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=True) as tmp:
        tmp.write(data)
        tmp.flush()
        try:
            return _structure_pdf_or_image(tmp.name)
        except Exception as e:  # noqa: BLE001
            raise HTTPException(status_code=500, detail=f"structure_failed: {type(e).__name__}")

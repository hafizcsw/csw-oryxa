"""Thin FastAPI wrapper around PaddleOCR 3.x — PP-StructureV3.

Endpoint contract is documented in paddle-service/README.md and must
match the mapper in src/features/documents/document-ai/paddle-output-mapper.ts.

Why PP-StructureV3 (PaddleOCR 3.x) instead of legacy PPStructure:
  * End-to-end document parsing: layout + tables + OCR + reading order
    in one pipeline (no manual stitching).
  * Built on PP-OCRv5 — better multilingual recognition (incl. Arabic
    digits, Latin text, Chinese) which is what our students upload.
  * Returns structured Python objects with .json / .markdown accessors
    instead of opaque list-of-dicts; far easier to map to our
    StructuredDocumentArtifact.

Fail-closed behavior:
  * Any model error returns a structured error JSON; the calling edge
    function will translate it into reason='service_error' and the
    engine will fall back to browser_heuristic.
  * Files are streamed from the supplied signed_url and discarded after
    structuring. Nothing is persisted.
"""
from __future__ import annotations

import os
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
    """Initialise PP-StructureV3 once. CPU-only, no chart parsing
    (chart model is heavy and not needed for transcripts/IDs)."""
    global _PIPE, _PIPE_INIT_ERROR
    if _PIPE is not None:
        return _PIPE
    try:
        # New 3.x entrypoint. Old `from paddleocr import PPStructure`
        # is gone in 3.x.
        from paddleocr import PPStructureV3  # type: ignore

        _PIPE = PPStructureV3(
            use_doc_orientation_classify=True,   # auto-rotate scans
            use_doc_unwarping=False,             # heavy + we don't need it
            use_seal_recognition=False,
            use_chart_recognition=False,         # OOM risk on small CPUs
            use_formula_recognition=False,
            use_table_recognition=True,
            use_region_detection=True,
            device="cpu",
        )
        return _PIPE
    except Exception as e:  # noqa: BLE001
        _PIPE_INIT_ERROR = f"{type(e).__name__}: {e}"
        raise


API_KEY = os.environ.get("PADDLE_API_KEY")
DOWNLOAD_TIMEOUT = float(os.environ.get("DOWNLOAD_TIMEOUT_S", "20"))
MAX_BYTES = int(os.environ.get("MAX_BYTES", str(25 * 1024 * 1024)))  # 25 MB

app = FastAPI(title="paddle-structure", version="2.0.0")


class StructureRequest(BaseModel):
    signed_url: str = Field(..., min_length=1)
    mime_type: str
    file_name: str
    url_ttl_seconds: int = 60


@app.get("/healthz")
def healthz() -> dict[str, Any]:
    return {
        "ok": True,
        "engine": "PP-StructureV3 (PaddleOCR 3.x)",
        "pipeline_loaded": _PIPE is not None,
        "pipeline_init_error": _PIPE_INIT_ERROR,
    }


# ── Role classification ────────────────────────────────────────
# PP-StructureV3 uses richer layout labels than legacy PPStructure.
# We collapse them to the small role vocabulary the mapper expects.
_ROLE_MAP = {
    "doc_title": "title",
    "paragraph_title": "title",
    "title": "title",
    "header": "header",
    "page_header": "header",
    "footer": "footer",
    "page_footer": "footer",
    "page_number": "footer",
    "footnote": "footer",
    "table": "table",
    "figure": "figure",
    "image": "figure",
    "chart": "figure",
    "seal": "figure",
    "formula": "text",
    "abstract": "text",
    "content": "text",
    "reference": "text",
    "text": "text",
}


def _classify_role(layout_type: str) -> str:
    return _ROLE_MAP.get((layout_type or "").lower(), "text")


def _html_table_to_cells(html: str) -> list[list[str]]:
    """Tiny regex-free HTML row/cell splitter — avoids pulling lxml."""
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


def _extract_page(page_obj: Any, page_number: int) -> dict[str, Any]:
    """Extract a normalized page dict from one PP-StructureV3 result."""
    # PP-StructureV3 result objects expose .json (dict) and .markdown (dict).
    # Older intermediate builds expose ['res'] mapping. Be defensive.
    try:
        data = page_obj.json if hasattr(page_obj, "json") else page_obj
        if isinstance(data, dict) and "res" in data:
            data = data["res"]
    except Exception:  # noqa: BLE001
        data = {}

    parsing_results: list[dict[str, Any]] = []
    if isinstance(data, dict):
        # Common 3.x key — ordered list of layout regions with text/html.
        parsing_results = (
            data.get("parsing_res_list")
            or data.get("layout_parsing_result")
            or []
        )

    blocks: list[dict[str, Any]] = []
    tables: list[dict[str, Any]] = []
    text_chunks: list[str] = []

    for region in parsing_results:
        if not isinstance(region, dict):
            continue
        layout_type = (
            region.get("block_label")
            or region.get("type")
            or region.get("label")
            or "text"
        )
        role = _classify_role(layout_type)
        score = float(region.get("block_score") or region.get("score") or 0)

        if role == "table":
            html = (
                region.get("block_content")
                or region.get("html")
                or region.get("table_html")
                or ""
            )
            cells = _html_table_to_cells(html) if html else []
            tables.append({"cells": cells, "confidence": score})
            continue

        text_value = (
            region.get("block_content")
            or region.get("text")
            or ""
        )
        if isinstance(text_value, list):
            text_value = "\n".join(
                str(t.get("text", "") if isinstance(t, dict) else t)
                for t in text_value
            )
        text_value = str(text_value).strip()
        if not text_value:
            continue
        text_chunks.append(text_value)
        blocks.append({
            "role": role,
            "text": text_value[:5000],
            "confidence": score,
        })

    # Markdown fallback — guarantees we still have body text even if
    # the layout list shape changes between minor releases.
    if not text_chunks and hasattr(page_obj, "markdown"):
        try:
            md = page_obj.markdown
            md_text = md.get("markdown_texts") if isinstance(md, dict) else None
            if isinstance(md_text, str) and md_text.strip():
                text_chunks.append(md_text.strip())
        except Exception:  # noqa: BLE001
            pass

    return {
        "page_number": page_number,
        "text": "\n".join(text_chunks)[:50_000],
        "blocks": blocks,
        "tables": tables,
    }


def _structure_pdf_or_image(local_path: str) -> dict[str, Any]:
    pipe = _get_pipeline()
    t0 = time.perf_counter()

    # PP-StructureV3 returns a list of result objects (one per page for
    # PDFs, one element for single images).
    results = pipe.predict(local_path)
    pages_iter = list(results) if not isinstance(results, list) else results

    out_pages = [
        _extract_page(p, idx)
        for idx, p in enumerate(pages_iter, start=1)
    ]

    return {
        "pages": out_pages,
        "reading_order": [p["page_number"] for p in out_pages],
        "build_time_ms": int((time.perf_counter() - t0) * 1000),
        "engine": "PP-StructureV3",
    }


@app.post("/v1/structure")
def structure(
    req: StructureRequest,
    authorization: Optional[str] = Header(default=None),
) -> dict[str, Any]:
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
            raise HTTPException(status_code=500, detail=f"structure_failed: {type(e).__name__}: {e}")

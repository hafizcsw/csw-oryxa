# DeepSeek-OCR service (CSW-controlled)

This is the **CSW-controlled OCR service** that the Supabase
`deepseek-ocr-service` adapter calls via `DEEPSEEK_OCR_ENDPOINT`.

> ⚠️ `DEEPSEEK_OCR_ENDPOINT` must point to **this** service.
> It must **NOT** point to `https://api.deepseek.com/chat/completions` —
> that is the DeepSeek Chat LLM API and is not an OCR provider.

## Why it lives outside Supabase Edge

DeepSeek-OCR / DeepSeek-OCR-2 inference requires:

- Python 3.11
- PyTorch + CUDA
- vLLM / FlashAttention
- GPU + VRAM
- DeepSeek-OCR weights

Supabase Edge Functions are Deno/TypeScript serverless runtimes and cannot
host this workload. So the service lives in the same repository (CSW-owned)
but runs on a CSW-controlled GPU host.

## Status

`DeepSeek-OCR service skeleton = code-ready / deployment pending`

The skeleton boots, serves `/health`, validates auth, downloads the file
from a short-lived signed URL into a temp path, and returns a structured
`model_not_configured` failure from `/v1/ocr` until the real DeepSeek-OCR
inference is wired inside `run_deepseek_ocr` in `app.py`.

## API contract

### `GET /health`

Public. No auth.

```json
{
  "ok": true,
  "service": "deepseek-ocr-service",
  "engine": "deepseek_ocr_2",
  "model_loaded": false,
  "device": "cuda",
  "version": "0.1.0"
}
```

### `POST /v1/ocr`

Headers:

```
Authorization: Bearer <DEEPSEEK_OCR_SERVICE_KEY>
Content-Type: application/json
```

Body:

```json
{
  "signed_url": "<short-lived portal-drafts signed url>",
  "mime_type": "application/pdf | image/jpeg | image/png",
  "file_name": "passport.jpg",
  "document_type_hint": "passport | certificate | transcript | ielts | unknown",
  "trace_id": "..."
}
```

Success:

```json
{
  "ok": true,
  "engine": "deepseek_ocr_2",
  "ocr_text": "...",
  "markdown": "...",
  "pages": [
    { "page": 1, "text": "...", "markdown": "...", "confidence": null, "method": "deepseek_ocr_2" }
  ],
  "quality_flags": [],
  "trace_id": "..."
}
```

Failure shapes:

```json
{ "ok": false, "reason": "model_not_configured", "trace_id": "...", "detail": "..." }
{ "ok": false, "reason": "deepseek_ocr_failed",  "trace_id": "...", "detail": "..." }
```

## Required env vars

See `.env.example`.

| Var | Purpose |
| --- | --- |
| `DEEPSEEK_OCR_SERVICE_KEY` | Bearer token the Supabase adapter must send |
| `MODEL_DEVICE` | `cuda` on GPU host; `cpu` for skeleton only |
| `MODEL_NAME` | Hugging Face / local model id |
| `MAX_FILE_MB` | Per-request size cap (default 25) |
| `REQUEST_TIMEOUT_SECONDS` | Download + inference budget |
| `LOG_LEVEL` | `info` by default |

## Local run

```bash
cp .env.example .env
# edit DEEPSEEK_OCR_SERVICE_KEY
pip install -r requirements.txt
export $(grep -v '^#' .env | xargs)
uvicorn app:app --host 0.0.0.0 --port 8000
```

Smoke test:

```bash
curl http://localhost:8000/health

curl -X POST http://localhost:8000/v1/ocr \
  -H "Authorization: Bearer change-me" \
  -H "Content-Type: application/json" \
  -d '{"signed_url":"https://example.com/test.pdf","mime_type":"application/pdf","file_name":"test.pdf","document_type_hint":"unknown","trace_id":"local-smoke"}'
# → { "ok": false, "reason": "model_not_configured", ... }
```

## Docker

Build:

```bash
docker build -t deepseek-ocr-service:0.1.0 .
```

Run (skeleton):

```bash
docker run --rm -p 8000:8000 --env-file .env deepseek-ocr-service:0.1.0
```

## GPU deployment notes

To run real inference:

1. Switch the `Dockerfile` base image to a CUDA image (e.g.
   `nvidia/cuda:12.4.1-cudnn-runtime-ubuntu22.04`) and install Python 3.11.
2. Uncomment the GPU pip lines in the `Dockerfile` and `requirements.txt`
   (torch+cu124, vllm, flash-attn, transformers, accelerate, pypdfium2,
   pillow).
3. Implement `_try_load_model()` and `run_deepseek_ocr()` in `app.py` to load
   `MODEL_NAME` on `MODEL_DEVICE` and return the contracted result shape.
4. Run with `--gpus all` and a host that has the matching NVIDIA driver.
5. Front the service with TLS (e.g. Caddy) and set:
   - `DEEPSEEK_OCR_ENDPOINT=https://<host>/v1/ocr`
   - `DEEPSEEK_OCR_API_KEY=<DEEPSEEK_OCR_SERVICE_KEY>`
   in the Supabase project secrets.

## How the Supabase adapter calls this

The `supabase/functions/deepseek-ocr-service` Edge Function:

1. Generates a short-lived signed URL for the uploaded portal-drafts file.
2. POSTs to `DEEPSEEK_OCR_ENDPOINT` with the request body above and
   `Authorization: Bearer ${DEEPSEEK_OCR_API_KEY}`.
3. On success, persists the returned `ocr_text` / `markdown` /
   `quality_flags` into `oryxa_ocr_runs` with `engine_path = deepseek_ocr`.
4. On failure, surfaces the `reason` (`model_not_configured` →
   `deepseek_ocr_service_not_configured`, etc.) without any external
   fallback.

## Hard boundaries

- ❌ No CRM writes.
- ❌ No Supabase writes from this service.
- ❌ No persistence of student files beyond per-request temp file.
- ❌ No external OCR providers (Mistral / Google Vision / Textract / OpenAI).
- ❌ Never use `https://api.deepseek.com/chat/completions` as OCR.
- ✅ Returns OCR text / markdown / pages only.
- ✅ Logs only `trace_id`, `file_name`, `mime_type`, `pages`, `chars`,
  `latency_ms`, error code. Never logs full signed URLs or full OCR text.

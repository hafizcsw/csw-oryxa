# PaddleOCR PP-StructureV3 — Self-Hosted Service

This directory contains the deployment scaffolding for the **self-hosted Document AI service** that powers our `paddle_self_hosted` provider. The application code does **not** depend on this being running — when the endpoint is missing the engine fails closed and falls back to `browser_heuristic`.

---

## 1. What this service must expose

A single HTTP endpoint, called by the Supabase Edge Function `paddle-structure`:

```
POST  /v1/structure
Content-Type: application/json
Authorization: Bearer <PADDLE_API_KEY>            # optional but recommended

{
  "signed_url":       "https://...supabase.co/.../signed?token=...",
  "mime_type":        "application/pdf",
  "file_name":        "transcript.pdf",
  "url_ttl_seconds":  60
}
```

### Required response shape (HTTP 200)

```json
{
  "pages": [
    {
      "page_number": 1,
      "width": 1654,
      "height": 2339,
      "text": "...",
      "quality_score": 0.82,
      "blocks": [
        { "role": "title",  "text": "TRANSCRIPT", "confidence": 0.98 },
        { "role": "header", "text": "...",         "confidence": 0.91 },
        { "role": "text",   "text": "...",         "confidence": 0.88 }
      ],
      "tables": [
        { "cells": [["Code","Course","Grade","Credits"], ["CHEM101","..","A","3"]], "confidence": 0.86 }
      ]
    }
  ],
  "reading_order": [1, 2, 3],
  "build_time_ms": 2438
}
```

The mapping from this shape into our internal `StructuredDocumentArtifact` happens in `src/features/documents/document-ai/paddle-output-mapper.ts`. Raw PaddleOCR output **must not** leak past that file.

### Allowed `block.role` values (mapped)

| Role string                 | Maps to `LineGroup.role_hint` |
|-----------------------------|------------------------------|
| `title`, `header`, `page_header` | `header`                |
| `footer`, `page_footer`, `page_number` | `footer`           |
| anything containing `table` | `table_row`                  |
| everything else             | `body`                       |

Unknown roles are accepted and treated as `body`.

---

## 2. Runtime contract

- **Stateless.** The service must NOT persist incoming files or extracted content. The signed URL expires in ~60s.
- **No PII enrichment.** The service may not call third-party APIs with the document content.
- **Time budget.** The Edge Function aborts after 25s. The service should respond inside 20s for typical pages or stream / chunk if longer.

---

## 3. Deployment (suggested)

### Dockerfile

A minimal `Dockerfile` is provided that builds a PP-StructureV3 image and exposes a thin FastAPI wrapper at `:8000/v1/structure`. This file is a **scaffold** — adjust the model download, GPU/CPU base image, and worker count to match your VPS.

```bash
# build
docker build -t paddle-structure .

# run (CPU)
docker run --rm -p 8000:8000 \
  -e PADDLE_API_KEY=change-me \
  paddle-structure

# health
curl http://localhost:8000/healthz
```

### docker-compose

`docker-compose.yml` is provided for one-command bring-up on a VPS plus Caddy as a TLS terminator. Replace `paddle.example.com` with your hostname.

After bring-up, set the following Supabase secrets so the edge function can talk to your service:

| Secret | Example | Notes |
|---|---|---|
| `PADDLE_STRUCTURE_ENDPOINT` | `https://paddle.example.com/v1/structure` | full URL incl. `/v1/structure` |
| `PADDLE_API_KEY`            | random long string                        | optional; if set, sent as `Authorization: Bearer <key>` |

Until **both** secrets are set, the edge function returns `{ ok: false, reason: 'no_endpoint_configured' }` and the engine falls back to `browser_heuristic`. This is the expected, fail-closed default.

---

## 4. Failure semantics (must be preserved)

| Service behavior              | Edge `reason`             | Engine behavior            |
|-------------------------------|---------------------------|----------------------------|
| `PADDLE_STRUCTURE_ENDPOINT` unset | `no_endpoint_configured` | browser_heuristic fallback |
| HTTP 5xx                      | `service_5xx`             | browser_heuristic fallback |
| HTTP 4xx                      | `service_error`           | browser_heuristic fallback |
| Timeout                       | `timeout`                 | browser_heuristic fallback |
| Bad JSON / no `pages`         | `invalid_paddle_response` | browser_heuristic fallback |
| Storage path not owned by user | `storage_path_forbidden` | browser_heuristic fallback |

The engine never throws on any of these. UI surfaces `document_ai_mode` so reviewers can tell which provider was used.

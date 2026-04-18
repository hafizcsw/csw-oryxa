# paddle-service — Operator Handoff

This is the **internal self-hosted document engine** that processes student
documents end-to-end. It runs **outside** Lovable Cloud (Lovable cannot host
Python containers) on a small VPS you control.

---

## Who calls what

```
Browser (StudyFileTab)
   │ uploads to bucket  student-docs (path: user/<profile_id>/<ts>_<name>)
   │ then triggers analyzeFile(file, docId, slotHint, storage_path)
   ▼
analysis-engine.ts
   │ reads file (pdfjs/tesseract — fallback only)
   │ calls resolveStructuredArtifact({ ai_request: { storage_path, … } })
   ▼
supabase/functions/paddle-structure (edge proxy)
   │ verifies caller owns the storage_path (RLS-style check)
   │ creates 60s signed URL on bucket  student-docs
   │ POSTs { signed_url, mime_type, file_name } to PADDLE_STRUCTURE_ENDPOINT
   ▼
paddle-service  (this directory, on YOUR VPS)
   │ downloads the file via the signed URL
   │ runs PaddleOCR 3.x · PP-StructureV3 (CPU)
   │ returns { pages:[{text, blocks, tables}], reading_order, … }
```

If `PADDLE_STRUCTURE_ENDPOINT` is unset OR the service is down,
the engine fails closed and falls back to the in-browser
heuristic (Tesseract.js + pdf.js). This is logged with
`reason='no_endpoint_configured'` or `reason='service_5xx'` etc.

---

## One-time deployment (15 minutes)

### 1. Provision a VPS

Minimum spec: **2 vCPU / 4 GB RAM / 20 GB SSD**.
Tested providers:
- Hetzner CX22 (€4.5/mo) — recommended
- DigitalOcean 2 GB ($12/mo)
- Vultr Cloud Compute 2 GB ($10/mo)

Pick a region near your Supabase region for low signed-URL fetch latency.

### 2. Point a domain at it

Create an `A` record:
```
paddle.<your-domain>   →   <vps-public-ip>
```
Wait for DNS to propagate (`dig paddle.<your-domain>`).

### 3. Copy this folder to the VPS

From your laptop:
```bash
scp -r paddle-service root@<vps-ip>:/root/
```

### 4. Run the deployment script

SSH in and run:
```bash
ssh root@<vps-ip>
cd /root/paddle-service
DOMAIN=paddle.<your-domain> bash deploy-vps.sh
```

The script will:
- install Docker + Caddy
- build the PaddleOCR 3.x container
- start it on `127.0.0.1:8000`
- configure Caddy with auto-HTTPS
- print the **endpoint URL** and the **generated API key**

### 5. Wire into Lovable Cloud

Open Edge Function secrets and add:

| Secret name                  | Value                                             |
|------------------------------|---------------------------------------------------|
| `PADDLE_STRUCTURE_ENDPOINT`  | `https://paddle.<your-domain>/v1/structure`       |
| `PADDLE_API_KEY`             | (printed by the script)                           |

The Supabase edge function picks them up automatically on the next invocation.

### 6. Verify end-to-end

1. Open `/account?tab=study-file`
2. Upload a passport image
3. Watch the **EngineActivityStrip** — you should see real stages flow through
4. Check the analysis card — it should show
   `document_ai_mode: paddle_self_hosted` in the diagnostic envelope
5. Check the browser console for `[DocumentAI:Resolved] mode_used: "paddle_self_hosted"`

---

## Operations

```bash
# Tail container logs
docker compose -f /opt/paddle-service/docker-compose.yml logs -f

# Restart after a code change (re-copy app.py first)
docker compose -f /opt/paddle-service/docker-compose.yml up -d --build

# Caddy reload after editing /etc/caddy/Caddyfile
systemctl reload caddy

# Health check
curl https://paddle.<your-domain>/healthz
```

---

## Cost summary

| Item                      | Monthly   |
|---------------------------|-----------|
| Hetzner CX22 VPS          | €4.50     |
| Domain (you already own)  | €0        |
| Bandwidth                 | included  |
| **Total**                 | **~€5**   |

PaddleOCR weights are cached inside the container after first request
(~250 MB), so repeated analyses are fast (typical 1.5–4 s per page on CPU).

---

## Security model

- Service listens only on `127.0.0.1:8000` — never exposed directly.
- Caddy terminates TLS and enforces auto-HTTPS via Let's Encrypt.
- Supabase edge function authenticates with `Bearer ${PADDLE_API_KEY}`.
- Files reach the service only as **short-lived signed URLs** (60 s TTL)
  on YOUR Supabase Storage bucket. The service downloads, processes,
  and discards them — nothing is persisted on the VPS.
- The student's user_id is matched against the storage path before the
  signed URL is issued (`storage_path_forbidden` otherwise).

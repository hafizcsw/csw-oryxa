# Paddle Service — Deployment Handoff

This is the **single source of truth** for bringing the self-hosted
PaddleOCR PP-StructureV3 service online. Code is 100% ready in this repo.
Your job is ~6 commands on a VPS plus 2 Supabase secrets.

---

## 0. What you need before starting

| Item | Notes |
|---|---|
| A Linux VPS | 4 vCPU / 8 GB RAM minimum (CPU-only PaddleOCR). Ubuntu 22.04+ recommended. |
| A public DNS hostname | e.g. `paddle.yourdomain.com` — must have an A record pointing to the VPS public IP **before** step 3, or Let's Encrypt will fail. |
| Docker + Docker Compose v2 | `curl -fsSL https://get.docker.com \| sh` then `sudo usermod -aG docker $USER` (re-login). |
| Ports 80 + 443 open | Caddy needs both for ACME HTTP-01 challenge + serving traffic. |
| Access to Supabase project | To paste 2 secrets at the end. |

---

## 1. Copy the `paddle-service/` folder to the VPS

From your laptop (or CI):

```bash
# Replace <vps> with user@host
scp -r paddle-service/ <vps>:/opt/paddle-service/
ssh <vps>
cd /opt/paddle-service
```

You should see:
```
app.py  Caddyfile  docker-compose.yml  Dockerfile  .env.example  HANDOFF.md  README.md  requirements.txt
```

---

## 2. Create `.env`

```bash
cp .env.example .env

# Generate a strong API key (save this — you will paste it into Supabase later):
openssl rand -hex 32

# Edit the file and set:
#   PADDLE_API_KEY  = <the value you just generated>
#   PADDLE_HOSTNAME = paddle.yourdomain.com
#   ACME_EMAIL      = you@yourdomain.com
nano .env
```

---

## 3. Start the service

```bash
docker compose up -d --build
```

First build downloads PaddleOCR weights (~500 MB) and may take 5–10 min.
Subsequent restarts are instant.

Watch logs until you see Caddy obtain a cert and uvicorn say `Application startup complete.`:

```bash
docker compose logs -f
# Ctrl-C once both services look healthy
```

---

## 4. Health check (run from anywhere)

```bash
curl -fsS https://paddle.yourdomain.com/healthz
```

Expected (HTTP 200):
```json
{"ok": true, "pipeline_loaded": false, "pipeline_init_error": null}
```

`pipeline_loaded:false` is **expected** — the model is lazy-loaded on the first
real request to keep cold-start small. It will flip to `true` after the first
`/v1/structure` call succeeds.

If this fails see **Troubleshooting** at the bottom.

---

## 5. Smoke test (proves the full path works)

This calls the structure endpoint with a tiny public test PDF. Run from your
laptop or the VPS:

```bash
# Replace HOST and KEY with your real values.
HOST="https://paddle.yourdomain.com"
KEY="<the PADDLE_API_KEY you generated in step 2>"

curl -sS -X POST "$HOST/v1/structure" \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "signed_url": "https://www.africau.edu/images/default/sample.pdf",
    "mime_type":  "application/pdf",
    "file_name":  "sample.pdf",
    "url_ttl_seconds": 60
  }' | head -c 500
```

Expected: a JSON response starting with `{"pages":[{"page_number":1,...`
and ending with `"build_time_ms": <number>}`.

If you see `{"detail":"invalid_bearer"}` → wrong `KEY`.
If you see `{"detail":"fetch_failed: ..."}` → VPS cannot reach the test URL
(unrelated to your setup; try a different public PDF).

---

## 6. Wire it into Supabase

Go to **Supabase Dashboard → Project Settings → Edge Functions → Secrets**
and add **two** secrets:

| Secret name                  | Value                                            |
|------------------------------|--------------------------------------------------|
| `PADDLE_STRUCTURE_ENDPOINT`  | `https://paddle.yourdomain.com/v1/structure`     |
| `PADDLE_API_KEY`             | the `openssl rand -hex 32` value from step 2     |

The edge function `paddle-structure` reads these on every request — no redeploy
needed. Until **both** are set, the engine returns `provider: 'none'` /
`reason: 'no_endpoint_configured'` and falls back to `browser_heuristic` (the
intended fail-closed behavior).

---

## 7. What to send back so I can close runtime proof

Reply to me with **all of the following**:

1. The exact `PADDLE_HOSTNAME` you used (so I can verify the endpoint URL).
2. The output of `curl -fsS https://<host>/healthz` (full JSON).
3. The first 500 chars of the smoke-test response from step 5.
4. Confirmation that both Supabase secrets are saved (just say "secrets saved").
5. Then upload **4 test files** through the normal app flow at `/account?tab=study-file`:
   - one transcript (PDF or image)
   - one graduation certificate
   - one language certificate (IELTS/TOEFL)
   - one mixed/ambiguous document

Once I have those, I will pull the runtime traces and produce the final
runtime-closed report (provider used, builder used, lane, readability,
artifact summary, extracted fields, proposal statuses) for each file.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `curl /healthz` → connection refused | DNS not pointing to VPS yet, or ports 80/443 blocked | `dig +short paddle.yourdomain.com` should return your VPS IP. Open ports in firewall / cloud security group. |
| Caddy logs show `obtain: ... no such host` | DNS not propagated | Wait 5–15 min, then `docker compose restart caddy`. |
| Caddy logs show `acme: ... 429` | Hit Let's Encrypt rate limit during testing | Switch to staging temporarily: add `acme_ca https://acme-staging-v02.api.letsencrypt.org/directory` inside the `{ }` block in `Caddyfile`. |
| `/v1/structure` → 500 `structure_failed: ...` | First-call model download failed (no internet from container, low RAM) | `docker compose logs paddle` — usually OOM (need ≥8 GB) or blocked egress. |
| `/v1/structure` → 401 `invalid_bearer` | Token mismatch | The value in Supabase `PADDLE_API_KEY` must be **byte-for-byte** the same as `PADDLE_API_KEY` in `.env`. |
| `/v1/structure` → 413 `file_too_large` | Document > 25 MB | Bump `MAX_BYTES` in `.env`, `docker compose up -d`. |

---

## Operations

- **Update the service:** `git pull && docker compose up -d --build`
- **View logs:** `docker compose logs -f paddle` or `... caddy`
- **Stop:** `docker compose down`  (data + certs preserved in named volumes)
- **Rotate API key:** generate a new value, update `.env`, `docker compose up -d`,
  then update the Supabase secret. The old key stops working immediately on restart.
- **Backup:** nothing to back up — the service is stateless. Caddy's TLS state
  in `caddy_data` will be re-issued automatically if lost.

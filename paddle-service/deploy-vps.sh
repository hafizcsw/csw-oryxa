#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# paddle-service · One-shot VPS deployment script
# ═══════════════════════════════════════════════════════════════
# Tested on Ubuntu 22.04 / Debian 12. Run as root (or sudo).
#
# Usage:
#   1. SSH into a fresh VPS (Hetzner CX22 / DO 2GB minimum recommended)
#   2. Set DOMAIN + PADDLE_API_KEY env vars below or via prompt
#   3. curl -fsSL https://raw.githubusercontent.com/<your-fork>/main/paddle-service/deploy-vps.sh | sudo bash
#      OR scp this file + run it locally on the VPS
#
# What it does (idempotent — safe to re-run):
#   - Installs Docker + docker compose plugin + Caddy
#   - Clones/updates the paddle-service from this repo
#   - Generates a strong PADDLE_API_KEY if you don't supply one
#   - Builds the container (PaddleOCR 3.x · PP-StructureV3, CPU)
#   - Starts it under systemd, behind Caddy with auto-HTTPS
#   - Prints the endpoint URL + API key for you to paste into
#     Lovable Cloud secrets (PADDLE_STRUCTURE_ENDPOINT, PADDLE_API_KEY)
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

# ── Configurable (env-overridable) ────────────────────────────
DOMAIN="${DOMAIN:-}"
PADDLE_API_KEY="${PADDLE_API_KEY:-}"
INSTALL_DIR="${INSTALL_DIR:-/opt/paddle-service}"
SERVICE_USER="${SERVICE_USER:-paddle}"
APP_PORT="${APP_PORT:-8000}"

# ── Helpers ───────────────────────────────────────────────────
log() { echo -e "\033[1;36m▶\033[0m $*"; }
err() { echo -e "\033[1;31m✗\033[0m $*" >&2; }
ok()  { echo -e "\033[1;32m✓\033[0m $*"; }

require_root() {
  if [[ $EUID -ne 0 ]]; then
    err "Run as root: sudo bash $0"
    exit 1
  fi
}

prompt_if_missing() {
  if [[ -z "$DOMAIN" ]]; then
    read -rp "Public domain for the service (e.g. paddle.example.com, must point to this server): " DOMAIN
  fi
  if [[ -z "$DOMAIN" ]]; then
    err "DOMAIN is required for HTTPS. Aborting."
    exit 1
  fi
  if [[ -z "$PADDLE_API_KEY" ]]; then
    PADDLE_API_KEY="$(openssl rand -hex 32)"
    log "Generated new PADDLE_API_KEY (save it!)"
  fi
}

install_docker() {
  if command -v docker >/dev/null 2>&1; then
    ok "Docker already installed"
    return
  fi
  log "Installing Docker..."
  apt-get update -y
  apt-get install -y ca-certificates curl gnupg lsb-release
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/debian/gpg | \
    gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
    https://download.docker.com/linux/$(. /etc/os-release && echo "$ID") \
    $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
  ok "Docker installed"
}

install_caddy() {
  if command -v caddy >/dev/null 2>&1; then
    ok "Caddy already installed"
    return
  fi
  log "Installing Caddy..."
  apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | \
    gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | \
    tee /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y
  apt-get install -y caddy
  ok "Caddy installed"
}

stage_app() {
  log "Staging app to ${INSTALL_DIR}..."
  mkdir -p "${INSTALL_DIR}"
  # Copy the three files we need (the operator runs this from a checkout).
  # If the script lives next to the source files, copy them; otherwise
  # the operator must scp them up before running.
  local src_dir
  src_dir="$(cd "$(dirname "$0")" && pwd)"
  for f in app.py requirements.txt Dockerfile; do
    if [[ -f "${src_dir}/${f}" ]]; then
      cp "${src_dir}/${f}" "${INSTALL_DIR}/${f}"
    elif [[ ! -f "${INSTALL_DIR}/${f}" ]]; then
      err "Missing ${f}. Place the paddle-service/ folder next to this script or copy it to ${INSTALL_DIR} first."
      exit 1
    fi
  done

  # docker-compose for the service
  cat > "${INSTALL_DIR}/docker-compose.yml" <<COMPOSE
services:
  paddle:
    build: .
    image: paddle-structure:local
    container_name: paddle-structure
    restart: unless-stopped
    ports:
      - "127.0.0.1:${APP_PORT}:8000"
    environment:
      PADDLE_API_KEY: "\${PADDLE_API_KEY}"
      DOWNLOAD_TIMEOUT_S: "20"
      MAX_BYTES: "26214400"
    healthcheck:
      test: ["CMD", "curl", "-fsS", "http://127.0.0.1:8000/healthz"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 90s
COMPOSE

  # .env consumed by docker compose (gitignored in real deploys)
  cat > "${INSTALL_DIR}/.env" <<EOF
PADDLE_API_KEY=${PADDLE_API_KEY}
EOF
  chmod 600 "${INSTALL_DIR}/.env"
  ok "App staged"
}

write_caddyfile() {
  log "Writing Caddyfile for ${DOMAIN}..."
  cat > /etc/caddy/Caddyfile <<CADDY
# Auto-HTTPS reverse proxy for paddle-structure
${DOMAIN} {
    encode gzip

    # The service binds to 127.0.0.1:${APP_PORT}; only Caddy is exposed.
    reverse_proxy 127.0.0.1:${APP_PORT} {
        # Long enough for OCR of multi-page PDFs.
        transport http {
            response_header_timeout 60s
            read_timeout            60s
            write_timeout           60s
        }
    }

    # Strip headers that would leak Caddy version info.
    header {
        -Server
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
        X-Content-Type-Options    "nosniff"
        Referrer-Policy           "no-referrer"
    }

    log {
        output file /var/log/caddy/paddle.log {
            roll_size 10mb
            roll_keep 5
        }
        format console
    }
}
CADDY
  systemctl reload caddy || systemctl restart caddy
  ok "Caddy configured"
}

build_and_start() {
  log "Building container (first build ~5-10 min, downloads PaddleOCR weights on first request)..."
  cd "${INSTALL_DIR}"
  docker compose build
  docker compose up -d
  ok "Service started"
}

wait_healthy() {
  log "Waiting for service to become healthy..."
  for i in $(seq 1 60); do
    if curl -fsS "http://127.0.0.1:${APP_PORT}/healthz" >/dev/null 2>&1; then
      ok "Service is healthy"
      return
    fi
    sleep 2
  done
  err "Service did not become healthy in 120s. Check: docker logs paddle-structure"
  exit 1
}

print_summary() {
  cat <<SUMMARY

═══════════════════════════════════════════════════════════════
  ✅  paddle-service deployed
═══════════════════════════════════════════════════════════════

  Endpoint URL :  https://${DOMAIN}/v1/structure
  Health check :  https://${DOMAIN}/healthz
  API key      :  ${PADDLE_API_KEY}

  Add these as Lovable Cloud secrets (Settings → Edge function secrets):
    PADDLE_STRUCTURE_ENDPOINT = https://${DOMAIN}/v1/structure
    PADDLE_API_KEY            = ${PADDLE_API_KEY}

  Smoke test from your laptop:
    curl https://${DOMAIN}/healthz
    # Expect: {"ok":true,"engine":"PP-StructureV3 (PaddleOCR 3.x)",...}

  Operations:
    docker compose -f ${INSTALL_DIR}/docker-compose.yml logs -f
    systemctl status caddy
    systemctl reload caddy   # after Caddyfile edits
═══════════════════════════════════════════════════════════════
SUMMARY
}

main() {
  require_root
  prompt_if_missing
  install_docker
  install_caddy
  stage_app
  write_caddyfile
  build_and_start
  wait_healthy
  print_summary
}

main "$@"

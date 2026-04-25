# ─────────────────────────────────────────────────────────────────────────────
# CSW-controlled DeepSeek-OCR service — Dockerfile
#
# This skeleton image is CPU-only and boots /health + returns
# `model_not_configured` from /v1/ocr. Real inference requires switching to a
# CUDA base image and enabling the GPU dependencies (see comments below and
# requirements.txt).
# ─────────────────────────────────────────────────────────────────────────────
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

# Minimal system deps. For GPU, switch to e.g.
#   nvidia/cuda:12.4.1-cudnn-runtime-ubuntu22.04
# and install python3.11 + the CUDA-enabled torch/vllm wheels.
RUN apt-get update && apt-get install -y --no-install-recommends \
        curl \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt ./
RUN pip install --upgrade pip && pip install -r requirements.txt

# ── GPU image only — uncomment when wiring real model ──────────────────────
# RUN pip install --extra-index-url https://download.pytorch.org/whl/cu124 \
#       torch==2.4.0
# RUN pip install vllm flash-attn transformers accelerate pillow pypdfium2

COPY app.py ./

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD curl -fsS http://127.0.0.1:8000/health || exit 1

# Single worker — model state is process-local once wired.
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]

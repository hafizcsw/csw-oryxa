# ───────────────────────────────────────────────────────────────
# PaddleOCR 3.x · PP-StructureV3 — self-hosted scaffold
# CPU build. For GPU, switch base image to a CUDA variant and
# install `paddlepaddle-gpu==3.0.0` from the GPU index instead.
# ───────────────────────────────────────────────────────────────
FROM python:3.10-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

# System deps required by PaddleOCR (libgl/libglib for OpenCV,
# libgomp for paddle's OpenMP runtime).
RUN apt-get update && apt-get install -y --no-install-recommends \
        libgl1 \
        libglib2.0-0 \
        libgomp1 \
        curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt ./
# paddlepaddle 3.x CPU wheels live on PaddlePaddle's own index, not
# PyPI. We pass the index as an extra so paddleocr (PyPI) still
# resolves normally.
RUN pip install --upgrade pip && \
    pip install \
        --extra-index-url https://www.paddlepaddle.org.cn/packages/stable/cpu/ \
        -r requirements.txt

COPY app.py ./

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
  CMD curl -fsS http://127.0.0.1:8000/healthz || exit 1

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]

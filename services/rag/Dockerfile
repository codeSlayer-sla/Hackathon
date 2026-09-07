# RAG service: needs the QVAC Python SDK, which hosts its worker via Node.js
# (>=22.17), so this image carries both runtimes.
FROM python:3.11-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates gnupg \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /srv

# Shared contracts package first (better layer caching than the app code).
COPY shared/py /srv/shared
RUN pip install --no-cache-dir /srv/shared

COPY services/rag/requirements.txt /srv/requirements.txt
RUN pip install --no-cache-dir -r /srv/requirements.txt \
    && python -m tetherto.qvac_sdk install-worker || true

COPY services/rag/app /srv/app

ENV QVAC_CACHE_DIR=/data/qvac-models
VOLUME ["/data/qvac-models"]

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

# Generic QVAC peer image, shared by Medium and Large/GPU providers.
# Which one it becomes is decided entirely by env vars in docker-compose
# (NODE_ID, ROLE, MODEL_TIER, MODEL_NAME, PRICE_PER_1K_TOKENS) -- never
# by the image itself, so any laptop can become any peer.
FROM python:3.11-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates gnupg \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /srv

COPY shared/py /srv/shared
RUN pip install --no-cache-dir /srv/shared

COPY services/peer/requirements.txt /srv/requirements.txt
RUN pip install --no-cache-dir -r /srv/requirements.txt \
    && python -m tetherto.qvac_sdk install-worker || true

COPY services/peer/app /srv/app

ENV QVAC_CACHE_DIR=/data/qvac-models
VOLUME ["/data/qvac-models"]

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

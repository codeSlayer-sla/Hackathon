# Installed Base service: pure orchestration (calls the Router's peer
# registry + a Peer's /infer over HTTP for the AI extraction). No QVAC SDK,
# no Node.js -- same reasoning as the Router's Dockerfile: this service
# never runs inference itself.
FROM python:3.11-slim

WORKDIR /srv

COPY shared/py /srv/shared
RUN pip install --no-cache-dir /srv/shared

COPY services/installed-base/requirements.txt /srv/requirements.txt
RUN pip install --no-cache-dir -r /srv/requirements.txt

COPY services/installed-base/app /srv/app

VOLUME ["/data"]
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

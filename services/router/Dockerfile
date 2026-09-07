# Router: orchestrates RAG + Peers over plain HTTP. Deliberately does NOT
# depend on the QVAC SDK or Node.js -- the backend must never become the
# place where inference actually happens.
FROM python:3.11-slim

WORKDIR /srv

COPY shared/py /srv/shared
RUN pip install --no-cache-dir /srv/shared

COPY services/router/requirements.txt /srv/requirements.txt
RUN pip install --no-cache-dir -r /srv/requirements.txt

COPY services/router/app /srv/app

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

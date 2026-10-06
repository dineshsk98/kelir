# One image: the built web app and the API that serves it (and runs the delivery loop).

# 1. Build the web app
FROM node:22-alpine AS web
WORKDIR /web
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# 2. The API, with the built web app beside it (backend/app/config.py finds frontend/dist
#    relative to the repo root, here /app)
FROM python:3.11-slim
ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
WORKDIR /app
COPY backend/requirements.txt backend/requirements.txt
RUN pip install -r backend/requirements.txt
COPY backend/ backend/
COPY --from=web /web/dist frontend/dist

# Uploaded photos, audio and video live here: mount a volume on it. The app runs as an
# ordinary user, not root, so a hole in the app is not a root shell in the container.
ENV UPLOADS_DIR=/data/uploads
RUN useradd --system --uid 10001 --no-create-home app && mkdir -p /data/uploads && chown -R app /data
VOLUME /data
EXPOSE 8000
USER app

# One worker: the delivery loop runs inside the API process, so a second worker would
# run a second loop (safe, but pointless). Migrations run first, every start.
WORKDIR /app/backend
CMD ["sh", "-c", "alembic upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips='*'"]

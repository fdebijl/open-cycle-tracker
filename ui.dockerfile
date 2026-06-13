# syntax=docker/dockerfile:1

# Open Cycle Tracker — UI image (Vite/React SPA served as static files by nginx).
# Build context is the repo root: `docker build -f ui.dockerfile .`
#
# NOTE: Vite inlines VITE_API_URL at *build* time, so the API URL is baked into
# the published image. Self-hosters who need a different API origin must rebuild
# with `--build-arg VITE_API_URL=https://api.example.com` rather than setting an
# env var at `docker run` time.

# ---- builder: produce the static bundle in dist/ ----------------------------
FROM node:20-bookworm-slim AS builder
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

COPY ui/package.json ui/pnpm-lock.yaml ui/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

ARG VITE_API_URL=http://localhost:3000
ENV VITE_API_URL=$VITE_API_URL
COPY ui/ ./
RUN pnpm build

# ---- runtime: nginx serving the SPA -----------------------------------------
FROM nginx:1.27-alpine AS runtime

# SPA routing: every unknown path falls back to index.html so React Router can
# handle deep links (/calendar, /cycles/:id, …). HTML is never cached so a new
# deploy is picked up immediately; the content-hashed assets cache forever.
RUN cat > /etc/nginx/conf.d/default.conf <<'NGINX'
server {
  listen 80;
  server_name _;
  root /usr/share/nginx/html;
  index index.html;

  location / {
    try_files $uri $uri/ /index.html;
  }

  location /assets/ {
    expires 1y;
    add_header Cache-Control "public, immutable";
  }

  location = /index.html {
    add_header Cache-Control "no-cache";
  }
}
NGINX

COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null 2>&1 || exit 1

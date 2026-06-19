# syntax=docker/dockerfile:1

# Open Cycle Tracker - UI image (Vite/React SPA served as static files by nginx).
# Build context is the repo root: `docker build -f ui.dockerfile .`
#
# API URL is configurable at RUNTIME: the entrypoint writes /config.js (an ES
# module exporting `apiUrl` and `demoMode`) from $PUBLIC_API_URL / $PUBLIC_DEMO_MODE
# on container start, and the app dynamic-imports it at startup, falling back to
# the build-time VITE_API_URL (see ui/src/config/env.ts). So the published image
# can be pointed at any API origin (and flipped into demo mode) with env vars, no
# rebuild needed:
#   docker run -e PUBLIC_API_URL=https://api.example.com -e PUBLIC_DEMO_MODE=true ...
# The build-time --build-arg VITE_API_URL still works as the baked-in default
# for when PUBLIC_API_URL is unset.

FROM node:24-bookworm-slim AS builder
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

COPY ui/package.json ui/pnpm-lock.yaml ui/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

ARG VITE_API_URL=http://localhost:3000
ENV VITE_API_URL=$VITE_API_URL
COPY ui/ ./
RUN pnpm build

FROM nginx:1.27-alpine AS runtime

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

  # Runtime config is regenerated per container start - never cache it, or a
  # stale apiUrl survives a redeploy with a changed PUBLIC_API_URL.
  location = /config.js {
    add_header Cache-Control "no-store";
  }
}
NGINX

# Runtime config generator. The stock nginx entrypoint runs every executable
# *.sh in /docker-entrypoint.d before launching nginx, so this writes /config.js
# from $PUBLIC_API_URL / $PUBLIC_DEMO_MODE on each start. Empty/unset apiUrl -> ""
# which the app treats as "fall back to the build-time default". The URL is
# JS-escaped so quotes/backslashes can't break out of the string literal;
# demoMode is emitted as a bare boolean (true only when PUBLIC_DEMO_MODE=true).
RUN cat > /docker-entrypoint.d/40-oct-config.sh <<'SH' && chmod +x /docker-entrypoint.d/40-oct-config.sh
#!/bin/sh
set -e
escaped=$(printf '%s' "${PUBLIC_API_URL:-}" | sed 's/\\/\\\\/g; s/"/\\"/g')
demo=false
[ "${PUBLIC_DEMO_MODE:-}" = "true" ] && demo=true
cat > /usr/share/nginx/html/config.js <<EOF
export const apiUrl = "${escaped}";
export const demoMode = ${demo};
EOF
echo "oct: wrote /config.js (apiUrl=${PUBLIC_API_URL:-<unset, using build-time default>}, demoMode=${demo})"
SH

COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null 2>&1 || exit 1

# syntax=docker/dockerfile:1

# Open Cycle Tracker - API image (Node + Express + Drizzle, the ciphertext store).
# Build context is the repo root: `docker build -f api.dockerfile .`

# ---- builder: install all deps and compile to dist/ -------------------------
FROM node:24-bookworm-slim AS builder
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

# Install with a frozen lockfile first (cached unless the manifest changes).
COPY api/package.json api/pnpm-lock.yaml api/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# Compile the server plus the migrate/seed entrypoints. tsup leaves runtime
# `dependencies` external, so they're required from node_modules at runtime
# (this is what keeps the native @node-rs/argon2 binding out of the bundle).
COPY api/ ./
RUN pnpm exec tsup src/index.ts src/db/migrate.ts src/db/seed.ts \
      --format esm --target node20 --clean

# ---- runtime: prod deps + compiled output only ------------------------------
FROM node:24-bookworm-slim AS runtime
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV NODE_ENV=production
RUN corepack enable
WORKDIR /app

# Production dependencies only. The platform-specific @node-rs/argon2 binary is
# pulled here, so it matches this image's glibc (hence bookworm, not alpine).
COPY api/package.json api/pnpm-lock.yaml api/pnpm-workspace.yaml ./
RUN pnpm install --prod --frozen-lockfile && pnpm store prune

# Compiled JS and the SQL migrations the migrator reads at runtime (./drizzle,
# resolved relative to WORKDIR).
COPY --from=builder /app/dist ./dist
COPY api/drizzle ./drizzle

# Drop privileges - the `node` user ships with the base image.
USER node

EXPOSE 3000

# Liveness against the unauthenticated /health route (no curl in slim images).
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/index.js"]

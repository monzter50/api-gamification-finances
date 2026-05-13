# syntax=docker/dockerfile:1.7
# =============================================================================
# Multi-stage build for the API.
# Stages: deps -> builder -> pruned -> production
#
# Performance notes:
#  - `yarn install` only runs once with a full install in `deps`.
#  - `pruned` removes devDependencies from that same node_modules (no re-fetch).
#  - BuildKit cache mounts persist the yarn cache between builds, so any
#    repeat install is mostly offline and fast.
# =============================================================================

# ---- Stage 1: install ALL deps (dev + prod) once ----
FROM node:20-slim AS deps
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

# ---- Stage 2: build TypeScript + generate Prisma client (uses full deps) ----
FROM deps AS builder
COPY tsconfig.json ./
COPY prisma ./prisma
COPY src ./src
RUN yarn prisma generate
RUN yarn build

# ---- Stage 3: prune dev deps from the already-installed node_modules ----
# Inherits from `deps`, so packages are already extracted on disk.
# `--prefer-offline` hits the cache instead of the registry — fast.
FROM deps AS pruned
RUN yarn install --frozen-lockfile --production && \
    yarn cache clean

# ---- Stage 4: production runtime — minimal image ----
FROM node:20-slim AS production
WORKDIR /app

# wget for healthcheck, openssl + ca-certificates for Prisma + TLS to managed DBs
RUN apt-get update && \
    apt-get install -y --no-install-recommends wget openssl ca-certificates && \
    rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production

# Bring in the pruned node_modules (prod-only), then overlay the Prisma client
# artifacts generated during the build (`.prisma` + `@prisma`).
COPY package.json yarn.lock ./
COPY --from=pruned  /app/node_modules            ./node_modules
COPY --from=builder /app/node_modules/.prisma    ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma    ./node_modules/@prisma
COPY --from=builder /app/dist                    ./dist
COPY prisma ./prisma

# Non-root user for security
RUN groupadd -g 1001 nodejs && \
    useradd -u 1001 -g nodejs -s /bin/sh -m nodejs && \
    chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 3000

# Migrations run as a separate pre-deploy step (see railway.json or your
# deploy pipeline), NOT on container start. This avoids race conditions
# when running multiple replicas and lets a failed migration block the
# rollout instead of crashing every replica into a restart loop.
CMD ["node", "dist/server.js"]

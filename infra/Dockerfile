# syntax=docker/dockerfile:1.7
#
# Multi-stage production image for Dashora (API + prebuilt web assets).
# Targets: linux/amd64 and linux/arm64 (build with docker buildx).
# Secrets must be supplied at runtime via env / *_FILE mounts — never COPY .env.

ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-bookworm-slim AS base
ENV PNPM_HOME="/pnpm" \
    PATH="/pnpm:$PATH"
RUN corepack enable
WORKDIR /app

# ---------------------------------------------------------------------------
# Build: install (incl. native modules), compile packages/apps, deploy prod tree
# ---------------------------------------------------------------------------
FROM base AS build

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
COPY packages/ui/package.json packages/ui/
COPY packages/widget-sdk/package.json packages/widget-sdk/

RUN pnpm install --frozen-lockfile

COPY . .

ENV NODE_ENV=production
RUN pnpm build \
  && pnpm --filter @dashora/server deploy --prod --legacy /deploy/server \
  && mkdir -p /deploy/server/drizzle \
  && cp -a apps/server/drizzle/. /deploy/server/drizzle/ \
  && mkdir -p /deploy/web \
  && cp -a apps/web/dist/. /deploy/web/

# ---------------------------------------------------------------------------
# Runtime: slim Node LTS, non-root, no toolchain / no pnpm / no secrets
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-bookworm-slim AS runtime

ARG VERSION=1.0.0
ARG REVISION=unknown
ARG BUILD_DATE=unknown

LABEL org.opencontainers.image.title="Dashora" \
      org.opencontainers.image.description="Self-hosted personal dashboard" \
      org.opencontainers.image.url="https://github.com/GitTheums/Dashora" \
      org.opencontainers.image.source="https://github.com/GitTheums/Dashora" \
      org.opencontainers.image.documentation="https://github.com/GitTheums/Dashora/blob/main/docs/installation.md" \
      org.opencontainers.image.licenses="Apache-2.0" \
      org.opencontainers.image.vendor="Dashora" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.revision="${REVISION}" \
      org.opencontainers.image.created="${BUILD_DATE}"

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    DASHORA_DATA_DIR=/data \
    TZ=UTC \
    APP_VERSION=${VERSION} \
    NODE_OPTIONS=--max-old-space-size=384

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates tzdata \
  && rm -rf /var/lib/apt/lists/* \
  && useradd --system --create-home --uid 10001 --home-dir /home/dashora dashora \
  && mkdir -p /data /app /srv/dashora-web \
  && chown dashora:dashora /data

COPY --from=build --chown=root:root /deploy/server /app
COPY --from=build --chown=root:root /deploy/web /srv/dashora-web

# Application tree is owned by root and not writable by the runtime user.
RUN chmod -R a-w /app /srv/dashora-web \
  && find /app /srv/dashora-web -type d -exec chmod a+rx {} \; \
  && find /app /srv/dashora-web -type f -exec chmod a+r {} \;

WORKDIR /app
USER dashora

EXPOSE 3000
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/v1/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]

CMD ["node", "dist/index.js"]

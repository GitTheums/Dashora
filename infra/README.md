# Infrastructure

Production Docker packaging for Dashora.

| File | Purpose |
| --- | --- |
| [`Dockerfile`](./Dockerfile) | Multi-stage Node 22 LTS image (API + web `dist`), non-root, OCI labels, healthcheck |
| [`Dockerfile.dev`](./Dockerfile.dev) | Dev image with native build tools for `compose.dev.yaml` |
| [`nginx.conf`](./nginx.conf) | Gzip/brotli-static friendly reverse proxy; immutable cache for `/assets/` |
| [`backup-restore.md`](./backup-restore.md) | SQLite backup and restore |
| [`upgrade.md`](./upgrade.md) | Image upgrade and rollback |

Root Compose files:

| File | Purpose |
| --- | --- |
| [`../compose.yaml`](../compose.yaml) | Local production stack (API + nginx + `/data` volume) |
| [`../compose.dev.yaml`](../compose.dev.yaml) | Development stack with bind-mounted source and hot reload |

See the root [`.dockerignore`](../.dockerignore) for build exclusions. Performance notes live in [`docs/PERFORMANCE.md`](../docs/PERFORMANCE.md).

## Quick start (production-style)

```bash
# From the repository root
docker compose up --build
```

| URL | Service |
| --- | --- |
| http://localhost:8080 | nginx (SPA + `/api` proxy) |
| http://localhost:3000 | Dashora API directly |
| http://localhost:3000/api/v1/health | Health endpoint |

### Common options

```bash
# Timezone (IANA name)
TZ=Europe/Berlin docker compose up --build

# Bind-mount host data instead of the named volume
DASHORA_DATA_BIND=./data docker compose up --build

# Publish different host ports
DASHORA_HOST_PORT=3001 DASHORA_HTTP_PORT=8081 docker compose up --build
```

The API container runs as UID `10001`, with a read-only root filesystem and a writable `/data` volume. Application files under `/app` and `/srv/dashora-web` are not writable by the runtime user. Secrets (`SECRETS_ENCRYPTION_KEY`, provider tokens, etc.) must be supplied at runtime via environment variables or `*_FILE` mounts — they are never baked into the image.

Configurable listen port inside the image: set `PORT` (default `3000`). The Compose file keeps the container on `3000` for the nginx upstream and remaps the host port with `DASHORA_HOST_PORT`.

## Development Compose

```bash
docker compose -f compose.dev.yaml up --build
```

| URL | Service |
| --- | --- |
| http://localhost:5173 | Vite web (proxies `/api` to the API) |
| http://localhost:3000 | Fastify API |

Data persists in the `dashora-dev-data` volume (override with `DASHORA_DATA_BIND`).

## Data directory

| Variable | Default | Purpose |
| --- | --- | --- |
| `DASHORA_DATA_DIR` | `/data` | Directory for SQLite and related durable files |
| `TZ` | `UTC` | Process timezone (Node / OS tzdata in the image) |

Mount a Docker volume or bind mount at `/data` so the database survives container recreation.

## Multi-arch images (`linux/amd64`, `linux/arm64`)

Native modules (`better-sqlite3`, `@node-rs/argon2`) are compiled in the build stage, so each architecture must be built on that platform (or via QEMU/buildx).

```bash
docker buildx create --use --name dashora-builder 2>/dev/null || docker buildx use dashora-builder

docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -f infra/Dockerfile \
  -t dashora:local \
  --build-arg VERSION=1.0.0 \
  --build-arg REVISION="$(git rev-parse HEAD)" \
  --build-arg BUILD_DATE="$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --load \
  .
```

`--load` only supports a single platform at a time. For a multi-arch manifest use `--push` to a registry (see [upgrade.md](./upgrade.md)). Published images are available at `ghcr.io/gittheums/dashora`.

## Container smoke test

```bash
pnpm test:container
# or force failure when Docker is missing:
DASHORA_REQUIRE_DOCKER=1 pnpm test:container
```

This builds the production image, starts a read-only container with a `/data` volume, asserts `GET /api/v1/health`, checks SPA assets are present, and verifies graceful shutdown on SIGTERM.

## Backup, restore, and upgrades

- [Backup and restore](./backup-restore.md)
- [Upgrade procedure](./upgrade.md)

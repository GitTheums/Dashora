# Installation

This guide covers installing Dashora with Docker Compose (recommended) and notes for running from source.

## Requirements

| Method | Requirements |
| --- | --- |
| Docker Compose | Docker Engine + Compose plugin |
| From source | Node.js 22+, [pnpm](https://pnpm.io/) 11+ |

Recommended host resources for a personal deployment: roughly 512 MB RAM and a few hundred MB of disk for the image plus SQLite data.

## Docker Compose (recommended)

### Build from this repository

```bash
git clone https://github.com/GitTheums/Dashora.git
cd Dashora
docker compose up --build
```

| URL | Purpose |
| --- | --- |
| http://localhost:8080 | SPA + `/api` via the bundled nginx proxy |
| http://localhost:3000 | API directly |
| http://localhost:3000/api/v1/health | Health endpoint |

Stop with `Ctrl+C`, or run detached:

```bash
docker compose up --build -d
docker compose logs -f dashora
```

### Pull a published image (GHCR)

Stable images are published to GitHub Container Registry:

```text
ghcr.io/gittheums/dashora:<version>
```

Examples: `ghcr.io/gittheums/dashora:1.0.0`, `ghcr.io/gittheums/dashora:1.0`, `ghcr.io/gittheums/dashora:1`, `ghcr.io/gittheums/dashora:latest` (stable releases only).

Using the Compose stack with a published tag (from a clone that still provides `compose.yaml` and `infra/nginx.conf`):

```bash
export DASHORA_IMAGE_TAG=1.0.0
docker pull "ghcr.io/gittheums/dashora:${DASHORA_IMAGE_TAG}"
docker tag "ghcr.io/gittheums/dashora:${DASHORA_IMAGE_TAG}" "dashora:${DASHORA_IMAGE_TAG}"
DASHORA_IMAGE_TAG=1.0.0 docker compose up -d
```

Or point both `dashora` and `assets` services at the registry image with a Compose override:

```yaml
# compose.ghcr.yaml
services:
  dashora:
    image: ghcr.io/gittheums/dashora:1.0.0
    pull_policy: always
  assets:
    image: ghcr.io/gittheums/dashora:1.0.0
    pull_policy: always
```

```bash
docker compose -f compose.yaml -f compose.ghcr.yaml up -d
```

Public GHCR packages may require authenticating once (`docker login ghcr.io`) depending on package visibility settings for the repository.

### Common options

```bash
# Timezone for the process (IANA name)
TZ=Europe/Berlin docker compose up --build

# Bind-mount host data instead of the named volume
DASHORA_DATA_BIND=./data docker compose up --build

# Publish different host ports
DASHORA_HOST_PORT=3001 DASHORA_HTTP_PORT=8081 docker compose up --build

# Public origin used for CORS and the first-run setup URL
DASHORA_PUBLIC_URL=https://dashora.example.com docker compose up --build
```

The API container runs as UID `10001` with a read-only root filesystem and a writable `/data` volume. Application files under `/app` and `/srv/dashora-web` are not writable by the runtime user.

### Production checklist

1. Set `DASHORA_PUBLIC_URL` (and therefore CORS / public base URL) to your real https origin.
2. Generate and persist a secrets encryption key:

   ```bash
   openssl rand -hex 32
   ```

   Supply it as `SECRETS_ENCRYPTION_KEY` or mount it via `SECRETS_ENCRYPTION_KEY_FILE` (Docker/Podman secret). Do not bake secrets into the image.
3. Put TLS termination in front of Dashora (see [Reverse proxy](./reverse-proxy.md)).
4. Back up `/data` and the encryption key (see [Backup and restore](./backup-restore.md)).
5. Prefer a pinned GHCR tag such as `ghcr.io/gittheums/dashora:1.0.0` in production (see [Upgrading](./upgrading.md)).

More packaging detail: [`infra/README.md`](../infra/README.md). Release process: [Release checklist](./release-checklist.md).

## First-run setup

On first start with no operator account, Dashora issues a one-time setup token and logs a URL:

```text
Dashora first-run setup required. Open: http://localhost:8080/setup?token=...
```

1. Read the URL from logs:

   ```bash
   docker compose logs dashora | grep -i setup
   ```

2. Open the URL in a browser you trust on the same network.
3. Create the operator account:
   - Email
   - Display name
   - Password (minimum 12 characters; common / breached passwords and email-local-part passwords are rejected)
4. After completion, sign in at the normal login page. The setup token is invalidated and `/setup` completion is disabled.

Notes:

- The token is stored only as a hash; the plaintext appears in logs when a **new** token is issued.
- Default lifetime is 24 hours (`SETUP_TOKEN_TTL_MS`).
- Setup completion is rate-limited (`SETUP_RATE_LIMIT_*`).
- If the token expires before use, restart the API (or clear the incomplete setup state carefully) so a new token can be issued — see [Troubleshooting](./troubleshooting.md).

## Data directory

| Path | Purpose |
| --- | --- |
| `$DASHORA_DATA_DIR/dashora.sqlite` | Primary database |
| `$DASHORA_DATA_DIR/dashora.sqlite-wal` | WAL file (when present) |
| `$DASHORA_DATA_DIR/dashora.sqlite-shm` | WAL shared memory (when present) |

In Compose, `DASHORA_DATA_DIR` is `/data`. The named volume `dashora-data` (or `DASHORA_DATA_BIND`) must survive container recreation.

## Development Compose

Hot-reload stack for contributors:

```bash
docker compose -f compose.dev.yaml up --build
```

| URL | Service |
| --- | --- |
| http://localhost:5173 | Vite web (proxies `/api`) |
| http://localhost:3000 | Fastify API |

See [Development](./development.md).

## Install from source

```bash
pnpm install
cp apps/server/.env.example apps/server/.env
cp apps/web/.env.example apps/web/.env
pnpm dev
```

| App | URL |
| --- | --- |
| Web | http://localhost:5173 |
| API | http://localhost:3000 |

For a production-like local build without Docker:

```bash
pnpm build
# Run the server package with NODE_ENV=production and a configured DASHORA_DATA_DIR
```

Prefer the Compose production stack for real deployments so nginx, healthchecks, and volume layout stay consistent.

## Multi-arch images

Production images target `linux/amd64` and `linux/arm64`. Native modules are compiled per architecture — use Buildx when publishing multi-arch manifests. See [`infra/README.md`](../infra/README.md).

## Next steps

- [Configuration](./configuration.md)
- [Supported widgets](./widgets/index.md)
- [Reverse proxy](./reverse-proxy.md)
- [Security model](./security-model.md)

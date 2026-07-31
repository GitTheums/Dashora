# Upgrade procedure

Dashora applies SQLite migrations automatically on startup and fails closed if a migration cannot run. Prefer pinned image tags in production so you can roll forward deliberately.

## Before you upgrade

1. Read the release notes for breaking env changes or required migration steps.
2. Take a consistent backup of `DASHORA_DATA_DIR` (see [backup-restore.md](./backup-restore.md)).
3. Record the currently running image digest/tag and any runtime env (especially `SECRETS_ENCRYPTION_KEY` / `SECRETS_ENCRYPTION_KEY_FILE`).
4. Schedule a short maintenance window if you prefer a stopped-file backup over an online SQLite `.backup`.

## Upgrade with Docker Compose (recommended)

From the repository root (or your deployment directory that contains `compose.yaml`):

```bash
# 1. Backup first
docker compose stop dashora
# Copy the volume or bind-mounted data directory — see backup-restore.md
docker compose start dashora

# 2. Pull / rebuild the new image
export DASHORA_IMAGE_TAG=1.0.0   # or omit to rebuild :local from source
docker pull "ghcr.io/gittheums/dashora:${DASHORA_IMAGE_TAG}"
docker tag "ghcr.io/gittheums/dashora:${DASHORA_IMAGE_TAG}" "dashora:${DASHORA_IMAGE_TAG}"
# or: docker compose build dashora   # when building from this repo

# 3. Recreate containers (named volume / bind mount at /data is preserved)
docker compose up -d

# 4. Verify
curl -fsS "http://localhost:${DASHORA_HOST_PORT:-3000}/api/v1/health"
curl -fsSI "http://localhost:${DASHORA_HTTP_PORT:-8080}/"
docker compose ps
```

Migrations run when the new `dashora` container starts. If startup fails, the previous data files remain on the volume — restore from backup if you need to roll back the database as well as the image.

## Upgrade a standalone container

```bash
docker stop dashora
docker rename dashora dashora-prev

docker run -d --name dashora \
  --restart unless-stopped \
  -e TZ="${TZ:-UTC}" \
  -e PORT=3000 \
  -e DASHORA_DATA_DIR=/data \
  -e CORS_ORIGIN="https://dashora.example.com" \
  -e PUBLIC_BASE_URL="https://dashora.example.com" \
  -e TRUST_PROXY=true \
  -e SECRETS_ENCRYPTION_KEY_FILE=/run/secrets/dashora_secrets_key \
  -v dashora-data:/data \
  -p 3000:3000 \
  ghcr.io/gittheums/dashora:1.0.0

curl -fsS http://localhost:3000/api/v1/health
docker rm dashora-prev
```

Reuse the same `/data` volume and the same encryption key. Changing the encryption key without a re-encrypt tool makes stored secrets undecryptable.

## Multi-arch images

Production images are intended for both `linux/amd64` and `linux/arm64`. Build and publish with Buildx:

```bash
docker buildx create --use --name dashora-builder 2>/dev/null || docker buildx use dashora-builder

docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -f infra/Dockerfile \
  -t ghcr.io/gittheums/dashora:1.0.0 \
  -t ghcr.io/gittheums/dashora:1.0 \
  -t ghcr.io/gittheums/dashora:1 \
  -t ghcr.io/gittheums/dashora:latest \
  --build-arg VERSION=1.0.0 \
  --build-arg REVISION="$(git rev-parse HEAD)" \
  --build-arg BUILD_DATE="$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --push \
  .
```

Prefer the GitHub Actions **Release** workflow (triggered by `v*.*.*` tags) over manual pushes. Prerelease tags must not update `latest`.


## Rollback

1. Stop the new container/stack.
2. Start the previous image tag against the same `/data` volume **only if** the new version’s migrations are known to be backward-compatible with that older binary.
3. If migrations already advanced the schema in a way the old binary cannot read, restore the pre-upgrade backup into `/data` and start the previous image.

## After upgrade

- Confirm `GET /api/v1/health` returns `"status":"ok"` and the expected `version`.
- Sign in once and spot-check a widget that uses an integration secret.
- Confirm timezone-sensitive widgets look correct for your `TZ` setting.

## Related

- [Backup and restore](./backup-restore.md)
- [Infrastructure overview](./README.md)
- [ADR 0003 — SQLite and Drizzle](../docs/adr/0003-sqlite-drizzle.md)

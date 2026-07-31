# Upgrading

Dashora applies SQLite migrations automatically on startup and fails closed if a migration cannot run. Prefer pinned image tags in production so you roll forward deliberately.

## Before you upgrade

1. Read the release notes for breaking environment changes or required steps.
2. Take a consistent backup of `DASHORA_DATA_DIR` (see [Backup and restore](./backup-restore.md)).
3. Record the current image tag/digest and runtime env — especially `SECRETS_ENCRYPTION_KEY` / `SECRETS_ENCRYPTION_KEY_FILE`.
4. Optionally export config from Settings → Backup as a second recovery path.
5. Schedule a short maintenance window if you prefer a stopped-file backup over an online SQLite `.backup`.

## Upgrade with Docker Compose

From the directory that contains `compose.yaml`:

```bash
# 1. Backup first
docker compose stop dashora
# Archive the volume or bind-mounted data directory — see backup-restore.md
docker compose start dashora

# 2. Pull or rebuild the new image
export DASHORA_IMAGE_TAG=1.0.0   # example; omit to rebuild :local from source
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

Migrations run when the new `dashora` container starts. If startup fails, previous data files remain on the volume — restore from backup if you need to roll back both the database and the image.

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

Reuse the same `/data` volume and the **same** encryption key. Changing the encryption key without re-entering secrets makes stored ciphertext undecryptable.

## Building from this repository

```bash
docker compose build dashora
docker compose up -d
```

For multi-arch publish (`linux/amd64`, `linux/arm64`), use Buildx as described in [`infra/README.md`](../infra/README.md) and [`infra/upgrade.md`](../infra/upgrade.md).

## Rollback

1. Stop the new container/stack.
2. Start the previous image tag against the same `/data` volume **only if** the new version’s migrations are known to be backward-compatible with that older binary.
3. If migrations already advanced the schema, restore the pre-upgrade backup into `/data` and start the previous image.

## After upgrade

- Confirm `GET /api/v1/health` returns an OK status and the expected version.
- Sign in once and spot-check a widget that uses an integration secret.
- Confirm timezone-sensitive widgets look correct for your `TZ` setting.
- Skim [Troubleshooting](./troubleshooting.md) if login or widgets misbehave after a URL or proxy change.

## Related

- [Backup and restore](./backup-restore.md)
- [`infra/upgrade.md`](../infra/upgrade.md)
- [Configuration](./configuration.md)
- [Roadmap](./roadmap.md)

# Configuration

Dashora is configured with environment variables. The server validates its environment with Zod at startup and fails closed on invalid critical settings.

Copy examples for local development:

```bash
cp apps/server/.env.example apps/server/.env
cp apps/web/.env.example apps/web/.env
```

In Docker Compose, set variables in your shell, a `.env` file next to `compose.yaml`, or an orchestrator secret store. Never bake secrets into the image.

## Core runtime

| Variable | Default | Description |
| --- | --- | --- |
| `NODE_ENV` | — | `development` or `production` |
| `HOST` | `0.0.0.0` | Listen address |
| `PORT` | `3000` | API listen port inside the container/process |
| `LOG_LEVEL` | `info` | Fastify / app log level |
| `APP_VERSION` | from build | Reported version string |
| `DASHORA_DATA_DIR` | `./data` locally; `/data` in Docker | SQLite and durable files |
| `TZ` | `UTC` | Process timezone (IANA name; image includes tzdata) |

## Public URL, CORS, and cookies

| Variable | Default | Description |
| --- | --- | --- |
| `CORS_ORIGIN` | Compose: `DASHORA_PUBLIC_URL` or `http://localhost:8080` | Allowed browser origin |
| `PUBLIC_BASE_URL` | falls back to `CORS_ORIGIN` | Base URL printed in the first-run setup log line |
| `TRUST_PROXY` | `false` locally; `true` in Compose | Trust `X-Forwarded-*` from a reverse proxy |
| `COOKIE_SECURE` | `auto` | `auto` → Secure cookies in production; or `true` / `false` |
| `SESSION_TTL_MS` | `604800000` (7d) | Session lifetime |
| `SESSION_RENEWAL_THRESHOLD_MS` | `86400000` (1d) | Rotate session token when remaining life falls below this |
| `HSTS_MAX_AGE_SECONDS` | `15552000` (180d) | HSTS max-age; sent only when the connection is treated as HTTPS |

Compose convenience variable (not read by the Node process directly):

| Variable | Description |
| --- | --- |
| `DASHORA_PUBLIC_URL` | Sets `CORS_ORIGIN` and `PUBLIC_BASE_URL` in `compose.yaml` |
| `DASHORA_HOST_PORT` | Host port mapped to the API (`3000`) |
| `DASHORA_HTTP_PORT` | Host port mapped to nginx (`8080`) |
| `DASHORA_DATA_BIND` | Bind path instead of the named data volume |
| `DASHORA_IMAGE_TAG` | Image tag label when building/running Compose |

**Warning:** Enable `TRUST_PROXY` only when a trusted reverse proxy strips client-supplied `X-Forwarded-*` headers before setting its own. Misconfiguration undermines rate limiting and audit IP attribution. The server logs a startup warning when trust-proxy is enabled.

## First-run setup and rate limits

| Variable | Default | Description |
| --- | --- | --- |
| `SETUP_TOKEN_TTL_MS` | `86400000` (24h) | First-run setup token lifetime |
| `LOGIN_RATE_LIMIT_MAX` | `10` | Max login attempts per window (keyed by client IP + normalized email) |
| `LOGIN_RATE_LIMIT_WINDOW_MS` | `900000` (15m) | Login rate-limit window |
| `SETUP_RATE_LIMIT_MAX` | `20` | Max setup-complete attempts per window (keyed by client IP + normalized email) |
| `SETUP_RATE_LIMIT_WINDOW_MS` | `900000` (15m) | Setup rate-limit window |
| `AUTH_ME_RATE_LIMIT_MAX` | `60` | Max `/api/v1/auth/me` session probes per window (keyed by client IP) |
| `AUTH_ME_RATE_LIMIT_WINDOW_MS` | `60000` (1m) | Auth `/me` rate-limit window |
| `API_RATE_LIMIT_MAX` | `300` | Global API requests per window |
| `API_RATE_LIMIT_WINDOW_MS` | `60000` (1m) | Global API rate-limit window |
| `MAX_BODY_BYTES` | `1000000` | Default Fastify body size limit |
| `BACKUP_IMPORT_MAX_BYTES` | `8000000` | Max size for config-backup import uploads |

## Secrets encryption

Integration secrets (GitHub PATs, ICS basic-auth passwords, generic API secrets) are encrypted at rest with AES-256-GCM.

| Variable | Description |
| --- | --- |
| `SECRETS_ENCRYPTION_KEY` | 32-byte key as **64 hex characters** |
| `SECRETS_ENCRYPTION_KEY_FILE` | Path to a file containing the same hex key (Docker/Podman secret mount) |

Rules:

- Set **exactly one** of `SECRETS_ENCRYPTION_KEY` or `SECRETS_ENCRYPTION_KEY_FILE`.
- Generate with `openssl rand -hex 32`.
- Back up the key with the same care as the database. Restoring SQLite without the matching key leaves secrets undecryptable.
- There is currently no automatic key-rotation / re-encrypt tool — changing the key requires re-entering integration secrets.

## Provider credentials (server-only)

These values never go to the browser bundle. Prefer UI-managed encrypted integrations where available; env vars cover process-wide defaults or widgets that read from the environment.

| Variable | Used by |
| --- | --- |
| `GITHUB_TOKEN` | Optional process-wide GitHub token when a widget has no linked credential |
| `COINGECKO_API_KEY` | Markets (crypto) |
| `FINNHUB_API_KEY` | Markets (equities / indexes) |
| `REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET` | Reddit widget OAuth application |
| `TWITCH_CLIENT_ID` / `TWITCH_CLIENT_SECRET` | Twitch Helix application |

Missing required provider credentials surface as a `configuration-required` widget state with an operator-safe message — they do not crash the process.

## Web app (development)

| Variable | Default | Description |
| --- | --- | --- |
| `VITE_APP_NAME` | `Dashora` | Display name in the Vite app |
| `VITE_API_BASE_URL` | empty | Leave empty in dev so the Vite proxy forwards `/api` |

Production builds are served by nginx (or your reverse proxy) same-origin with `/api/`, so the browser does not need a separate API base URL.

## Appearance and in-app settings

Theme / appearance preferences are stored for the authenticated operator and edited under Settings → Appearance. Dashboard pages, layout, and widget instance config are stored in SQLite and edited in the UI (edit mode + widget settings drawers).

Config export/import is available under Settings → Backup (see [Backup and restore](./backup-restore.md)).

## Logging

- Prefer `LOG_LEVEL=info` in production.
- Dashora redacts passwords, cookies, tokens, and authorization headers from structured logs.
- Never enable verbose logging that dumps full request bodies containing secrets.

## Related

- [Installation](./installation.md)
- [Reverse proxy](./reverse-proxy.md)
- [Security model](./security-model.md)
- Server example env: [`apps/server/.env.example`](../apps/server/.env.example)

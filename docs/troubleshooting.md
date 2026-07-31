# Troubleshooting

Short operator checklist for common Dashora deployment issues.

## Health check fails

Symptoms: `curl http://localhost:3000/api/v1/health` errors or Compose marks `dashora` unhealthy.

1. Check logs: `docker compose logs dashora`.
2. Confirm the process is listening on `PORT` (default `3000`) and `HOST=0.0.0.0`.
3. Confirm `/data` (or `DASHORA_DATA_DIR`) is writable by UID `10001` in Docker.
4. Look for Zod env validation errors at startup (invalid or missing critical config).
5. If migrations failed, the process fails closed — fix the data directory or restore a backup ([Backup and restore](./backup-restore.md)).

## Cannot complete first-run setup

| Symptom | Likely cause | What to try |
| --- | --- | --- |
| No setup URL in logs | Setup already completed, or token was issued earlier | Open the normal login page; if stuck, inspect DB / logs for `setupRequired` |
| Setup URL uses wrong host | `PUBLIC_BASE_URL` / `DASHORA_PUBLIC_URL` mismatch | Set the public origin and restart so a **new** token issue prints the right URL |
| “Setup token has expired” | TTL elapsed (`SETUP_TOKEN_TTL_MS`) | Restart after ensuring no operator user exists yet so a new token can be issued |
| “Setup is already completed” | An operator account exists | Use login; there is no second setup pass |
| Rate limited (`429`) | Too many setup attempts | Wait for `SETUP_RATE_LIMIT_WINDOW_MS` |

Password rules: minimum 12 characters; common/breached passwords and passwords based on the email local-part are rejected.

## Cannot sign in

1. Confirm you finished first-run setup and are using that email/password.
2. Check cookie settings: behind HTTPS, `COOKIE_SECURE` must allow Secure cookies (`true` or `auto` in production).
3. Confirm `CORS_ORIGIN` matches the exact browser origin (scheme + host + port).
4. If behind a proxy, verify `TRUST_PROXY` and `X-Forwarded-Proto` (see [Reverse proxy](./reverse-proxy.md)).
5. Login is rate-limited — wait out `LOGIN_RATE_LIMIT_WINDOW_MS` after repeated failures.

There is currently **no password-reset flow**. Recovery requires database-level intervention and is intentionally not documented as a casual self-service path. See [SECURITY.md](../SECURITY.md).

## Blank page or API calls fail in the browser

1. Open the browser network tab: do `/api/v1/...` requests hit the same origin?
2. Through Compose, use the nginx URL (`http://localhost:8080`), not only the Vite-less API port, for the SPA.
3. After changing public URL / CORS, hard-refresh and clear site cookies for the old origin.
4. Confirm the `assets` one-shot service completed so nginx has SPA files (`docker compose ps`).

## Widgets stuck in configuration-required or error

| Widget family | Check |
| --- | --- |
| Markets | `COINGECKO_API_KEY` / `FINNHUB_API_KEY` for the asset classes you use |
| Reddit | `REDDIT_CLIENT_ID` and `REDDIT_CLIENT_SECRET` |
| Twitch | `TWITCH_CLIENT_ID` and `TWITCH_CLIENT_SECRET` |
| GitHub (private / higher limits) | UI GitHub integration or `GITHUB_TOKEN` |
| Calendar with basic auth | ICS credential integration + `SECRETS_ENCRYPTION_KEY` |
| Custom API | URL allow rules, API secret integration, optional private-network opt-in |
| RSS / YouTube / HN / Lobsters | Feed URL validity, outbound network from the container |

Also verify:

- `SECRETS_ENCRYPTION_KEY` is set and unchanged since secrets were stored.
- The container can reach the public internet (or your LAN target for Custom API with private-network opt-in).
- Widget settings are saved (edit mode → settings → save).

Stale banners mean Dashora is showing last-good data while refresh is soft-failing — check provider status and logs without expecting tokens to appear in log lines.

## Integration secrets undecryptable after restore/migrate

Cause: database restored with a different `SECRETS_ENCRYPTION_KEY`.

Fix: restore the original key, or re-enter each integration secret under Settings after generating a new key (old ciphertext remains unreadable).

## Permission errors on `/data`

Compose runs as UID `10001`. After copying files onto a bind mount:

```bash
docker run --rm -v "$(pwd)/data:/data" alpine chown -R 10001:10001 /data
```

## High memory or OOM

The Compose service sets `NODE_OPTIONS=--max-old-space-size=384`. For very large backups or many remote widgets, raise host memory or reduce refresh pressure. See [Performance](./PERFORMANCE.md) for measurement notes.

## Useful commands

```bash
docker compose ps
docker compose logs -f dashora
curl -fsS http://localhost:3000/api/v1/health
curl -fsSI http://localhost:8080/
```

## Still stuck?

- [Configuration](./configuration.md)
- [Security model](./security-model.md)
- [Installation](./installation.md)
- Open an issue with version/commit, redacted logs, and reproduction steps — never include tokens, cookies, or passwords.

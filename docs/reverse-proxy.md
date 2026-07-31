# Reverse proxy

Dashora’s Compose stack already includes an nginx service that serves the SPA and proxies `/api/` to the API. Use this guide when you put another proxy (or TLS terminator) in front, or when you deploy the API and web assets yourself.

## What must be true

1. The browser loads the SPA and calls the API **same-origin** (recommended), or CORS is configured for the exact SPA origin.
2. `/api/` reaches the Dashora API process.
3. Session cookies work over your public URL (`Secure` when using HTTPS).
4. If you trust forwarded headers, only your proxy may set them.

## Bundled Compose proxy

`compose.yaml` publishes:

| Port | Service |
| --- | --- |
| `8080` (`DASHORA_HTTP_PORT`) | nginx — static SPA + `/api/` → `dashora:3000` |
| `3000` (`DASHORA_HOST_PORT`) | API directly (optional to expose) |

Example config: [`infra/nginx.conf`](../infra/nginx.conf).

For many home setups you only need TLS in front of port 8080 and can leave the internal nginx as-is.

## Required environment when using HTTPS

Set these on the Dashora API (Compose already wires `DASHORA_PUBLIC_URL`):

```bash
DASHORA_PUBLIC_URL=https://dashora.example.com
# compose maps these for you:
# CORS_ORIGIN=https://dashora.example.com
# PUBLIC_BASE_URL=https://dashora.example.com
TRUST_PROXY=true
COOKIE_SECURE=true   # or leave COOKIE_SECURE=auto in production
```

Restart after changing them so the first-run setup URL (if still needed) and CORS match the public origin.

## Header expectations

Your TLS proxy should forward at least:

| Header | Purpose |
| --- | --- |
| `Host` | Original host |
| `X-Real-IP` / `X-Forwarded-For` | Client IP for rate limits and audit (only if you strip untrusted client values first) |
| `X-Forwarded-Proto` | `https` so Secure cookies / HSTS logic see TLS |
| `X-Forwarded-Host` | Original host when useful |

**Operator responsibility:** when `TRUST_PROXY=true`, the proxy must overwrite (not append blindly from the client) `X-Forwarded-*` values. Dashora cannot verify that for you.

## Example: Caddy

Terminate TLS with Caddy and reverse-proxy to the Compose nginx port (or directly to the API + static files):

```caddyfile
dashora.example.com {
  encode gzip
  reverse_proxy 127.0.0.1:8080
}
```

Then point `DASHORA_PUBLIC_URL` at `https://dashora.example.com` and keep `TRUST_PROXY=true` on the API if you rely on forwarded client IPs from an intermediate hop. If Caddy talks to nginx on localhost and nginx talks to the API on the Compose network, prefer trusting only the hop that sets accurate headers.

## Example: nginx (TLS terminator)

```nginx
server {
  listen 443 ssl http2;
  server_name dashora.example.com;

  # ssl_certificate / ssl_certificate_key ...

  location / {
    proxy_pass http://127.0.0.1:8080;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-Host $host;
  }
}
```

## Example: Traefik (label sketch)

Point a router at the `proxy` service (port 8080) or at a single published host port. Ensure the entrypoint is HTTPS and that forwarded proto/host headers are set by Traefik. Keep `DASHORA_PUBLIC_URL` aligned with the router rule host.

## SPA Content Security Policy note

The Dashora **API** sends a strict default-deny CSP suitable for a JSON API. When nginx (or another layer) serves the built SPA, that layer should set a CSP appropriate for the browser app (e.g. `script-src 'self'`, styles as required by the build, plus handling for the theme-bootstrap inline script). See [Security model — HTTP response security headers](./security-model.md#http-response-security-headers).

## WebSocket / long-lived connections

Dashora’s v1 API is request/response HTTP. You do not need special WebSocket proxy settings for the core dashboard.

## Checklist

- [ ] Public URL uses HTTPS
- [ ] `DASHORA_PUBLIC_URL` / `CORS_ORIGIN` / `PUBLIC_BASE_URL` match that origin exactly
- [ ] `/api/v1/health` succeeds through the public hostname
- [ ] Login sets a session cookie and survives refresh
- [ ] `TRUST_PROXY` is enabled only behind a correctly configured proxy
- [ ] Direct API port (`3000`) is not exposed to the internet unless intentional

## Related

- [Installation](./installation.md)
- [Configuration](./configuration.md)
- [Security model](./security-model.md)
- [`infra/nginx.conf`](../infra/nginx.conf)

# Security model

Dashora is self-hosted software that often sits next to powerful credentials (mail, cloud APIs, home automation, monitoring). The security model assumes a trusted operator and an untrusted broader network: protect secrets, minimize browser privilege, and fail closed on auth and validation errors.

This document describes what is actually implemented today, not just what is planned. See [SECURITY.md](../SECURITY.md) for the reporting process and a concise, versioned summary of accepted risks.

## Threat framing

| Asset | Risk if exposed |
| --- | --- |
| Provider API tokens | Account takeover / data exfiltration at third parties |
| Session cookie | Dashboard access and config tampering |
| SQLite database | Layout, settings, and encrypted-or-hashed secret material |
| Widget payloads | Usually lower sensitivity, but may include personal content |
| Audit log | Operational record of who did what; not itself secret, but useful for incident review |

Primary attackers in scope: casual LAN peers, malicious websites (XSS/CSRF), stolen backups, dependency compromise, credential stuffing / brute force against the login and setup endpoints. Nation-state physical access is out of scope for v1 hardening claims.

## HTTP response security headers

Implemented via `@fastify/helmet`, registered first in [`apps/server/src/app.ts`](../apps/server/src/app.ts):

| Header | Value | Rationale |
| --- | --- | --- |
| `Content-Security-Policy` | `default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'` | Dashora's server is a JSON API only today (no `@fastify/static`, no HTML responses) — default-deny is safe and simplest. |
| `X-Frame-Options` | `DENY` | Clickjacking defense-in-depth alongside `frame-ancestors`. |
| `X-Content-Type-Options` | `nosniff` | Prevents MIME-sniffing of API responses. |
| `Referrer-Policy` | `no-referrer` | API responses never need referrer leakage. |
| `Permissions-Policy` | denies camera/microphone/geolocation/payment/usb/interest-cohort | Dashora has no use for any of these browser features. |
| `Cross-Origin-Resource-Policy` | `same-origin` | |
| `Strict-Transport-Security` | `max-age=<HSTS_MAX_AGE_SECONDS>; includeSubDomains` | Sent **only** when `COOKIE_SECURE` resolves true (production/HTTPS) — never sent over plain HTTP, where it would be meaningless/harmful. |

**Known limitation:** when a reverse proxy serves the built SPA (`/srv/dashora-web` in the production image; see `compose.yaml` + `infra/nginx.conf`), that layer must set its **own** CSP appropriate for a browser app (e.g. `script-src 'self'`, `style-src 'self' 'unsafe-inline'` — the web app currently uses some inline `style={{...}}` — plus a hash or nonce for the inline theme-bootstrap script in `apps/web/index.html`). The API process itself remains JSON-only with default-deny CSP (no `@fastify/static`).

Tests: [`security-headers.test.ts`](../apps/server/src/http/security-headers.test.ts).

## Rate limiting

Four limiters via `@fastify/rate-limit` (global plugin + per-route `config.rateLimit` overrides):

| Scope | Env vars | Default | Key | Purpose |
| --- | --- | --- | --- | --- |
| Global (every route) | `API_RATE_LIMIT_MAX` / `API_RATE_LIMIT_WINDOW_MS` | 300 / 60s | Client IP | General abuse/DoS backstop. |
| Login (`POST /api/v1/auth/login`) | `LOGIN_RATE_LIMIT_MAX` / `LOGIN_RATE_LIMIT_WINDOW_MS` | 10 / 15min | Client IP + normalized email | Credential-stuffing / brute-force resistance. |
| Setup completion (`POST /api/v1/setup/complete`) | `SETUP_RATE_LIMIT_MAX` / `SETUP_RATE_LIMIT_WINDOW_MS` | 20 / 15min | Client IP + normalized email | The one-time setup token is a bearer secret; this slows down guessing it. |
| Session probe (`GET /api/v1/auth/me`) | `AUTH_ME_RATE_LIMIT_MAX` / `AUTH_ME_RATE_LIMIT_WINDOW_MS` | 60 / 60s | Client IP | Slows session-cookie probing. |

All auth limiters return a generic `429 rate_limited` body (no account-existence hints) and a `Retry-After` header. Client IP is taken from Fastify's `request.ip`; `X-Forwarded-For` is trusted only when `TRUST_PROXY` is enabled behind a stripping reverse proxy.

## Authentication model

### Local session auth (implemented)

1. Operator authenticates with local credentials; passwords are hashed with **Argon2id** ([`apps/server/src/auth/password.ts`](../apps/server/src/auth/password.ts)), including a dummy-hash comparison on unknown emails to keep login timing constant regardless of whether the account exists.
2. Server issues an **HttpOnly**, **SameSite=Lax**, **Secure** (`COOKIE_SECURE=auto` → Secure in production) session cookie holding an opaque random token; only its SHA-256 hash is stored server-side ([`sessions` table](../apps/server/src/db/schema.ts)).
3. **Session rotation:** sessions are periodically re-issued. When a session's remaining lifetime falls below `SESSION_RENEWAL_THRESHOLD_MS`, `resolveSession` generates a *new* opaque token, inserts a new session row, and deletes the old row — rather than only bumping `expiresAt` on the same token. This shrinks the replay window for a previously leaked cookie during a long-lived session. See [`session-service.ts`](../apps/server/src/auth/session-service.ts) and its [tests](../apps/server/src/auth/session-service.test.ts).
4. **CSRF:** a double-submit cookie (`CSRF_COOKIE_NAME` + `X-CSRF-Token` header) is required on all state-changing (non-GET) requests, including the anonymous first-run setup endpoint.
5. Unauthenticated mutating routes return `401`; CSRF failures return `403 csrf_invalid`.

**Known limitations (not fixed in this pass, tracked here deliberately):**

- No "sign out of all devices" action and login does not invalidate other active sessions — concurrent multi-device sessions are allowed by design, but there's currently no self-service way to revoke them individually. Operators can inspect/delete rows in the `sessions` table directly if needed.
- No password-reset flow and no password-change endpoint exist yet (first-run setup is the only place a password is currently set).
- No MFA / WebAuthn.

### Password policy

Enforced in `packages/shared/src/auth.ts` on the setup schema:

- Minimum 12 characters. Deliberately **no** forced character-class composition rules (no "must contain a symbol"), per NIST SP 800-63B guidance that composition rules push users toward predictable patterns without real strength gains.
- Rejects an embedded common/breached password denylist (case-insensitive exact match) — [`packages/shared/src/password-denylist.ts`](../packages/shared/src/password-denylist.ts).
- Rejects a password that starts with, ends with, or exactly equals the account email's local-part (e.g. email `alice@example.com` choosing `alice12345678`).

### Roles

v1 targets a single operator. Fine-grained multi-tenant RBAC is not implemented and not currently planned; if multiple local users appear, keep any future model minimal (full-operator vs read-only) rather than general-purpose RBAC.

### Later: optional OIDC

OIDC / reverse-proxy auth may be added behind an ADR. The browser still must not receive provider API tokens for widgets; OIDC would cover *who may use Dashora*, not *how Dashora calls Gmail*.

## Secret handling

**Hard rule:** Provider tokens and secrets never ship to the browser bundle, never appear in API responses in recoverable form, and never appear in logs.

1. **Encryption at rest** — Integration secrets (GitHub PATs, ICS basic-auth passwords, generic API secrets) are stored as AES-256-GCM ciphertext ([`apps/server/src/secrets/encryption.ts`](../apps/server/src/secrets/encryption.ts)), keyed by `SECRETS_ENCRYPTION_KEY` (32-byte key, 64 hex chars).
2. **Docker-secret-style key loading** — `SECRETS_ENCRYPTION_KEY_FILE` may point at a file (e.g. `/run/secrets/dashora_secrets_key`, a Docker/Podman secret mount) containing the same hex key; the server reads and trims it at startup. Setting both `SECRETS_ENCRYPTION_KEY` and `SECRETS_ENCRYPTION_KEY_FILE` is a startup error (ambiguous config) — see [`load-env.ts`](../apps/server/src/load-env.ts).
3. **Reference by id** — Widget configs store an integration id, not the secret value.
4. **Redact on read** — Integration list/detail endpoints return metadata (name, provider, `hasToken`/`hasSecret`/`hasCredentials`, a last-four hint) but never the full secret.
5. **Log hygiene** — see "Logging & error handling" below.
6. **Env validation** — the server environment is parsed with Zod at startup (`@dashora/shared`); missing/malformed critical security config fails startup rather than running half-open.

## SSRF, DNS rebinding, and outbound requests (Custom API, iFrame embed probe, calendar feeds)

Every server-initiated outbound HTTP request (Custom API widget, iCal feed fetching, iFrame embeddability probing) goes through the same guarded client ([`apps/server/src/providers/http-client.ts`](../apps/server/src/providers/http-client.ts), [`ssrf.ts`](../apps/server/src/providers/ssrf.ts)):

| Control | Behavior |
| --- | --- |
| Scheme | `http`/`https` only |
| Blocklist | Private, loopback, link-local, multicast, and cloud metadata (`169.254.169.254`) addresses are rejected by default |
| DNS resolution check | Hostnames are resolved and every returned address is checked against the blocklist before connecting |
| Private-network opt-in | Operators may opt in per widget (`allowPrivateNetwork`) for trusted LAN endpoints only |
| **DNS-rebinding pinning** | The IP address(es) validated by the SSRF check are pinned into the actual TCP connection via a per-request `undici` `Agent` with a custom `lookup` ([`pinned-dispatcher.ts`](../apps/server/src/providers/pinned-dispatcher.ts)) — this closes the classic TOCTOU gap where a second DNS lookup at connect time resolves to a different (private) address than the one that was validated. A fresh dispatcher is created and closed per request attempt (including each redirect hop) — pinning is never shared across hostnames or requests. |
| Redirects | Followed manually up to a configured limit; **each hop is re-validated** (blocklist + DNS + re-pinned) rather than trusting the first check |
| Response size | Both an early `Content-Length` header rejection and a streaming byte-count cap enforce the configured maximum — defense in depth in case a server lies about or omits `Content-Length` |
| Timeouts | Separate connect and total-request timeouts |

**Residual risk, stated plainly:** pinning is applied per validated address (or address set for hosts with multiple A/AAAA records), not to a single hard-coded IP forever — this keeps CDN-backed hosts working, but it does mean a multi-IP host's *other* validated addresses remain trusted for the lifetime of that one request. This is considered acceptable because every address used was independently validated moments earlier in the same request. If real-world provider hosts prove this too permissive, pinning will be tightened further and this note updated.

Tests: [`ssrf.test.ts`](../apps/server/src/providers/ssrf.test.ts), [`pinned-dispatcher.test.ts`](../apps/server/src/providers/pinned-dispatcher.test.ts), [`http-client.test.ts`](../apps/server/src/providers/http-client.test.ts).

## Custom API widget

The Custom API widget performs **server-side** HTTP only (`GET` / `POST`). The browser never receives provider secrets and never executes mapped responses as code.

| Control | Behavior |
| --- | --- |
| Methods | `GET` and `POST` only |
| Headers | Allow-listed names; hop-by-hop / `Host` / `Cookie` / forwarding headers denied |
| Secrets | Header values may reference `api-secret` integration ids; literals must not store credentials |
| Response handling | JSON parsed server-side and mapped via limited paths into text / metric / list / progress / status |
| Forbidden | Arbitrary JavaScript, server-side template engines, and raw HTML rendering |
| Limits | Configurable timeout (1–30s), response size cap, redirect limits — see "SSRF, DNS rebinding" above |
| Preview | `POST /api/v1/widgets/custom-api/preview` runs a test request; responses redact secrets and sensitive headers |
| Logs / errors | Authorization and other sensitive headers are redacted; secret values never appear in messages |

JSON path mapping is intentionally limited (`data.value`, `items[0].title`). Filters, recursive descent (`..`), and script expressions are rejected.

## iFrame widget

The iFrame widget embeds a single **https** URL in a sandboxed frame. It is not a plugin host and does not expose a `postMessage` API.

| Control | Behavior |
| --- | --- |
| URL validation | https only, no credentials, no localhost |
| Allow list | Optional hostname allow list (`example.com`, `*.trusted.example`) |
| Sandbox | Restrictive by default; scripts / same-origin / forms / popups are explicit opt-ins |
| Embedding probe | Server checks `X-Frame-Options` / CSP `frame-ancestors` and surfaces a warning when framing is refused |
| CSP | Embeds must **not** widen the main app Content Security Policy globally (no `frame-src *` / `default-src *` for convenience) |

Operators should keep sandbox tokens minimal. Combining `allow-scripts` with `allow-same-origin` weakens isolation and should be reserved for fully trusted origins.

## HTML / text sanitization (RSS and similar feed content)

Provider/feed content (RSS descriptions, etc.) is only ever rendered as **plain text**, never as HTML — `dangerouslySetInnerHTML` is not used anywhere in `apps/web`, `packages/ui`, or `packages/widget-sdk`, enforced by a repo-wide regression test ([`apps/web/src/no-dangerous-html.test.ts`](../apps/web/src/no-dangerous-html.test.ts)) that scans those packages' sources and fails if the prop is ever introduced.

`stripHtmlToText` / `sanitizeHttpUrl` ([`packages/widget-sdk/src/widgets/rss/sanitize.ts`](../packages/widget-sdk/src/widgets/rss/sanitize.ts)) decode HTML entities **before** stripping tags (not after — decoding after stripping would let an entity-encoded tag like `&lt;script&gt;` resurrect as literal `<script>` text) and reject `javascript:`/`data:`/`vbscript:` URL schemes and credentialed URLs. This is a **text-extraction guarantee, not a general-purpose HTML sanitizer** — if `dangerouslySetInnerHTML` (or any HTML-rendering surface) is ever introduced, it must first be paired with a real sanitizer (e.g. `sanitize-html`) and this section must be revisited.

Tests: [`sanitize.test.ts`](../packages/widget-sdk/src/widgets/rss/sanitize.test.ts).

## Logging & error handling

- **Structured redaction** — pino's `redact` option scrubs a fixed path list (`LOG_REDACT_PATHS` in [`app.ts`](../apps/server/src/app.ts)) before anything is serialized: `Authorization`/cookie headers (request and response), and request-body fields `password`, `confirmPassword`, `token`, `secret`, `clientSecret`, `value`, `username`, `csrfToken`, plus the nested array shapes used by Custom API header configs (`headers[*].value`, `widgets[*].config.headers[*].value`). Verified directly against pino's redaction engine in [`logging-redaction.test.ts`](../apps/server/src/logging-redaction.test.ts) (including nested/array paths), since Fastify's built-in request/response serializers don't apply to arbitrary log payloads.
- **Global error handler** ([`http/error-handler.ts`](../apps/server/src/http/error-handler.ts)) — every unhandled error is logged in full (with stack) server-side, but the client always receives a generic, stack-free envelope (`{"error":{"code":"internal_error","message":"..."}}` for 500s; safe generic messages for 4xx classes) — **regardless of `NODE_ENV`**, not just in production. A generic 404 envelope is used for unknown routes.
- **Request body limits** — a global Fastify `bodyLimit` (`MAX_BODY_BYTES`, default 1 MB) applies to all routes; the backup import/preview routes use a separate, larger, explicit override (`BACKUP_IMPORT_MAX_BYTES`) since config exports can legitimately be larger. There is no file-upload (`multipart`) feature today; if one is added, it must use `@fastify/multipart` with strict per-file/total limits — this is a documented requirement for that future feature, not something implemented speculatively now.

Tests: [`error-handler.test.ts`](../apps/server/src/http/error-handler.test.ts).

## Audit log

A dedicated `audit_events` table ([`db/schema.ts`](../apps/server/src/db/schema.ts), migration `0006_audit_events.sql`) records security-relevant actions via [`services/audit-service.ts`](../apps/server/src/services/audit-service.ts):

- **Auth:** login success/failure (failure records the attempted email, not a password), logout, first-run setup completion (success and failure).
- **Settings:** theme preference update/reset.
- **Integrations:** GitHub / ICS-basic-auth / API-secret create, update, delete — metadata only (provider, integration id, name), **never** secret values or tokens.
- **Backup:** export and import (import records the mode — `replace` or `merge` — not the file contents).

Design notes:

- `actorUserId` is nullable to represent pre-auth events (e.g. a failed login for an email that doesn't exist); `actorEmail` captures the attempted identity in that case.
- `metadataJson` is schema-constrained to flat scalar values (string/number/boolean/null) — an entire object/array can never be smuggled in as a value, which would otherwise risk a future call site accidentally nesting a secret payload.
- Audit writes are best-effort and isolated: a failure to write an audit row is logged server-side but never fails or alters the outcome of the request it's observing.
- **No admin UI** for viewing the audit log ships in this pass — operators query the SQLite `audit_events` table directly. This is an intentional scope cut, not an oversight; tracked in [security-checklist.md](./security-checklist.md).

Tests: [`audit-service.test.ts`](../apps/server/src/services/audit-service.test.ts), plus assertions in the affected route test files (`auth.test.ts`, `settings.test.ts`, `integrations.test.ts`, `backup.test.ts`) that a row is recorded and that secret material never appears in it.

## Network and deployment

- Production expects HTTPS termination (reverse proxy or managed TLS); `COOKIE_SECURE=auto` follows `NODE_ENV`.
- **`TRUST_PROXY`** is opt-in (default `false`) and controls whether Fastify trusts client-supplied `X-Forwarded-For`/`X-Forwarded-Proto` headers for computing the client IP and scheme. **This must only be enabled when Dashora sits directly behind a reverse proxy that itself strips any client-supplied `X-Forwarded-*` headers before setting its own.** If enabled without that guarantee, a client can spoof its own IP address, which undermines both rate limiting (an attacker can claim a different IP per request to dodge the login/setup limiters) and the audit log's `ip` field (falsified provenance for security review). The server logs a startup warning whenever `TRUST_PROXY=true` to make this easy to notice in deployment logs.
- CORS is restricted to the configured `CORS_ORIGIN`.
- Health endpoints must not disclose secrets or detailed internal inventory.

## Database and backups

- SQLite file permissions should be restricted to the Dashora service account.
- Backups are sensitive: treat them like production secrets (they can contain integration metadata and, depending on future export scope, encrypted secret ciphertext).
- Migrations are applied by the server process only; see [architecture.md](./architecture.md).
- Operator backup/restore steps: [infra/backup-restore.md](../infra/backup-restore.md).

## Dependency and extension policy

- New large dependencies require justification (see project rules). This pass added `@fastify/helmet` (official Fastify-org header plugin) and an explicit `undici` dependency (Node's own fetch engine, needed only for typed `Agent`/dispatcher access for DNS-rebinding pinning — see [SECURITY.md](../SECURITY.md) for a version-pinning caveat).
- Arbitrary third-party JavaScript plugins are deferred; see [widget-system.md](./widget-system.md).
- CI runs lint, typecheck, tests, and build before merge, plus a non-blocking `pnpm audit --audit-level=high` report step (see [SECURITY.md](../SECURITY.md) for current advisories and why they aren't blocking).

## Incident expectations

If a secret may have leaked:

1. Rotate the provider credential at the provider.
2. Rotate `SECRETS_ENCRYPTION_KEY` and re-encrypt stored integration secrets (requires re-entering them, since rotating the key alone does not re-encrypt existing ciphertext — there is no key-rotation migration tool yet, tracked in the checklist).
3. Invalidate sessions by deleting rows from the `sessions` table (no bulk "revoke all sessions" endpoint exists yet).
4. Review the `audit_events` table for the affected time window (without pasting secret values into tickets — none should be present, but treat exported rows as sensitive operational data regardless).

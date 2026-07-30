# Security model

Dashora is self-hosted software that often sits next to powerful credentials (mail, cloud APIs, home automation, monitoring). The security model assumes a trusted operator and an untrusted broader network: protect secrets, minimize browser privilege, and fail closed on auth and validation errors.

## Threat framing (v1)

| Asset | Risk if exposed |
| --- | --- |
| Provider API tokens | Account takeover / data exfiltration at third parties |
| Session cookie | Dashboard access and config tampering |
| SQLite database | Layout, settings, and encrypted-or-hashed secret material |
| Widget payloads | Usually lower sensitivity, but may include personal content |

Primary attackers in scope: casual LAN peers, malicious websites (XSS), stolen backups, dependency compromise. Nation-state physical access is out of scope for v1 hardening claims.

## Server-side secret handling

**Hard rule:** Provider tokens and secrets never ship to the browser bundle, never appear in API responses in recoverable form, and never appear in logs.

Practices:

1. **Store secrets only on the server** — Prefer encrypted-at-rest secret fields (application key from environment) or OS-backed secret storage when introduced; never `localStorage`.
2. **Reference by id** — Widget configs store `credentialId`, not the secret value.
3. **Redact on read** — Credential list endpoints may return metadata (name, provider, last four, updatedAt) but not the full secret.
4. **Memory discipline** — Resolvers use secrets ephemerally for outbound calls; do not attach them to cached widget payloads.
5. **Log hygiene** — Loggers must scrub `Authorization`, cookie headers, password fields, and known secret keys. Prefer structured field allow-lists over raw request dumps.
6. **Env validation** — Server environment is parsed with Zod at startup (`@dashora/shared`); missing critical security config fails startup rather than running half-open.

## Authentication model

### v1: local session auth

1. Operator authenticates with local credentials (password verified server-side with a slow hash such as Argon2id or bcrypt — exact algorithm chosen at implementation time).
2. Server issues an **HTTP-only**, **Secure** (in production HTTPS), **SameSite** session cookie.
3. Session identifiers are random, stored server-side (or as signed server-verifiable session records in SQLite), and rotatable on login/logout.
4. CSRF protections apply to cookie-authenticated state-changing requests (SameSite plus explicit anti-CSRF strategy as implemented).
5. Unauthenticated mutating routes return 401; authorized-but-forbidden return 403.

### Roles (v1)

v1 targets a single operator (optionally a small set of local users later). Fine-grained multi-tenant RBAC is not required for the first release. If multiple local users appear, default to full-operator vs read-only only when needed — keep the model small.

### Later: optional OIDC

OIDC / reverse-proxy auth may be added behind an ADR. Browser still must not receive provider API tokens for widgets; OIDC covers *who may use Dashora*, not *how Dashora calls Gmail*.

## Browser trust boundary

The SPA is responsible for UX, not for holding privileged secrets.

- Content Security Policy should tighten as features land (default deny inline scripts once the Vite app allows it).
- User-generated or provider-sourced HTML is sanitized or rendered as text; widgets should prefer structured data over raw HTML.
- No `eval`, no remote script injection, no “paste this plugin URL” loader in v1.

## Network and deployment

- Production expects HTTPS termination (reverse proxy or managed TLS).
- `TRUST_PROXY` is opt-in and documented — do not enable blindly.
- CORS is restricted to the known web origin.
- Health endpoints must not disclose secrets or detailed internal inventory.

## Database and backups

- SQLite file permissions should be restricted to the Dashora service account.
- Backups are sensitive: treat them like production secrets.
- Migrations are applied by the server process only; see [architecture.md](./architecture.md).
- Operator backup/restore steps: [infra/backup-restore.md](../infra/backup-restore.md).

## Dependency and extension policy

- New large dependencies require justification (see project rules).
- Arbitrary third-party JavaScript plugins are deferred; see [widget-system.md](./widget-system.md).
- CI runs lint, typecheck, tests, and build before merge.

## Incident expectations

If a secret may have leaked:

1. Rotate the provider credential at the provider.
2. Rotate Dashora session secrets / app encryption keys as applicable.
3. Invalidate sessions.
4. Audit logs for suspicious access windows (without pasting secrets into tickets).

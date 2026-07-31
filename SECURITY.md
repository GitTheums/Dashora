# Security policy

Dashora is self-hosted software, often deployed next to real credentials (mail, cloud APIs, home automation, monitoring). This document describes supported versions, how to report a vulnerability, a summary of the controls currently implemented, and — deliberately — the limitations and accepted risks that remain. **Nothing in this document, or in the fact that a hardening pass and a checklist exist, should be read as a claim that Dashora is fully secure.** Treat it as a snapshot of what has been reviewed and implemented, not a certification.

## Supported versions

| Version | Supported |
| --- | --- |
| 1.0.x | Yes |
| < 1.0 | No (pre-release development builds) |

Security fixes for the current stable line land on `main` and ship in patch releases. There is no long-term maintenance of older major lines yet.

## Reporting a vulnerability

Please report suspected vulnerabilities privately rather than opening a public issue:

- Preferred: open a [GitHub private security advisory](https://github.com/GitTheums/Dashora/security/advisories/new) on this repository.
- If that isn't available to you, open a regular issue asking for a private contact channel — do not include exploit details or real secret values in a public issue.

Please include: the affected version/commit, a description of the issue, reproduction steps, and the potential impact. There is currently no bug bounty program.

## What this pass implemented

A full summary with file/test pointers lives in [docs/security-model.md](docs/security-model.md). In short:

- HTTP response security headers (CSP, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, conditional HSTS) via `@fastify/helmet`.
- Global, login-scoped, and setup-completion-scoped rate limiting via `@fastify/rate-limit`.
- Session token rotation on renewal (not just expiry extension), on top of pre-existing fixation-resistant login and HttpOnly/SameSite/Secure cookies.
- A common-password denylist and email-local-part rejection in the setup password policy (NIST 800-63B style — length + denylist, no forced composition rules).
- `SECRETS_ENCRYPTION_KEY_FILE` support for Docker/Podman-secret-style key loading, alongside the existing AES-256-GCM secret encryption.
- A global Fastify request body size limit.
- DNS-rebinding protection for all server-initiated outbound requests (Custom API widget, iCal feeds, iFrame embeddability probes), pinning SSRF-validated IP addresses into the actual TCP connection, plus an early `Content-Length` rejection alongside the existing streaming response-size cap.
- A regression test locking in that `dangerouslySetInnerHTML` is never introduced in the web app, plus hardened tests for the existing text-only HTML/URL sanitization.
- Expanded structured-log redaction and a global error handler that never leaks internal error messages or stack traces to clients, in any environment.
- A new `audit_events` table and service recording login, logout, setup, settings, integration, and backup changes — metadata only, never secret values.
- A startup warning when `TRUST_PROXY` is enabled, since misconfiguring it undermines both rate limiting and audit-log IP attribution.
- `pnpm audit` reviewed workspace-wide; see "Known dependency advisories" below. A non-blocking `pnpm audit --audit-level=high` step now runs in CI.

## Known limitations / accepted risks

These are gaps that exist today, listed explicitly rather than silently left out of the checklist:

- **No MFA / WebAuthn.** Single-factor password auth only.
- **No password-reset or password-change flow.** The only place a password is set is first-run setup. An operator who loses their password currently has no self-service recovery path.
- **No "sign out of all devices."** Logging in does not invalidate other active sessions, and there is no bulk session-revocation endpoint; an operator must delete rows from the `sessions` table directly.
- **No admin UI for the audit log.** Operators query the SQLite `audit_events` table directly. See [docs/security-checklist.md](docs/security-checklist.md) for the tracked follow-up.
- **CSP is only meaningful at the current JSON-API-only deployment shape.** If/when a reverse proxy or the server itself starts serving the built SPA, that layer needs its own CSP (`script-src 'self'`, plus handling for existing inline styles and the theme-bootstrap inline script) — see [docs/security-model.md](docs/security-model.md#http-response-security-headers).
- **DNS-rebinding pinning is per-request, not permanent, and pins the full validated address set for a multi-A-record host** rather than a single IP forever. This is a deliberate trade-off to keep CDN-backed provider hosts working; see [docs/security-model.md](docs/security-model.md#ssrf-dns-rebinding-and-outbound-requests-custom-api-iframe-embed-probe-calendar-feeds) for the full reasoning.
- **No secret-key rotation tooling.** Rotating `SECRETS_ENCRYPTION_KEY` does not re-encrypt existing ciphertext; affected integrations must be re-entered.
- **`TRUST_PROXY` is a foot-gun if misconfigured** — it is opt-in and warns at startup, but Dashora cannot verify that a reverse proxy actually strips client-supplied `X-Forwarded-*` headers before setting its own; that guarantee is the operator's responsibility.
- **Multi-tenant RBAC does not exist.** v1 targets a single operator.

None of the above are silently "fixed" by this pass — they're recorded here so operators can make an informed deployment decision, and so future work has a concrete backlog.

## Known dependency advisories

`pnpm audit` (workspace-wide) currently reports:

- **`brace-expansion` ≤ 5.0.7 (high, [GHSA-mh99-v99m-4gvg](https://github.com/advisories/GHSA-mh99-v99m-4gvg))** — transitive via `@vitest/coverage-v8` → `test-exclude` → `glob` → `minimatch`. DevDependency-only (coverage tooling); not in the production image.

**Resolved:** `esbuild` ≤ 0.24.2 ([GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99)) was previously pulled in via `drizzle-kit` → `@esbuild-kit/esm-loader` → `@esbuild-kit/core-utils`. No stable `drizzle-kit` release drops that abandoned package, so the workspace uses a narrow root override in `pnpm-workspace.yaml` (`@esbuild-kit/core-utils>esbuild` → `>=0.25.0`) to force a patched esbuild on that unused leaf. Re-evaluate the override when `drizzle-kit` ships a stable release without `@esbuild-kit/*`.

This list should be kept current — re-run `pnpm audit` and update this section whenever advisories change, rather than letting it go stale.

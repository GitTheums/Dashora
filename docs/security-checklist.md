# Security checklist

A traceability list of concrete security controls, their status, and where to find the implementing code and tests. This is **not** a claim that Dashora is "secure" — it's a working record so gaps are visible and reviewable, not hidden by the existence of a checklist. See [SECURITY.md](../SECURITY.md#known-limitations--accepted-risks) for the plain-language list of accepted risks and [security-model.md](./security-model.md) for the full narrative.

Status legend: ✅ Done · ⚠️ Partial (see note) · ➖ Not applicable / out of scope (see note)

## Transport & response headers

| # | Control | Status | Implementation | Test |
| - | --- | --- | --- | --- |
| 1 | Content-Security-Policy | ✅ | `app.ts` (`@fastify/helmet`) | `http/security-headers.test.ts` |
| 2 | Clickjacking protection (`X-Frame-Options` / `frame-ancestors`) | ✅ | `app.ts` | `http/security-headers.test.ts` |
| 3 | MIME-sniffing protection (`X-Content-Type-Options`) | ✅ | `app.ts` | `http/security-headers.test.ts` |
| 4 | Referrer-Policy | ✅ | `app.ts` | `http/security-headers.test.ts` |
| 5 | Permissions-Policy | ✅ | `app.ts` | `http/security-headers.test.ts` |
| 6 | HSTS | ✅ (conditional on HTTPS) | `app.ts` | `http/security-headers.test.ts` |
| 7 | CORS restricted to a known origin | ✅ (pre-existing) | `app.ts` (`@fastify/cors`) | — |

## Session & authentication

| # | Control | Status | Implementation | Test |
| - | --- | --- | --- | --- |
| 8 | HttpOnly / Secure / SameSite session cookie | ✅ (pre-existing) | `auth/cookies.ts` | — |
| 9 | CSRF protection (double-submit cookie) on state-changing requests | ✅ (pre-existing) | `auth/csrf.ts` | route tests (403 on missing/invalid token) |
| 10 | Session-fixation resistance (fresh token at login) | ✅ (pre-existing) | `auth/session-service.ts` | — |
| 11 | Session token rotation during a long-lived session (not just expiry extension) | ✅ | `auth/session-service.ts` | `auth/session-service.test.ts` |
| 12 | Password hashing with a slow, salted algorithm (Argon2id) + constant-time comparison on unknown accounts | ✅ (pre-existing) | `auth/password.ts` | `auth/password.test.ts` |
| 13 | Password policy beyond length (denylist, no email-based passwords) | ✅ | `packages/shared/src/auth.ts`, `password-denylist.ts` | `auth.test.ts`, `password-denylist.test.ts`, `routes/auth.test.ts` |
| 14 | Login brute-force rate limiting | ✅ | `routes/auth.ts` (`config.rateLimit`) | `routes/auth-rate-limit.test.ts` |
| 15 | First-run setup token brute-force rate limiting | ✅ | `routes/auth.ts` (`config.rateLimit`) | `routes/auth-rate-limit.test.ts` |
| 15b | Session probe (`/api/v1/auth/me`) rate limiting | ✅ | `routes/auth.ts` (`config.rateLimit`) | `routes/auth-rate-limit.test.ts` |
| 16 | Global API rate limiting (abuse/DoS backstop) | ✅ | `app.ts` | (registered globally; see `http/error-handler.test.ts` 429 handling) |
| 17 | Self-service session revocation ("sign out of all devices") | ⚠️ Partial | Logout deletes only the current session row | Not implemented — see SECURITY.md |
| 18 | Password reset / change flow | ➖ | Not implemented | Out of scope for this pass — see SECURITY.md |
| 19 | Multi-factor authentication | ➖ | Not implemented | Out of scope for this pass — see SECURITY.md |

## Secrets

| # | Control | Status | Implementation | Test |
| - | --- | --- | --- | --- |
| 20 | Secrets never sent to the browser | ✅ (pre-existing) | Integration response schemas expose only metadata + hints | `routes/integrations.test.ts` |
| 21 | Secrets encrypted at rest (AES-256-GCM) | ✅ (pre-existing) | `secrets/encryption.ts` | `secrets/encryption.test.ts` |
| 22 | Docker/Podman-secret-style key file loading | ✅ | `load-env.ts` (`SECRETS_ENCRYPTION_KEY_FILE`) | `load-env.test.ts` |
| 23 | Secret-key rotation tooling (re-encrypt existing ciphertext) | ➖ | Not implemented | Out of scope for this pass — see SECURITY.md |

## Input handling & request limits

| # | Control | Status | Implementation | Test |
| - | --- | --- | --- | --- |
| 24 | All API routes validate input with Zod | ✅ (pre-existing convention, verified for routes touched in this pass) | `packages/shared/src/*`, route handlers | route tests across `routes/*.test.ts` |
| 25 | Global request body size limit | ✅ | `app.ts` (`MAX_BODY_BYTES`) | `http/error-handler.test.ts` |
| 26 | Per-route body limit override where a route legitimately needs a larger payload (backup import) | ✅ (pre-existing) | `routes/backup.ts` (`BACKUP_IMPORT_MAX_BYTES`) | `routes/backup.test.ts` |
| 27 | File-upload (`multipart`) size/type limits | ➖ | No upload feature exists today | If added, must use `@fastify/multipart` with strict limits — documented requirement, not implemented speculatively |

## Outbound requests / SSRF

| # | Control | Status | Implementation | Test |
| - | --- | --- | --- | --- |
| 28 | Private/loopback/link-local/metadata address blocklist | ✅ (pre-existing) | `providers/ssrf.ts` | `providers/ssrf.test.ts` |
| 29 | DNS resolution checked against the blocklist before connecting | ✅ (pre-existing) | `providers/ssrf.ts` | `providers/ssrf.test.ts` |
| 30 | DNS-rebinding protection (pin validated address into the actual connection) | ✅ | `providers/pinned-dispatcher.ts`, `http-client.ts` | `providers/pinned-dispatcher.test.ts`, `providers/http-client.test.ts` |
| 31 | Redirect re-validation per hop | ✅ (pre-existing) | `providers/http-client.ts` | `providers/http-client.test.ts` |
| 32 | Outbound response size cap (streaming) | ✅ (pre-existing) | `providers/http-client.ts` | `providers/http-client.test.ts` |
| 33 | Outbound response size cap (early `Content-Length` rejection) | ✅ | `providers/http-client.ts` | `providers/http-client.test.ts` |

## Output handling

| # | Control | Status | Implementation | Test |
| - | --- | --- | --- | --- |
| 34 | Provider/feed content never rendered as raw HTML | ✅ (pre-existing architecture, now regression-tested) | `packages/widget-sdk/src/widgets/rss/sanitize.ts` | `apps/web/src/no-dangerous-html.test.ts` (repo-wide grep guard) |
| 35 | HTML entity/tag stripping resists bypasses (encoded tags, malformed markup, dangerous URL schemes) | ✅ | `sanitize.ts` | `sanitize.test.ts` |

## Logging & error handling

| # | Control | Status | Implementation | Test |
| - | --- | --- | --- | --- |
| 36 | Structured log redaction for secrets/tokens/passwords/cookies | ✅ (expanded this pass) | `app.ts` (`LOG_REDACT_PATHS`) | `logging-redaction.test.ts` |
| 37 | Errors never leak internal messages or stack traces to clients, in any environment | ✅ | `http/error-handler.ts` | `http/error-handler.test.ts` |
| 38 | Generic 404 for unknown routes | ✅ | `http/error-handler.ts` | `http/error-handler.test.ts` |

## Audit trail

| # | Control | Status | Implementation | Test |
| - | --- | --- | --- | --- |
| 39 | Login success/failure recorded | ✅ | `services/audit-service.ts`, `routes/auth.ts` | `routes/auth.test.ts` |
| 40 | Logout recorded | ✅ | `routes/auth.ts` | `routes/auth.test.ts` |
| 41 | First-run setup completion recorded | ✅ | `routes/auth.ts` | `routes/auth.test.ts` |
| 42 | Settings changes recorded | ✅ | `routes/settings.ts` | `routes/settings.test.ts` |
| 43 | Integration create/update/delete recorded (metadata only) | ✅ | `routes/integrations.ts` | `routes/integrations.test.ts` |
| 44 | Backup export/import recorded | ✅ | `routes/backup.ts` | `routes/backup.test.ts` |
| 45 | Audit metadata schema-constrained to non-secret scalars | ✅ | `db/repositories/audit-events.ts` | `services/audit-service.test.ts` |
| 46 | Admin UI to browse the audit log | ➖ | Not implemented | Operators query SQLite directly — out of scope for this pass |

## Deployment & operations

| # | Control | Status | Implementation | Test |
| - | --- | --- | --- | --- |
| 47 | `TRUST_PROXY` is opt-in, off by default | ✅ (pre-existing) | `packages/shared/src/env.ts` | — |
| 48 | Startup warning when `TRUST_PROXY` is enabled | ✅ | `app.ts` | Manual verification (log-message test omitted as low-value; see PR discussion) |
| 49 | Dependency vulnerability scanning | ✅ | `pnpm audit` reviewed; 1 accepted low-risk devDependency advisory documented | [SECURITY.md](../SECURITY.md#known-dependency-advisories) |
| 50 | CI dependency-audit step | ✅ (non-blocking/report-only) | `.github/workflows/ci.yml` | — |
| 51 | `SECURITY.md` with reporting process and accepted risks | ✅ | [SECURITY.md](../SECURITY.md) | — |

---

**How to read the ➖ rows:** they represent deliberate, documented scope cuts for this pass — not silently-ignored gaps. Each links back to [SECURITY.md](../SECURITY.md#known-limitations--accepted-risks) for the reasoning and should be revisited as the product matures (e.g. before a 1.0 release or before recommending Dashora for anything beyond a trusted single-operator LAN deployment).

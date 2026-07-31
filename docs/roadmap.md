# Roadmap

This roadmap is directional. Dates are intentionally absent; milestones complete when acceptance criteria land in `main`.

## Version 1.0 — usable personal dashboard (shipped)

Acceptance theme: an operator can log in, arrange widgets on a page, configure credentials on the server, and see live-or-stale data safely.

- [x] pnpm monorepo with `apps/web`, `apps/server`, shared packages
- [x] Health API, env validation, CI, agent rules
- [x] Architecture documentation set (this folder)
- [x] SQLite + Drizzle schema and migration runner
- [x] Local session auth and secure cookies (first-run setup token)
- [x] Dashboard page CRUD and 12-column layout editor
- [x] Widget SDK contracts, registries, and end-to-end provider wiring
- [x] First-party widgets: Search, Clock, Bookmarks, Todo, Weather, RSS, Calendar, GitHub Repository/Releases, Markets, Hacker News, Lobsters, Reddit, YouTube, Twitch, Custom API, iFrame
- [x] Server-side secrets API with redacted reads
- [x] Cache + stale-while-revalidate for remote widgets
- [x] Light/dark themes and appearance settings
- [x] Config import/export (Settings → Backup)
- [x] Unit/integration tests, Playwright e2e/a11y/visual, container smoke
- [x] Container packaging under `infra/` + Compose + GHCR multi-arch publish

Out of scope reminders: third-party JS plugins, Rackora inventory features, SaaS multi-tenant.

See [CHANGELOG.md](../CHANGELOG.md) for the v1.0.0 release notes.

## Version 1.x — deepen the core

- Additional first-party widgets driven by operator demand (for example HTTP health/status)
- Optional OIDC / reverse-proxy auth documentation and support
- Backup / restore polish and optional helpers
- Richer empty/error copy and configuration wizards
- Performance passes on cache hit rates and layout editor UX
- Further CSP and security-header hardening for SPA-serving deployments
- MFA / password-change / session-revocation (see [SECURITY.md](../SECURITY.md))

## Version 2 — deliberate extensibility

Only after v1.x is solid and an ADR revisits the plugin policy:

- Capability-restricted extension mechanism (not raw `eval` plugins)
- Multi-page navigation polish and shared widget presets
- Stronger multi-user roles if real demand exists

## Explicit non-goals (until revisited)

| Non-goal | Why |
| --- | --- |
| Glance compatibility layer | Dashora is original; no fork or template import path |
| Arbitrary remote JS plugins | Security and support cost; see widget system docs |
| Becoming Rackora | Different product domain; keep repositories separate |
| Mobile app stores | Responsive web first |

## Decision log

Architectural decisions are recorded under [`docs/adr/`](./adr/):

- [0001 — Monorepo](./adr/0001-monorepo.md)
- [0002 — React, Vite, Fastify](./adr/0002-react-vite-fastify.md)
- [0003 — SQLite and Drizzle](./adr/0003-sqlite-drizzle.md)
- [0004 — Widget registry](./adr/0004-widget-registry.md)

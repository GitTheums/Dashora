# Roadmap

This roadmap is directional. Dates are intentionally absent; milestones complete when acceptance criteria land in `main`.

## Now — foundation (complete / in progress)

- [x] pnpm monorepo with `apps/web`, `apps/server`, shared packages
- [x] Health API, env validation, CI, agent rules
- [x] Architecture documentation set (this folder)
- [x] SQLite + Drizzle schema and migration runner
- [ ] Session authentication
- [ ] Page + 12-column layout persistence APIs
- [x] Widget SDK contracts, registries, and `demo-metrics` developer example
- [x] First-party widgets: Search, Clock, Bookmarks, Todo (see [First-party widgets](./widgets/first-party.md))
- [ ] Widget registry wiring end-to-end for remote/provider widgets beyond local config + Todo API

## Version 1 — usable personal dashboard

Acceptance theme: an operator can log in, arrange widgets on a page, configure credentials on the server, and see live-or-stale data safely.

- Local session auth and secure cookies
- Dashboard page CRUD and layout editor
- First-party widget set (small but real): for example clock/bookmarks, RSS, weather, and one HTTP health/status widget
- Server-side secrets API with redacted reads
- Cache + stale-while-revalidate for remote widgets
- Light/dark themes across shells and widgets
- Unit tests for new routes; smoke e2e for login + dashboard render
- Container packaging under `infra/` for single-host deploy

Out of scope reminders: third-party JS plugins, Rackora inventory features, SaaS multi-tenant.

## Version 1.x — deepen the core

- Additional first-party widgets driven by operator demand
- Optional OIDC / reverse-proxy auth documentation and support
- Backup / restore guidance and optional helpers
- Richer empty/error copy and configuration wizards
- Performance passes on cache hit rates and layout editor UX
- Hardened CSP and security headers defaults

## Version 2 — deliberate extensibility

Only after v1 is solid and an ADR revisits the plugin policy:

- Capability-restricted extension mechanism (not raw `eval` plugins)
- Import/export of dashboard definitions
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

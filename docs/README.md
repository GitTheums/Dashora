# Dashora documentation

Operator guides, architecture notes, and contributor docs for Dashora — an independent self-hosted personal dashboard.

Glance is acknowledged only as product-category inspiration. Dashora does not copy Glance source, templates, assets, naming, CSS, or documentation, and does not depend on Glance as a library.

## Operator guides

| Document | Contents |
| --- | --- |
| [Installation](./installation.md) | Docker Compose install, first-run setup, data directory |
| [Configuration](./configuration.md) | Environment variables, secrets, provider keys |
| [Supported widgets](./widgets/index.md) | Catalog of first-party widgets |
| [Reverse proxy](./reverse-proxy.md) | TLS, nginx/Caddy/Traefik, `TRUST_PROXY` |
| [Backup and restore](./backup-restore.md) | Config export + SQLite / volume backups |
| [Upgrading](./upgrading.md) | Image upgrade and rollback |
| [Release checklist](./release-checklist.md) | Pre-tag validation and GHCR publish steps |
| [Troubleshooting](./troubleshooting.md) | Common failure modes |
| [Security policy](../SECURITY.md) | Reporting and accepted risks |
| [Security model](./security-model.md) | Secrets, auth, SSRF, headers |
| [Changelog](../CHANGELOG.md) | Released versions |

## Contributor guides

| Document | Contents |
| --- | --- |
| [Contributing](../CONTRIBUTING.md) | PR expectations and local checks |
| [Code of conduct](../CODE_OF_CONDUCT.md) | Community standards |
| [Development](./development.md) | Local setup, scripts, engineering rules |
| [Widget development](./widget-development.md) | Adding first-party widgets |
| [Adding a widget (detailed)](../packages/widget-sdk/docs/adding-a-widget.md) | Step-by-step with code samples |
| [First-party widgets (detailed)](./widgets/first-party.md) | Settings and API notes per widget |

## Product and architecture

| Document | Contents |
| --- | --- |
| [Product vision](./product-vision.md) | Dashora vs Rackora, originality, v1 scope |
| [Architecture](./architecture.md) | System shape, FE/BE boundary, DB ownership, caching |
| [Performance](./PERFORMANCE.md) | Bundle/cache/timing measurements |
| [Design system](./design-system.md) | Themes, a11y, 12-column responsive layout |
| [Widget system](./widget-system.md) | Contracts, registry, SWR, extension strategy |
| [Quality](./quality.md) | Testing and quality expectations |
| [Security checklist](./security-checklist.md) | Hardening checklist |
| [Roadmap](./roadmap.md) | Near-term milestones and non-goals |

## Architecture decision records

| ADR | Decision |
| --- | --- |
| [0001](./adr/0001-monorepo.md) | pnpm workspace monorepo |
| [0002](./adr/0002-react-vite-fastify.md) | React + Vite and Fastify |
| [0003](./adr/0003-sqlite-drizzle.md) | SQLite + Drizzle migrations |
| [0004](./adr/0004-widget-registry.md) | In-repo widget registry; no arbitrary third-party JS plugins |

## Operations (infra)

| Document | Contents |
| --- | --- |
| [Infrastructure](../infra/README.md) | Docker Compose, multi-arch images, nginx |
| [Backup and restore (infra)](../infra/backup-restore.md) | Low-level SQLite volume procedures |
| [Upgrade procedure (infra)](../infra/upgrade.md) | Image upgrade notes |

## Screenshot placeholders

Replace SVG placeholders under [`docs/images/`](./images/) with real captures when available:

- `dashboard-light.placeholder.svg`
- `dashboard-dark.placeholder.svg`
- `dashboard-mobile.placeholder.svg`
- `dashboard-edit.placeholder.svg`

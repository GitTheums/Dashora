# Dashora documentation

Architecture and contributor documentation for Dashora, an independent self-hosted personal dashboard.

## Start here

| Document | Contents |
| --- | --- |
| [Product vision](./product-vision.md) | Dashora vs Rackora, originality vs Glance, v1 scope |
| [Architecture](./architecture.md) | System shape, FE/BE boundary, DB ownership, caching |
| [Design system](./design-system.md) | Themes, a11y, 12-column responsive layout |
| [Widget system](./widget-system.md) | Contracts, registry, SWR, extension strategy |
| [First-party widgets](./widgets/first-party.md) | Search, Clock, Bookmarks, Todo |
| [Adding a widget](../packages/widget-sdk/docs/adding-a-widget.md) | Contributor guide for first-party widgets |
| [Security model](./security-model.md) | Secrets, authentication, browser trust boundary |
| [Roadmap](./roadmap.md) | Near-term milestones and non-goals |

## Architecture decision records

| ADR | Decision |
| --- | --- |
| [0001](./adr/0001-monorepo.md) | pnpm workspace monorepo |
| [0002](./adr/0002-react-vite-fastify.md) | React + Vite and Fastify |
| [0003](./adr/0003-sqlite-drizzle.md) | SQLite + Drizzle migrations |
| [0004](./adr/0004-widget-registry.md) | In-repo widget registry; no arbitrary third-party JS plugins |

## Current implementation status

Scaffolded monorepo with:

- `apps/web` — dashboard UI, layout editor, first-party widgets
- `apps/server` — health, auth, dashboard/layout APIs, Todo widget persistence
- Shared packages for UI, schemas, and widget contracts
- Production widgets: Search, Clock, Bookmarks, Todo (see [First-party widgets](./widgets/first-party.md))

## Operations

| Document | Contents |
| --- | --- |
| [Backup and restore](../infra/backup-restore.md) | SQLite file backup/restore under `DASHORA_DATA_DIR` |

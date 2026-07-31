# Development

Contributor guide for running and changing Dashora locally.

Dashora is an independent codebase. Do not copy source, templates, assets, naming, CSS, or documentation from Glance or other dashboards. [Glance](https://github.com/glanceapp/glance) is acknowledged only as product-category inspiration.

## Prerequisites

- Node.js 22+
- [pnpm](https://pnpm.io/) 11+
- Docker (optional; required for Compose and `pnpm test:container`)

## Workspace layout

```
apps/
  web/           React + Vite + TypeScript frontend
  server/        Fastify + TypeScript API
packages/
  ui/            Shared UI primitives
  shared/        Zod schemas and shared types
  widget-sdk/    Widget contracts and first-party widgets
docs/            Product, operator, and architecture docs
infra/           Dockerfile, nginx, ops notes
compose.yaml     Local production Docker Compose stack
compose.dev.yaml Development Docker Compose stack
```

## Quick start

```bash
pnpm install
cp apps/server/.env.example apps/server/.env
cp apps/web/.env.example apps/web/.env
pnpm dev
```

| App | URL | Purpose |
| --- | --- | --- |
| Web | http://localhost:5173 | Vite + React (proxies `/api`) |
| API | http://localhost:3000 | Fastify backend |

Health check:

```bash
curl http://localhost:3000/api/v1/health
```

On first run, complete setup using the URL logged by the server (see [Installation — first-run setup](./installation.md#first-run-setup)).

## Scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Build packages, then run web and server in parallel |
| `pnpm build` | Build all workspace packages and apps |
| `pnpm lint` | Lint and format-check with Biome |
| `pnpm format` | Format with Biome |
| `pnpm typecheck` | TypeScript project references check |
| `pnpm test` | Unit tests (Vitest) |
| `pnpm test:coverage` | Coverage for selected packages |
| `pnpm test:e2e` | Playwright e2e (web app) |
| `pnpm test:container` | Build/run the production image and assert health |
| `pnpm analyze:web` | Web bundle analysis helper |

Before completing a change, run the relevant lint, typecheck, unit tests, and build commands.

## Docker development

```bash
docker compose -f compose.dev.yaml up --build
```

| URL | Service |
| --- | --- |
| http://localhost:5173 | Vite web |
| http://localhost:3000 | Fastify API |

Production-style local stack:

```bash
docker compose up --build
```

See [`infra/README.md`](../infra/README.md).

## Engineering rules

Summarized from [AGENTS.md](../AGENTS.md):

- TypeScript strict mode; avoid `any` unless documented and unavoidable.
- Validate external input with Zod.
- Never expose provider tokens or secrets to the browser; never log passwords, cookies, tokens, or full authorization headers.
- Every widget must support loading, refreshing, success, empty, stale, error, disabled, and configuration-required states.
- Every new API route needs validation and tests.
- Visual components support dark and light themes, keyboard navigation, visible focus, and reduced motion.
- Prefer small, focused modules; do not add large dependencies without explaining why.
- Keep the UI in English.

## Architecture docs

| Document | Contents |
| --- | --- |
| [Product vision](./product-vision.md) | Scope, Dashora vs Rackora, originality |
| [Architecture](./architecture.md) | System shape, FE/BE boundary, caching |
| [Widget system](./widget-system.md) | Contracts, registry, SWR |
| [Security model](./security-model.md) | Secrets, auth, SSRF controls |
| [Design system](./design-system.md) | Themes, a11y, layout |
| [ADRs](./adr/) | Decision records |

## Adding features

- **API routes** — Validate with Zod, add route tests under `apps/server/src/routes/`, keep errors operator-safe.
- **UI** — Use `@dashora/ui` primitives and design tokens; cover light/dark.
- **Widgets** — Follow [Widget development](./widget-development.md).
- **Migrations** — Owned Drizzle migrations under `apps/server/drizzle/`; never hand-edit production DBs as the primary change path.

## Pull requests

1. Keep diffs focused; do not modify unrelated files.
2. Include tests for new behavior.
3. Update operator docs when install/config/widget behavior changes.
4. Mention Glance only as inspiration if you must mention it — never as a dependency or copy source.

## Related

- [Widget development](./widget-development.md)
- [Configuration](./configuration.md)
- [Roadmap](./roadmap.md)
- [Quality](./quality.md)

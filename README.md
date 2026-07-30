# Dashora

Dashora is a self-hosted personal dashboard. This repository is an independent implementation — no Glance source, assets, or branding.

## Prerequisites

- Node.js 22+
- [pnpm](https://pnpm.io/) 11+

## Quick start

```bash
pnpm install
pnpm dev
```

This starts:

| App | URL | Purpose |
| --- | --- | --- |
| Web | http://localhost:5173 | Vite + React frontend |
| API | http://localhost:3000 | Fastify backend |

Health check:

```bash
curl http://localhost:3000/api/v1/health
```

## Scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Run web and server in parallel |
| `pnpm build` | Build all workspace packages and apps |
| `pnpm lint` | Lint and format-check with Biome |
| `pnpm format` | Format with Biome |
| `pnpm typecheck` | TypeScript project references check |
| `pnpm test` | Unit tests (Vitest) |
| `pnpm test:e2e` | End-to-end tests (Playwright; web app) |

## Workspace layout

```
apps/
  web/           React + Vite + TypeScript frontend
  server/        Fastify + TypeScript API
packages/
  ui/            Shared UI primitives
  shared/        Zod schemas and shared types
  widget-sdk/    Widget contracts
docs/            Architecture and contributor docs
infra/           Deployment and container scaffolding
.cursor/rules/   Agent / IDE project rules
.github/workflows/  CI
```

## Environment

Copy examples and adjust as needed:

```bash
cp apps/server/.env.example apps/server/.env
cp apps/web/.env.example apps/web/.env
```

Server variables are validated with Zod at startup. Never put provider tokens or secrets in the browser bundle.

## License

Apache-2.0 — see [LICENSE](./LICENSE).

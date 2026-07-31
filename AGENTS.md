# Dashora agent instructions

Dashora is an independent, self-hosted personal dashboard. Never copy source code, templates, assets, naming, CSS, or documentation from Glance or other dashboards.

## Stack

- pnpm workspace monorepo
- `apps/web` — React + Vite + TypeScript
- `apps/server` — Fastify + TypeScript
- `packages/ui` — shared UI primitives
- `packages/shared` — Zod schemas and shared types
- `packages/widget-sdk` — widget contracts

## Engineering rules

- Use TypeScript strict mode. Do not introduce `any` unless documented and unavoidable.
- Keep the UI in English.
- Prefer small, focused modules.
- Validate all external input with Zod.
- Never expose provider tokens or secrets to the browser.
- Never log passwords, cookies, tokens, secret values, or full authorization headers.
- Every widget must support loading, refreshing, success, empty, stale, error, disabled, and configuration-required states.
- Every new API route must include validation and tests.
- Every visual component must support dark and light themes.
- Meet WCAG AA contrast where practical.
- Support keyboard navigation and visible focus states.
- Respect reduced motion.
- Do not introduce a large dependency without explaining why.
- Before completing a task, run the relevant lint, typecheck, unit tests, and build commands.
- Do not modify unrelated files.
- Summarize changed files, commands run, and remaining risks after each task.

## Local commands

```bash
pnpm install
pnpm dev
pnpm build
pnpm lint
pnpm typecheck
pnpm test
pnpm test:coverage
pnpm test:e2e
pnpm test:container
```

Docker: `compose.yaml` (local production), `compose.dev.yaml` (dev), image build in `infra/Dockerfile`.

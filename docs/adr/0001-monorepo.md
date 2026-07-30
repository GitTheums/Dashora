# ADR 0001: pnpm workspace monorepo

- **Status:** Accepted
- **Date:** 2026-07-30

## Context

Dashora needs a React frontend, a Fastify API, shared Zod schemas, UI primitives, and widget contracts. These pieces change together and must stay type-compatible. Separate repositories would slow iteration and invite version drift. A single-package “mega app” would blur deploy and dependency boundaries.

## Decision

Use a **pnpm workspace monorepo** with:

- `apps/web` — Vite + React SPA
- `apps/server` — Fastify API
- `packages/ui` — shared UI primitives
- `packages/shared` — shared schemas/types
- `packages/widget-sdk` — widget contracts

Root scripts orchestrate `dev`, `build`, `lint`, `typecheck`, `test`, and `test:e2e`. TypeScript project references / workspace protocol (`workspace:*`) keep local linking explicit.

## Consequences

### Positive

- Atomic PRs can update API contracts and UI together
- Shared lint/test/typecheck standards apply once
- Clear package boundaries without multi-repo release theater

### Negative / trade-offs

- CI must be workspace-aware
- Contributors need pnpm and Node 22+
- Requires discipline so packages do not develop circular dependencies

### Follow-ups

- Keep apps deployable independently (web static assets + server process)
- Avoid dumping all domain logic into `packages/shared`; prefer feature modules near their owner

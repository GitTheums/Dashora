# ADR 0002: React + Vite frontend and Fastify backend

- **Status:** Accepted
- **Date:** 2026-07-30

## Context

Dashora needs a responsive, interactive dashboard editor and widget shells in the browser, plus a privileged API that owns secrets, outbound provider calls, caching, and SQLite. A single SSR framework could work, but the product’s sharp security boundary favors a clear SPA ↔ API split. The team also wants a TypeScript-first stack with fast local feedback.

## Decision

- **Frontend:** React 19 + Vite + TypeScript in `apps/web`
- **Backend:** Fastify + TypeScript in `apps/server`
- **Validation:** Zod on both sides via `@dashora/shared` / `@dashora/widget-sdk`
- **UI language:** English
- **Communication:** Versioned HTTP JSON under `/api/v1`, cookie sessions for auth

Vite provides fast HMR for layout work. Fastify provides a lean, schema-friendly Node server without imposing a full-stack meta-framework.

## Consequences

### Positive

- Hard separation: browser never needs filesystem or secret access
- Familiar React component model for widget states and grid editing
- Fastify keeps the API surface small and testable
- Fits the monorepo and shared-contract approach

### Negative / trade-offs

- Two processes in development (web + server)
- Need CORS / proxy configuration discipline
- No automatic RSC/SSR for the dashboard (acceptable for an authenticated app)

### Alternatives considered

| Option | Why not (for now) |
| --- | --- |
| Next.js / full-stack React | Blurs secret boundary; heavier than needed for self-hosted SPA |
| Go / Rust API | Strong, but splits language and slows shared Zod contracts |
| Pure SSR templates | Weaker fit for rich layout editing and widget state machines |

### Follow-ups

- Document production reverse-proxy serving of static web assets
- Keep bundle free of server env secrets via explicit client env allow-listing

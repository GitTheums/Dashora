# ADR 0003: SQLite with Drizzle ORM

- **Status:** Accepted
- **Date:** 2026-07-30

## Context

Dashora v1 is a single-operator (or small household) self-hosted app. It needs durable storage for users/sessions, pages, layout, widget instances, settings, and secret metadata. Operators expect simple backup (copy a file) and low operational overhead—no mandatory external database cluster.

## Decision

- Use **SQLite** as the system of record for v1
- Access it through **Drizzle ORM** with **SQL migrations** owned by `apps/server`
- Apply migrations on server startup (fail closed on migration failure)
- Treat the database file (and related key material) as the backup unit

The browser never talks to SQLite directly.

## Consequences

### Positive

- One-file durability matches self-hosted expectations
- Drizzle gives typed schema + explicit migrations without heavy magic
- Easy local development and container volume mounts
- Clear ownership: only the server process mutates schema/data

### Negative / trade-offs

- Horizontal multi-writer scaling is not a v1 goal
- Large binary blobs should stay out of SQLite when possible
- Need careful handling of concurrent writes (serialize via server design)

### Alternatives considered

| Option | Why not (for now) |
| --- | --- |
| PostgreSQL only | Excellent later option; higher ops cost for personal deploy |
| JSON/YAML config files only | Poor fit for sessions, cache metadata, and concurrent edits |
| Prisma | Viable; Drizzle chosen for lighter SQL-oriented control in this codebase |

### Follow-ups

- Encryption strategy for secret columns (application key from env)
- Optional Postgres dialect later would require a new ADR and migration story
- Backup/restore operator guide lives in [`infra/backup-restore.md`](../../infra/backup-restore.md)

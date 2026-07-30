# ADR 0004: In-repo widget registry (no arbitrary third-party JS plugins)

- **Status:** Accepted
- **Date:** 2026-07-30

## Context

Dashboards become powerful when widgets integrate with many providers. They become dangerous when any remote script can run beside those integrations. Dashora will hold provider credentials on the server and render personal data in the browser. A classic “drop a JS plugin into a folder / paste a URL” model conflicts with that trust model and with the decision to keep Dashora an original, reviewable codebase.

## Decision

1. Ship a **first-party widget registry** in the monorepo.
2. Each widget is typed code: Zod config, server resolver (if needed), client renderer, tests.
3. Layout and config may only reference registered widget ids.
4. **Defer arbitrary third-party JavaScript plugins** for v1 (and until a future ADR defines a sandboxed capability model).

Extension path for contributors: open a PR that adds a registry entry.

## Consequences

### Positive

- Secrets stay behind reviewed server resolvers
- CI typechecks and tests every widget
- CSP and dependency review remain tractable
- Product quality bar stays high for state handling (`loading` … `ready`)

### Negative / trade-offs

- Operators cannot install random community widgets without forking/contributing
- Feature velocity for niche integrations depends on maintainers or PRs
- Marketplace network effects are intentionally postponed

### Why not load third-party JS now

- Browser plugins could XSS the dashboard session
- Server plugins could read every credential the process can access
- Unsigned remote code recreates supply-chain risk inside the home trust zone
- Safe plugin systems need sandboxing, capability mediation, and ABI stability—work that would delay a useful v1

### Alternatives considered

| Option | Why not (for now) |
| --- | --- |
| iframe + postMessage plugins | Still needs host API design; easy to get wrong |
| Remote ESM import maps | Supply chain + CSP pain without strong signing |
| Glance-style or foreign plugin formats | Conflicts with “original implementation” and our contracts |

### Follow-ups

- Wire metadata / server / client registries end-to-end in `apps/server` and `apps/web` (helpers live in `@dashora/widget-sdk`)
- Consider declarative allow-listed “recipe” widgets before full sandboxed plugins
- Any plugin runtime requires a new ADR superseding this one

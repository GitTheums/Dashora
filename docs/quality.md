# Quality and regression suite

Dashora’s test strategy layers unit, integration, component, and Playwright E2E checks. Coverage thresholds gate critical packages without chasing 100%.

## Commands

```bash
pnpm test              # unit + integration + component (Vitest)
pnpm test:coverage     # Vitest coverage with thresholds (shared, widget-sdk, server)
pnpm test:e2e          # Playwright (setup, auth, dashboard flows, a11y, visual)
```

## Layers

| Layer | Focus |
|-------|--------|
| Unit | Schemas, layouts, widget config migrations, provider normalization, SWR cache policy, URL/SSRF validation, secret encryption |
| Integration | Auth, dashboard/widget CRUD, integrations, import/export, provider failure normalization, temp SQLite migrations |
| Component | Widget shell states, settings validation, keyboard/focus trap, theme variants |
| E2E | First-run setup, login/logout, create page, add/configure widget, drag/resize + refresh persistence, theme switch, export, mobile nav, keyboard-only flows |
| A11y | axe-core on dashboard + login (WCAG 2 A/AA; contrast checked separately in design review) |
| Visual | Main dashboard light/dark (+ mobile light) screenshots |

## Coverage thresholds

Configured in package Vitest configs for:

- `@dashora/shared` — schemas/contracts (~70% lines)
- `@dashora/widget-sdk` — cache/migration/demo contracts (~65% lines)
- `@dashora/server` — auth, secrets, SSRF, SWR, backup, core routes (~60% lines)

Thresholds are intentional floors for critical paths, not a race to full coverage of every UI branch.

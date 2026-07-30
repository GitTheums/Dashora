---
description: Dashora project engineering rules
alwaysApply: true
---

# Dashora project rules

- Dashora is an independent implementation. Never copy source code, templates, assets, naming, CSS, or documentation from Glance or other dashboards.
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
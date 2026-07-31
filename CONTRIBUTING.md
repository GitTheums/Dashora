# Contributing to Dashora

Thanks for helping improve Dashora. This repository is an independent self-hosted personal dashboard. **Do not copy** Glance or other dashboard source code, templates, assets, naming, CSS, or documentation.

## Before you start

1. Read [docs/product-vision.md](./docs/product-vision.md) for scope (and what Dashora is not).
2. Follow the engineering rules in [AGENTS.md](./AGENTS.md).
3. Prefer opening an issue (or draft PR) for larger changes before investing deep work.

## Development setup

```bash
pnpm install
pnpm dev
```

| App | URL |
| --- | --- |
| Web | http://localhost:5173 |
| API | http://localhost:3000 |

Full local workflow: [docs/development.md](./docs/development.md). Widget authors: [docs/widget-development.md](./docs/widget-development.md).

## Pull requests

- Keep changes focused; avoid unrelated refactors.
- Validate external input with Zod.
- Never expose provider tokens or secrets to the browser.
- Never commit `.env` files, databases, tokens, or credentials.
- New API routes need validation and tests.
- Visual changes must support light and dark themes, keyboard focus, and reduced motion where relevant.
- Use the PR template checklist.

Before requesting review:

```bash
pnpm exec biome ci --linter-enabled=false --organize-imports-enabled=false --assists-enabled=false .
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Optional: `pnpm test:e2e`, `pnpm test:container` when your change touches UI flows or Docker packaging.

## Code of conduct

Participation is governed by [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md).

## Security

Report vulnerabilities privately — see [SECURITY.md](./SECURITY.md). Do not open public issues with exploit details or secret values.

## License

By contributing, you agree that your contributions are licensed under the Apache License 2.0 — see [LICENSE](./LICENSE).

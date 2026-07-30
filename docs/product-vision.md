# Product vision

Dashora is a self-hosted personal dashboard: a calm, configurable home screen for the information you check every day. It aggregates feeds, calendars, weather, bookmarks, service health, and other first-party widgets into a responsive grid that you own and run on your own hardware.

Dashora is an original product and codebase. It is not a fork, skin, or derivative of Glance or any other dashboard. Inspiration from the broader dashboard category is allowed; copying source, templates, assets, naming, CSS, or documentation is not.

## Dashora vs Rackora

Dashora and Rackora are sibling products with different jobs.

| | Dashora | Rackora |
| --- | --- | --- |
| Primary job | Personal information dashboard | Infrastructure inventory and operations |
| Mental model | “What do I need to see today?” | “What is in my racks, network, and lab?” |
| Core objects | Pages, widgets, layout, credentials | Rooms, racks, devices, ports, cables, IPAM |
| Interaction | Glanceable cards and feeds on a grid | Structured inventory, topology, and ops workflows |
| Success metric | Fast, trustworthy personal overview | Accurate physical/logical infrastructure map |

They may share engineering taste (TypeScript, Fastify, React, SQLite, self-hosting) and branding lineage (the `-ora` family), but they are separate products with separate repositories, schemas, and release cycles. Dashora must not grow into a rack inventory tool, and Rackora must not become a general personal dashboard.

## Why an original implementation (not a Glance fork)

Dashora starts from a blank slate for deliberate reasons:

1. **Ownership and license clarity** — An original Apache-2.0 codebase avoids inherited license, contributor, and branding constraints from another project.
2. **Architecture fit** — Dashora’s intended stack (React + Vite frontend, Fastify API, SQLite + Drizzle, Zod contracts, first-party widget registry) is designed for this product, not adapted from another runtime or template language.
3. **Security boundary** — Secrets stay on the server; widgets talk through validated APIs. Forking an existing dashboard often means inheriting client-visible credential patterns or plugin models that conflict with that boundary.
4. **Product identity** — Dashora should look and behave like Dashora. Reusing another project’s CSS, naming, or widget UX would create a derivative experience rather than an independent one.
5. **Long-term extensibility** — A first-party widget registry and typed contracts are easier to evolve when the platform owns the contracts from day one.

Existing dashboards remain useful reference points for *category* expectations (self-hosted, widget grid, low friction). They are not a source of implementation.

## Version 1 scope

Version 1 delivers a usable single-deployment personal dashboard for one operator (or a small trusted household), not a marketplace or multi-tenant SaaS.

### In scope for v1

- Local session authentication with secure cookies
- One or more dashboard pages with a 12-column responsive layout
- First-party widgets registered in-repo through the widget registry
- Server-side provider credentials and secret storage
- Widget data fetching with caching and stale-while-revalidate behavior
- SQLite persistence via Drizzle, with owned migrations
- Light and dark themes, keyboard access, and practical WCAG AA contrast
- Configuration UI for pages, layout, and widget settings
- Health endpoint and basic operational logging (without secret leakage)

### Explicitly out of scope for v1

- Arbitrary third-party JavaScript plugins loaded at runtime
- Multi-tenant cloud hosting or billed SaaS accounts
- Full Rackora inventory / topology features
- Federated widget marketplaces
- Mobile-native apps (responsive web is enough)
- Real-time collaborative multi-editor workflows

Later versions may deepen widget coverage, optional OIDC, backups, and carefully designed extension points — without relaxing the server-side secret rule or the first-party trust model until an ADR explicitly changes that policy.

## Design principles

1. **Self-hosted by default** — One operator, one machine (or LAN), data stays local.
2. **Server holds secrets** — Browsers receive rendered or sanitized widget payloads, never provider tokens.
3. **Widgets are contracts** — Every widget declares identity, config, and runtime states up front.
4. **Stale is better than blank** — Prefer showing last-good data with a stale signal over a hard empty failure while refresh continues.
5. **Small, focused modules** — Prefer clear package and route boundaries over a monolithic “god” dashboard module.
6. **Accessible and themeable** — Light/dark, visible focus, reduced motion, English UI for v1.
7. **Original work** — Build Dashora; do not copy Glance or peer dashboards.

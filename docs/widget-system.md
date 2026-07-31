# Widget system

Widgets are Dashora’s unit of information. Each widget is a first-party module with a typed contract, a server-side data path (when it needs external data), and a client shell that can render every required runtime state.

Package home: `packages/widget-sdk` (contracts + registry helpers) plus implementations registered for use by `apps/server` and `apps/web`.

Contributor guide: [Adding a widget](../packages/widget-sdk/docs/adding-a-widget.md).

## Widget contracts

Canonical runtime states (from `@dashora/widget-sdk`):

| State | Meaning |
| --- | --- |
| `loading` | No usable payload yet; fetch in progress |
| `refreshing` | Showing data (or a shell) while a refresh runs |
| `success` | Fresh, displayable data |
| `empty` | Fetch succeeded; there is nothing to show |
| `stale` | Showing last-good data while refresh is due or failing softly |
| `error` | Cannot show trustworthy data; include an operator-safe message |
| `disabled` | Instance exists but is turned off |
| `configuration-required` | Missing settings or credentials needed to run |

A widget definition includes at least:

- Stable `id`
- Human `name`
- `version` (package / module version string)
- `schemaVersion` (config schema version for migrations)
- `description`
- `category` and `icon` metadata
- Declared `states` (must cover the full required set)
- Zod `configSchema`, `defaultConfig`, and optional migration steps
- `defaultLayout` span hints
- Capability flags (`supportsManualRefresh`, `supportsTitleOverride`, `requiresIntegration`, …)
- Cache and refresh policy metadata

Additional contract fields evolve in `widget-sdk` and must remain Zod-validated.

**Rule:** Every widget surface must handle all required states. Skipping `stale`, `refreshing`, or `configuration-required` is a defect.

## Registry model

Dashora uses an **in-repo widget registry**, not a runtime plugin CDN.

- Widgets are TypeScript modules checked into the monorepo (or tightly controlled workspace packages).
- Helpers:
  - `createWidgetMetadataRegistry` — catalog metadata
  - `createWidgetServerRegistry` — definition + `WidgetProvider`
  - `createWidgetClientRegistry` — renderer + settings components
- The registry maps widget `id` → server provider + client renderer + config schema.
- Unknown widget ids fail validation when saving layout/config.
- Enabling a widget for operators is a product decision (shipped code), not an untrusted upload.

See [ADR 0004](./adr/0004-widget-registry.md).

Production widgets: [Search, Clock, Bookmarks, Todo](./widgets/first-party.md) via `@dashora/widget-sdk/widgets/*`.

## Server vs client roles for a widget

| Concern | Server | Client |
| --- | --- | --- |
| Config schema validation | Yes | Mirrors for forms |
| Config schema migrations | Yes | — |
| Reading secrets / credentials | Yes | Never |
| Calling provider APIs | Yes | Never directly with secrets |
| Cache + SWR | Yes | Displays returned state |
| Rendering states | Provides payload + state | Mandatory UI for all states |
| Layout span defaults | May suggest | Applies in grid |

## Shared API response envelope

Widget data endpoints return `widgetDataResponseSchema`:

- `widgetId`, `instanceId`, `state`
- optional sanitized `data`, `message`, `errorCode`
- `meta`: `fetchedAt`, optional `expiresAt` / `staleAt`, `cache` status, `schemaVersion`, optional `widgetVersion`

Build responses with `createWidgetDataResponse` so clients can parse with the same Zod schema.

## Caching and stale-while-revalidate

Each widget instance has a cache entry derived from:

- Widget id
- Instance id
- Normalized config hash
- Optional credential id reference (not the secret value)

Policy sketch:

1. **Fresh HIT** → `success`
2. **Expired HIT** → return last payload as `stale`, revalidate
3. **MISS** → fetch; on success `success`, on failure `error` (or `configuration-required` if that is the true cause)
4. **In-flight refresh with last-good** → `refreshing` (optional) or keep serving `stale`
5. **Revalidate failure with last-good** → remain `stale` until recovery or escalation policy marks `error`

TTLs are widget-specific (weather vs RSS vs static bookmarks). The platform provides shared cache helpers; widgets declare freshness hints via `cache` and `refresh` on the definition.

## Extension strategy

### Supported in v1

- Add a first-party widget module
- Register it in the registry
- Add Zod config schema + tests
- Add server provider tests (including failure paths)
- Add client state coverage tests

### Deferred: arbitrary third-party JavaScript plugins

Dashora deliberately does **not** load untrusted third-party JavaScript into the operator’s browser or Node process in v1.

Reasons:

1. **Trust boundary** — Self-hosted dashboards often hold API tokens for mail, cloud, and home services. Eval-style plugins expand the blast radius of one malicious or compromised script to every secret the server can reach.
2. **Supply chain** — A plugin “marketplace” without review recreates npm-scale risk inside the home LAN trust zone.
3. **CSP and isolation cost** — Safe plugin hosts need strict sandboxing, capability mediation, and stable ABI versioning. That is a product of its own.
4. **Supportability** — First-party contracts keep CI, typecheck, and security review tractable.
5. **Product focus** — v1 succeeds by shipping excellent built-in widgets, not by becoming a plugin runtime.

Future extension options (each requiring an ADR) may include:

- Signed, capability-restricted WASM or worker sandboxes
- Declarative “recipe” widgets that only compose allow-listed fetchers
- Separate companion processes with explicit IPC and least privilege

Until then, contribution path = pull request into the registry.

## Configuration-required and credentials

If a widget needs a provider token:

1. Operator stores the credential via the secrets API (server-side only).
2. Widget instance references the credential by id.
3. Provider loads the secret in-process, fetches data, returns sanitized payload.
4. Client never sees the token.

Missing credential or incomplete config → `configuration-required`, not a generic `error`, when that distinction is knowable.

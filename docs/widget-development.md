# Widget development

Dashora widgets are first-party TypeScript modules registered in the monorepo. There is no runtime plugin CDN and no arbitrary remote JavaScript execution.

Package: `@dashora/widget-sdk`

Longer step-by-step with code samples: [`packages/widget-sdk/docs/adding-a-widget.md`](../packages/widget-sdk/docs/adding-a-widget.md).

Catalog of shipped widgets: [Supported widgets](./widgets/index.md) · [First-party details](./widgets/first-party.md).

## Design rules

1. **Contracts first** — Each widget declares id, metadata, Zod config, capabilities, cache/refresh, default layout, and schema version.
2. **Server holds secrets** — Providers may read encrypted integrations; browser payloads must never include tokens.
3. **All runtime states** — Skipping any required state is a defect.
4. **Sanitized output** — Strip or map untrusted HTML; prefer plain text and allow-listed URLs.
5. **Original work** — Do not copy Glance or other dashboard widgets, templates, naming, or CSS.

## Required runtime states

| State | Meaning |
| --- | --- |
| `loading` | No usable payload yet; fetch in progress |
| `refreshing` | Showing data (or a shell) while a refresh runs |
| `success` | Fresh, displayable data |
| `empty` | Fetch succeeded; nothing to show |
| `stale` | Showing last-good data while refresh is due or failing softly |
| `error` | Cannot show trustworthy data; operator-safe message |
| `disabled` | Instance exists but is turned off |
| `configuration-required` | Missing settings or credentials |

## Pieces of a widget

| Piece | Where | Role |
| --- | --- | --- |
| Definition | `packages/widget-sdk` | Id, Zod config, capabilities, cache, schema version |
| Provider | server (sdk + `apps/server` wiring) | Fetch sanitized data; read secrets |
| Renderer | web | Render every runtime state |
| Settings | web | Edit instance config when `hasSettings` |
| Tests | beside the module / apps | Config, provider paths, state coverage |
| Registry entry | server + web | Wire definition + provider / renderer + settings |
| Catalog entry | `apps/web` widget library | Discoverability in edit mode |

## Step-by-step (summary)

1. **Define** config schema and `defineWidget({...})` with a stable kebab-case `id`.
2. **Migrate** config when the schema changes (`schemaVersion` + contiguous migration steps).
3. **Implement** a server provider with `defineWidgetProvider` — never put secrets in `data` or `message`.
4. **Implement** renderer and settings React components using design tokens; handle all eight states.
5. **Register** via metadata / server / client registries (`toServerRegistration`, `toClientRegistration`) and add a catalog entry.
6. **Test** parse/migration, provider success/empty/error/configuration-required, and render states.
7. **Document** the widget in [widgets/index.md](./widgets/index.md) and [widgets/first-party.md](./widgets/first-party.md).

## Capability flags

| Flag | Meaning |
| --- | --- |
| `supportsManualRefresh` | Chrome may show a refresh action |
| `supportsTitleOverride` | Instance title can differ from the type name |
| `requiresIntegration` | Needs a linked credential before leaving `configuration-required` |
| `supportsDisable` | Instance can be toggled off |
| `hasSettings` | A settings component must be registered |

## Registry wiring (apps)

| App | Location |
| --- | --- |
| Web client registry | `apps/web/src/dashboard/widgets/registry.ts` |
| Web catalog | `apps/web/src/dashboard/widget-library/catalog.ts` |
| Server routes / providers | `apps/server/src/routes/widgets.ts`, `apps/server/src/providers/*` |

Unknown widget ids must fail when saving layout or config (`registry.require`).

## Security reminders

- Provider tokens and secrets stay on the server.
- Outbound HTTP goes through the shared SSRF-aware client where applicable.
- Custom API and iFrame widgets are intentionally constrained — read [Security model](./security-model.md) before expanding their power.
- Never log cookies, tokens, passwords, or full authorization headers.
- Do not introduce `dangerouslySetInnerHTML` for untrusted content.

## Reference implementations

Start from a simple production widget (Clock or Bookmarks) under `packages/widget-sdk/src/widgets/`, then look at a remote provider widget (RSS or Weather) for SWR and failure isolation patterns.

## Related

- [Adding a widget (detailed)](../packages/widget-sdk/docs/adding-a-widget.md)
- [Widget system](./widget-system.md)
- [Development](./development.md)
- [ADR 0004 — Widget registry](./adr/0004-widget-registry.md)

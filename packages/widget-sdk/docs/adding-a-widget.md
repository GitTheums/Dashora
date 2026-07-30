# Adding a widget

Dashora widgets are first-party TypeScript modules registered in the monorepo.
There is no runtime plugin CDN — open a PR that adds a registry entry.

Package: `@dashora/widget-sdk`

## Required runtime states

Every widget surface must handle all of these states:

| State | Meaning |
| --- | --- |
| `loading` | No usable payload yet; fetch in progress |
| `refreshing` | Showing data (or a shell) while a refresh runs |
| `success` | Fresh, displayable data |
| `empty` | Fetch succeeded; nothing to show |
| `stale` | Showing last-good data while refresh is due or failing softly |
| `error` | Cannot show trustworthy data; include an operator-safe message |
| `disabled` | Instance exists but is turned off |
| `configuration-required` | Missing settings or credentials needed to run |

Skipping any of these is a defect.

## Pieces of a widget

| Piece | Where | Role |
| --- | --- | --- |
| Definition | shared / sdk | id, metadata, Zod config, capabilities, cache/refresh, default layout, schema version |
| Provider | server | Fetch sanitized data; read secrets; never leak tokens |
| Renderer | web | Render every runtime state |
| Settings | web | Edit instance config (when `hasSettings`) |
| Tests | beside the module | Definition, provider failure paths, state coverage |
| Registry entry | server + web boot | Wire definition + provider / renderer + settings |

## Step-by-step

### 1. Define config and metadata

```ts
import { z } from "zod";
import { defineWidget } from "@dashora/widget-sdk";

export const myWidgetConfigSchema = z.object({
  title: z.string().trim().min(1).max(40).default("My widget"),
});

export const myWidgetDefinition = defineWidget({
  id: "my-widget", // kebab-case, stable
  name: "My Widget",
  version: "0.1.0",
  schemaVersion: 1,
  description: "What the operator sees in the catalog.",
  category: "utilities",
  icon: { name: "spark" },
  configSchema: myWidgetConfigSchema,
  defaultConfig: myWidgetConfigSchema.parse({}),
  capabilities: {
    supportsManualRefresh: true,
    supportsTitleOverride: true,
    requiresIntegration: false,
  },
  cache: { ttlSeconds: 60, staleWhileRevalidateSeconds: 300 },
  refresh: { defaultIntervalSeconds: 60 },
});
```

`defineWidget` rejects definitions that omit any required state.

### 2. Add config migrations when the schema changes

Bump `schemaVersion` and append a contiguous migration step:

```ts
migrateConfig: {
  currentVersion: 2,
  steps: [
    {
      fromVersion: 1,
      toVersion: 2,
      migrate: (raw) => {
        const legacy = raw as { title?: string };
        return { title: legacy.title ?? "My widget", enabled: true };
      },
    },
  ],
},
```

The server registry’s `parseConfig` applies migrations before Zod validation.

### 3. Implement a server provider

```ts
import { defineWidgetProvider } from "@dashora/widget-sdk";

export const myWidgetProvider = defineWidgetProvider({
  id: "my-widget",
  fetch: async ({ config, getSecret, credentialId, signal }) => {
    if (!config.title.trim()) {
      return {
        state: "configuration-required",
        message: "Set a title in settings.",
      };
    }
    // Fetch remotely if needed. Never put secrets in `data` or `message`.
    return {
      state: "success",
      data: { title: config.title, value: 1 },
      cacheStatus: "miss",
    };
  },
});
```

Return a shared envelope from the HTTP layer with `createWidgetDataResponse`.

### 4. Implement renderer and settings

- Renderer props: `WidgetRendererProps<TData, TConfig>`
- Settings props: `WidgetSettingsProps<TConfig>`
- Handle all eight states in the renderer (copy the `demo-metrics` switch as a starting point)

### 5. Register

```ts
import {
  createWidgetMetadataRegistry,
  createWidgetServerRegistry,
  createWidgetClientRegistry,
  toServerRegistration,
  toClientRegistration,
} from "@dashora/widget-sdk";

const metadataRegistry = createWidgetMetadataRegistry([myWidgetDefinition]);

const serverRegistry = createWidgetServerRegistry([
  toServerRegistration(myWidgetDefinition, myWidgetProvider),
]);

const clientRegistry = createWidgetClientRegistry([
  toClientRegistration(myWidgetDefinition, MyWidgetRenderer, MyWidgetSettings),
]);
```

Use `toServerRegistration` / `toClientRegistration` so typed providers and React components can live in a heterogeneous registry map.

Unknown widget ids must fail when saving layout or config (`registry.require`).

### 6. Tests and docs

- Unit-test config parse + migration
- Unit-test provider success, empty, error, configuration-required, and cache/SWR behavior
- Render-test each required state
- Do not ship secrets in fixtures or snapshots

## Reference implementation

See `packages/widget-sdk/src/examples/demo-metrics/`:

- Zod config + schema v1→v2 migration
- In-memory cache / stale-while-revalidate demo provider
- Settings form with a `forceState` control for visual QA
- Renderer covering every state
- Tests under `demo-metrics.test.ts` and `demo-metrics.ui.test.tsx`

Import the example as:

```ts
import {
  demoMetricsDefinition,
  demoMetricsProvider,
  DemoMetricsRenderer,
  DemoMetricsSettings,
} from "@dashora/widget-sdk/examples/demo-metrics";
```

`demo-metrics` is a **developer example only** — not a production dashboard widget.

Production widgets live under `packages/widget-sdk/src/widgets/` and are documented in [First-party widgets](../../../docs/widgets/first-party.md).

## Capability flags

| Flag | Meaning |
| --- | --- |
| `supportsManualRefresh` | Chrome may show a refresh action |
| `supportsTitleOverride` | Instance title can differ from the type name |
| `requiresIntegration` | Needs a linked credential before it can leave `configuration-required` |
| `supportsDisable` | Instance can be toggled off |
| `hasSettings` | A settings component must be registered |

## Security reminders

- Provider tokens and secrets stay on the server
- Browser responses must be sanitized
- Never log cookies, tokens, passwords, or full authorization headers

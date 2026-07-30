# First-party widgets

Dashora ships a small set of production widgets registered in `@dashora/widget-sdk/widgets/*` and wired into `apps/web` and `apps/server`.

Contributor guide for adding more: [Adding a widget](../packages/widget-sdk/docs/adding-a-widget.md).

## Search (`search`)

Configurable web search with a keyboard shortcut and optional quick links.

| Setting | Behavior |
| --- | --- |
| Engine | DuckDuckGo, Google, Bing, Wikipedia, or a custom HTTPS template |
| Custom template | Must be an absolute `http`/`https` URL containing `{query}` |
| Keyboard shortcut | e.g. `/` or `Ctrl+K` (ignored while typing in other fields) |
| Quick links | Optional https links shown under the search field |
| Open in new tab | Applies to search results and quick links |

Safe URL generation rejects `javascript:`, credentialed URLs, and templates without `{query}`. Queries are `encodeURIComponent`’d before navigation.

## Clock (`clock`)

Local clock driven by the browser clock (ticks live; provider validates config).

| Setting | Behavior |
| --- | --- |
| Timezone | IANA name (e.g. `UTC`, `Europe/Amsterdam`) |
| Hour format | 12-hour or 24-hour |
| Show seconds | 1s tick when enabled; otherwise ~15s |
| Secondary timezone | Optional second face |
| Date format | `full` / `long` / `medium` / `short` / `none` |

## Bookmarks (`bookmarks`)

Grouped links stored in widget instance config (persisted with the page layout).

| Setting | Behavior |
| --- | --- |
| Groups | Named groups with a design-token color (`primary`, `secondary`, `success`, `warning`, `danger`, `muted`) |
| Items | Title, https URL, optional description, icon |
| Open in new tab | Same tab or `noopener` new tab |
| Reorder | Drag-and-drop inside settings, plus ↑/↓ buttons for keyboard users |

Empty state prompts the operator to add groups and links in settings.

## Todo (`todo`)

Persistent local tasks stored in SQLite for the authenticated owner, keyed by widget instance id.

| Capability | Notes |
| --- | --- |
| Create / complete / reopen / delete | Optimistic UI with rollback on API failure |
| Optional due date | ISO datetime; shown in detailed view |
| Reorder | Keyboard-accessible Move up / Move down (avoids conflict with the dashboard grid drag handle) |
| View mode | `compact` or `detailed` |
| Show completed | Filter toggle in settings |

### Todo HTTP API

All routes require a session cookie. Mutations require CSRF (`x-csrf-token`).

| Method | Path |
| --- | --- |
| `GET` | `/api/v1/widgets/todo/instances/:instanceId/items` |
| `POST` | `/api/v1/widgets/todo/instances/:instanceId/items` |
| `PATCH` | `/api/v1/widgets/todo/instances/:instanceId/items/:itemId` |
| `DELETE` | `/api/v1/widgets/todo/instances/:instanceId/items/:itemId` |
| `PUT` | `/api/v1/widgets/todo/instances/:instanceId/items/order` |

Shared widget data endpoint (config-backed widgets + todo snapshot):

`GET /api/v1/widgets/:widgetType/instances/:instanceId/data?config=<urlencoded-json>`

## Registry wiring

| App | Location |
| --- | --- |
| Web client registry | `apps/web/src/dashboard/widgets/registry.ts` |
| Web catalog | `apps/web/src/dashboard/widget-library/catalog.ts` |
| Server routes | `apps/server/src/routes/widgets.ts` |
| Todo persistence | `todo_items` table + `apps/server/src/db/repositories/todo-items.ts` |

## Accessibility

- Visible focus styles via shared UI tokens
- Search shortcut does not steal focus from other inputs
- Bookmarks and todo expose accessible names on controls
- Empty, error, disabled, and configuration-required states are rendered for every widget
- Motion is limited to clock ticking; no decorative animation is required

## Themes

Widgets use `--ds-*` design tokens and inherit light/dark from the dashboard theme.

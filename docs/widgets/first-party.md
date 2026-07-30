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

Shared widget data endpoint (config-backed widgets + remote widgets + todo snapshot):

`GET /api/v1/widgets/:widgetType/instances/:instanceId/data?config=<urlencoded-json>&refresh=1`

## Weather (`weather`)

Current conditions plus hourly and daily forecasts via an Open-Meteo provider adapter (no API key).

| Setting | Behavior |
| --- | --- |
| Location search | Server-side geocoding; pick a place in settings |
| Units | Metric (°C, km/h) or imperial (°F, mph) |
| Layout | `compact` or `detailed` |
| Hourly / daily | Toggle sections; counts capped in config |
| Timezone | Times render in the location timezone |

Feels-like temperature and precipitation probability are included. Responses use the provider platform SWR cache (`stale` when serving last-good data).

| Method | Path |
| --- | --- |
| `GET` | `/api/v1/widgets/weather/locations?q=<query>&limit=<n>` |

## RSS (`rss`)

Multiple RSS/Atom feeds per widget with feed-level failure isolation.

| Setting | Behavior |
| --- | --- |
| Feeds | Up to 10 HTTPS feed URLs |
| Title override | Optional per-feed display name |
| Item limits | Per-feed limit plus global max items |
| Deduplicate links | Drop duplicate normalized URLs across feeds |
| Thumbnails | Optional; only sanitized `http(s)` image URLs |
| Layout | `compact`, `detailed`, or horizontal `cards` |

Titles and summaries are stripped to plain text — untrusted HTML is never rendered. Relative timestamps update on the client. If some feeds fail, remaining items still show in a `stale` state.

## Calendar (`calendar`)

Privacy-conscious upcoming events from one or more ICS/iCal feeds. Google and Microsoft OAuth are intentionally out of scope for this phase.

| Setting | Behavior |
| --- | --- |
| Feeds | Up to 10 HTTPS ICS URLs (credentials must not be embedded in the URL) |
| Color | Per-feed design-token color (`primary`, `secondary`, `success`, `warning`, `danger`, `muted`) |
| Basic auth | Optional server-stored username/password referenced by `credentialId` |
| Layout | `day` (today only), `agenda` (chronological look-ahead), or `month-summary` |
| Timezone | IANA zone used for “today”, day boundaries, and display |
| Look-ahead days | 1–90 days from today (inclusive) |
| Hide descriptions | Omit event descriptions from the payload and UI |
| Redact private details | Replace `CLASS:PRIVATE` / `CONFIDENTIAL` titles with “Private event” and clear details |

Feed-level failures are isolated: remaining events still render in a `stale` state. Fetches use the provider platform SWR cache with ETag / Last-Modified conditional requests. Recurring events (common `RRULE` frequencies), all-day `VALUE=DATE` events, and IANA timezones are expanded server-side.

### ICS basic auth API

Credentials are encrypted at rest (`SECRETS_ENCRYPTION_KEY`). Passwords are never returned to the browser; public metadata may include the username as `usernameHint`.

| Method | Path |
| --- | --- |
| `GET` | `/api/v1/integrations/ics-basic-auth` |
| `POST` | `/api/v1/integrations/ics-basic-auth` |
| `PATCH` | `/api/v1/integrations/ics-basic-auth/:id` |
| `DELETE` | `/api/v1/integrations/ics-basic-auth/:id` |

## GitHub Repository (`github-repository`)

Stars, forks, open issues, open pull requests, language metadata, description, and a latest-activity summary for one repository.

| Setting | Behavior |
| --- | --- |
| Owner / repository | Validated GitHub owner and repo names |
| Layout | `compact` or `detailed` |
| Description / languages | Optional sections |
| Credential | Optional server-stored GitHub PAT (`credentialId`) |

Public repositories work without a token. A PAT (or `GITHUB_TOKEN` env) raises rate limits and unlocks private repositories. Tokens never appear in browser responses.

## GitHub Releases (`github-releases`)

Latest release for one or more repositories.

| Setting | Behavior |
| --- | --- |
| Repositories | Up to 10 `owner/repo` entries |
| Include prereleases | When off, only stable releases are shown |
| Compact mode | Denser list layout |
| Credential | Optional server-stored GitHub PAT |

Relative publish times update on the client. Each release links to its GitHub release page.

### GitHub integration API

Tokens are encrypted at rest (`SECRETS_ENCRYPTION_KEY`) and never returned to the browser (metadata may include a short `tokenHint`).

| Method | Path |
| --- | --- |
| `GET` | `/api/v1/integrations/github` |
| `POST` | `/api/v1/integrations/github` |
| `PATCH` | `/api/v1/integrations/github/:id` |
| `DELETE` | `/api/v1/integrations/github/:id` |

## Markets (`markets`)

Provider-agnostic watchlist for crypto, equities, and indexes. UI consumes a normalized quote model; CoinGecko and Finnhub are pluggable server adapters.

| Setting | Behavior |
| --- | --- |
| Symbols | Up to 20 tickers with asset class `crypto`, `equity`, or `index` |
| Provider symbol | Optional override (e.g. CoinGecko id `bitcoin` for BTC) |
| Currency | Display currency (default `USD`) |
| Layout | `compact` list or larger `cards` |
| Range | Sparkline window `1d` / `7d` / `30d` / `90d` / `1y` |
| Range selector | Optional in-widget control that re-fetches for the selected window |
| Sparkline / absolute change | Toggle sections |

Server env (never sent to the browser):

| Variable | Adapter |
| --- | --- |
| `COINGECKO_API_KEY` | Crypto (CoinGecko Demo/Pro documented API) |
| `FINNHUB_API_KEY` | Equities and indexes (Finnhub documented API) |

If symbols need an adapter whose key is missing, the widget returns `configuration-required` with a clear message instead of crashing. Quotes use the provider platform SWR cache (60s for live prices, longer for history) with rate-limit handling. Market-closed state is shown for equities/indexes when Finnhub reports the exchange is closed. Stale fetches surface a banner plus the last-good timestamp.

## Registry wiring

| App | Location |
| --- | --- |
| Web client registry | `apps/web/src/dashboard/widgets/registry.ts` |
| Web catalog | `apps/web/src/dashboard/widget-library/catalog.ts` |
| Server routes | `apps/server/src/routes/widgets.ts` |
| Weather adapter | `apps/server/src/providers/weather/open-meteo.ts` |
| RSS fetcher | `apps/server/src/providers/rss/feed-fetcher.ts` |
| Calendar ICS fetcher / parser | `apps/server/src/providers/calendar/feed-fetcher.ts`, `apps/server/src/providers/parsers/ics.ts` |
| GitHub adapter | `apps/server/src/providers/github/api.ts` |
| Markets crypto adapter | `apps/server/src/providers/markets/coingecko.ts` |
| Markets equities adapter | `apps/server/src/providers/markets/finnhub.ts` |
| Todo persistence | `todo_items` table + `apps/server/src/db/repositories/todo-items.ts` |

## Accessibility

- Visible focus styles via shared UI tokens
- Search shortcut does not steal focus from other inputs
- Bookmarks and todo expose accessible names on controls
- Markets range selector is keyboard-operable (arrow keys + aria-pressed toggles)
- Empty, error, disabled, and configuration-required states are rendered for every widget
- Motion is limited to clock ticking and relative-time refresh; no decorative animation is required

## Themes

Widgets use `--ds-*` design tokens and inherit light/dark from the dashboard theme.

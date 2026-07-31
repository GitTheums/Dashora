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

## Hacker News (`hacker-news`)

Stories from the official Hacker News Firebase API (no API key).

| Setting | Behavior |
| --- | --- |
| Feed | `top`, `new`, `best`, `ask`, `show`, or `jobs` |
| Max items | 1–50 (default 15) |
| Layout | `compact` or `rich` |
| Score / comments | Optional meta rows with safe HN discussion links |

Outbound story links use `noopener noreferrer` when opening in a new tab. Relative publish times update on the client.

## Lobsters (`lobsters`)

Hottest, newest, active, and tag JSON feeds from lobste.rs with per-source failure isolation.

| Setting | Behavior |
| --- | --- |
| Sources | Up to 10 feeds (`hottest` / `newest` / `active` / `tag`) |
| Tag | Required when source kind is `tag` |
| Item limits | Per-source limit plus global max items |
| Layout | `compact` or `rich` |

If some sources fail, remaining stories still show in a `stale` state.

## Reddit (`reddit`)

Subreddit listings via Reddit’s official OAuth API (application-only client credentials).

| Setting | Behavior |
| --- | --- |
| Subreddits | Up to 10 names with sort (`hot` / `new` / `top` / `rising`) |
| Top time frame | Optional for `top` sort |
| Item limits | Per-subreddit limit plus global max items |
| Thumbnails | Optional; placeholder values like `self` / `nsfw` are skipped |
| Layout | `compact` or `rich` |

Server env (never sent to the browser):

| Variable | Purpose |
| --- | --- |
| `REDDIT_CLIENT_ID` | Reddit app client id |
| `REDDIT_CLIENT_SECRET` | Reddit app client secret |

Missing credentials or rejected keys return `configuration-required` / clear forbidden messages. Per-subreddit failures are isolated.

## YouTube (`youtube`)

Channel uploads from the official YouTube Atom feed (`feeds/videos.xml?channel_id=…`). No API key.

| Setting | Behavior |
| --- | --- |
| Channels | Up to 10 YouTube channel ids (`UC…`) |
| Item limits | Per-channel limit plus global max items |
| Thumbnails | From Atom `media:thumbnail` when present |
| Layout | `compact` or `rich` |

Per-channel failures are isolated. Invalid or blocked channel feeds surface clear error messaging without taking down other channels.

## Custom API (`custom-api`)

Server-side `GET`/`POST` against a JSON HTTP API. Responses are mapped into a fixed presentation model (text, metric, list, progress, or status). No arbitrary JavaScript, HTML, or server templates.

| Setting | Behavior |
| --- | --- |
| URL / method | Absolute `http(s)` URL; credentials must not be embedded in the URL |
| Headers | Allow-listed names; values may be literals or `api-secret` references |
| Body | Optional JSON string for `POST` |
| Template + paths | Limited JSON paths such as `data.value` or `items[0].title` |
| Timeout | 1–30 seconds (default 10s) |
| Private network | Opt-in SSRF bypass for trusted LAN / private targets |
| Preview | Settings “Test request” calls the preview API without exposing secrets |

Secrets are stored via the API secret integration (encrypted at rest). Preview and widget payloads never include secret values or sensitive header contents.

| Method | Path |
| --- | --- |
| `POST` | `/api/v1/widgets/custom-api/preview` |
| `GET` | `/api/v1/integrations/api-secret` |
| `POST` | `/api/v1/integrations/api-secret` |
| `PATCH` | `/api/v1/integrations/api-secret/:id` |
| `DELETE` | `/api/v1/integrations/api-secret/:id` |

See [Security model](../security-model.md#custom-api-widget) for SSRF, redaction, and presentation constraints.

## iFrame (`iframe`)

Sandboxed https embed with optional host allow list and aspect ratio. Not a plugin runtime — no host `postMessage` API.

| Setting | Behavior |
| --- | --- |
| URL | https only; no credentials; no localhost |
| Allow list | Optional hostnames (`example.com`, `*.trusted.example`) |
| Aspect ratio | `16:9`, `4:3`, `1:1`, `21:9`, `3:4`, or custom |
| Sandbox | Restrictive by default; scripts / same-origin / forms / popups are opt-in |
| Embedding warning | Server probe warns when `X-Frame-Options` / CSP `frame-ancestors` refuse framing |

Dashora does not relax the main application Content Security Policy globally for embeds. Prefer tight allow lists and minimal sandbox tokens.

See [Security model](../security-model.md#iframe-widget).

## Twitch (`twitch`)

Live status and stream metadata for configured channel logins via the Twitch Helix API.

| Setting | Behavior |
| --- | --- |
| Channels | Up to 20 logins |
| Offline channels | Optional; when off, only live channels are listed |
| Thumbnails | Helix preview URLs with sanitized `http(s)` only |
| Layout | `compact` or `rich` |

Server env (never sent to the browser):

| Variable | Purpose |
| --- | --- |
| `TWITCH_CLIENT_ID` | Twitch app client id |
| `TWITCH_CLIENT_SECRET` | Twitch app client secret |

Missing or rejected credentials return `configuration-required` with an operator-safe message. Tokens never appear in browser payloads.

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
| Hacker News adapter | `apps/server/src/providers/hacker-news/api.ts` |
| Lobsters adapter | `apps/server/src/providers/lobsters/api.ts` |
| Reddit adapter | `apps/server/src/providers/reddit/api.ts` |
| YouTube adapter | `apps/server/src/providers/youtube/api.ts` |
| Twitch adapter | `apps/server/src/providers/twitch/api.ts` |
| Custom API adapter | `apps/server/src/providers/custom-api/api.ts` |
| iFrame embed probe | `apps/server/src/providers/iframe/embed-probe.ts` |
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

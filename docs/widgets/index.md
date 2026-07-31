# Supported widgets

Dashora ships first-party widgets registered in `@dashora/widget-sdk`. There is no runtime plugin CDN — new widgets are added in-repo (see [Widget development](../widget-development.md)).

Every widget supports these runtime states: loading, refreshing, success, empty, stale, error, disabled, and configuration-required.

For deeper per-widget settings and API notes, see [First-party widgets](./first-party.md).

## Catalog

| Widget | Id | Credentials | Summary |
| --- | --- | --- | --- |
| Search | `search` | None | Web search with shortcut and optional quick links |
| Clock | `clock` | None | Local clock with optional secondary timezone |
| Bookmarks | `bookmarks` | None | Grouped HTTPS links stored in widget config |
| Todo | `todo` | None | Persistent tasks in SQLite |
| Weather | `weather` | None | Current + forecast via Open-Meteo |
| RSS | `rss` | None | Multiple RSS/Atom feeds with failure isolation |
| Calendar | `calendar` | Optional ICS basic auth | Upcoming events from ICS/iCal feeds |
| GitHub Repository | `github-repository` | Optional GitHub PAT | Stars, issues, PRs, activity for one repo |
| GitHub Releases | `github-releases` | Optional GitHub PAT | Latest releases for one or more repos |
| Markets | `markets` | CoinGecko / Finnhub env keys | Crypto, equities, and indexes watchlist |
| Hacker News | `hacker-news` | None | Top / new / best / ask / show / jobs |
| Lobsters | `lobsters` | None | Hottest, newest, active, and tag feeds |
| Reddit | `reddit` | Reddit app client id/secret | Subreddit listings via OAuth |
| YouTube | `youtube` | None | Channel uploads via Atom feeds |
| Twitch | `twitch` | Twitch Helix client id/secret | Live status for channel logins |
| Custom API | `custom-api` | Optional API secrets | Server-side JSON mapped to a fixed UI model |
| iFrame | `iframe` | None | Sandboxed https embed |

## Quick notes by category

### Utilities

- **Search** — DuckDuckGo, Google, Bing, Wikipedia, or a custom HTTPS template containing `{query}`. Rejects unsafe URL schemes.
- **Clock** — Browser-driven; 12/24h, seconds, date format, secondary face.
- **Bookmarks** — Groups with design-token colors; keyboard-friendly reorder in settings.
- **Todo** — Create, complete, reorder, optional due dates; compact or detailed view.

### Information & feeds

- **Weather** — Server-side geocoding; metric or imperial; compact/detailed layouts.
- **RSS** — Up to 10 HTTPS feeds; titles/summaries stripped to plain text (no untrusted HTML).
- **Calendar** — Privacy-conscious ICS; optional description hiding and private-event redaction. Google/Microsoft OAuth calendars are out of scope for this phase.
- **Hacker News / Lobsters / Reddit / YouTube / Twitch** — Provider adapters with SWR caching; per-source failure isolation where applicable.

### Developer & markets

- **GitHub Repository / Releases** — Public repos work without a token; PAT (UI integration or `GITHUB_TOKEN`) raises limits and unlocks private repos.
- **Markets** — Normalized quotes; set `COINGECKO_API_KEY` and/or `FINNHUB_API_KEY` on the server.
- **Custom API** — `GET`/`POST` only; allow-listed headers; limited JSON paths into text / metric / list / progress / status. No arbitrary JS or HTML. See [Security model — Custom API](../security-model.md#custom-api-widget).
- **iFrame** — https only, restrictive sandbox by default, optional host allow list. Not a plugin runtime. See [Security model — iFrame](../security-model.md#iframe-widget).

## Adding widgets on a page

1. Sign in and open a dashboard page.
2. Enter edit mode from the top navigation.
3. Open the widget library and add a widget.
4. Resize / move on the 12-column grid.
5. Open widget settings for feeds, credentials, and layout options.
6. Exit edit mode to use the dashboard.

Widgets that need credentials show **configuration-required** until you link an integration or set the required server env vars.

## Integrations

Managed under Settings (and referenced from widget settings):

| Integration | Purpose |
| --- | --- |
| GitHub | Personal access tokens for GitHub widgets |
| ICS basic auth | Username/password for protected calendar feeds |
| API secret | Header values for the Custom API widget |

Secrets are encrypted with `SECRETS_ENCRYPTION_KEY` and returned to the browser only as metadata (e.g. last-four hints), never as recoverable secret values.

## Themes and accessibility

Widgets use shared design tokens and inherit light/dark appearance. Controls expose accessible names, visible focus, and keyboard paths where the UI provides reorder or range selection. Decorative motion is avoided; prefer respecting reduced motion.

## Related

- [First-party widgets (detailed)](./first-party.md)
- [Widget development](../widget-development.md)
- [Widget system architecture](../widget-system.md)
- [Configuration](../configuration.md)

# Performance

Measured performance posture for Dashora. Optimize from numbers, not intuition.

## How to measure

```bash
# Frontend bundle (writes dist/bundle-summary.json + dist/bundle-stats.html)
pnpm analyze:web

# Provider cache + timing diagnostics (authenticated session)
curl -sS -b cookies.txt http://localhost:3000/api/v1/admin/providers/diagnostics | jq '.cache,.providers[] | {id,timings,counters}'

# Widget fetch timing is on each data response
# meta.durationMs and Server-Timing: widget;dur=…, app;dur=…
```

| Signal | Where |
| --- | --- |
| Bundle sizes / treemap | `pnpm analyze:web` → `apps/web/dist/bundle-summary.json`, `bundle-stats.html` |
| HTTP request duration | `Server-Timing: app;dur=…` on every API response |
| Widget resolve duration | `meta.durationMs` on `/api/v1/widgets/.../data` + `Server-Timing: widget;dur=…` |
| Cache hit metrics | `GET /api/v1/admin/providers/diagnostics` → `cache.hits/misses/stales/hitRate/entryCount` |
| Provider timings | Same diagnostics endpoint → `providers[].timings` |

## Baseline (before this pass)

Captured 2026-07-31 with `pnpm --filter @dashora/web run build`:

| Metric | Value |
| --- | --- |
| JS entry chunks | **1** (`index-*.js`) |
| Main JS (raw / gzip) | **747.1 KB / 194.6 KB** |
| CSS (raw / gzip) | **120.3 KB / 40.4 KB** |
| Vite chunk warning | Yes (>500 KB) |
| Widget UI loading | Eager static imports of every renderer |
| SWR stale path | Awaited upstream before returning stale |
| Widget refresh | Dirty-saved layout document; blanked to `loading` |
| List virtualization | None |
| Static compression | None |
| Immutable asset caching | Undocumented |
| Request timing header | None |
| Widget `meta.durationMs` | None |
| Cache `hitRate` / expiry purge | Missing / not scheduled |

## After (this pass)

Captured 2026-07-31 with `pnpm analyze:web`:

| Metric | Value | Delta |
| --- | --- | --- |
| JS entry + vendors (initial graph) | main **277.2 KB** + react **193.9 KB** + grid **69.8 KB** + zod **55.8 KB** | Split; widgets async |
| Main app JS (raw / gzip) | **272.7 KB / 70.7 KB** (was 747.1 / 194.6) | **−64%** gzip on app chunk |
| Initial JS set gzip | ~**164 KB** (app+react+grid+zod) | Split; widgets deferred |
| Widget UI chunks | Per-widget async chunks (~4–24 KB each) | Lazy on mount |
| Precompressed assets | `.gz` + `.br` beside hashed files | Enabled |
| SWR stale | Return immediately; background revalidate | Matches architecture docs |
| Widget refresh | Local card state only; `forceRefresh` + AbortSignal | No layout dirty; no full-grid refetch |
| Long lists | Virtualized at ≥24 items (RSS/HN/Lobsters/Reddit) | DOM capped to viewport |
| Charts | Custom SVG microcharts (no Chart.js/Recharts) | Bundle cost already minimal |
| Container heap tip | `NODE_OPTIONS=--max-old-space-size=384` in `infra/Dockerfile` | Reasonable RSS target |
| Cache maintenance | Expired rows purged every 15 minutes | Bounds SQLite growth |

Initial JS download for a cold dashboard shell is now the vendor/app/grid/zod set (~**167 KB gzip** combined) instead of one **195 KB gzip** blob that also contained every widget renderer. Widget code loads in parallel after the grid mounts, so a page with only Clock/Search stays smaller than one with Markets + RSS.

## Behaviors locked in

1. **Independent widget loading** — each card fetches its own data; slow providers do not block siblings.
2. **Stale cache immediately** — provider platform returns SWR-stale payloads without waiting on upstream; revalidation continues in the background.
3. **Cancel obsolete requests** — `TypedWidgetBody` aborts in-flight fetches on unmount / dependency change.
4. **No unnecessary refetches** — manual refresh sends `?refresh=1`; ordinary mounts reuse server cache; refresh no longer persists layout.
5. **Reduced layout shift** — keep prior widget body while `refreshing`; grid cell sizes remain reserved by react-grid-layout.
6. **Avoid full-grid rerender on one update** — refresh token + updated-at live inside `WidgetInstanceCard` (`memo`).
7. **Compress + cache immutable assets** — Vite emits gzip/brotli; `infra/nginx.conf` sets `Cache-Control: public, max-age=31536000, immutable` for `/assets/`.

## Remaining risks

- Catalog still statically imports widget package barrels for definitions; Rollup tree-shakes renderers when unused, but a future barrel side-effect could re-inflate the main chunk — re-run `pnpm analyze:web` after widget additions.
- Production Compose (`compose.yaml`) seeds `/srv/dashora-web` from the Dashora image into a volume for nginx; custom proxies can mount the same path from the image.
- Virtualization uses fixed row estimates; variable-height detailed rows may show minor scroll jitter above the threshold.
- Provider diagnostics counters are process-local (reset on restart), not Prometheus.

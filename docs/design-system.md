# Design system

Dashora’s visual system prioritizes a readable personal dashboard: clear hierarchy, calm surfaces, and a predictable grid. The UI language is English for v1. Every visual component must support light and dark themes.

Implementation lives primarily in `packages/ui` (tokens and primitives) and `apps/web` (layout shells and page composition).

## Principles

1. **One dashboard composition** — The primary view is a coherent grid of widgets, not a marketing landing page.
2. **Information first** — Typography and spacing serve scanability; decoration stays secondary.
3. **Theme as a first-class mode** — Light and dark are both designed states, not an afterthought invert.
4. **Accessible by default** — Visible focus, keyboard reachability, practical WCAG AA contrast, reduced-motion respect.
5. **Original styling** — Do not copy Glance or other dashboard CSS, naming, or layout chrome.

## Theme tokens

Tokens are CSS custom properties under a `:root` / dark media (or explicit theme class) scheme. Canonical categories:

| Token role | Purpose |
| --- | --- |
| Background / foreground | Page canvas and primary text |
| Muted | Secondary text and quiet labels |
| Accent | Primary actions and selected emphasis |
| Border | Separators and control outlines |
| Focus | Focus ring color meeting contrast needs |
| Radius / spacing / font | Shared rhythm |

Primitive components (`Button`, `Stack`, and future shell pieces) consume tokens only — no hard-coded one-off palette values in feature code when a token exists.

## 12-column responsive dashboard layout

Dashora pages use a **12-column grid**.

### Desktop and wide layouts

- The page content area is a CSS grid with `grid-template-columns: repeat(12, minmax(0, 1fr))`.
- Each widget instance declares a column span (`colSpan`, 1–12) and optional row span.
- Placement is stored as durable layout data (page id, widget instance id, column start, column span, row order / row span).
- Gaps are tokenized so density stays consistent across pages.

### Breakpoints (v1 intent)

| Viewport | Behavior |
| --- | --- |
| Wide (≥ ~1200px) | Full 12-column placement as configured |
| Medium (~768–1199px) | Spans clamp so widgets remain usable; multi-column still allowed |
| Narrow (< ~768px) | Widgets stack toward full width (effective span 12) unless a widget explicitly opts into a compact dual-column pattern |

Exact pixel breakpoints may be tuned in implementation, but the contract is: **authored layout is 12 columns; responsive rules never leave a widget unreadable.**

### Layout editing

- Edit mode allows move/resize within the 12-column rules.
- Invalid placements (overlap policy, out-of-range spans) are rejected by shared Zod schemas before persistence.
- The server stores layout; the client optimistically updates UI and reconciles with API responses.

### Widget chrome

Widget shells provide:

- Title and optional actions (refresh, open settings)
- State presentation for loading / refreshing / success / empty / stale / error / disabled / configuration-required
- Consistent padding and focus containment

Widget bodies should not invent a second competing card system when the shell already provides structure.

## Motion

- Use motion sparingly to signal hierarchy (for example, subtle state transitions).
- Honor `prefers-reduced-motion: reduce` by disabling non-essential animation and transitions.

## Accessibility checklist

- Text and interactive contrast aim for WCAG AA where practical
- Focus rings are visible and not removed without a replacement
- Interactive controls are reachable by keyboard
- State text is available to assistive tech (not color-only)
- Hit targets remain usable on touch breakpoints

## Content tone

- Prefer short, plain English labels
- Error copy should say what failed and what the operator can do next
- Do not leak secret values or raw provider payloads into UI strings

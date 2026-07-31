# Changelog

All notable changes to Dashora are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-07-31

First stable release of Dashora — a self-hosted personal dashboard for feeds, weather, calendars, bookmarks, markets, and other first-party widgets.

### Added

- Customizable dashboard pages with a 12-column responsive widget grid
- Drag-and-drop layout editing with edit mode
- Local operator authentication (Argon2id passwords, HttpOnly session cookies, CSRF protection, rate limits, first-run setup token)
- First-party widgets: Search, Clock, Bookmarks, Todo, Weather, RSS, GitHub Repository, GitHub Releases, Markets, ICS Calendar, Hacker News, Lobsters, Reddit, YouTube, Twitch, Custom API, and sandboxed iFrame
- Server-side encrypted integration secrets (never sent to the browser)
- Stale-while-revalidate provider caching with clear stale/error/empty widget states
- Light and dark themes with appearance settings and branding controls
- Config import/export from Settings → Backup, plus volume/SQLite disaster-recovery guidance
- Docker Compose production stack (API + nginx), multi-arch images (`linux/amd64`, `linux/arm64`), and GHCR publishing at `ghcr.io/gittheums/dashora`
- Security hardening: CSP and related headers, SSRF protections for outbound fetches, audit events, structured-log redaction, and a documented security model
- Automated quality gates: lint/format, typecheck, unit and integration tests, coverage thresholds, Playwright E2E/a11y/visual suite, and container smoke tests

### Notes

- Dashora is an independent codebase. Glance inspired the *category* of a self-hosted personal dashboard; Dashora does not copy Glance source, templates, assets, naming, CSS, or documentation.
- Single-operator model: no MFA, no password-reset flow, and no multi-tenant RBAC in v1 (see [SECURITY.md](./SECURITY.md)).

## [0.1.0] - 2026-07-30

Pre-release development baseline used while the v1 feature set, packaging, and hardening landed on `main`.

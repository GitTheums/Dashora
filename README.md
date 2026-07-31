<p align="center">
  <img src="docs/images/dashora-banner.png" alt="Dashora — your home, your data, your way" width="100%">
</p>

<p align="center">
  <strong>A modern, self-hosted personal dashboard for everything you want to see at a glance.</strong>
</p>

<p align="center">
  Build your own pages, arrange widgets with drag and drop, and keep your data on infrastructure you control.
</p>

<p align="center">
  <a href="https://github.com/GitTheums/Dashora/releases">
    <img src="https://img.shields.io/github/v/release/GitTheums/Dashora?display_name=tag&sort=semver&style=flat-square&color=2dd4bf" alt="Latest release">
  </a>
  <a href="https://github.com/GitTheums/Dashora/actions/workflows/ci.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/GitTheums/Dashora/ci.yml?branch=main&style=flat-square&label=build" alt="Build status">
  </a>
  <a href="https://github.com/GitTheums/Dashora/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/GitTheums/Dashora?style=flat-square" alt="License">
  </a>
  <img src="https://img.shields.io/badge/Docker-amd64%20%7C%20arm64-2496ED?style=flat-square&logo=docker&logoColor=white" alt="Docker platforms">
  <img src="https://img.shields.io/badge/self--hosted-yes-2dd4bf?style=flat-square" alt="Self-hosted">
</p>

<p align="center">
  <a href="#what-is-dashora">Overview</a>
  ·
  <a href="#features">Features</a>
  ·
  <a href="#widgets">Widgets</a>
  ·
  <a href="#quick-start">Quick start</a>
  ·
  <a href="#documentation">Documentation</a>
  ·
  <a href="#development">Development</a>
</p>

---

## What is Dashora?

Dashora is a self-hosted personal information dashboard. It brings the things you check throughout the day—weather, feeds, calendars, markets, GitHub activity, bookmarks, tasks, media, and more—together in one calm, responsive interface.

Create multiple pages, add only the widgets you need, and arrange each dashboard through a visual drag-and-drop editor. Dashora runs on your own hardware, stores its persistent data in SQLite, and keeps provider credentials on the server.

> **Dashora is an information hub, not an infrastructure management platform.**  
> For detailed Proxmox, VM, LXC, Docker, and homelab management, see the separate Rackora project.

### Built around four principles

| Principle | What it means |
| --- | --- |
| **Personal** | Your pages, widgets, layout, theme, branding, and data sources |
| **Glanceable** | Important information should be understandable within seconds |
| **Local-first** | Persistent data stays on your own server by default |
| **Resilient** | One unavailable feed or provider should never break the whole dashboard |

---

## Features

| Area | What Dashora provides |
| --- | --- |
| **Dashboard pages** | Create, rename, reorder, duplicate, and remove multiple pages |
| **Visual editor** | Drag, resize, undo, and persist widget layouts |
| **Responsive layouts** | Independent desktop, tablet, and mobile arrangements |
| **Widget catalog** | Searchable first-party widget library with settings and previews |
| **Appearance** | Light, dark, and system mode with multiple polished presets |
| **Personalization** | Accent colors, density, card radius, ambient background, custom name, and logo |
| **Local authentication** | Secure first-run setup, Argon2id passwords, server-side sessions, and rate limiting |
| **Server-side integrations** | Provider tokens and credentials never need to enter the browser bundle |
| **Reliable refreshes** | Independent widget loading, caching, stale states, and manual refresh |
| **Backup and restore** | Versioned configuration export/import plus full SQLite volume backups |
| **Docker-first deployment** | Multi-stage image, healthcheck, non-root runtime, and persistent `/data` storage |
| **Multi-architecture images** | Published for `linux/amd64` and `linux/arm64` |

---

## Widgets

Dashora ships with first-party widgets maintained inside this repository. There is no remote JavaScript plugin marketplace or runtime plugin CDN.

### Utilities and productivity

| Widget | Description |
| --- | --- |
| **Search** | Configurable search engines, keyboard shortcut, and quick links |
| **Clock** | Local time, secondary timezone, date format, and 12/24-hour display |
| **Bookmarks** | Grouped links with custom labels and visual organization |
| **Todo** | Persistent tasks with completion, reordering, and optional due dates |

### Information and feeds

| Widget | Description |
| --- | --- |
| **Weather** | Current conditions and forecasts through Open-Meteo |
| **RSS** | Multiple RSS and Atom feeds with feed-level failure isolation |
| **Calendar** | Privacy-conscious ICS/iCal agenda with optional basic authentication |
| **Hacker News** | Top, new, best, Ask, Show, and Jobs feeds |
| **Lobsters** | Hottest, newest, active, and tag-based stories |
| **Reddit** | Subreddit listings through Reddit OAuth |
| **YouTube** | Channel uploads through Atom feeds |
| **Twitch** | Live status for configured Twitch channels |

### Development and markets

| Widget | Description |
| --- | --- |
| **GitHub Repository** | Stars, forks, issues, pull requests, and repository activity |
| **GitHub Releases** | Latest releases for one or more repositories |
| **Markets** | Crypto, equity, and index watchlists through provider adapters |
| **Custom API** | Server-side JSON requests mapped into a restricted presentation model |
| **iFrame** | Sandboxed HTTPS embeds with optional host allowlisting |

See the complete catalog in [`docs/widgets/index.md`](docs/widgets/index.md).

---

## Dashora versus Rackora

Dashora and Rackora are related by naming and design philosophy, but solve different problems.

| | Dashora | Rackora |
| --- | --- | --- |
| **Purpose** | Personal information dashboard | Proxmox and homelab control center |
| **Main content** | Feeds, weather, calendars, media, markets, bookmarks, tasks | Nodes, VM/LXC status, Docker containers, storage, temperatures, uptime |
| **Daily question** | “What do I want to see today?” | “How is my infrastructure doing?” |
| **Interaction** | Browse and organize information | Monitor and manage infrastructure |

---

## Quick start

### Requirements

- Docker Engine
- Docker Compose plugin
- Approximately 512 MB RAM for a personal deployment
- A few hundred MB of disk space plus your SQLite data

### Recommended: published GHCR image

Clone the repository so Compose can use the included nginx configuration:

```bash
git clone https://github.com/GitTheums/Dashora.git
cd Dashora
```

Create a small registry override:

```bash
cat > compose.ghcr.yaml <<'YAML'
services:
  dashora:
    image: ghcr.io/gittheums/dashora:1.0.0
    pull_policy: always

  assets:
    image: ghcr.io/gittheums/dashora:1.0.0
    pull_policy: always
YAML
```

Start Dashora:

```bash
docker compose -f compose.yaml -f compose.ghcr.yaml up -d
```

Open:

| URL | Purpose |
| --- | --- |
| `http://localhost:8080` | Dashora web interface and API through nginx |
| `http://localhost:3000/api/v1/health` | Direct API health endpoint |

For a production deployment, pin an exact image version rather than relying on `latest`.

### Build from source

```bash
git clone https://github.com/GitTheums/Dashora.git
cd Dashora
docker compose up --build -d
```

### Useful commands

```bash
# Container status
docker compose -f compose.yaml -f compose.ghcr.yaml ps

# Follow application logs
docker compose -f compose.yaml -f compose.ghcr.yaml logs -f dashora

# Find the first-run setup URL
docker compose -f compose.yaml -f compose.ghcr.yaml logs dashora | grep -i setup

# Stop the stack without deleting persistent data
docker compose -f compose.yaml -f compose.ghcr.yaml down
```

Full installation instructions: [`docs/installation.md`](docs/installation.md).

---

## First-run setup

A new Dashora installation does not create a default administrator account.

On the first start, Dashora generates a single-use setup token and writes a setup URL to the application logs:

```text
Dashora first-run setup required. Open: http://localhost:8080/setup?token=...
```

1. Read the URL from the logs.
2. Open it in a trusted browser on the same network.
3. Create the operator account.
4. Sign in and build your first page.

The token is stored only as a hash, expires automatically, is rate-limited, and becomes invalid after successful setup.

---

## Configuration

Dashora is primarily configured through environment variables and the in-app Settings area.

| Variable | Purpose |
| --- | --- |
| `DASHORA_DATA_DIR` | SQLite database and durable application files |
| `DASHORA_PUBLIC_URL` | Public origin used by the Compose stack |
| `CORS_ORIGIN` | Allowed browser origin for direct API deployments |
| `PUBLIC_BASE_URL` | Base URL used when generating setup links |
| `TRUST_PROXY` | Trusted reverse-proxy configuration |
| `COOKIE_SECURE` | Secure-cookie behavior behind HTTPS |
| `SECRETS_ENCRYPTION_KEY` | 64-character hexadecimal key used to encrypt stored integration secrets |
| `SECRETS_ENCRYPTION_KEY_FILE` | File-based alternative for Docker or Podman secrets |
| `GITHUB_TOKEN` | Optional GitHub token for higher limits and private repositories |
| `COINGECKO_API_KEY` | Optional CoinGecko provider key |
| `FINNHUB_API_KEY` | Optional Finnhub provider key |
| `REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET` | Reddit application credentials |
| `TWITCH_CLIENT_ID` / `TWITCH_CLIENT_SECRET` | Twitch Helix credentials |
| `TZ` | Container timezone using an IANA timezone name |

Never commit `.env` files, provider tokens, session secrets, or encryption keys.

Complete reference: [`docs/configuration.md`](docs/configuration.md).

---

## Persistent storage

Dashora stores persistent application data under `/data` inside the application container.

| Location | Path |
| --- | --- |
| Container data directory | `/data` |
| SQLite database | `/data/dashora.sqlite` |
| Default Compose storage | Named volume `dashora-data` |
| Runtime user | UID `10001` |

To use a host bind mount:

```bash
mkdir -p data
sudo chown -R 10001:10001 data

DASHORA_DATA_BIND=./data \
docker compose -f compose.yaml -f compose.ghcr.yaml up -d
```

Replacing or updating the container does not remove the database as long as the volume or bind-mounted data directory remains intact.

> Deleting the persistent data directory permanently deletes dashboards, tasks, settings, and stored integration metadata.

---

## Backup and restore

Dashora supports two complementary backup methods.

### Configuration export

Use **Settings → Backup** to export a versioned JSON file containing supported dashboard configuration.

This is the easiest method for portability between installations.

### Full data backup

For complete disaster recovery, back up:

- the full Dashora data volume or bind-mounted `/data` directory;
- the secrets encryption key used by the installation.

The encryption key is required to decrypt stored provider secrets after a restore.

See [`docs/backup-restore.md`](docs/backup-restore.md) before moving or upgrading a production installation.

---

## Updating

Back up the data directory and encryption key first.

```bash
cd Dashora

docker compose -f compose.yaml -f compose.ghcr.yaml pull
docker compose -f compose.yaml -f compose.ghcr.yaml up -d
docker compose -f compose.yaml -f compose.ghcr.yaml ps
```

Production installations should use a pinned image tag:

```yaml
image: ghcr.io/gittheums/dashora:1.0.0
```

To roll back, change the tag to the previous known-good version and recreate the stack.

See [`docs/upgrading.md`](docs/upgrading.md).

---

## Reverse proxy and remote access

The included Compose stack serves Dashora through nginx on port `8080`.

For remote access:

- terminate TLS through nginx, Caddy, Traefik, or another trusted reverse proxy;
- set the public origin and cookie settings correctly;
- configure `TRUST_PROXY` only when forwarded headers are controlled by your proxy;
- never expose integration credentials in client-side configuration;
- prefer a VPN or authenticated reverse proxy for private deployments.

See [`docs/reverse-proxy.md`](docs/reverse-proxy.md).

---

## Security

Dashora is designed as a trusted single-operator self-hosted application—not as a hardened public multi-tenant SaaS.

Implemented protections include:

- Argon2id password hashing;
- opaque server-side sessions;
- HttpOnly and SameSite cookies;
- CSRF protection;
- rate limiting on authentication and setup routes;
- encrypted integration secrets;
- server-side provider requests;
- restricted Custom API mapping;
- sandboxed iFrames;
- URL validation and SSRF-aware request controls;
- non-root Docker runtime;
- read-only application filesystem.

Before exposing Dashora outside your local network, read:

- [`SECURITY.md`](SECURITY.md)
- [`docs/security-model.md`](docs/security-model.md)
- [`docs/security-checklist.md`](docs/security-checklist.md)

Security issues should be reported privately according to [`SECURITY.md`](SECURITY.md), not through a public issue.

---

## Technology

| Layer | Technology |
| --- | --- |
| Frontend | React, Vite, TypeScript |
| API | Fastify, Node.js |
| Database | SQLite with Drizzle ORM |
| Validation | Zod |
| Data fetching | TanStack Query and server-side provider adapters |
| State | Zustand |
| Layout | React Grid Layout |
| Styling | Tailwind CSS and shared semantic design tokens |
| Testing | Vitest, React Testing Library, Playwright |
| Packaging | pnpm workspace, Docker Buildx, nginx |
| CI/CD | GitHub Actions and GitHub Container Registry |

---

## Development

Requirements:

- Node.js 22 or newer
- pnpm 11 or newer

```bash
git clone https://github.com/GitTheums/Dashora.git
cd Dashora

pnpm install
pnpm dev
```

| Service | URL |
| --- | --- |
| Web development server | `http://localhost:5173` |
| API | `http://localhost:3000` |

### Quality commands

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:coverage
pnpm test:e2e
pnpm build
pnpm test:container
```

### Project structure

```text
Dashora/
├── apps/
│   ├── web/                  # React frontend
│   └── server/               # Fastify API and SQLite ownership
├── packages/
│   ├── shared/               # Shared schemas and types
│   ├── ui/                   # Shared interface primitives
│   └── widget-sdk/           # Widget contracts and first-party widgets
├── docs/                     # Operator and contributor documentation
├── infra/                    # Dockerfile, nginx, and deployment notes
├── scripts/                  # Repository automation and smoke tests
├── compose.yaml              # Production-style local stack
└── compose.dev.yaml          # Development stack
```

---

## Documentation

| Guide | Description |
| --- | --- |
| [Installation](docs/installation.md) | Docker deployment and first-run setup |
| [Configuration](docs/configuration.md) | Environment variables and provider credentials |
| [Supported widgets](docs/widgets/index.md) | First-party widget catalog |
| [Backup and restore](docs/backup-restore.md) | Configuration and SQLite backups |
| [Upgrading](docs/upgrading.md) | Updating and rolling back |
| [Reverse proxy](docs/reverse-proxy.md) | TLS and proxy configuration |
| [Troubleshooting](docs/troubleshooting.md) | Common problems and diagnostics |
| [Development](docs/development.md) | Local development workflow |
| [Widget development](docs/widget-development.md) | Adding a first-party widget |
| [Architecture](docs/architecture.md) | System design and ownership boundaries |
| [Security model](docs/security-model.md) | Authentication, secrets, SSRF, and trust model |
| [Roadmap](docs/roadmap.md) | Planned direction and non-goals |

---

## Roadmap

Dashora 1.0 establishes the core self-hosted dashboard:

- local authentication;
- persistent pages and layouts;
- responsive drag-and-drop editing;
- first-party widget catalog;
- themes and custom branding;
- import/export;
- Docker and GHCR distribution.

Future releases may expand the widget catalog, authentication options, backup tooling, and integrations while keeping the product focused and local-first.

See [`docs/roadmap.md`](docs/roadmap.md) for the maintained roadmap.

---

## Contributing

Bug reports, documentation improvements, and thoughtful feature proposals are welcome.

Before opening a pull request:

1. Read [`CONTRIBUTING.md`](CONTRIBUTING.md).
2. Follow the engineering rules in [`AGENTS.md`](AGENTS.md).
3. Keep Dashora an original implementation.
4. Add tests for functional changes.
5. Run the complete relevant quality checks.

For large features or architectural changes, open an issue first so the approach can be discussed.

---

## Inspiration and originality

Dashora was inspired by the broader self-hosted dashboard ecosystem, including [Glance](https://github.com/glanceapp/glance).

Dashora is an independent product and codebase. It does not copy Glance source code, templates, assets, CSS, naming, or documentation, and does not depend on Glance as a library.

---

## License

Dashora is licensed under the [Apache License 2.0](LICENSE).

---

<p align="center">
  <strong>Your home. Your data. Your way.</strong>
</p>

<p align="center">
  <a href="https://github.com/GitTheums/Dashora">Repository</a>
  ·
  <a href="https://github.com/GitTheums/Dashora/releases">Releases</a>
  ·
  <a href="https://github.com/GitTheums/Dashora/issues">Issues</a>
  ·
  <a href="https://github.com/GitTheums/Dashora/blob/main/SECURITY.md">Security</a>
</p>

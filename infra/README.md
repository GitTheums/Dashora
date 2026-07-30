# Infrastructure

Container and deployment scaffolding for Dashora.

Dockerfiles and compose files will be added as runtime packaging is introduced. See the root `.dockerignore` for image build exclusions.

## Data directory

| Variable | Default | Purpose |
| --- | --- | --- |
| `DASHORA_DATA_DIR` | `/data` | Directory for SQLite and related durable files |

Mount a Docker volume at `/data` (or set `DASHORA_DATA_DIR` to your volume path) so the database survives container recreation.

## Backup and restore

See [backup-restore.md](./backup-restore.md).

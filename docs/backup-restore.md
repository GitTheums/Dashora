# Backup and restore

Dashora keeps durable state in SQLite under `DASHORA_DATA_DIR`. You can also export and import **configuration** from the Settings UI without copying the whole database file.

Treat backups as sensitive: they can include hashed passwords, session material, encrypted secret ciphertext, personal feeds, and todos.

## Two backup types

| Type | What it covers | Best for |
| --- | --- | --- |
| **Config export** (Settings → Backup) | Dashboards, pages, widgets, todos, integration metadata + secret ciphertext as packaged by the export, appearance | Moving layout between instances; routine config snapshots |
| **Data directory / SQLite** | Full `dashora.sqlite` (+ WAL/SHM) under `DASHORA_DATA_DIR` | Disaster recovery, upgrades, machine migration |

Also back up deployment secrets that are **not** inside SQLite:

- `SECRETS_ENCRYPTION_KEY` or the file behind `SECRETS_ENCRYPTION_KEY_FILE`
- Provider env vars (`GITHUB_TOKEN`, Reddit/Twitch/markets keys, etc.)

Without the matching encryption key, restored integration secrets cannot be decrypted.

## Config export and import (UI)

1. Sign in → **Settings** → **Backup**.
2. **Export** downloads a JSON file (`dashora-backup-YYYY-MM-DD.json`).
3. **Import** accepts a previously exported file. Preview the summary, choose a mode (as offered in the UI), then confirm.

Server limits: `BACKUP_IMPORT_MAX_BYTES` (default 8 MB). Import/export require an authenticated session and CSRF on mutating requests.

API surface (for operators/scripts):

| Method | Path |
| --- | --- |
| `GET` | `/api/v1/backup/export` |
| `POST` | `/api/v1/backup/import/preview` |
| `POST` | `/api/v1/backup/import` |

Config export is not a substitute for a full volume backup before major upgrades.

## Full SQLite / volume backup

Default paths:

| Path | Purpose |
| --- | --- |
| `$DASHORA_DATA_DIR/dashora.sqlite` | Primary database |
| `$DASHORA_DATA_DIR/dashora.sqlite-wal` | WAL (if present) |
| `$DASHORA_DATA_DIR/dashora.sqlite-shm` | WAL shared memory (if present) |

Docker Compose maps the named volume `dashora-data` (or `DASHORA_DATA_BIND`) to `/data`.

### Consistent copy while stopped (recommended)

```bash
# From the repository root — service name is `dashora`
docker compose stop dashora

# Named volume example (Linux Docker host)
docker run --rm \
  -v dashora_dashora-data:/data:ro \
  -v "$(pwd):/backup" \
  alpine tar -czf "/backup/dashora-backup-$(date -u +%Y%m%dT%H%M%SZ).tar.gz" -C /data .

# Bind mount example
# tar -czf "dashora-backup-$(date -u +%Y%m%dT%H%M%SZ).tar.gz" -C ./data .

docker compose start dashora
```

Adjust the volume name if your Compose project name differs (`name: dashora` in `compose.yaml` typically yields `dashora_dashora-data`).

### Online backup with the SQLite CLI

If the data directory is bind-mounted and you cannot stop the process:

```bash
sqlite3 ./data/dashora.sqlite ".backup './dashora-backup.sqlite'"
```

Prefer a stopped-directory archive for named volumes so WAL companions stay consistent.

## Restore (full data directory)

1. Stop Dashora (`docker compose stop dashora`).
2. Replace the contents of `DASHORA_DATA_DIR` with the backup files (same filenames).
3. Restore ownership for the container user (UID/GID `10001`):

   ```bash
   docker run --rm -v "$(pwd)/data:/data" alpine chown -R 10001:10001 /data
   ```

4. Ensure the same `SECRETS_ENCRYPTION_KEY` (or file) is configured.
5. Start Dashora. Migrations run on startup and fail closed if they cannot apply.
6. Verify health and sign-in:

   ```bash
   curl -fsS http://localhost:3000/api/v1/health
   ```

Do **not** mix a main DB file with WAL/SHM files from a different generation. Prefer a single `.backup` snapshot or a full stopped-directory archive.

## What the SQLite file alone does not cover

- Encryption keys and other env-supplied secrets
- The container/image version that produced the schema (pin versions)
- External provider accounts — rotate tokens if a backup may have leaked

## Related

- Low-level ops notes: [`infra/backup-restore.md`](../infra/backup-restore.md)
- [Upgrading](./upgrading.md)
- [Configuration](./configuration.md)
- [Security model](./security-model.md)

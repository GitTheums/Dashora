# Backup and restore

Dashora v1 stores durable state in a single SQLite database file under `DASHORA_DATA_DIR`.

| Path | Purpose |
| --- | --- |
| `$DASHORA_DATA_DIR/dashora.sqlite` | Primary database (system of record) |
| `$DASHORA_DATA_DIR/dashora.sqlite-wal` | Write-ahead log (present while WAL mode is active) |
| `$DASHORA_DATA_DIR/dashora.sqlite-shm` | Shared-memory companion for WAL |

Default `DASHORA_DATA_DIR` is `/data` so a Docker volume can mount persistence at `/data`. Local development typically sets `DASHORA_DATA_DIR=./data` (see `apps/server/.env.example`).

Treat the data directory (and any future encryption-key material from the environment) as sensitive. Backups can contain hashed passwords, session token hashes, and encrypted secret ciphertext.

## Backup (recommended)

1. Stop Dashora, **or** use SQLite’s online backup API / `.backup` so the copy is consistent while writers are active.
2. Copy the entire data directory contents, at minimum:
   - `dashora.sqlite`
   - `dashora.sqlite-wal` and `dashora.sqlite-shm` if they exist (or checkpoint/stop first so only the main file remains)
3. Store the archive offline with the same care as production secrets.
4. Also record deployment env that is **not** in SQLite (for example future secret-encryption keys). Restoring the DB without the matching key leaves secrets undecryptable.

### Consistent file copy while stopped

```bash
# Example: container volume at /data
docker compose stop dashora
tar -czf dashora-backup-$(date -u +%Y%m%dT%H%M%SZ).tar.gz -C /var/lib/dashora data
docker compose start dashora
```

Adjust host paths to match your volume mount.

### Online backup with the SQLite CLI

If you cannot stop the process, prefer an atomic SQLite backup over copying files mid-write:

```bash
sqlite3 /data/dashora.sqlite ".backup '/tmp/dashora-backup.sqlite'"
```

## Restore

1. Stop Dashora completely.
2. Replace the contents of `DASHORA_DATA_DIR` with the backup files (same filenames).
3. Ensure file ownership/permissions allow only the Dashora service account to read/write.
4. Start Dashora. The server applies pending migrations on startup and fails closed if migration cannot run.
5. Verify `GET /api/v1/health` and that you can authenticate once auth is enabled.

Do **not** restore a WAL/SHM pair from a different generation than the main DB file. Prefer restoring a single consistent `.backup` snapshot or a full stopped-directory archive.

## What is not covered by the SQLite file alone

- Application encryption keys and other secrets supplied via environment variables
- Container/image version used to produce the schema (pin versions so migrations match)
- External provider accounts — rotating provider tokens is still required if a backup may have leaked

## Related

- [ADR 0003 — SQLite and Drizzle](../docs/adr/0003-sqlite-drizzle.md)
- [Architecture — database ownership](../docs/architecture.md)
- [Security model — database and backups](../docs/security-model.md)

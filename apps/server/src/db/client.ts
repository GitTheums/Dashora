import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_DASHORA_DATA_DIR } from "@dashora/shared";
import Database from "better-sqlite3";
import { type BetterSQLite3Database, drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { ensureDataDir, resolveDataDir, resolveDatabasePath } from "./paths.js";
import { schema } from "./schema.js";

export type DashoraDatabase = BetterSQLite3Database<typeof schema>;

export type OpenDatabaseOptions = {
  /** Overrides DASHORA_DATA_DIR when `databasePath` is not set. */
  dataDir?: string;
  /** Absolute or relative path to the SQLite file. Takes precedence over `dataDir`. */
  databasePath?: string;
  /** When false, skips applying migrations. Default true. */
  migrate?: boolean;
  /** Absolute path to the drizzle migrations folder. */
  migrationsFolder?: string;
};

export type OpenedDatabase = {
  db: DashoraDatabase;
  sqlite: Database.Database;
  databasePath: string;
  dataDir: string;
  close: () => void;
};

export function defaultMigrationsFolder(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), "../../drizzle");
}

export function openSqlite(databasePath: string): Database.Database {
  const sqlite = new Database(databasePath);
  // Cascade / SET NULL behavior requires foreign keys to be enabled per connection.
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("journal_mode = WAL");
  return sqlite;
}

export function applyMigrations(
  db: DashoraDatabase,
  migrationsFolder: string = defaultMigrationsFolder(),
): void {
  migrate(db, { migrationsFolder });
}

export function openDatabase(options: OpenDatabaseOptions = {}): OpenedDatabase {
  const databasePath = options.databasePath
    ? resolve(options.databasePath)
    : resolveDatabasePath(options.dataDir ?? DEFAULT_DASHORA_DATA_DIR);

  const dataDir = dirname(databasePath);
  ensureDataDir(dataDir);

  const sqlite = openSqlite(databasePath);
  const db = drizzle(sqlite, { schema });

  if (options.migrate !== false) {
    applyMigrations(db, options.migrationsFolder ?? defaultMigrationsFolder());
  }

  return {
    db,
    sqlite,
    databasePath,
    dataDir,
    close: () => {
      sqlite.close();
    },
  };
}

export function openDatabaseFromDataDir(
  dataDir: string,
  options: Omit<OpenDatabaseOptions, "dataDir" | "databasePath"> = {},
): OpenedDatabase {
  return openDatabase({ ...options, dataDir: resolveDataDir(dataDir) });
}

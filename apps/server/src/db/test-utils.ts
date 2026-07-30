import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type OpenedDatabase, openDatabase } from "./client.js";
import { resolveDatabasePath } from "./paths.js";
import { type Repositories, createRepositories } from "./repositories/index.js";

export type TestDatabase = OpenedDatabase & {
  repos: Repositories;
  /** Remove the temporary data directory after closing. */
  cleanup: () => void;
};

/**
 * Opens an isolated SQLite database under a unique temp directory.
 * Migrations are applied. Callers must invoke `cleanup()` (typically in afterEach/afterAll).
 */
export function createTestDatabase(): TestDatabase {
  const dataDir = mkdtempSync(join(tmpdir(), "dashora-db-"));
  const opened = openDatabase({
    databasePath: resolveDatabasePath(dataDir),
    migrate: true,
  });
  const repos = createRepositories(opened.db);

  return {
    ...opened,
    repos,
    cleanup: () => {
      opened.close();
      rmSync(dataDir, { recursive: true, force: true });
    },
  };
}

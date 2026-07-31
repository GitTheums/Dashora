import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { applyMigrations, openDatabase } from "./client.js";
import { resolveDatabasePath } from "./paths.js";
import { createRepositories } from "./repositories/index.js";

describe("temporary SQLite migrations", () => {
  const dirs: string[] = [];

  afterEach(() => {
    while (dirs.length > 0) {
      const dir = dirs.pop();
      if (dir) {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  it("applies the full migration chain on a fresh temp database", () => {
    const dataDir = mkdtempSync(join(tmpdir(), "dashora-migrate-"));
    dirs.push(dataDir);

    const opened = openDatabase({
      databasePath: resolveDatabasePath(dataDir),
      migrate: true,
    });

    try {
      const tables = opened.sqlite
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
        .all() as Array<{ name: string }>;
      const names = tables.map((row) => row.name);
      expect(names).toEqual(
        expect.arrayContaining([
          "users",
          "sessions",
          "dashboards",
          "pages",
          "page_layouts",
          "widgets",
          "integrations",
          "secrets",
          "cache_entries",
          "todo_items",
          "settings",
          "audit_events",
          "__drizzle_migrations",
        ]),
      );

      const journal = opened.sqlite
        .prepare("SELECT COUNT(*) AS count FROM __drizzle_migrations")
        .get() as { count: number };
      expect(journal.count).toBeGreaterThanOrEqual(7);

      const themeColumn = opened.sqlite.prepare("PRAGMA table_info(dashboards)").all() as Array<{
        name: string;
      }>;
      expect(themeColumn.some((column) => column.name === "theme_json")).toBe(true);
    } finally {
      opened.close();
    }
  });

  it("is idempotent when migrations are reapplied", () => {
    const dataDir = mkdtempSync(join(tmpdir(), "dashora-migrate-idem-"));
    dirs.push(dataDir);
    const opened = openDatabase({
      databasePath: resolveDatabasePath(dataDir),
      migrate: true,
    });

    try {
      applyMigrations(opened.db);
      const repos = createRepositories(opened.db);
      expect(repos.users).toBeDefined();
      expect(repos.dashboards).toBeDefined();
    } finally {
      opened.close();
    }
  });
});

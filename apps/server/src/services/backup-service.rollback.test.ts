import * as nodeCrypto from "node:crypto";
import { type DashoraExport, EXPORT_FORMAT, EXPORT_FORMAT_VERSION } from "@dashora/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type TestDatabase, createTestDatabase } from "../db/test-utils.js";
import { BackupServiceError, createBackupService } from "./backup-service.js";

vi.mock("node:crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:crypto")>();
  return { ...actual, randomUUID: vi.fn(actual.randomUUID) };
});

describe("backup service transactional rollback", () => {
  let db: TestDatabase;

  afterEach(() => {
    db?.cleanup();
  });

  it("rolls back every write when a later insert fails inside the transaction", async () => {
    db = createTestDatabase();
    const user = await db.repos.users.create({
      email: "owner@example.com",
      passwordHash: "hash",
      displayName: "Owner",
    });
    const otherUser = await db.repos.users.create({
      email: "other@example.com",
      passwordHash: "hash",
      displayName: "Other",
    });

    // Pre-existing row whose id we will force the import's new dashboard to collide with,
    // triggering a primary-key violation partway through the transaction.
    const collisionId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    await db.repos.dashboards.create({
      id: collisionId,
      ownerUserId: otherUser.id,
      name: "Collider",
      slug: "collider",
    });

    const backup = createBackupService({ repos: db.repos, db: db.db, serverVersion: "0.1.0-test" });

    const file: DashoraExport = {
      format: EXPORT_FORMAT,
      formatVersion: EXPORT_FORMAT_VERSION,
      exportedAt: new Date().toISOString(),
      generator: { app: "dashora", serverVersion: "0.1.0-test" },
      data: {
        themePreferences: null,
        integrations: [
          {
            id: "11111111-1111-4111-8111-111111111111",
            provider: "github",
            name: "GitHub",
            config: {},
            createdAt: 0,
            updatedAt: 0,
          },
        ],
        dashboards: [
          {
            id: "22222222-2222-4222-8222-222222222222",
            name: "Dashboard",
            slug: "default",
            themeOverride: null,
            createdAt: 0,
            updatedAt: 0,
            pages: [],
          },
        ],
      },
    };

    // Plan order for this file is: 1 randomUUID() call for the integration id,
    // then 1 call for the dashboard id. Let the first call through untouched and
    // force the second (the dashboard id) to collide with the pre-existing row.
    const mockedRandomUUID = vi.mocked(nodeCrypto.randomUUID);
    mockedRandomUUID.mockImplementationOnce(() => "33333333-3333-4333-8333-333333333333");
    mockedRandomUUID.mockImplementationOnce(
      () => collisionId as `${string}-${string}-${string}-${string}-${string}`,
    );

    await expect(backup.runImport(user.id, file, "replace")).rejects.toBeInstanceOf(
      BackupServiceError,
    );

    const integrationsAfter = await db.repos.integrations.listByUser(user.id);
    expect(integrationsAfter).toHaveLength(0);
    const dashboardsAfter = await db.repos.dashboards.listByOwner(user.id);
    expect(dashboardsAfter).toHaveLength(0);

    // The pre-existing, unrelated row must be untouched.
    const collider = await db.repos.dashboards.findById(collisionId);
    expect(collider?.slug).toBe("collider");
  });
});

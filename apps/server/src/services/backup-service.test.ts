import { randomUUID } from "node:crypto";
import {
  type DashoraExport,
  EXPORT_FORMAT,
  EXPORT_FORMAT_VERSION,
  ExportFormatError,
  type PageLayoutDocument,
  addWidgetToLayout,
  createEmptyPageLayout,
} from "@dashora/shared";
import { afterEach, describe, expect, it } from "vitest";
import { type TestDatabase, createTestDatabase } from "../db/test-utils.js";
import { createBackupService } from "./backup-service.js";
import { THEME_SETTINGS_KEY } from "./theme-settings-service.js";

async function seedUser(db: TestDatabase, email = "owner@example.com") {
  return db.repos.users.create({ email, passwordHash: "hash", displayName: "Owner" });
}

function layoutWithTodoAndCustomApiWidget(
  todoWidgetId: string,
  apiWidgetId: string,
  credentialId: string | null,
): PageLayoutDocument {
  let doc = createEmptyPageLayout();
  doc = addWidgetToLayout(
    doc,
    {
      kind: "widget",
      id: todoWidgetId,
      type: "todo",
      title: "Tasks",
      enabled: true,
      config: {},
      schemaVersion: 1,
    },
    { colSpan: 4, rowSpan: 2 },
  );
  doc = addWidgetToLayout(
    doc,
    {
      kind: "widget",
      id: apiWidgetId,
      type: "custom-api",
      title: "API",
      enabled: true,
      config: {
        credentialId,
        headers: [{ id: randomUUID(), name: "X-Test", secretId: credentialId }],
      },
      schemaVersion: 1,
    },
    { colSpan: 4, rowSpan: 2 },
  );
  return doc;
}

describe("backup service", () => {
  let db: TestDatabase;

  afterEach(() => {
    db?.cleanup();
  });

  it("exports and replace-imports a full account, remapping every id", async () => {
    db = createTestDatabase();
    const user = await seedUser(db);
    const dashboard = await db.repos.dashboards.create({
      ownerUserId: user.id,
      name: "Dashboard",
      slug: "default",
    });
    const page = await db.repos.pages.create({
      dashboardId: dashboard.id,
      title: "Home",
      slug: "home",
    });
    const integration = await db.repos.integrations.create({
      userId: user.id,
      provider: "github",
      name: "GitHub",
    });
    const todoWidgetId = randomUUID();
    const apiWidgetId = randomUUID();
    await db.repos.pageLayouts.upsertForPage(
      page.id,
      layoutWithTodoAndCustomApiWidget(todoWidgetId, apiWidgetId, integration.id),
    );
    await db.repos.todoItems.create({
      ownerUserId: user.id,
      instanceId: todoWidgetId,
      title: "Buy milk",
      completed: false,
      dueAt: null,
      sortOrder: 0,
    });
    await db.repos.settings.upsert({
      userId: user.id,
      key: THEME_SETTINGS_KEY,
      value: {
        mode: "dark",
        preset: "aurora",
        accent: "teal",
        accentCustom: null,
        density: "comfortable",
        reducedTransparency: false,
        reducedMotion: false,
        cardRadius: "soft",
        ambientBackground: true,
        appName: null,
        logoDataUrl: null,
      },
    });

    const backup = createBackupService({ repos: db.repos, db: db.db, serverVersion: "0.1.0-test" });

    const exported = await backup.exportConfig(user.id);
    expect(exported.data.dashboards).toHaveLength(1);
    expect(exported.data.dashboards[0]?.pages[0]?.todos).toHaveLength(1);
    expect(exported.data.integrations).toHaveLength(1);

    const preview = await backup.previewImport(user.id, exported, "replace");
    expect(preview).toMatchObject({
      mode: "replace",
      dashboardsCreated: 1,
      pagesCreated: 1,
      widgetsCreated: 2,
      todosCreated: 1,
      integrationsCreated: 1,
      themePreferencesApplied: true,
      renamedSlugs: [],
    });
    expect(preview.skippedIntegrations).toEqual([
      expect.objectContaining({ provider: "github", name: "GitHub", reason: "secret_required" }),
    ]);

    const result = await backup.runImport(user.id, exported, "replace");
    expect(result).toMatchObject({
      mode: "replace",
      dashboardsCreated: 1,
      pagesCreated: 1,
      widgetsCreated: 2,
      todosCreated: 1,
      integrationsCreated: 1,
      themePreferencesApplied: true,
      renamedSlugs: [],
    });

    const dashboardsAfter = await db.repos.dashboards.listByOwner(user.id);
    expect(dashboardsAfter).toHaveLength(1);
    expect(dashboardsAfter[0]?.id).not.toBe(dashboard.id);
    expect(dashboardsAfter[0]?.slug).toBe("default");

    const dashboardAfter = dashboardsAfter[0];
    if (!dashboardAfter) throw new Error("expected dashboard");
    const pagesAfter = await db.repos.pages.listByDashboard(dashboardAfter.id);
    expect(pagesAfter).toHaveLength(1);

    const pageAfter = pagesAfter[0];
    if (!pageAfter) throw new Error("expected page");
    const layoutAfter = await db.repos.pageLayouts.findByPageId(pageAfter.id);
    expect(layoutAfter?.layout.widgets).toHaveLength(2);
    const apiWidgetAfter = layoutAfter?.layout.widgets.find(
      (widget) => "type" in widget && widget.type === "custom-api",
    );

    const integrationsAfter = await db.repos.integrations.listByUser(user.id);
    expect(integrationsAfter).toHaveLength(1);
    expect(integrationsAfter[0]?.id).not.toBe(integration.id);

    const remappedConfig =
      apiWidgetAfter && "config" in apiWidgetAfter ? apiWidgetAfter.config : undefined;
    expect(remappedConfig?.["credentialId"]).toBe(integrationsAfter[0]?.id);

    const themeAfter = await db.repos.settings.findByUserAndKey(user.id, THEME_SETTINGS_KEY);
    expect((themeAfter?.value as { mode?: string })?.mode).toBe("dark");
  });

  it("merge mode adds alongside existing data and renames conflicting slugs", async () => {
    db = createTestDatabase();
    const user = await seedUser(db);
    const dashboard = await db.repos.dashboards.create({
      ownerUserId: user.id,
      name: "Dashboard",
      slug: "default",
    });
    await db.repos.pages.create({ dashboardId: dashboard.id, title: "Home", slug: "home" });

    const backup = createBackupService({ repos: db.repos, db: db.db, serverVersion: "0.1.0-test" });
    const exported = await backup.exportConfig(user.id);

    const summary = await backup.runImport(user.id, exported, "merge");
    expect(summary.dashboardsCreated).toBe(1);
    expect(summary.renamedSlugs).toEqual([{ from: "default", to: "default-2" }]);
    expect(summary.themePreferencesApplied).toBe(false);

    const dashboardsAfter = await db.repos.dashboards.listByOwner(user.id);
    expect(dashboardsAfter).toHaveLength(2);
    expect(dashboardsAfter.map((record) => record.slug).sort()).toEqual(["default", "default-2"]);
    expect(dashboardsAfter.some((record) => record.id === dashboard.id)).toBe(true);
  });

  it("clears and warns about widget credential references that were not part of the import", async () => {
    db = createTestDatabase();
    const user = await seedUser(db);
    const widgetId = randomUUID();
    const orphanIntegrationId = randomUUID();
    const doc = addWidgetToLayout(
      createEmptyPageLayout(),
      {
        kind: "widget",
        id: widgetId,
        type: "custom-api",
        title: "API",
        enabled: true,
        config: { credentialId: orphanIntegrationId },
        schemaVersion: 1,
      },
      { colSpan: 4, rowSpan: 2 },
    );

    const file: DashoraExport = {
      format: EXPORT_FORMAT,
      formatVersion: EXPORT_FORMAT_VERSION,
      exportedAt: new Date().toISOString(),
      generator: { app: "dashora", serverVersion: "0.1.0-test" },
      data: {
        themePreferences: null,
        integrations: [],
        dashboards: [
          {
            id: randomUUID(),
            name: "Dashboard",
            slug: "default",
            themeOverride: null,
            createdAt: 0,
            updatedAt: 0,
            pages: [
              {
                id: randomUUID(),
                title: "Home",
                slug: "home",
                icon: "home",
                accent: null,
                sortOrder: 0,
                createdAt: 0,
                updatedAt: 0,
                layout: doc,
                todos: [],
              },
            ],
          },
        ],
      },
    };

    const backup = createBackupService({ repos: db.repos, db: db.db, serverVersion: "0.1.0-test" });
    const preview = await backup.previewImport(user.id, file, "replace");
    expect(preview.warnings.some((warning) => warning.includes("credentialId"))).toBe(true);

    await backup.runImport(user.id, file, "replace");
    const dashboardsAfter = await db.repos.dashboards.listByOwner(user.id);
    const dashboardAfter = dashboardsAfter[0];
    if (!dashboardAfter) throw new Error("expected dashboard");
    const pagesAfter = await db.repos.pages.listByDashboard(dashboardAfter.id);
    const pageAfter = pagesAfter[0];
    if (!pageAfter) throw new Error("expected page");
    const layoutAfter = await db.repos.pageLayouts.findByPageId(pageAfter.id);
    const widgetAfter = layoutAfter?.layout.widgets[0];
    const configAfter = widgetAfter && "config" in widgetAfter ? widgetAfter.config : undefined;
    expect(configAfter?.["credentialId"]).toBeNull();
  });

  it("rejects a malformed file without writing any data", async () => {
    db = createTestDatabase();
    const user = await seedUser(db);
    const backup = createBackupService({ repos: db.repos, db: db.db, serverVersion: "0.1.0-test" });

    await expect(backup.previewImport(user.id, { nope: true }, "replace")).rejects.toBeInstanceOf(
      ExportFormatError,
    );
    await expect(backup.runImport(user.id, { nope: true }, "replace")).rejects.toBeInstanceOf(
      ExportFormatError,
    );

    const dashboardsAfter = await db.repos.dashboards.listByOwner(user.id);
    expect(dashboardsAfter).toHaveLength(0);
  });

  it("rejects a file exported by a newer, unsupported version", async () => {
    db = createTestDatabase();
    const user = await seedUser(db);
    const backup = createBackupService({ repos: db.repos, db: db.db, serverVersion: "0.1.0-test" });

    const future = {
      format: EXPORT_FORMAT,
      formatVersion: EXPORT_FORMAT_VERSION + 1,
      exportedAt: new Date().toISOString(),
      generator: { app: "dashora", serverVersion: "9.9.9" },
      data: { themePreferences: null, integrations: [], dashboards: [] },
    };

    await expect(backup.previewImport(user.id, future, "replace")).rejects.toMatchObject({
      code: "unsupported_version",
    });
  });
});

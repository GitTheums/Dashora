import { afterEach, describe, expect, it } from "vitest";
import { type TestDatabase, createTestDatabase } from "../test-utils.js";

describe("repository layer (integration)", () => {
  let database: TestDatabase;

  afterEach(() => {
    database?.cleanup();
  });

  async function seedGraph(db: TestDatabase) {
    const user = await db.repos.users.create({
      email: "Operator@Example.com",
      passwordHash: "hash",
      displayName: "Operator",
    });
    const dashboard = await db.repos.dashboards.create({
      ownerUserId: user.id,
      name: "Home",
      slug: "home",
    });
    const page = await db.repos.pages.create({
      dashboardId: dashboard.id,
      title: "Overview",
      slug: "overview",
    });
    const integration = await db.repos.integrations.create({
      userId: user.id,
      provider: "weather",
      name: "OpenWeather",
      config: { units: "metric" },
    });
    const widget = await db.repos.widgets.create({
      pageId: page.id,
      type: "weather",
      title: "Local weather",
      config: { location: "Berlin" },
      integrationId: integration.id,
    });
    const layout = await db.repos.widgetLayouts.create({
      widgetId: widget.id,
      pageId: page.id,
      colStart: 1,
      colSpan: 6,
      rowOrder: 0,
      rowSpan: 2,
    });
    return { user, dashboard, page, integration, widget, layout };
  }

  it("uses an isolated temporary database per test", () => {
    database = createTestDatabase();
    const other = createTestDatabase();
    try {
      expect(database.databasePath).not.toBe(other.databasePath);
      expect(database.sqlite.pragma("foreign_keys", { simple: true })).toBe(1);
    } finally {
      other.cleanup();
    }
  });

  it("persists users, sessions, and settings", async () => {
    database = createTestDatabase();
    const user = await database.repos.users.create({
      email: "A@Example.com",
      passwordHash: "hash",
      displayName: "Ada",
    });
    expect(user.email).toBe("a@example.com");
    expect(Number.isInteger(user.createdAt)).toBe(true);

    const session = await database.repos.sessions.create({
      userId: user.id,
      tokenHash: "token-1",
      expiresAt: user.createdAt + 60_000,
    });
    expect(await database.repos.sessions.findByTokenHash("token-1")).toMatchObject({
      id: session.id,
      userId: user.id,
    });

    const setting = await database.repos.settings.upsert({
      userId: user.id,
      key: "theme",
      value: "dark",
    });
    expect(setting.value).toBe("dark");
    await database.repos.settings.upsert({
      userId: user.id,
      key: "theme",
      value: { mode: "light" },
    });
    expect((await database.repos.settings.findByUserAndKey(user.id, "theme"))?.value).toEqual({
      mode: "light",
    });
  });

  it("persists dashboard → page → widget → layout graph with JSON configs", async () => {
    database = createTestDatabase();
    const graph = await seedGraph(database);

    expect(await database.repos.dashboards.findByOwnerAndSlug(graph.user.id, "home")).toBeDefined();
    expect(await database.repos.pages.listByDashboard(graph.dashboard.id)).toHaveLength(1);
    expect(graph.widget.config).toEqual({ location: "Berlin" });
    expect(graph.integration.config).toEqual({ units: "metric" });
    expect(await database.repos.widgetLayouts.findByWidgetId(graph.widget.id)).toMatchObject({
      colStart: 1,
      colSpan: 6,
      rowSpan: 2,
    });

    await database.repos.secrets.create({
      integrationId: graph.integration.id,
      key: "api_token",
      ciphertext: "cipher-abc",
    });
    expect(
      (await database.repos.secrets.findByIntegrationAndKey(graph.integration.id, "api_token"))
        ?.ciphertext,
    ).toBe("cipher-abc");

    const now = Date.now();
    await database.repos.cacheEntries.upsertByCacheKey({
      cacheKey: `weather:${graph.widget.id}:hash`,
      widgetId: graph.widget.id,
      payload: { tempC: 21 },
      fetchedAt: now,
      staleAt: now + 60_000,
      expiresAt: now + 300_000,
    });
    expect(
      (await database.repos.cacheEntries.findByCacheKey(`weather:${graph.widget.id}:hash`))
        ?.payload,
    ).toEqual({ tempC: 21 });
  });

  it("cascades deletes from users through owned graph", async () => {
    database = createTestDatabase();
    const graph = await seedGraph(database);
    await database.repos.secrets.create({
      integrationId: graph.integration.id,
      key: "api_token",
      ciphertext: "cipher",
    });
    await database.repos.sessions.create({
      userId: graph.user.id,
      tokenHash: "session-token",
      expiresAt: Date.now() + 10_000,
    });
    await database.repos.settings.create({
      userId: graph.user.id,
      key: "locale",
      value: "en",
    });
    await database.repos.cacheEntries.create({
      cacheKey: "k1",
      widgetId: graph.widget.id,
      payload: { ok: true },
      fetchedAt: Date.now(),
      staleAt: Date.now() + 1,
      expiresAt: Date.now() + 2,
    });

    expect(await database.repos.users.deleteById(graph.user.id)).toBe(true);

    expect(await database.repos.sessions.listByUserId(graph.user.id)).toHaveLength(0);
    expect(await database.repos.dashboards.listByOwner(graph.user.id)).toHaveLength(0);
    expect(await database.repos.pages.findById(graph.page.id)).toBeUndefined();
    expect(await database.repos.widgets.findById(graph.widget.id)).toBeUndefined();
    expect(await database.repos.widgetLayouts.findById(graph.layout.id)).toBeUndefined();
    expect(await database.repos.integrations.findById(graph.integration.id)).toBeUndefined();
    expect(
      await database.repos.secrets.findByIntegrationAndKey(graph.integration.id, "api_token"),
    ).toBeUndefined();
    expect(await database.repos.cacheEntries.findByCacheKey("k1")).toBeUndefined();
    expect(await database.repos.settings.findByUserAndKey(graph.user.id, "locale")).toBeUndefined();
  });

  it("sets widget.integration_id to null when integration is deleted", async () => {
    database = createTestDatabase();
    const graph = await seedGraph(database);

    expect(await database.repos.integrations.deleteById(graph.integration.id)).toBe(true);
    const widget = await database.repos.widgets.findById(graph.widget.id);
    expect(widget?.integrationId).toBeNull();
  });

  it("rejects invalid layout placements and invalid JSON configs", async () => {
    database = createTestDatabase();
    const graph = await seedGraph(database);

    await expect(
      database.repos.widgetLayouts.create({
        widgetId: graph.widget.id,
        pageId: graph.page.id,
        colStart: 10,
        colSpan: 4,
        rowOrder: 0,
        rowSpan: 1,
      }),
    ).rejects.toThrow(/exceeds 12 columns/);

    await expect(
      database.repos.widgets.create({
        pageId: graph.page.id,
        type: "broken",
        config: ["not-an-object"] as unknown as Record<string, never>,
      }),
    ).rejects.toThrow(/widgets.config_json/);
  });

  it("deletes expired sessions and cache entries", async () => {
    database = createTestDatabase();
    const user = await database.repos.users.create({
      email: "expiry@example.com",
      passwordHash: "hash",
      displayName: "Expiry",
    });
    const now = Date.now();
    await database.repos.sessions.create({
      userId: user.id,
      tokenHash: "expired",
      expiresAt: now - 1,
    });
    await database.repos.sessions.create({
      userId: user.id,
      tokenHash: "fresh",
      expiresAt: now + 60_000,
    });
    expect(await database.repos.sessions.deleteExpired(now)).toBe(1);
    expect(await database.repos.sessions.findByTokenHash("fresh")).toBeDefined();

    await database.repos.cacheEntries.create({
      cacheKey: "old",
      payload: 1,
      fetchedAt: now - 10,
      staleAt: now - 5,
      expiresAt: now - 1,
    });
    await database.repos.cacheEntries.create({
      cacheKey: "new",
      payload: 2,
      fetchedAt: now,
      staleAt: now + 1,
      expiresAt: now + 10,
    });
    expect(await database.repos.cacheEntries.deleteExpired(now)).toBe(1);
    expect((await database.repos.cacheEntries.findByCacheKey("new"))?.payload).toBe(2);
  });
});

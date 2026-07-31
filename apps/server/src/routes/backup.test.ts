import {
  type DashoraExport,
  dashoraExportSchema,
  importSummaryResponseSchema,
  setupResponseSchema,
} from "@dashora/shared";
import type { FastifyInstance, LightMyRequestResponse } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { CSRF_COOKIE_NAME, SESSION_COOKIE_NAME } from "../auth/cookies.js";
import { createSetupService } from "../auth/setup-service.js";
import { type TestDatabase, createTestDatabase } from "../db/test-utils.js";
import { createTestServerEnv } from "../test/env.js";

function parseCookies(response: LightMyRequestResponse): Record<string, string> {
  const raw = response.headers["set-cookie"];
  const lines = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const out: Record<string, string> = {};
  for (const line of lines) {
    const pair = line.split(";")[0];
    if (!pair) {
      continue;
    }
    const eq = pair.indexOf("=");
    if (eq <= 0) {
      continue;
    }
    out[pair.slice(0, eq)] = pair.slice(eq + 1);
  }
  return out;
}

function cookieHeader(cookies: Record<string, string>): string {
  return Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

describe("backup export/import API", () => {
  let db: TestDatabase;
  let app: FastifyInstance;
  let authCookies: Record<string, string>;
  let csrfToken: string;

  afterEach(async () => {
    if (app) {
      await app.close();
    }
    if (db) {
      db.cleanup();
    }
  });

  async function startAuthenticated(
    overrides: Partial<ReturnType<typeof createTestServerEnv>> = {},
  ) {
    db = createTestDatabase();
    const env = createTestServerEnv({
      PUBLIC_BASE_URL: "http://localhost:5173",
      LOGIN_RATE_LIMIT_MAX: 50,
      ...overrides,
    });
    const setup = createSetupService({
      db: db.db,
      setupTokenTtlMs: env.SETUP_TOKEN_TTL_MS,
      nodeEnv: env.NODE_ENV,
    });
    app = await buildApp({
      version: "0.1.0-test",
      logger: false,
      database: db,
      setup,
      env,
    });

    const csrfResponse = await app.inject({ method: "GET", url: "/api/v1/auth/csrf" });
    const csrfCookies = parseCookies(csrfResponse);
    const setupToken = setup.getPlaintextForTests();
    if (!setupToken) {
      throw new Error("expected setup token");
    }

    const setupResponse = await app.inject({
      method: "POST",
      url: "/api/v1/setup/complete",
      headers: {
        "content-type": "application/json",
        cookie: cookieHeader(csrfCookies),
        "x-csrf-token": csrfResponse.json().csrfToken as string,
      },
      payload: {
        token: setupToken,
        email: "admin@example.com",
        displayName: "Admin",
        password: "correct-horse-battery",
      },
    });
    expect(setupResponse.statusCode).toBe(200);
    setupResponseSchema.parse(setupResponse.json());
    authCookies = { ...csrfCookies, ...parseCookies(setupResponse) };
    expect(authCookies[SESSION_COOKIE_NAME]).toBeTruthy();

    const refreshedCsrf = await app.inject({
      method: "GET",
      url: "/api/v1/auth/csrf",
      headers: { cookie: cookieHeader(authCookies) },
    });
    csrfToken = refreshedCsrf.json().csrfToken as string;
    authCookies = { ...authCookies, ...parseCookies(refreshedCsrf) };
    expect(authCookies[CSRF_COOKIE_NAME]).toBe(csrfToken);
  }

  it("requires authentication on all three routes", async () => {
    await startAuthenticated();

    const exportResponse = await app.inject({ method: "GET", url: "/api/v1/backup/export" });
    expect(exportResponse.statusCode).toBe(401);

    // Send a valid CSRF cookie/token pair (but no session cookie) so the auth check —
    // not the CSRF check — is what's being exercised here.
    const csrfOnlyCookies = { [CSRF_COOKIE_NAME]: csrfToken };
    const previewResponse = await app.inject({
      method: "POST",
      url: "/api/v1/backup/import/preview",
      headers: {
        "content-type": "application/json",
        cookie: cookieHeader(csrfOnlyCookies),
        "x-csrf-token": csrfToken,
      },
      payload: { mode: "replace", file: {} },
    });
    expect(previewResponse.statusCode).toBe(401);

    const importResponse = await app.inject({
      method: "POST",
      url: "/api/v1/backup/import",
      headers: {
        "content-type": "application/json",
        cookie: cookieHeader(csrfOnlyCookies),
        "x-csrf-token": csrfToken,
      },
      payload: { mode: "replace", file: {} },
    });
    expect(importResponse.statusCode).toBe(401);
  });

  it("requires CSRF on both POST routes", async () => {
    await startAuthenticated();

    const previewResponse = await app.inject({
      method: "POST",
      url: "/api/v1/backup/import/preview",
      headers: { "content-type": "application/json", cookie: cookieHeader(authCookies) },
      payload: { mode: "replace", file: {} },
    });
    expect(previewResponse.statusCode).toBe(403);

    const importResponse = await app.inject({
      method: "POST",
      url: "/api/v1/backup/import",
      headers: { "content-type": "application/json", cookie: cookieHeader(authCookies) },
      payload: { mode: "replace", file: {} },
    });
    expect(importResponse.statusCode).toBe(403);
  });

  it("exports, previews, and imports a backup end-to-end", async () => {
    await startAuthenticated();

    await app.inject({
      method: "POST",
      url: "/api/v1/dashboard/pages",
      headers: {
        "content-type": "application/json",
        cookie: cookieHeader(authCookies),
        "x-csrf-token": csrfToken,
      },
      payload: { name: "Extra", slug: "extra", icon: "grid" },
    });

    const exportResponse = await app.inject({
      method: "GET",
      url: "/api/v1/backup/export",
      headers: { cookie: cookieHeader(authCookies) },
    });
    expect(exportResponse.statusCode).toBe(200);
    expect(exportResponse.headers["content-disposition"]).toContain("attachment");
    const exported = dashoraExportSchema.parse(exportResponse.json());
    expect(exported.data.dashboards[0]?.pages.length).toBeGreaterThanOrEqual(2);

    const previewResponse = await app.inject({
      method: "POST",
      url: "/api/v1/backup/import/preview",
      headers: {
        "content-type": "application/json",
        cookie: cookieHeader(authCookies),
        "x-csrf-token": csrfToken,
      },
      payload: { mode: "replace", file: exported },
    });
    expect(previewResponse.statusCode).toBe(200);
    const preview = importSummaryResponseSchema.parse(previewResponse.json()).summary;
    expect(preview.mode).toBe("replace");
    expect(preview.dashboardsCreated).toBe(1);

    const importResponse = await app.inject({
      method: "POST",
      url: "/api/v1/backup/import",
      headers: {
        "content-type": "application/json",
        cookie: cookieHeader(authCookies),
        "x-csrf-token": csrfToken,
      },
      payload: { mode: "replace", file: exported },
    });
    expect(importResponse.statusCode).toBe(200);
    const summary = importSummaryResponseSchema.parse(importResponse.json()).summary;
    expect(summary.dashboardsCreated).toBe(1);
    expect(summary.pagesCreated).toBe(preview.pagesCreated);

    const dashboardAfter = await app.inject({
      method: "GET",
      url: "/api/v1/dashboard",
      headers: { cookie: cookieHeader(authCookies) },
    });
    expect(dashboardAfter.statusCode).toBe(200);
    expect(dashboardAfter.json().dashboard.pages).toHaveLength(preview.pagesCreated);

    const events = await db.repos.auditEvents.listRecent();
    expect(events.find((event) => event.event === "backup.export")).toMatchObject({
      success: true,
      actorEmail: "admin@example.com",
    });
    const importEvent = events.find((event) => event.event === "backup.import");
    expect(importEvent).toMatchObject({ success: true, actorEmail: "admin@example.com" });
    expect(importEvent?.metadata).toMatchObject({ mode: "replace" });
    // The preview endpoint must not itself be treated as a mutating, audited import.
    expect(events.filter((event) => event.event === "backup.import")).toHaveLength(1);
  });

  it("supports merge mode, adding alongside existing data", async () => {
    await startAuthenticated();

    const exportResponse = await app.inject({
      method: "GET",
      url: "/api/v1/backup/export",
      headers: { cookie: cookieHeader(authCookies) },
    });
    const exported = dashoraExportSchema.parse(exportResponse.json());

    const importResponse = await app.inject({
      method: "POST",
      url: "/api/v1/backup/import",
      headers: {
        "content-type": "application/json",
        cookie: cookieHeader(authCookies),
        "x-csrf-token": csrfToken,
      },
      payload: { mode: "merge", file: exported },
    });
    expect(importResponse.statusCode).toBe(200);
    const summary = importSummaryResponseSchema.parse(importResponse.json()).summary;
    expect(summary.mode).toBe("merge");
    expect(summary.renamedSlugs.length).toBeGreaterThan(0);
  });

  it("rejects a malformed import payload with 400", async () => {
    await startAuthenticated();

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/backup/import/preview",
      headers: {
        "content-type": "application/json",
        cookie: cookieHeader(authCookies),
        "x-csrf-token": csrfToken,
      },
      payload: { mode: "replace", file: { not: "a valid export" } },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: { code: "invalid_format" } });
  });

  it("rejects an oversized import body with 413", async () => {
    await startAuthenticated({ BACKUP_IMPORT_MAX_BYTES: 200 });

    const bigFile: Partial<DashoraExport> = {
      format: "dashora-config",
      formatVersion: 1,
      exportedAt: new Date().toISOString(),
      generator: { app: "dashora", serverVersion: "0.1.0-test" },
      data: {
        themePreferences: null,
        integrations: [],
        dashboards: Array.from({ length: 50 }, (_, index) => ({
          id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
          name: "Padding",
          slug: `padding-${index}`,
          themeOverride: null,
          createdAt: 0,
          updatedAt: 0,
          pages: [],
        })),
      },
    };

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/backup/import/preview",
      headers: {
        "content-type": "application/json",
        cookie: cookieHeader(authCookies),
        "x-csrf-token": csrfToken,
      },
      payload: { mode: "replace", file: bigFile },
    });
    expect(response.statusCode).toBe(413);
  });
});

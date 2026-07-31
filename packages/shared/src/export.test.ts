import { describe, expect, it } from "vitest";
import {
  type DashoraExport,
  EXPORT_FORMAT,
  EXPORT_FORMAT_VERSION,
  ExportFormatError,
  dashoraExportSchema,
  migrateExportPayload,
} from "./export.js";
import { createDefaultPageLayout } from "./layout.js";
import { DEFAULT_THEME_PREFERENCES } from "./theme.js";

function sampleExport(): DashoraExport {
  return {
    format: EXPORT_FORMAT,
    formatVersion: EXPORT_FORMAT_VERSION,
    exportedAt: "2026-07-31T09:00:00.000Z",
    generator: { app: "dashora", serverVersion: "0.1.0" },
    data: {
      themePreferences: DEFAULT_THEME_PREFERENCES,
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
          pages: [
            {
              id: "33333333-3333-4333-8333-333333333333",
              title: "Home",
              slug: "home",
              icon: "home",
              accent: null,
              sortOrder: 0,
              createdAt: 0,
              updatedAt: 0,
              layout: createDefaultPageLayout(),
              todos: [],
            },
          ],
        },
      ],
    },
  };
}

describe("dashoraExportSchema", () => {
  it("accepts a well-formed v1 export", () => {
    const parsed = dashoraExportSchema.parse(sampleExport());
    expect(parsed.formatVersion).toBe(1);
    expect(parsed.data.dashboards).toHaveLength(1);
  });

  it("rejects oversized dashboard arrays", () => {
    const payload = sampleExport();
    const dashboardTemplate = payload.data.dashboards[0];
    if (!dashboardTemplate) throw new Error("expected dashboard");
    const dashboards = Array.from({ length: 51 }, () => dashboardTemplate);
    expect(
      dashoraExportSchema.safeParse({ ...payload, data: { ...payload.data, dashboards } }).success,
    ).toBe(false);
  });
});

describe("migrateExportPayload", () => {
  it("round-trips a current-version export", () => {
    const result = migrateExportPayload(sampleExport());
    expect(result.data.integrations).toHaveLength(1);
  });

  it("rejects a non-object payload", () => {
    expect(() => migrateExportPayload("not-an-object")).toThrow(ExportFormatError);
    try {
      migrateExportPayload(null);
    } catch (error) {
      expect(error).toBeInstanceOf(ExportFormatError);
      expect((error as ExportFormatError).code).toBe("invalid_format");
    }
  });

  it("rejects an unrecognized format string", () => {
    const payload = { ...sampleExport(), format: "some-other-app" };
    try {
      migrateExportPayload(payload);
      throw new Error("expected to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(ExportFormatError);
      expect((error as ExportFormatError).code).toBe("invalid_format");
    }
  });

  it("rejects a formatVersion newer than supported", () => {
    const payload = { ...sampleExport(), formatVersion: EXPORT_FORMAT_VERSION + 1 };
    try {
      migrateExportPayload(payload);
      throw new Error("expected to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(ExportFormatError);
      expect((error as ExportFormatError).code).toBe("unsupported_version");
    }
  });

  it("rejects a malformed shape that fails the full schema", () => {
    const payload = sampleExport();
    const malformed = {
      ...payload,
      data: { ...payload.data, dashboards: [{ nope: true }] },
    };
    try {
      migrateExportPayload(malformed);
      throw new Error("expected to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(ExportFormatError);
      expect((error as ExportFormatError).code).toBe("validation_error");
      expect((error as ExportFormatError).issues?.length).toBeGreaterThan(0);
    }
  });
});

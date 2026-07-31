import { createPageWidgetRequestSchema, isDashoraUuid } from "@dashora/shared";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  WIDGET_CATALOG,
  createInstanceFromCatalog,
  createRequestFromCatalog,
  filterCatalog,
  formatDefaultSize,
  getCatalogEntry,
  newWidgetInstanceId,
  shouldOpenSettingsAfterAdd,
} from "./catalog.js";

describe("widget catalog", () => {
  it("includes production widgets and placeholders", () => {
    expect(WIDGET_CATALOG.some((entry) => entry.id === "search")).toBe(true);
    expect(WIDGET_CATALOG.some((entry) => entry.id === "clock")).toBe(true);
    expect(WIDGET_CATALOG.some((entry) => entry.id === "bookmarks")).toBe(true);
    expect(WIDGET_CATALOG.some((entry) => entry.id === "todo")).toBe(true);
    expect(WIDGET_CATALOG.some((entry) => entry.id === "weather")).toBe(true);
    expect(WIDGET_CATALOG.some((entry) => entry.id === "rss")).toBe(true);
    expect(WIDGET_CATALOG.some((entry) => entry.id === "calendar")).toBe(true);
    expect(WIDGET_CATALOG.some((entry) => entry.id === "github-repository")).toBe(true);
    expect(WIDGET_CATALOG.some((entry) => entry.id === "github-releases")).toBe(true);
    expect(WIDGET_CATALOG.some((entry) => entry.id === "hacker-news")).toBe(true);
    expect(WIDGET_CATALOG.some((entry) => entry.id === "lobsters")).toBe(true);
    expect(WIDGET_CATALOG.some((entry) => entry.id === "reddit")).toBe(true);
    expect(WIDGET_CATALOG.some((entry) => entry.id === "youtube")).toBe(true);
    expect(WIDGET_CATALOG.some((entry) => entry.id === "twitch")).toBe(true);
    expect(WIDGET_CATALOG.some((entry) => entry.id === "demo-metrics")).toBe(false);
    expect(WIDGET_CATALOG.some((entry) => entry.kind === "placeholder")).toBe(true);
    expect(WIDGET_CATALOG.some((entry) => entry.id === "placeholder:bookmarks")).toBe(false);
    expect(WIDGET_CATALOG.some((entry) => entry.id === "placeholder:weather")).toBe(false);
    expect(WIDGET_CATALOG.some((entry) => entry.id === "placeholder:calendar")).toBe(false);
    expect(WIDGET_CATALOG.some((entry) => entry.id === "placeholder:feed")).toBe(false);
  });

  it("filters by query and category", () => {
    const clockMatches = filterCatalog("clock", "all");
    expect(clockMatches.some((entry) => entry.id === "clock")).toBe(true);

    const home = filterCatalog("", "home");
    expect(home.every((entry) => entry.category === "home")).toBe(true);
    expect(home.length).toBeGreaterThan(0);
  });

  it("creates typed and placeholder instances", () => {
    const clock = getCatalogEntry("clock");
    expect(clock).toBeTruthy();
    if (!clock) {
      return;
    }
    const typed = createInstanceFromCatalog(clock, "b1111111-1111-4111-8111-111111111201");
    expect(typed.kind).toBe("widget");
    if (typed.kind === "widget") {
      expect(typed.type).toBe("clock");
      expect(typed.config).toMatchObject({ timezone: "UTC" });
    }

    const weather = getCatalogEntry("weather");
    expect(weather).toBeTruthy();
    if (!weather) {
      return;
    }
    const typedWeather = createInstanceFromCatalog(weather, "b1111111-1111-4111-8111-111111111202");
    expect(typedWeather.kind).toBe("widget");
    expect(shouldOpenSettingsAfterAdd(weather)).toBe(true);
  });

  it("opens settings after add when integration is required", () => {
    const services = getCatalogEntry("placeholder:services");
    expect(services).toBeTruthy();
    if (!services) {
      return;
    }
    expect(services.capabilities.requiresIntegration).toBe(true);
    expect(shouldOpenSettingsAfterAdd(services)).toBe(true);
  });

  it("formats default size previews", () => {
    expect(formatDefaultSize({ colSpan: 4, rowSpan: 2 })).toBe("4×2");
  });

  it("builds create requests without a persistent id and keeps type as the slug", () => {
    const weather = getCatalogEntry("weather");
    expect(weather).toBeTruthy();
    if (!weather) {
      return;
    }
    const request = createRequestFromCatalog(weather);
    expect(request).not.toHaveProperty("id");
    expect(createPageWidgetRequestSchema.parse(request)).toMatchObject({
      kind: "widget",
      type: "weather",
    });
  });

  it("never uses the catalog slug as the typed instance id", () => {
    const weather = getCatalogEntry("weather");
    expect(weather).toBeTruthy();
    if (!weather) {
      return;
    }
    const instanceId = newWidgetInstanceId();
    const instance = createInstanceFromCatalog(weather, instanceId);
    expect(instance.id).toBe(instanceId);
    expect(instance.id).not.toBe("weather");
    expect(isDashoraUuid(instance.id)).toBe(true);
    if (instance.kind === "widget") {
      expect(instance.type).toBe("weather");
    }
  });

  it("generates valid UUIDs even when crypto.randomUUID is unavailable", () => {
    const original = globalThis.crypto;
    const getRandomValues = vi.fn((bytes: Uint8Array) => {
      for (let i = 0; i < bytes.length; i += 1) {
        bytes[i] = (i * 31 + 7) % 256;
      }
      return bytes;
    });
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: { getRandomValues },
    });
    try {
      const id = newWidgetInstanceId();
      expect(z.string().uuid().safeParse(id).success).toBe(true);
      expect(id).not.toMatch(/^a[0-9a-f]{11}-/);
      expect(id).not.toBe("weather");
    } finally {
      Object.defineProperty(globalThis, "crypto", {
        configurable: true,
        value: original,
      });
    }
  });
});

import { describe, expect, it } from "vitest";
import {
  WIDGET_CATALOG,
  createInstanceFromCatalog,
  filterCatalog,
  formatDefaultSize,
  getCatalogEntry,
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
});

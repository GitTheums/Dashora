import { DEFAULT_THEME_PREFERENCES } from "@dashora/shared";
import { afterEach, describe, expect, it } from "vitest";
import { applyThemeAppearance, resolveThemeMode } from "./apply-appearance.js";

describe("theme variants", () => {
  afterEach(() => {
    document.documentElement.removeAttribute("style");
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.removeAttribute("data-preset");
  });

  it("resolves system mode from the preferred color scheme", () => {
    expect(resolveThemeMode("system", "dark")).toBe("dark");
    expect(resolveThemeMode("system", "light")).toBe("light");
    expect(resolveThemeMode("dark", "light")).toBe("dark");
    expect(resolveThemeMode("light", "dark")).toBe("light");
  });

  it("applies dark and light CSS variables to the document", () => {
    applyThemeAppearance({ ...DEFAULT_THEME_PREFERENCES, mode: "dark" }, "dark");
    expect(document.documentElement.dataset["theme"]).toBe("dark");
    expect(
      document.documentElement.style.getPropertyValue("--ds-canvas").trim().length,
    ).toBeGreaterThan(0);

    applyThemeAppearance({ ...DEFAULT_THEME_PREFERENCES, mode: "light" }, "light");
    expect(document.documentElement.dataset["theme"]).toBe("light");
  });
});

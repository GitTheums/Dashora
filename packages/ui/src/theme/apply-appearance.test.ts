import { DEFAULT_THEME_PREFERENCES } from "@dashora/shared";
import { afterEach, describe, expect, it } from "vitest";
import {
  applyThemeAppearance,
  buildAppearanceTokens,
  resolveThemeMode,
} from "./apply-appearance.js";

describe("applyThemeAppearance", () => {
  afterEach(() => {
    document.documentElement.removeAttribute("style");
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.removeAttribute("data-preset");
    document.documentElement.removeAttribute("data-density");
    document.documentElement.removeAttribute("data-card-radius");
    document.documentElement.removeAttribute("data-reduced-transparency");
    document.documentElement.removeAttribute("data-reduced-motion");
    document.documentElement.removeAttribute("data-ambient");
  });

  it("resolves system mode from the system theme", () => {
    expect(resolveThemeMode("system", "light")).toBe("light");
    expect(resolveThemeMode("dark", "light")).toBe("dark");
  });

  it("builds distinct tokens per preset", () => {
    const midnight = buildAppearanceTokens(
      { ...DEFAULT_THEME_PREFERENCES, preset: "midnight" },
      "dark",
    );
    const aurora = buildAppearanceTokens(
      { ...DEFAULT_THEME_PREFERENCES, preset: "aurora" },
      "dark",
    );
    expect(midnight.canvas).not.toBe(aurora.canvas);
  });

  it("applies data attributes and CSS variables", () => {
    applyThemeAppearance(
      {
        ...DEFAULT_THEME_PREFERENCES,
        preset: "graphite",
        density: "compact",
        cardRadius: "sharp",
        reducedTransparency: true,
        reducedMotion: true,
        ambientBackground: false,
        accent: "sky",
      },
      "dark",
    );

    const root = document.documentElement;
    expect(root.dataset["theme"]).toBe("dark");
    expect(root.dataset["preset"]).toBe("graphite");
    expect(root.dataset["density"]).toBe("compact");
    expect(root.dataset["cardRadius"]).toBe("sharp");
    expect(root.dataset["reducedTransparency"]).toBe("true");
    expect(root.dataset["reducedMotion"]).toBe("true");
    expect(root.dataset["ambient"]).toBeUndefined();
    expect(root.style.getPropertyValue("--ds-canvas")).toBeTruthy();
    expect(root.style.getPropertyValue("--ds-primary")).toBeTruthy();
  });
});

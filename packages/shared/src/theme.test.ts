import { describe, expect, it } from "vitest";
import {
  DEFAULT_THEME_PREFERENCES,
  mergeThemePreferences,
  parseStoredThemePreferences,
  themePreferencesSchema,
} from "./theme.js";

describe("theme preferences", () => {
  it("accepts default preferences", () => {
    expect(themePreferencesSchema.parse(DEFAULT_THEME_PREFERENCES)).toEqual(
      DEFAULT_THEME_PREFERENCES,
    );
  });

  it("requires accentCustom when accent is custom", () => {
    expect(
      themePreferencesSchema.safeParse({
        ...DEFAULT_THEME_PREFERENCES,
        accent: "custom",
        accentCustom: null,
      }).success,
    ).toBe(false);
    expect(
      themePreferencesSchema.parse({
        ...DEFAULT_THEME_PREFERENCES,
        accent: "custom",
        accentCustom: "#22C55E",
      }).accentCustom,
    ).toBe("#22C55E");
  });

  it("merges dashboard overrides over base preferences", () => {
    const merged = mergeThemePreferences(DEFAULT_THEME_PREFERENCES, {
      preset: "aurora",
      density: "compact",
      ambientBackground: false,
    });
    expect(merged.preset).toBe("aurora");
    expect(merged.density).toBe("compact");
    expect(merged.ambientBackground).toBe(false);
    expect(merged.mode).toBe("system");
  });

  it("parses legacy mode-only storage", () => {
    expect(parseStoredThemePreferences("dark").mode).toBe("dark");
    expect(parseStoredThemePreferences({ mode: "light" }).mode).toBe("light");
    expect(parseStoredThemePreferences({ mode: "light" }).preset).toBe("midnight");
  });
});

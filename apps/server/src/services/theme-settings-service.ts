import {
  DEFAULT_THEME_PREFERENCES,
  type ThemePreferences,
  parseStoredThemePreferences,
  themePreferencesSchema,
} from "@dashora/shared";
import type { JsonValue } from "../db/json.js";
import type { Repositories } from "../db/repositories/index.js";

export const THEME_SETTINGS_KEY = "theme";

export type ThemeSettingsService = {
  getPreferences: (userId: string) => Promise<ThemePreferences>;
  updatePreferences: (userId: string, preferences: ThemePreferences) => Promise<ThemePreferences>;
  resetPreferences: (userId: string) => Promise<ThemePreferences>;
};

function toStoredPreferences(preferences: ThemePreferences): JsonValue {
  return {
    mode: preferences.mode,
    preset: preferences.preset,
    accent: preferences.accent,
    accentCustom: preferences.accentCustom ?? null,
    density: preferences.density,
    reducedTransparency: preferences.reducedTransparency,
    reducedMotion: preferences.reducedMotion,
    cardRadius: preferences.cardRadius,
    ambientBackground: preferences.ambientBackground,
    appName: preferences.appName ?? null,
    logoDataUrl: preferences.logoDataUrl ?? null,
  };
}

export function createThemeSettingsService(repos: Repositories): ThemeSettingsService {
  return {
    async getPreferences(userId) {
      const row = await repos.settings.findByUserAndKey(userId, THEME_SETTINGS_KEY);
      if (!row) {
        return { ...DEFAULT_THEME_PREFERENCES };
      }
      return parseStoredThemePreferences(row.value);
    },

    async updatePreferences(userId, preferences) {
      const parsed = themePreferencesSchema.parse(preferences);
      await repos.settings.upsert({
        userId,
        key: THEME_SETTINGS_KEY,
        value: toStoredPreferences(parsed),
      });
      return parsed;
    },

    async resetPreferences(userId) {
      await repos.settings.deleteByUserAndKey(userId, THEME_SETTINGS_KEY);
      return { ...DEFAULT_THEME_PREFERENCES };
    },
  };
}

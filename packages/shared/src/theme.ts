import { z } from "zod";

export const themeModeSchema = z.enum(["light", "dark", "system"]);
export type ThemeMode = z.infer<typeof themeModeSchema>;

export const themePresetIdSchema = z.enum(["midnight", "aurora", "graphite", "porcelain"]);
export type ThemePresetId = z.infer<typeof themePresetIdSchema>;

export const THEME_PRESET_IDS = themePresetIdSchema.options;

export const THEME_PRESET_META = [
  {
    id: "midnight" as const,
    name: "Dashora Midnight",
    description: "Teal accents on cool charcoal surfaces.",
  },
  { id: "aurora" as const, name: "Aurora", description: "Deep navy with luminous cyan and mint." },
  {
    id: "graphite" as const,
    name: "Graphite",
    description: "Neutral zinc surfaces with restrained contrast.",
  },
  {
    id: "porcelain" as const,
    name: "Porcelain",
    description: "Soft warm-neutral light with muted sage.",
  },
] as const;

export const themeAccentIdSchema = z.enum([
  "teal",
  "sky",
  "emerald",
  "amber",
  "rose",
  "violet",
  "slate",
  "custom",
]);
export type ThemeAccentId = z.infer<typeof themeAccentIdSchema>;

export const THEME_ACCENT_IDS = themeAccentIdSchema.options;

export const themeDensitySchema = z.enum(["comfortable", "compact", "dense"]);
export type ThemeDensity = z.infer<typeof themeDensitySchema>;

export const cardRadiusSchema = z.enum(["sharp", "soft", "rounded"]);
export type CardRadius = z.infer<typeof cardRadiusSchema>;

const hexColorSchema = z
  .string()
  .trim()
  .regex(/^#[0-9A-Fa-f]{6}$/, "Accent must be a hex color like #3B82F6");

/** Rough cap ~180KB for a data-URL logo (self-hosted, no object storage). */
export const MAX_LOGO_DATA_URL_LENGTH = 180_000;

const logoDataUrlSchema = z
  .string()
  .max(MAX_LOGO_DATA_URL_LENGTH, "Logo image is too large")
  .regex(
    /^data:image\/(png|jpeg|jpg|webp|svg\+xml);base64,/i,
    "Logo must be a PNG, JPEG, WebP, or SVG data URL",
  );

const appNameSchema = z.string().trim().min(1).max(40);

export const themePreferencesSchema = z
  .object({
    mode: themeModeSchema,
    preset: themePresetIdSchema,
    accent: themeAccentIdSchema,
    accentCustom: hexColorSchema.nullable().optional(),
    density: themeDensitySchema,
    reducedTransparency: z.boolean(),
    reducedMotion: z.boolean(),
    cardRadius: cardRadiusSchema,
    ambientBackground: z.boolean(),
    appName: appNameSchema.nullable().optional(),
    logoDataUrl: logoDataUrlSchema.nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.accent === "custom" && !value.accentCustom) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Custom accent requires accentCustom",
        path: ["accentCustom"],
      });
    }
  });

export type ThemePreferences = z.infer<typeof themePreferencesSchema>;

export const dashboardThemeOverrideSchema = z
  .object({
    mode: themeModeSchema.optional(),
    preset: themePresetIdSchema.optional(),
    accent: themeAccentIdSchema.optional(),
    accentCustom: hexColorSchema.nullable().optional(),
    density: themeDensitySchema.optional(),
    reducedTransparency: z.boolean().optional(),
    reducedMotion: z.boolean().optional(),
    cardRadius: cardRadiusSchema.optional(),
    ambientBackground: z.boolean().optional(),
    appName: appNameSchema.nullable().optional(),
    logoDataUrl: logoDataUrlSchema.nullable().optional(),
  })
  .strict();

export type DashboardThemeOverride = z.infer<typeof dashboardThemeOverrideSchema>;

export const DEFAULT_THEME_PREFERENCES: ThemePreferences = {
  mode: "system",
  preset: "midnight",
  accent: "teal",
  accentCustom: null,
  density: "comfortable",
  reducedTransparency: false,
  reducedMotion: false,
  cardRadius: "soft",
  ambientBackground: true,
  appName: null,
  logoDataUrl: null,
};

export function mergeThemePreferences(
  base: ThemePreferences,
  override?: DashboardThemeOverride | null,
): ThemePreferences {
  if (!override) {
    return base;
  }
  return themePreferencesSchema.parse({
    ...base,
    ...override,
    accentCustom:
      override.accentCustom !== undefined
        ? override.accentCustom
        : override.accent === "custom"
          ? base.accentCustom
          : override.accent !== undefined
            ? null
            : base.accentCustom,
    appName: override.appName !== undefined ? override.appName : base.appName,
    logoDataUrl: override.logoDataUrl !== undefined ? override.logoDataUrl : base.logoDataUrl,
  });
}

export const themePreferencesResponseSchema = z.object({
  preferences: themePreferencesSchema,
});

export type ThemePreferencesResponse = z.infer<typeof themePreferencesResponseSchema>;

export const updateThemePreferencesRequestSchema = themePreferencesSchema;
export type UpdateThemePreferencesRequest = ThemePreferences;

export const resetThemePreferencesResponseSchema = z.object({
  preferences: themePreferencesSchema,
});

export type ResetThemePreferencesResponse = z.infer<typeof resetThemePreferencesResponseSchema>;

export const updateDashboardThemeRequestSchema = z.object({
  themeOverride: dashboardThemeOverrideSchema.nullable(),
});

export type UpdateDashboardThemeRequest = z.infer<typeof updateDashboardThemeRequestSchema>;

export const dashboardThemeResponseSchema = z.object({
  themeOverride: dashboardThemeOverrideSchema.nullable(),
});

export type DashboardThemeResponse = z.infer<typeof dashboardThemeResponseSchema>;

/** Parse stored JSON into preferences, falling back to defaults for unknown shapes. */
export function parseStoredThemePreferences(value: unknown): ThemePreferences {
  if (value === "light" || value === "dark" || value === "system") {
    return { ...DEFAULT_THEME_PREFERENCES, mode: value };
  }
  if (typeof value === "object" && value !== null && "mode" in value) {
    const modeOnly = (value as { mode?: unknown }).mode;
    if (
      (modeOnly === "light" || modeOnly === "dark" || modeOnly === "system") &&
      Object.keys(value as object).length === 1
    ) {
      return { ...DEFAULT_THEME_PREFERENCES, mode: modeOnly };
    }
  }
  const parsed = themePreferencesSchema.safeParse(value);
  if (parsed.success) {
    return parsed.data;
  }
  return { ...DEFAULT_THEME_PREFERENCES };
}

export function parseStoredDashboardThemeOverride(value: unknown): DashboardThemeOverride | null {
  if (value === null || value === undefined) {
    return null;
  }
  const parsed = dashboardThemeOverrideSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

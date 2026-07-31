import type { ThemePreferences } from "@dashora/shared";
import { resolveAccentTokens } from "./accents.js";
import { getPresetTokens } from "./presets.js";
import type { ResolvedTheme, SemanticColorTokens } from "./types.js";

const COLOR_VAR_MAP: Record<keyof SemanticColorTokens, string> = {
  canvas: "--ds-canvas",
  canvasAmbient: "--ds-canvas-ambient",
  surface1: "--ds-surface-1",
  surface2: "--ds-surface-2",
  surface3: "--ds-surface-3",
  fg: "--ds-fg",
  fgMuted: "--ds-fg-muted",
  fgSubtle: "--ds-fg-subtle",
  border: "--ds-border",
  borderStrong: "--ds-border-strong",
  primary: "--ds-primary",
  primaryHover: "--ds-primary-hover",
  primaryFg: "--ds-primary-fg",
  primaryMuted: "--ds-primary-muted",
  secondary: "--ds-secondary",
  secondaryHover: "--ds-secondary-hover",
  secondaryFg: "--ds-secondary-fg",
  secondaryMuted: "--ds-secondary-muted",
  focus: "--ds-focus",
  danger: "--ds-danger",
  dangerMuted: "--ds-danger-muted",
  success: "--ds-success",
  successMuted: "--ds-success-muted",
  warning: "--ds-warning",
  warningMuted: "--ds-warning-muted",
  overlay: "--ds-overlay",
  shadowXs: "--ds-shadow-xs",
  shadowSm: "--ds-shadow-sm",
  shadowMd: "--ds-shadow-md",
};

function setFlag(el: HTMLElement, name: string, enabled: boolean): void {
  if (enabled) {
    el.dataset[name] = "true";
  } else {
    delete el.dataset[name];
  }
}

export function resolveThemeMode(
  mode: ThemePreferences["mode"],
  systemTheme: ResolvedTheme,
): ResolvedTheme {
  return mode === "system" ? systemTheme : mode;
}

export function buildAppearanceTokens(
  preferences: ThemePreferences,
  resolved: ResolvedTheme,
): SemanticColorTokens {
  const base = getPresetTokens(preferences.preset, resolved);
  const accent = resolveAccentTokens(preferences.accent, resolved, preferences.accentCustom);
  return {
    ...base,
    ...accent,
  };
}

export function applyThemeAppearance(
  preferences: ThemePreferences,
  resolved: ResolvedTheme,
  target: HTMLElement = document.documentElement,
): void {
  const tokens = buildAppearanceTokens(preferences, resolved);

  target.dataset["theme"] = resolved;
  target.dataset["preset"] = preferences.preset;
  target.dataset["density"] = preferences.density;
  target.dataset["cardRadius"] = preferences.cardRadius;
  target.style.colorScheme = resolved;

  setFlag(target, "reducedTransparency", preferences.reducedTransparency);
  setFlag(target, "reducedMotion", preferences.reducedMotion);
  setFlag(target, "ambient", preferences.ambientBackground);

  for (const [key, cssVar] of Object.entries(COLOR_VAR_MAP) as Array<
    [keyof SemanticColorTokens, string]
  >) {
    target.style.setProperty(cssVar, tokens[key]);
  }

  target.style.setProperty("--ds-shadow-focus", "0 0 0 3px var(--ds-primary-muted)");
}

import {
  DEFAULT_THEME_PREFERENCES,
  type DashboardThemeOverride,
  type ThemeMode,
  type ThemePreferences,
  mergeThemePreferences,
  parseStoredThemePreferences,
  themePreferencesSchema,
} from "@dashora/shared";
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { applyThemeAppearance, resolveThemeMode } from "./theme/apply-appearance.js";
import type { ResolvedTheme } from "./theme/types.js";

export type ThemeBranding = {
  appName: string | null;
  logoDataUrl: string | null;
};

type ThemeContextValue = {
  mode: ThemeMode;
  resolved: ResolvedTheme;
  preferences: ThemePreferences;
  effectivePreferences: ThemePreferences;
  preview: DashboardThemeOverride | null;
  dashboardOverride: DashboardThemeOverride | null;
  branding: ThemeBranding;
  setMode: (mode: ThemeMode) => void;
  setPreferences: (preferences: ThemePreferences) => void;
  patchPreferences: (patch: DashboardThemeOverride) => void;
  setPreview: (preview: DashboardThemeOverride | null) => void;
  clearPreview: () => void;
  setDashboardOverride: (override: DashboardThemeOverride | null) => void;
  toggle: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = "dashora-theme";

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "dark";
  }
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function readStoredPreferences(fallback: ThemePreferences): ThemePreferences {
  if (typeof window === "undefined") {
    return fallback;
  }
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return fallback;
    }
    if (stored === "light" || stored === "dark" || stored === "system") {
      return { ...fallback, mode: stored };
    }
    return parseStoredThemePreferences(JSON.parse(stored) as unknown);
  } catch {
    return fallback;
  }
}

function writeStoredPreferences(preferences: ThemePreferences): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
}

export type ThemeProviderProps = {
  children: ReactNode;
  defaultMode?: ThemeMode;
  /** Controlled preferences from the server (optional). */
  preferences?: ThemePreferences;
  onPreferencesChange?: (preferences: ThemePreferences) => void;
};

export function ThemeProvider({
  children,
  defaultMode = "system",
  preferences: controlledPreferences,
  onPreferencesChange,
}: ThemeProviderProps) {
  const defaults = useMemo(
    () => ({ ...DEFAULT_THEME_PREFERENCES, mode: defaultMode }),
    [defaultMode],
  );

  const [internalPreferences, setInternalPreferences] = useState<ThemePreferences>(() =>
    readStoredPreferences(defaults),
  );
  const [preview, setPreviewState] = useState<DashboardThemeOverride | null>(null);
  const [dashboardOverride, setDashboardOverrideState] = useState<DashboardThemeOverride | null>(
    null,
  );

  const preferences = controlledPreferences ?? internalPreferences;

  const effectivePreferences = useMemo(() => {
    const withDashboard = mergeThemePreferences(preferences, dashboardOverride);
    return mergeThemePreferences(withDashboard, preview);
  }, [preferences, dashboardOverride, preview]);

  const [resolved, setResolved] = useState<ResolvedTheme>(() =>
    resolveThemeMode(effectivePreferences.mode, getSystemTheme()),
  );

  useEffect(() => {
    if (controlledPreferences) {
      setInternalPreferences(controlledPreferences);
      writeStoredPreferences(controlledPreferences);
    }
  }, [controlledPreferences]);

  useEffect(() => {
    const next = resolveThemeMode(effectivePreferences.mode, getSystemTheme());
    setResolved(next);
    applyThemeAppearance(effectivePreferences, next);
    if (!controlledPreferences) {
      writeStoredPreferences(preferences);
    }
  }, [effectivePreferences, preferences, controlledPreferences]);

  useEffect(() => {
    if (effectivePreferences.mode !== "system") {
      return;
    }
    const media = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => {
      const next = getSystemTheme();
      setResolved(next);
      applyThemeAppearance(effectivePreferences, next);
    };
    media.addEventListener("change", onChange);
    return () => {
      media.removeEventListener("change", onChange);
    };
  }, [effectivePreferences]);

  const commitPreferences = useCallback(
    (next: ThemePreferences) => {
      const parsed = themePreferencesSchema.parse(next);
      setInternalPreferences(parsed);
      writeStoredPreferences(parsed);
      onPreferencesChange?.(parsed);
    },
    [onPreferencesChange],
  );

  const setMode = useCallback(
    (mode: ThemeMode) => {
      commitPreferences({ ...preferences, mode });
    },
    [commitPreferences, preferences],
  );

  const setPreferences = useCallback(
    (next: ThemePreferences) => {
      commitPreferences(next);
    },
    [commitPreferences],
  );

  const patchPreferences = useCallback(
    (patch: DashboardThemeOverride) => {
      commitPreferences(mergeThemePreferences(preferences, patch));
    },
    [commitPreferences, preferences],
  );

  const setPreview = useCallback((next: DashboardThemeOverride | null) => {
    setPreviewState(next);
  }, []);

  const clearPreview = useCallback(() => {
    setPreviewState(null);
  }, []);

  const setDashboardOverride = useCallback((override: DashboardThemeOverride | null) => {
    setDashboardOverrideState(override);
  }, []);

  const toggle = useCallback(() => {
    const active = resolveThemeMode(preferences.mode, getSystemTheme());
    commitPreferences({ ...preferences, mode: active === "dark" ? "light" : "dark" });
  }, [commitPreferences, preferences]);

  const branding = useMemo<ThemeBranding>(
    () => ({
      appName: effectivePreferences.appName ?? null,
      logoDataUrl: effectivePreferences.logoDataUrl ?? null,
    }),
    [effectivePreferences.appName, effectivePreferences.logoDataUrl],
  );

  const value = useMemo(
    () => ({
      mode: preferences.mode,
      resolved,
      preferences,
      effectivePreferences,
      preview,
      dashboardOverride,
      branding,
      setMode,
      setPreferences,
      patchPreferences,
      setPreview,
      clearPreview,
      setDashboardOverride,
      toggle,
    }),
    [
      preferences,
      resolved,
      effectivePreferences,
      preview,
      dashboardOverride,
      branding,
      setMode,
      setPreferences,
      patchPreferences,
      setPreview,
      clearPreview,
      setDashboardOverride,
      toggle,
    ],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}

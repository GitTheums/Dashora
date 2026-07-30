import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ThemeMode } from "./tokens/index.js";

export type ResolvedTheme = "light" | "dark";

type ThemeContextValue = {
  mode: ThemeMode;
  resolved: ResolvedTheme;
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = "dashora-theme";

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") {
    return "dark";
  }
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function readStoredMode(): ThemeMode {
  if (typeof window === "undefined") {
    return "system";
  }
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark" || stored === "system") {
    return stored;
  }
  return "system";
}

function resolveMode(mode: ThemeMode): ResolvedTheme {
  return mode === "system" ? getSystemTheme() : mode;
}

function applyTheme(resolved: ResolvedTheme): void {
  document.documentElement.dataset["theme"] = resolved;
  document.documentElement.style.colorScheme = resolved;
}

export type ThemeProviderProps = {
  children: ReactNode;
  defaultMode?: ThemeMode;
};

export function ThemeProvider({ children, defaultMode = "system" }: ThemeProviderProps) {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    const stored = readStoredMode();
    return stored === "system" ? defaultMode : stored;
  });
  const [resolved, setResolved] = useState<ResolvedTheme>(() => resolveMode(mode));

  useEffect(() => {
    const next = resolveMode(mode);
    setResolved(next);
    applyTheme(next);
    window.localStorage.setItem(STORAGE_KEY, mode);
  }, [mode]);

  useEffect(() => {
    if (mode !== "system") {
      return;
    }

    const media = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => {
      const next = getSystemTheme();
      setResolved(next);
      applyTheme(next);
    };
    media.addEventListener("change", onChange);
    return () => {
      media.removeEventListener("change", onChange);
    };
  }, [mode]);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
  }, []);

  const toggle = useCallback(() => {
    setModeState((current) => {
      const active = resolveMode(current);
      return active === "dark" ? "light" : "dark";
    });
  }, []);

  const value = useMemo(
    () => ({ mode, resolved, setMode, toggle }),
    [mode, resolved, setMode, toggle],
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

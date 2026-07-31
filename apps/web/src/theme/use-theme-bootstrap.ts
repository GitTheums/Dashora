import type { ThemePreferences } from "@dashora/shared";
import { useTheme } from "@dashora/ui";
import { useEffect, useState } from "react";
import type { ThemeApi } from "./api.js";

/** Loads durable theme preferences once after authentication and syncs into ThemeProvider. */
export function useThemeBootstrap(api: ThemeApi): {
  ready: boolean;
  error: string | null;
} {
  const { setPreferences } = useTheme();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const preferences: ThemePreferences = await api.getPreferences();
        if (cancelled) {
          return;
        }
        setPreferences(preferences);
        setReady(true);
      } catch (err) {
        if (cancelled) {
          return;
        }
        setError(err instanceof Error ? err.message : "Failed to load theme preferences");
        // Keep local/cached theme and continue into the app.
        setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [api, setPreferences]);

  return { ready, error };
}

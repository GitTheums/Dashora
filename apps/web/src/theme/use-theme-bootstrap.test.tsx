import { DEFAULT_THEME_PREFERENCES, type ThemePreferences } from "@dashora/shared";
import { ThemeProvider } from "@dashora/ui";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ThemeApi } from "./api.js";
import { useThemeBootstrap } from "./use-theme-bootstrap.js";

afterEach(() => {
  cleanup();
});

function Probe({ api }: { api: ThemeApi }) {
  const { ready, error } = useThemeBootstrap(api);
  if (!ready) {
    return <div>loading</div>;
  }
  return <div>{error ? `error:${error}` : "ready"}</div>;
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("useThemeBootstrap", () => {
  it("becomes ready after preferences load (including StrictMode remount)", async () => {
    const deferred = createDeferred<ThemePreferences>();
    const api: ThemeApi = {
      getPreferences: vi.fn(() => deferred.promise),
      savePreferences: vi.fn(async (preferences) => preferences),
      resetPreferences: vi.fn(async () => DEFAULT_THEME_PREFERENCES),
      updateDashboardTheme: vi.fn(async (override) => override),
    };

    render(
      <ThemeProvider>
        <Probe api={api} />
      </ThemeProvider>,
    );

    expect(screen.getByText("loading")).toBeTruthy();
    deferred.resolve(DEFAULT_THEME_PREFERENCES);

    await waitFor(() => {
      expect(screen.getByText("ready")).toBeTruthy();
    });
    expect(api.getPreferences).toHaveBeenCalled();
  });

  it("still becomes ready when the API fails", async () => {
    const api: ThemeApi = {
      getPreferences: vi.fn(async () => {
        throw new Error("offline");
      }),
      savePreferences: vi.fn(async (preferences) => preferences),
      resetPreferences: vi.fn(async () => DEFAULT_THEME_PREFERENCES),
      updateDashboardTheme: vi.fn(async (override) => override),
    };

    render(
      <ThemeProvider>
        <Probe api={api} />
      </ThemeProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("error:offline")).toBeTruthy();
    });
  });
});

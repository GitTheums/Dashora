import { DEFAULT_THEME_PREFERENCES, type ThemePreferences } from "@dashora/shared";
import { ThemeProvider } from "@dashora/ui";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { ThemeApi } from "./api.js";
import { AppearancePage } from "./appearance-page.js";

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: query.includes("light"),
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
});

afterEach(() => {
  cleanup();
});

function createMockApi(initial: ThemePreferences = DEFAULT_THEME_PREFERENCES): ThemeApi {
  let current = structuredClone(initial);
  return {
    getPreferences: vi.fn(async () => structuredClone(current)),
    savePreferences: vi.fn(async (preferences) => {
      current = structuredClone(preferences);
      return structuredClone(current);
    }),
    resetPreferences: vi.fn(async () => {
      current = structuredClone(DEFAULT_THEME_PREFERENCES);
      return structuredClone(current);
    }),
    updateDashboardTheme: vi.fn(async (themeOverride) => themeOverride),
  };
}

describe("AppearancePage", () => {
  it("renders presets and previews a selection", () => {
    const api = createMockApi();

    render(
      <ThemeProvider>
        <AppearancePage
          api={api}
          dashboardOverride={null}
          onDashboardOverrideChange={() => undefined}
          envAppName="Dashora"
        />
      </ThemeProvider>,
    );

    expect(screen.getByRole("heading", { name: "Appearance" })).toBeTruthy();
    expect(screen.getByRole("radiogroup", { name: "Apply appearance to" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Aurora" }));
    expect(document.documentElement.dataset["preset"]).toBe("aurora");
  });

  it("saves global preferences without writing a dashboard override", async () => {
    const api = createMockApi();
    const onDashboardOverrideChange = vi.fn();

    render(
      <ThemeProvider>
        <AppearancePage
          api={api}
          dashboardOverride={null}
          onDashboardOverrideChange={onDashboardOverrideChange}
          envAppName="Dashora"
        />
      </ThemeProvider>,
    );

    fireEvent.click(screen.getByRole("radio", { name: "All dashboards" }));
    fireEvent.click(screen.getByRole("button", { name: "Porcelain" }));
    fireEvent.click(screen.getByRole("button", { name: "Save globally" }));

    await waitFor(() => {
      expect(api.savePreferences).toHaveBeenCalled();
    });
    expect(api.updateDashboardTheme).not.toHaveBeenCalled();
    const saved = vi.mocked(api.savePreferences).mock.calls[0]?.[0];
    expect(saved?.preset).toBe("porcelain");
  });

  it("saves dashboard override without overwriting global preferences", async () => {
    const api = createMockApi();
    const onDashboardOverrideChange = vi.fn();

    render(
      <ThemeProvider>
        <AppearancePage
          api={api}
          dashboardOverride={null}
          onDashboardOverrideChange={onDashboardOverrideChange}
          envAppName="Dashora"
        />
      </ThemeProvider>,
    );

    fireEvent.click(screen.getByRole("radio", { name: "Current dashboard only" }));
    fireEvent.click(screen.getByRole("button", { name: "Graphite" }));
    fireEvent.click(screen.getByRole("button", { name: "Save for dashboard" }));

    await waitFor(() => {
      expect(api.updateDashboardTheme).toHaveBeenCalled();
    });
    expect(api.savePreferences).not.toHaveBeenCalled();
    expect(vi.mocked(api.updateDashboardTheme).mock.calls[0]?.[0]).toMatchObject({
      preset: "graphite",
    });
  });

  it("warns before leaving with unsaved changes", async () => {
    const api = createMockApi();
    const onRequestLeave = vi.fn();

    render(
      <ThemeProvider>
        <AppearancePage
          api={api}
          dashboardOverride={null}
          onDashboardOverrideChange={() => undefined}
          envAppName="Dashora"
          onRequestLeave={onRequestLeave}
        />
      </ThemeProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Aurora" }));
    fireEvent.click(screen.getByRole("button", { name: "Back to dashboard" }));

    expect(screen.getByRole("heading", { name: "Discard unsaved changes?" })).toBeTruthy();
    expect(onRequestLeave).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Discard and leave" }));
    await waitFor(() => {
      expect(onRequestLeave).toHaveBeenCalled();
    });
  });

  it("discards preview changes back to persisted preferences", async () => {
    const api = createMockApi({ ...DEFAULT_THEME_PREFERENCES, preset: "midnight" });

    render(
      <ThemeProvider preferences={{ ...DEFAULT_THEME_PREFERENCES, preset: "midnight" }}>
        <AppearancePage
          api={api}
          dashboardOverride={null}
          onDashboardOverrideChange={() => undefined}
          envAppName="Dashora"
        />
      </ThemeProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Aurora" }));
    expect(document.documentElement.dataset["preset"]).toBe("aurora");
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    await waitFor(() => {
      expect(document.documentElement.dataset["preset"]).toBe("midnight");
    });
    expect(api.savePreferences).not.toHaveBeenCalled();
  });

  it("clears a dashboard override with Use global appearance", async () => {
    const api = createMockApi();
    const onDashboardOverrideChange = vi.fn();

    render(
      <ThemeProvider>
        <AppearancePage
          api={api}
          dashboardOverride={{ preset: "graphite" }}
          onDashboardOverrideChange={onDashboardOverrideChange}
          envAppName="Dashora"
        />
      </ThemeProvider>,
    );

    fireEvent.click(screen.getByRole("radio", { name: "Current dashboard only" }));
    fireEvent.click(screen.getByRole("button", { name: "Use global appearance" }));

    await waitFor(() => {
      expect(api.updateDashboardTheme).toHaveBeenCalledWith(null);
    });
    expect(api.savePreferences).not.toHaveBeenCalled();
    expect(onDashboardOverrideChange).toHaveBeenCalledWith(null);
  });
});

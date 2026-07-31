import type { AuthUser } from "@dashora/shared";
import { ThemeProvider } from "@dashora/ui";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMemoryDashboardApi } from "../dashboard/memory-api.js";
import type { AuthApi } from "./api.js";
import { AuthGate } from "./auth-gate.js";

afterEach(() => {
  cleanup();
  window.history.replaceState({}, "", "/");
});

const sampleUser: AuthUser = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "admin@example.com",
  displayName: "Admin",
};

function renderGate(api: AuthApi) {
  return render(
    <ThemeProvider defaultMode="light">
      <AuthGate
        appName="Dashora"
        apiBaseUrl=""
        api={api}
        dashboardApi={createMemoryDashboardApi()}
      />
    </ThemeProvider>,
  );
}

function createMockApi(overrides: Partial<AuthApi> = {}): AuthApi {
  return {
    getStatus: vi.fn(async () => ({ setupRequired: false })),
    getMe: vi.fn(async () => null),
    ensureCsrf: vi.fn(async () => "csrf"),
    setup: vi.fn(async () => sampleUser),
    login: vi.fn(async () => sampleUser),
    logout: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe("AuthGate", () => {
  it("routes unauthenticated users to the login screen", async () => {
    renderGate(createMockApi());

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Sign in to Dashora" })).toBeTruthy();
    });
    expect(window.location.pathname).toBe("/login");
  });

  it("routes first-run to setup when no users exist", async () => {
    renderGate(
      createMockApi({
        getStatus: vi.fn(async () => ({ setupRequired: true })),
      }),
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Setup token required" })).toBeTruthy();
    });
    expect(window.location.pathname).toBe("/setup");
  });

  it("renders the dashboard for authenticated sessions", async () => {
    renderGate(
      createMockApi({
        getMe: vi.fn(async () => sampleUser),
      }),
    );

    await waitFor(() => {
      expect(screen.getByRole("link", { name: "Dashora home" })).toBeTruthy();
    });
    expect(screen.queryByText(/Signed in as/i)).toBeNull();
    expect(screen.queryByRole("button", { name: "Sign out" })).toBeNull();
    expect(screen.getByRole("button", { name: "Settings" })).toBeTruthy();
    expect(
      screen
        .getByRole("navigation", { name: "Dashboard pages" })
        .closest(".app-header__nav-sticky"),
    ).toBeTruthy();
  });

  it("exposes account details and sign out under Settings", async () => {
    window.history.replaceState({}, "", "/settings/account");
    renderGate(
      createMockApi({
        getMe: vi.fn(async () => sampleUser),
      }),
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Account" })).toBeTruthy();
    });
    expect(screen.getByText("Admin")).toBeTruthy();
    expect(screen.getByText("admin@example.com")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Account" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("button", { name: "Sign out" })).toBeTruthy();
  });

  it("shows a signed-out unreachable state when the API is down", async () => {
    renderGate(
      createMockApi({
        getStatus: vi.fn(async () => {
          throw new Error("network");
        }),
      }),
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Server unreachable" })).toBeTruthy();
    });
    expect(screen.getByText("Signed out")).toBeTruthy();
  });
});

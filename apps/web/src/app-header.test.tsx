import { ThemeProvider } from "@dashora/ui";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "./app.js";
import { createMemoryDashboardApi } from "./dashboard/memory-api.js";

afterEach(() => {
  cleanup();
  window.history.replaceState({}, "", "/");
});

describe("App header stacking", () => {
  it("renders sticky navigation without a separate account utility row", async () => {
    const { container } = render(
      <ThemeProvider defaultMode="dark">
        <App appName="Dashora" dashboardApi={createMemoryDashboardApi()} />
      </ThemeProvider>,
    );

    await screen.findByRole("navigation", { name: "Dashboard pages" });

    const sticky = container.querySelector("header.app-header__nav-sticky");
    expect(container.querySelector(".app-header__session")).toBeNull();
    expect(screen.queryByText(/Signed in as/i)).toBeNull();
    expect(screen.queryByRole("button", { name: "Sign out" })).toBeNull();
    expect(sticky?.querySelector(".top-nav")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Settings" })).toBeTruthy();
    expect(
      screen
        .getByRole("navigation", { name: "Dashboard pages" })
        .closest(".app-header__nav-sticky"),
    ).toBeTruthy();
  });

  it("keeps sticky navigation available for the dashboard shell", async () => {
    const { container } = render(
      <ThemeProvider defaultMode="light">
        <App appName="Dashora" dashboardApi={createMemoryDashboardApi()} />
      </ThemeProvider>,
    );

    await waitFor(() => {
      expect(container.querySelector("header.app-header__nav-sticky")).toBeTruthy();
    });
    expect(await screen.findByRole("navigation", { name: "Dashboard pages" })).toBeTruthy();
  });
});

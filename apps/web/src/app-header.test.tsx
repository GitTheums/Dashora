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
  it("keeps the account row in normal flow and navigation in the sticky container", async () => {
    const { container } = render(
      <ThemeProvider defaultMode="dark">
        <App
          appName="Dashora"
          dashboardApi={createMemoryDashboardApi()}
          session={{
            displayName: "Thom",
            onSignOut: () => undefined,
          }}
        />
      </ThemeProvider>,
    );

    await screen.findByRole("navigation", { name: "Dashboard pages" });

    const sticky = container.querySelector("header.app-header__nav-sticky");
    expect(container.querySelector(".app-header__session")).toBeTruthy();
    expect(sticky?.querySelector(".top-nav")).toBeTruthy();
    expect(screen.getByText("Signed in as Thom").closest(".app-header__session")).toBeTruthy();
    expect(screen.getByText("Signed in as Thom").closest(".app-header__nav-sticky")).toBeNull();
    expect(
      screen
        .getByRole("navigation", { name: "Dashboard pages" })
        .closest(".app-header__nav-sticky"),
    ).toBeTruthy();

    const content = container.querySelector("main.dash-shell__content");
    expect(content?.contains(screen.getByText("Signed in as Thom"))).toBe(false);
  });

  it("renders without a session row when unauthenticated shell props are used", async () => {
    const { container } = render(
      <ThemeProvider defaultMode="light">
        <App appName="Dashora" dashboardApi={createMemoryDashboardApi()} />
      </ThemeProvider>,
    );

    await waitFor(() => {
      expect(container.querySelector("header.app-header__nav-sticky")).toBeTruthy();
    });
    expect(container.querySelector(".app-header__session")).toBeNull();
    expect(await screen.findByRole("navigation", { name: "Dashboard pages" })).toBeTruthy();
  });
});

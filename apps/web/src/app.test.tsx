import { ThemeProvider } from "@dashora/ui";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "./app.js";
import { createMemoryDashboardApi } from "./dashboard/memory-api.js";

afterEach(() => {
  cleanup();
  window.history.replaceState({}, "", "/");
});

function renderApp() {
  return render(
    <ThemeProvider defaultMode="dark">
      <App appName="Dashora" dashboardApi={createMemoryDashboardApi()} />
    </ThemeProvider>,
  );
}

describe("App dashboard shell", () => {
  it("renders the floating navigation and home widgets", async () => {
    renderApp();

    expect(await screen.findByRole("link", { name: "Dashora home" })).toBeTruthy();
    expect(await screen.findByRole("navigation", { name: "Dashboard pages" })).toBeTruthy();
    expect(await screen.findByRole("heading", { level: 1, name: "Home" })).toBeTruthy();
    expect(await screen.findByRole("heading", { name: "Weather" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Calendar" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Feed" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Status" })).toBeTruthy();
  });

  it("switches pages from the top navigation and updates the URL slug", async () => {
    renderApp();

    const nav = await screen.findByRole("navigation", { name: "Dashboard pages" });
    fireEvent.click(within(nav).getByRole("button", { name: /Markets/i }));
    expect(await screen.findByRole("heading", { level: 1, name: "Markets" })).toBeTruthy();
    expect(await screen.findByRole("heading", { name: "Weather" })).toBeTruthy();
    await waitFor(() => {
      expect(window.location.pathname).toBe("/markets");
    });
  });

  it("toggles edit mode with layout editing affordances", async () => {
    renderApp();

    await screen.findByRole("heading", { level: 1, name: "Home" });
    fireEvent.click(screen.getByRole("button", { name: "Edit dashboard" }));
    expect(screen.getByText(/Edit mode — drag handles move widgets/i)).toBeTruthy();
    expect(await screen.findByRole("toolbar", { name: "Layout editing" })).toBeTruthy();
  });
});

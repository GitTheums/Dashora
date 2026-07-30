import { DEFAULT_DASHBOARD_PAGES } from "@dashora/shared";
import { ThemeProvider } from "@dashora/ui";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DashboardApi } from "./api.js";
import { DashboardApiError } from "./api.js";
import { DashboardPage } from "./dashboard-page.js";
import { createMemoryDashboardApi } from "./memory-api.js";

afterEach(() => {
  cleanup();
  window.history.replaceState({}, "", "/");
});

function renderDashboard(api?: DashboardApi) {
  return render(
    <ThemeProvider defaultMode="dark">
      <DashboardPage appName="Dashora" api={api ?? createMemoryDashboardApi()} />
    </ThemeProvider>,
  );
}

describe("persistent dashboard pages", () => {
  it("loads default pages into navigation", async () => {
    renderDashboard();
    const nav = await screen.findByRole("navigation", { name: "Dashboard pages" });
    for (const page of DEFAULT_DASHBOARD_PAGES) {
      expect(within(nav).getByRole("button", { name: page.name })).toBeTruthy();
    }
  });

  it("creates a page and routes to its slug", async () => {
    renderDashboard();
    await screen.findByRole("heading", { level: 1, name: "Home" });

    fireEvent.click(screen.getByRole("button", { name: "Edit dashboard" }));
    fireEvent.click(screen.getByRole("button", { name: "Add page" }));

    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Name"), { target: { value: "Ops" } });
    fireEvent.change(within(dialog).getByLabelText("Slug"), { target: { value: "ops" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Create" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Ops" })).toBeTruthy();
    await waitFor(() => {
      expect(window.location.pathname).toBe("/ops");
    });
  });

  it("opens the page actions menu without leaving the current page", async () => {
    renderDashboard();
    await screen.findByRole("heading", { level: 1, name: "Home" });
    fireEvent.click(screen.getByRole("button", { name: "Edit dashboard" }));

    const nav = screen.getByRole("navigation", { name: "Dashboard pages" });
    const homeWrap = within(nav)
      .getByRole("button", { name: "Home" })
      .closest(".top-nav__page-wrap");
    expect(homeWrap).toBeTruthy();
    fireEvent.click(
      within(homeWrap as HTMLElement).getByRole("button", { name: "Page actions for Home" }),
    );

    const menu = await screen.findByRole("menu");
    expect(within(menu).getByRole("menuitem", { name: "Rename page" })).toBeTruthy();
    expect(within(menu).getByRole("menuitem", { name: "Duplicate page" })).toBeTruthy();
    expect(within(menu).getByRole("menuitem", { name: "Move left" })).toHaveProperty(
      "disabled",
      true,
    );
    expect(within(menu).getByRole("menuitem", { name: "Move right" })).toHaveProperty(
      "disabled",
      false,
    );
    expect(within(menu).getByRole("menuitem", { name: "Delete page" })).toHaveProperty(
      "disabled",
      false,
    );
    expect(window.location.pathname === "/" || window.location.pathname === "/home").toBe(true);
    expect(screen.getByRole("heading", { level: 1, name: "Home" })).toBeTruthy();
  });

  it("rolls back optimistic delete when the API fails", async () => {
    const base = createMemoryDashboardApi();
    const api: DashboardApi = {
      ...base,
      deletePage: vi.fn(async () => {
        throw new DashboardApiError(500, "server_error", "Boom");
      }),
    };
    renderDashboard(api);

    await screen.findByRole("heading", { level: 1, name: "Home" });
    fireEvent.click(screen.getByRole("button", { name: "Edit dashboard" }));

    const nav = screen.getByRole("navigation", { name: "Dashboard pages" });
    const marketsWrap = within(nav)
      .getByRole("button", { name: "Markets" })
      .closest(".top-nav__page-wrap");
    expect(marketsWrap).toBeTruthy();
    fireEvent.click(
      within(marketsWrap as HTMLElement).getByRole("button", {
        name: "Page actions for Markets",
      }),
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete page" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(await screen.findByText(/Boom|Could not delete/i)).toBeTruthy();
    expect(within(nav).getByRole("button", { name: "Markets" })).toBeTruthy();
  });
});

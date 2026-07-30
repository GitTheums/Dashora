import { ThemeProvider } from "@dashora/ui";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DashboardPage } from "./dashboard-page.js";
import { createMemoryDashboardApi } from "./memory-api.js";

afterEach(() => {
  cleanup();
  window.history.replaceState({}, "", "/");
});

function renderDashboard() {
  return render(
    <ThemeProvider defaultMode="dark">
      <DashboardPage appName="Dashora" api={createMemoryDashboardApi()} />
    </ThemeProvider>,
  );
}

describe("view vs edit mode widget controls", () => {
  it("keeps a visually hidden live region without announcing on initial load", async () => {
    renderDashboard();
    await screen.findByRole("heading", { level: 1, name: "Home" });

    const announcer = screen.getByTestId("edit-mode-announcer");
    expect(announcer.tagName).toBe("OUTPUT");
    expect(announcer.getAttribute("aria-live")).toBe("polite");
    expect(announcer.getAttribute("aria-atomic")).toBe("true");
    expect(announcer.classList.contains("visually-hidden")).toBe(true);
    expect(announcer.textContent?.trim()).toBe("");
    expect(screen.queryByText(/Dashboard edit mode enabled/i)).toBeNull();
    expect(screen.queryByText(/Dashboard edit mode disabled/i)).toBeNull();
  });

  it("hides Add widget and ellipsis menus in View mode while keeping refresh", async () => {
    renderDashboard();
    await screen.findByRole("heading", { level: 1, name: "Home" });
    await screen.findByLabelText(/Weather widget/i);

    expect(screen.queryByRole("button", { name: "Add widget" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Weather actions/i })).toBeNull();
    expect(screen.queryByLabelText(/Drag Weather/i)).toBeNull();
    expect(screen.getByRole("button", { name: /Refresh Weather/i })).toBeTruthy();
    expect(document.querySelector(".dash-layout__toolbar")).toBeNull();
    expect(document.querySelector('[data-edit="true"]')).toBeNull();
    expect(screen.queryByText(/Your dashboard is in view mode\. Use Edit to add/i)).toBeNull();
    expect(document.querySelector(".dash-shell__lede")).toBeNull();
  });

  it("shows Add widget, menus, and drag handles after entering Edit mode", async () => {
    renderDashboard();
    await screen.findByLabelText(/Weather widget/i);

    fireEvent.click(screen.getByRole("button", { name: "Edit dashboard" }));

    expect(await screen.findByRole("button", { name: "Add widget" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Weather actions/i })).toBeTruthy();
    expect(screen.getByLabelText(/Drag Weather/i)).toBeTruthy();
    const announcer = screen.getByTestId("edit-mode-announcer");
    expect(announcer.textContent).toMatch(/Dashboard edit mode enabled/i);
    expect(announcer.classList.contains("visually-hidden")).toBe(true);
    expect(document.querySelector('.dash-layout[data-edit="true"]')).toBeTruthy();
  });

  it("hides edit controls again after Done and closes the catalog", async () => {
    renderDashboard();
    await screen.findByLabelText(/Weather widget/i);

    fireEvent.click(screen.getByRole("button", { name: "Edit dashboard" }));
    fireEvent.click(await screen.findByRole("button", { name: "Add widget" }));
    expect(await screen.findByRole("dialog", { name: "Add widget" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Finish editing dashboard" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Add widget" })).toBeNull();
    });
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Add widget" })).toBeNull();
    });
    expect(screen.queryByRole("button", { name: /Weather actions/i })).toBeNull();
    expect(screen.queryByLabelText(/Drag Weather/i)).toBeNull();
    expect(screen.getByRole("button", { name: /Refresh Weather/i })).toBeTruthy();
    const announcer = screen.getByTestId("edit-mode-announcer");
    expect(announcer.textContent).toMatch(/Dashboard edit mode disabled/i);
    expect(announcer.classList.contains("visually-hidden")).toBe(true);
  });

  it("offers Enter edit mode for configuration-required widgets in View mode", async () => {
    renderDashboard();
    await screen.findByLabelText(/Services widget/i);

    const services = screen.getByLabelText(/Services widget/i);
    expect(within(services).getByText("Configuration required")).toBeTruthy();
    expect(within(services).queryByRole("button", { name: "Configure widget" })).toBeNull();
    const enter = within(services).getByRole("button", { name: "Enter edit mode" });
    fireEvent.click(enter);

    expect(await screen.findByRole("dialog", { name: "Widget settings" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add widget" })).toBeTruthy();
    expect(document.querySelector('.dash-layout[data-edit="true"]')).toBeTruthy();
  });

  it("does not leave hidden action buttons focusable in View mode", async () => {
    renderDashboard();
    await screen.findByLabelText(/Weather widget/i);

    const actionButtons = screen
      .getAllByRole("button")
      .filter((button) => /actions$/i.test(button.getAttribute("aria-label") ?? ""));
    expect(actionButtons).toHaveLength(0);
  });
});

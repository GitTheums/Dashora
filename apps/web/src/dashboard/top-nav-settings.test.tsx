import type { Page } from "@dashora/shared";
import { ThemeProvider } from "@dashora/ui";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import * as routing from "../auth/routing.js";
import { SETTINGS_APPEARANCE_PATH } from "../settings/paths.js";
import { TopNav } from "./top-nav.js";

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
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

const pages: Page[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    dashboardId: "22222222-2222-4222-8222-222222222222",
    name: "Home",
    slug: "home",
    icon: "home",
    accent: null,
    sortOrder: 0,
    createdAt: 1,
    updatedAt: 1,
  },
];

function renderNav(options?: { editMode?: boolean; settingsActive?: boolean }) {
  return render(
    <ThemeProvider>
      <TopNav
        pages={pages}
        activePageId={pages[0]?.id ?? null}
        onPageChange={() => undefined}
        editMode={options?.editMode ?? false}
        onEditModeChange={() => undefined}
        onCreatePage={() => undefined}
        onEditPage={() => undefined}
        onDuplicatePage={() => undefined}
        onDeletePage={() => undefined}
        onMovePage={() => undefined}
        canDeletePages
        returnToPath="/home"
        settingsActive={options?.settingsActive ?? false}
      />
    </ThemeProvider>,
  );
}

describe("TopNav Settings entry", () => {
  it("shows an icon-only Settings control and navigates to appearance", () => {
    const navigateSpy = vi.spyOn(routing, "navigate").mockImplementation(() => undefined);
    renderNav({ editMode: false });

    const settings = screen.getByRole("button", { name: "Settings" });
    expect(settings.getAttribute("aria-label")).toBe("Settings");
    expect(settings.textContent?.trim()).toBe("");
    fireEvent.click(settings);
    expect(navigateSpy).toHaveBeenCalledWith(expect.stringContaining(SETTINGS_APPEARANCE_PATH));
    navigateSpy.mockRestore();
  });

  it("keeps Settings available in edit mode with active state support", () => {
    renderNav({ editMode: true, settingsActive: true });
    const settings = screen.getByRole("button", { name: "Settings" });
    expect(settings.getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("button", { name: "Finish editing dashboard" })).toBeTruthy();
  });

  it("keeps the quick theme toggle independent", () => {
    renderNav();
    expect(screen.getByRole("button", { name: /Switch to (light|dark) theme/ })).toBeTruthy();
  });
});

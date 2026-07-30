import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./dropdown-menu.js";
import { IconButton } from "./icon-button.js";

afterEach(() => {
  cleanup();
});

describe("DropdownMenu", () => {
  it("opens a portaled menu above clipped parents", async () => {
    render(
      <div style={{ overflow: "hidden", height: 24, width: 120 }}>
        <DropdownMenu>
          <DropdownMenuTrigger>
            <IconButton label="Page actions for Home">⋯</IconButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Rename page</DropdownMenuItem>
            <DropdownMenuItem>Duplicate page</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Page actions for Home" }));

    const menu = await screen.findByRole("menu");
    expect(menu).toBeTruthy();
    expect(document.body.contains(menu)).toBe(true);
    expect(within(menu).getByRole("menuitem", { name: "Rename page" })).toBeTruthy();
    expect(menu.className).toContain("ds-dropdown__menu--portal");
    expect(menu.style.position).toBe("fixed");
  });

  it("closes on Escape and restores focus to the trigger", async () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>
          <IconButton label="Page actions for Markets">⋯</IconButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Rename page</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    const trigger = screen.getByRole("button", { name: "Page actions for Markets" });
    fireEvent.click(trigger);
    await screen.findByRole("menu");

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByRole("menu")).toBeNull();
    });
    await waitFor(() => {
      expect(document.activeElement).toBe(trigger);
    });
  });

  it("does not bubble the trigger click to a sibling page control wrapper", () => {
    const onNavigate = vi.fn();
    render(
      <div onClick={onNavigate} onKeyDown={onNavigate} role="presentation">
        <button type="button" onClick={onNavigate}>
          Home
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger>
            <IconButton label="Page actions for Home">⋯</IconButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Rename page</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Page actions for Home" }));
    expect(onNavigate).not.toHaveBeenCalled();
    expect(screen.getByRole("menu")).toBeTruthy();
  });
});

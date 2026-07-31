import type { PageWidget } from "@dashora/shared";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WidgetSettingsDrawer } from "./widget-settings-drawer.js";

const placeholder: PageWidget = {
  kind: "placeholder",
  id: "a1111111-1111-4111-8111-111111111101",
  title: "Weather",
  description: "Local forecast",
  tone: "accent",
  enabled: true,
};

describe("WidgetSettingsDrawer validation", () => {
  afterEach(() => {
    cleanup();
  });

  it("blocks save when the title is empty", async () => {
    const onSave = vi.fn();
    render(
      <WidgetSettingsDrawer
        open
        widget={placeholder}
        onOpenChange={vi.fn()}
        onSave={onSave}
        onDuplicate={vi.fn()}
        onRemove={vi.fn()}
        onResetConfig={vi.fn()}
      />,
    );

    const title = await screen.findByLabelText("Title");
    fireEvent.change(title, { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText(/Title is required/i)).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("rejects refresh intervals below the minimum", async () => {
    const onSave = vi.fn();
    render(
      <WidgetSettingsDrawer
        open
        widget={placeholder}
        onOpenChange={vi.fn()}
        onSave={onSave}
        onDuplicate={vi.fn()}
        onRemove={vi.fn()}
        onResetConfig={vi.fn()}
      />,
    );

    const refresh = await screen.findByLabelText("Refresh interval (seconds)");
    fireEvent.change(refresh, { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText(/Minimum interval/i)).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("saves a valid title change", async () => {
    const onSave = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <WidgetSettingsDrawer
        open
        widget={placeholder}
        onOpenChange={onOpenChange}
        onSave={onSave}
        onDuplicate={vi.fn()}
        onRemove={vi.fn()}
        onResetConfig={vi.fn()}
      />,
    );

    const title = await screen.findByLabelText("Title");
    fireEvent.change(title, { target: { value: "Outdoor weather" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ title: "Outdoor weather" }));
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { type WidgetRuntimeState, WidgetShell } from "./widget-shell.js";

const STATES: WidgetRuntimeState[] = [
  "loading",
  "empty",
  "stale",
  "error",
  "disabled",
  "configuration-required",
  "ready",
];

describe("WidgetShell states", () => {
  afterEach(() => {
    cleanup();
  });

  it.each(STATES)("renders %s state without crashing", (state) => {
    render(
      <WidgetShell title="Weather" state={state}>
        <p>Content</p>
      </WidgetShell>,
    );
    expect(screen.getByRole("heading", { name: "Weather" })).toBeTruthy();
  });

  it("shows loading skeletons with polite busy semantics", () => {
    render(<WidgetShell title="Feed" state="loading" />);
    expect(screen.getByText("Loading")).toBeTruthy();
    expect(document.querySelector('[aria-busy="true"]')).toBeTruthy();
  });

  it("shows empty and error recovery copy", () => {
    const { rerender } = render(<WidgetShell title="Notes" state="empty" />);
    expect(screen.getByText("Nothing here yet")).toBeTruthy();

    rerender(<WidgetShell title="Notes" state="error" />);
    expect(screen.getByText("Could not load data")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
  });

  it("shows setup and disabled messaging", () => {
    const { rerender } = render(<WidgetShell title="API" state="configuration-required" />);
    expect(screen.getByText("Setup")).toBeTruthy();
    expect(screen.getByText("Configuration required")).toBeTruthy();

    rerender(<WidgetShell title="API" state="disabled" />);
    expect(screen.getByText("Widget disabled")).toBeTruthy();
  });

  it("keeps ready children visible with a stale banner when overdue", () => {
    render(
      <WidgetShell title="Markets" state="stale">
        <p>Ticker rows</p>
      </WidgetShell>,
    );
    expect(screen.getByText("Stale")).toBeTruthy();
    expect(screen.getByText("Ticker rows")).toBeTruthy();
  });
});

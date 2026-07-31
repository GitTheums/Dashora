import { cleanup, render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useRef, useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { useFocusTrap } from "./use-focus-trap.js";

function TrapDemo({ open }: { open: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, open);
  return (
    <div>
      <button type="button">Outside</button>
      <div ref={ref} data-testid="trap">
        <button type="button">First</button>
        <button type="button">Second</button>
        <button type="button">Last</button>
      </div>
    </div>
  );
}

function ToggleableTrap() {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <button type="button" onClick={() => setOpen(false)}>
        Close
      </button>
      <TrapDemo open={open} />
    </div>
  );
}

describe("useFocusTrap", () => {
  afterEach(() => {
    cleanup();
  });

  it("moves initial focus into the first focusable control", async () => {
    render(<TrapDemo open />);
    const trap = screen.getByTestId("trap");
    expect(await within(trap).findByRole("button", { name: "First" })).toBe(document.activeElement);
  });

  it("cycles Tab and Shift+Tab within the trap", async () => {
    const user = userEvent.setup();
    render(<TrapDemo open />);
    const trap = screen.getByTestId("trap");
    await within(trap).findByRole("button", { name: "First" });

    await user.tab();
    expect(within(trap).getByRole("button", { name: "Second" })).toBe(document.activeElement);
    await user.tab();
    expect(within(trap).getByRole("button", { name: "Last" })).toBe(document.activeElement);
    await user.tab();
    expect(within(trap).getByRole("button", { name: "First" })).toBe(document.activeElement);
    await user.tab({ shift: true });
    expect(within(trap).getByRole("button", { name: "Last" })).toBe(document.activeElement);
  });

  it("restores focus to the previously focused element when disabled", async () => {
    const user = userEvent.setup();
    render(<ToggleableTrap />);
    const trap = screen.getByTestId("trap");
    await within(trap).findByRole("button", { name: "First" });
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.getByRole("button", { name: "Close" })).toBe(document.activeElement);
  });
});

import type { AuthUser } from "@dashora/shared";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AccountPage } from "./account-page.js";

afterEach(() => {
  cleanup();
});

const user: AuthUser = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "thom@example.com",
  displayName: "Thom",
};

describe("AccountPage", () => {
  it("shows the signed-in identity and signs out", () => {
    const onSignOut = vi.fn();
    render(<AccountPage user={user} onSignOut={onSignOut} />);

    expect(screen.getByRole("heading", { name: "Account" })).toBeTruthy();
    expect(screen.getByText("Thom")).toBeTruthy();
    expect(screen.getByText("thom@example.com")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });
});

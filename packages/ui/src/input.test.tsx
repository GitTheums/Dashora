import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Input } from "./input.js";

describe("Input", () => {
  it("associates label and shows error text", () => {
    render(<Input label="Token" error="Required" />);
    expect(screen.getByLabelText("Token")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toBe("Required");
  });
});

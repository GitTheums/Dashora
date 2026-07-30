import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "./button.js";

describe("Button", () => {
  it("renders children", () => {
    render(<Button>Continue</Button>);
    expect(screen.getByRole("button", { name: "Continue" })).toBeTruthy();
  });

  it("supports secondary variant", () => {
    render(<Button variant="secondary">Cancel</Button>);
    expect(screen.getByRole("button", { name: "Cancel" }).className).toContain(
      "ds-button--secondary",
    );
  });
});

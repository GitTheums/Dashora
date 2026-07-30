import { ThemeProvider } from "@dashora/ui";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DesignSystemPage } from "./design-system-page.js";

describe("DesignSystemPage", () => {
  it("renders the design system heading", () => {
    render(
      <ThemeProvider defaultMode="dark">
        <DesignSystemPage />
      </ThemeProvider>,
    );
    expect(screen.getByRole("heading", { name: "Dashora design system" })).toBeTruthy();
  });
});

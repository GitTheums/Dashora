import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./app.js";

describe("App", () => {
  it("shows the development environment message", () => {
    render(<App appName="Dashora" />);
    expect(
      screen.getByRole("heading", { name: "Dashora development environment is running" }),
    ).toBeTruthy();
  });
});

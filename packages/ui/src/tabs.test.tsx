import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Tabs, TabsList, TabsPanel, TabsTrigger } from "./tabs.js";

describe("Tabs", () => {
  it("switches panels when a trigger is selected", () => {
    render(
      <Tabs defaultValue="one">
        <TabsList>
          <TabsTrigger value="one">One</TabsTrigger>
          <TabsTrigger value="two">Two</TabsTrigger>
        </TabsList>
        <TabsPanel value="one">Panel one</TabsPanel>
        <TabsPanel value="two">Panel two</TabsPanel>
      </Tabs>,
    );

    expect(screen.getByText("Panel one")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Two" }));
    expect(screen.getByText("Panel two")).toBeTruthy();
  });
});

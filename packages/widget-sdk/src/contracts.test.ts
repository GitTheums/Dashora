import { describe, expect, it } from "vitest";
import { widgetDefinitionSchema, widgetStateSchema } from "./contracts.js";

describe("widgetStateSchema", () => {
  it("includes required widget states", () => {
    expect(widgetStateSchema.options).toEqual(
      expect.arrayContaining([
        "loading",
        "empty",
        "stale",
        "error",
        "disabled",
        "configuration-required",
        "ready",
      ]),
    );
  });
});

describe("widgetDefinitionSchema", () => {
  it("accepts a minimal definition", () => {
    const definition = widgetDefinitionSchema.parse({
      id: "clock",
      name: "Clock",
      version: "0.1.0",
      description: "Displays the current time.",
      states: ["loading", "ready", "error"],
    });
    expect(definition.id).toBe("clock");
  });
});

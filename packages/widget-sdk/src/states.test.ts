import { describe, expect, it } from "vitest";
import {
  REQUIRED_WIDGET_STATES,
  assertCoversRequiredStates,
  isDatafulWidgetState,
  widgetStateSchema,
} from "./states.js";

describe("widget states", () => {
  it("accepts every required state name", () => {
    for (const state of REQUIRED_WIDGET_STATES) {
      expect(widgetStateSchema.parse(state)).toBe(state);
    }
  });

  it("identifies dataful states", () => {
    expect(isDatafulWidgetState("success")).toBe(true);
    expect(isDatafulWidgetState("stale")).toBe(true);
    expect(isDatafulWidgetState("refreshing")).toBe(true);
    expect(isDatafulWidgetState("loading")).toBe(false);
    expect(isDatafulWidgetState("error")).toBe(false);
    expect(isDatafulWidgetState("empty")).toBe(false);
    expect(isDatafulWidgetState("disabled")).toBe(false);
    expect(isDatafulWidgetState("configuration-required")).toBe(false);
  });

  it("assertCoversRequiredStates accepts a complete list", () => {
    expect(() => assertCoversRequiredStates(REQUIRED_WIDGET_STATES)).not.toThrow();
    expect(() => assertCoversRequiredStates(REQUIRED_WIDGET_STATES, "clock")).not.toThrow();
  });

  it("assertCoversRequiredStates reports missing states with optional widget id", () => {
    expect(() => assertCoversRequiredStates(["loading", "success"])).toThrow(
      /Widget definition is missing required states/,
    );
    expect(() => assertCoversRequiredStates(["loading"], "todo")).toThrow(
      /Widget "todo" is missing required states/,
    );
  });
});

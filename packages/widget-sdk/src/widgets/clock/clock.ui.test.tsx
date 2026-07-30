import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { REQUIRED_WIDGET_STATES } from "../../states.js";
import { CLOCK_DEFAULT_CONFIG, type ClockData } from "./config.js";
import { ClockRenderer } from "./renderer.js";
import { ClockSettings } from "./settings.js";

const sampleData: ClockData = {
  primary: {
    timezone: "UTC",
    label: "UTC",
    time: "12:00",
    date: "Jul 30, 2026",
  },
  secondary: null,
  generatedAt: "2026-07-30T12:00:00.000Z",
};

afterEach(() => {
  cleanup();
});

describe("ClockRenderer", () => {
  it.each(REQUIRED_WIDGET_STATES)("renders state=%s", (state) => {
    render(
      <ClockRenderer
        instanceId="1"
        title="Clock"
        config={CLOCK_DEFAULT_CONFIG}
        state={state}
        {...(state === "success" || state === "stale" || state === "refreshing"
          ? { data: sampleData }
          : {})}
        message={`msg-${state}`}
      />,
    );
    expect(document.querySelector(`[data-widget="clock"][data-state="${state}"]`)).toBeTruthy();
  });
});

describe("ClockSettings", () => {
  it("renders timezone control", () => {
    render(
      <ClockSettings instanceId="1" config={CLOCK_DEFAULT_CONFIG} onChange={() => undefined} />,
    );
    expect(screen.getByLabelText("Timezone")).toBeTruthy();
  });
});

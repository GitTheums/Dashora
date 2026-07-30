import { describe, expect, it } from "vitest";
import { REQUIRED_WIDGET_STATES } from "../../states.js";
import {
  CLOCK_DEFAULT_CONFIG,
  buildClockData,
  clockConfigSchema,
  clockDefinition,
  clockProvider,
} from "./index.js";

describe("clock definition", () => {
  it("covers every required runtime state", () => {
    expect(clockDefinition.states).toEqual(REQUIRED_WIDGET_STATES);
    expect(clockDefinition.id).toBe("clock");
  });

  it("parses default config", () => {
    expect(clockConfigSchema.parse({})).toEqual(CLOCK_DEFAULT_CONFIG);
  });

  it("rejects invalid timezones", () => {
    expect(() => clockConfigSchema.parse({ timezone: "Not/AZone" })).toThrow();
  });
});

describe("clock formatting", () => {
  it("builds primary and secondary faces", () => {
    const data = buildClockData(
      {
        ...CLOCK_DEFAULT_CONFIG,
        timezone: "UTC",
        hourFormat: "24",
        showSeconds: true,
        secondaryTimezone: "America/New_York",
        dateFormat: "short",
      },
      new Date("2026-07-30T12:00:00.000Z"),
    );
    expect(data.primary.timezone).toBe("UTC");
    expect(data.secondary?.timezone).toBe("America/New_York");
    expect(data.primary.date).toBeTruthy();
  });

  it("hides the date when format is none", () => {
    const data = buildClockData(
      { ...CLOCK_DEFAULT_CONFIG, dateFormat: "none" },
      new Date("2026-07-30T12:00:00.000Z"),
    );
    expect(data.primary.date).toBeNull();
  });
});

describe("clock provider", () => {
  it("returns success data", async () => {
    const result = await clockProvider.fetch({
      instanceId: "c1",
      config: CLOCK_DEFAULT_CONFIG,
      now: () => new Date("2026-07-30T12:00:00.000Z"),
    });
    expect(result.state).toBe("success");
    expect(result.data?.primary.timezone).toBe("UTC");
  });

  it("returns disabled when enabled is false", async () => {
    const result = await clockProvider.fetch({
      instanceId: "c2",
      config: { ...CLOCK_DEFAULT_CONFIG, enabled: false },
    });
    expect(result.state).toBe("disabled");
  });
});

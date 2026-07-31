import { describe, expect, it } from "vitest";
import { formatServerTiming } from "./request-timing.js";

describe("request timing", () => {
  it("formats Server-Timing values", () => {
    expect(formatServerTiming(12.5)).toBe("app;dur=12.5");
    expect(formatServerTiming(0)).toBe("app;dur=0");
  });
});

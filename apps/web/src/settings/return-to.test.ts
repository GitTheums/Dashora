import { describe, expect, it } from "vitest";
import { parseSafeReturnTo } from "./return-to.js";

describe("parseSafeReturnTo", () => {
  it("accepts internal dashboard paths", () => {
    expect(parseSafeReturnTo("/home")).toBe("/home");
    expect(parseSafeReturnTo("/")).toBe("/");
    expect(parseSafeReturnTo("/markets?tab=1")).toBe("/markets?tab=1");
  });

  it("rejects external and unsafe values", () => {
    expect(parseSafeReturnTo("https://evil.example/phish", "/")).toBe("/");
    expect(parseSafeReturnTo("//evil.example", "/")).toBe("/");
    expect(parseSafeReturnTo("/\\evil", "/")).toBe("/");
    expect(parseSafeReturnTo("/login", "/")).toBe("/");
    expect(parseSafeReturnTo("/setup", "/")).toBe("/");
    expect(parseSafeReturnTo("/api/v1/settings/theme", "/")).toBe("/");
    expect(parseSafeReturnTo(null, "/home")).toBe("/home");
  });
});

import { describe, expect, it } from "vitest";
import { isCommonPassword, passwordContainsEmailLocalPart } from "./password-denylist.js";

describe("isCommonPassword", () => {
  it("flags well-known breached passwords case-insensitively", () => {
    expect(isCommonPassword("password123")).toBe(true);
    expect(isCommonPassword("PASSWORD123")).toBe(true);
    expect(isCommonPassword("  qwertyuiop  ")).toBe(true);
  });

  it("does not flag a random, unlisted password", () => {
    expect(isCommonPassword("correct-battery-horse-zephyr-9482")).toBe(false);
  });
});

describe("passwordContainsEmailLocalPart", () => {
  it("flags a password that embeds the email local-part", () => {
    expect(passwordContainsEmailLocalPart("alicewonderland99", "alice@example.com")).toBe(true);
    expect(passwordContainsEmailLocalPart("ALICEwonderland99", "alice@example.com")).toBe(true);
  });

  it("does not flag unrelated passwords", () => {
    expect(passwordContainsEmailLocalPart("zephyr-9482-mountain", "alice@example.com")).toBe(false);
  });

  it("skips very short local-parts to avoid false positives", () => {
    expect(passwordContainsEmailLocalPart("abrandnewpassword1", "ab@example.com")).toBe(false);
  });
});

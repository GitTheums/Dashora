import { describe, expect, it } from "vitest";
import { setupRequestSchema } from "./auth.js";

const baseRequest = {
  token: "a-valid-looking-setup-token",
  email: "operator@example.com",
  displayName: "Operator",
};

describe("setupRequestSchema password policy", () => {
  it("accepts a long, non-denylisted password unrelated to the email", () => {
    const result = setupRequestSchema.safeParse({
      ...baseRequest,
      password: "correct-battery-horse-zephyr",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a common/breached password even if it meets the length requirement", () => {
    const result = setupRequestSchema.safeParse({
      ...baseRequest,
      password: "passwordpassword",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.includes("password"))).toBe(true);
    }
  });

  it("rejects a password containing the account's email local-part", () => {
    const result = setupRequestSchema.safeParse({
      ...baseRequest,
      password: "operator-super-secret-1",
    });
    expect(result.success).toBe(false);
  });

  it("still enforces the minimum length", () => {
    const result = setupRequestSchema.safeParse({
      ...baseRequest,
      password: "short1",
    });
    expect(result.success).toBe(false);
  });
});

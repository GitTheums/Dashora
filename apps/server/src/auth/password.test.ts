import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password.js";

describe("password hashing", () => {
  it("hashes with Argon2id and verifies", async () => {
    const hash = await hashPassword("correct-horse-battery");
    expect(hash.startsWith("$argon2id$")).toBe(true);
    expect(await verifyPassword(hash, "correct-horse-battery")).toBe(true);
    expect(await verifyPassword(hash, "wrong-password")).toBe(false);
  });
});

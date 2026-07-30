import { describe, expect, it } from "vitest";
import {
  decryptSecret,
  encryptSecret,
  parseSecretsEncryptionKey,
  tokenHint,
} from "./encryption.js";

const KEY_HEX = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

describe("secret encryption", () => {
  it("round-trips a token", () => {
    const key = parseSecretsEncryptionKey(KEY_HEX);
    expect(key).not.toBeNull();
    if (!key) {
      throw new Error("expected key");
    }
    const ciphertext = encryptSecret("ghp_super_secret_token", key);
    expect(ciphertext.startsWith("v1:")).toBe(true);
    expect(ciphertext).not.toContain("ghp_super_secret_token");
    expect(decryptSecret(ciphertext, key)).toBe("ghp_super_secret_token");
  });

  it("returns a short token hint", () => {
    expect(tokenHint("ghp_abcdefghijk")).toBe("hijk");
  });
});

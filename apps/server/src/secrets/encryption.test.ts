import { describe, expect, it } from "vitest";
import {
  SecretEncryptionError,
  decryptSecret,
  encryptSecret,
  parseSecretsEncryptionKey,
  requireSecretsEncryptionKey,
  tokenHint,
} from "./encryption.js";

const KEY_HEX = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const OTHER_KEY_HEX = "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";

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
    expect(tokenHint("ab")).toBe("ab");
  });

  it("rejects missing and malformed keys", () => {
    expect(parseSecretsEncryptionKey(undefined)).toBeNull();
    expect(() => parseSecretsEncryptionKey("too-short")).toThrow(SecretEncryptionError);
    expect(() => requireSecretsEncryptionKey(undefined)).toThrow(/required/i);
  });

  it("rejects wrong key and tampered ciphertext", () => {
    const key = requireSecretsEncryptionKey(KEY_HEX);
    const other = requireSecretsEncryptionKey(OTHER_KEY_HEX);
    const ciphertext = encryptSecret("secret-value", key);

    expect(() => decryptSecret(ciphertext, other)).toThrow(SecretEncryptionError);
    expect(() => decryptSecret("v2:a:b:c", key)).toThrow(/Unrecognized ciphertext/i);
    expect(() => decryptSecret("v1:only-two", key)).toThrow(SecretEncryptionError);

    const parts = ciphertext.split(":");
    parts[3] = `${parts[3]}tamper`;
    expect(() => decryptSecret(parts.join(":"), key)).toThrow(SecretEncryptionError);
  });

  it("rejects non-32-byte encryption keys", () => {
    const short = Buffer.alloc(16);
    expect(() => encryptSecret("x", short)).toThrow(/32 bytes/i);
    expect(() => decryptSecret("v1:a:b:c", short)).toThrow(/32 bytes/i);
  });
});

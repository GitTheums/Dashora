import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const VERSION_PREFIX = "v1";

export class SecretEncryptionError extends Error {
  readonly code: "missing_key" | "invalid_key" | "decrypt_failed" | "encrypt_failed";

  constructor(
    code: "missing_key" | "invalid_key" | "decrypt_failed" | "encrypt_failed",
    message: string,
  ) {
    super(message);
    this.name = "SecretEncryptionError";
    this.code = code;
  }
}

export function parseSecretsEncryptionKey(value: string | undefined): Buffer | null {
  if (!value) {
    return null;
  }
  if (!/^[0-9a-fA-F]{64}$/.test(value)) {
    throw new SecretEncryptionError(
      "invalid_key",
      "SECRETS_ENCRYPTION_KEY must be 64 hex characters",
    );
  }
  return Buffer.from(value, "hex");
}

export function requireSecretsEncryptionKey(value: string | undefined): Buffer {
  const key = parseSecretsEncryptionKey(value);
  if (!key) {
    throw new SecretEncryptionError(
      "missing_key",
      "SECRETS_ENCRYPTION_KEY is required to store integration secrets",
    );
  }
  return key;
}

/**
 * Encrypts a UTF-8 secret. Ciphertext format: `v1:<iv_b64>:<tag_b64>:<data_b64>`.
 */
export function encryptSecret(plaintext: string, key: Buffer): string {
  if (key.length !== 32) {
    throw new SecretEncryptionError("invalid_key", "Encryption key must be 32 bytes");
  }
  try {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [
      VERSION_PREFIX,
      iv.toString("base64url"),
      tag.toString("base64url"),
      encrypted.toString("base64url"),
    ].join(":");
  } catch (error) {
    throw new SecretEncryptionError(
      "encrypt_failed",
      error instanceof Error ? error.message : "Failed to encrypt secret",
    );
  }
}

export function decryptSecret(ciphertext: string, key: Buffer): string {
  if (key.length !== 32) {
    throw new SecretEncryptionError("invalid_key", "Encryption key must be 32 bytes");
  }
  const parts = ciphertext.split(":");
  if (parts.length !== 4 || parts[0] !== VERSION_PREFIX) {
    throw new SecretEncryptionError("decrypt_failed", "Unrecognized ciphertext format");
  }
  const [, ivB64, tagB64, dataB64] = parts;
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new SecretEncryptionError("decrypt_failed", "Incomplete ciphertext");
  }
  try {
    const iv = Buffer.from(ivB64, "base64url");
    const tag = Buffer.from(tagB64, "base64url");
    const data = Buffer.from(dataB64, "base64url");
    if (iv.length !== IV_LENGTH || tag.length !== AUTH_TAG_LENGTH) {
      throw new SecretEncryptionError("decrypt_failed", "Invalid ciphertext parameters");
    }
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch (error) {
    if (error instanceof SecretEncryptionError) {
      throw error;
    }
    throw new SecretEncryptionError("decrypt_failed", "Failed to decrypt secret");
  }
}

export function tokenHint(token: string): string {
  const trimmed = token.trim();
  if (trimmed.length < 4) {
    return trimmed;
  }
  return trimmed.slice(-4);
}

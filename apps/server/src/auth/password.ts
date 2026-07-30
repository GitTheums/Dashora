import { hash, hashSync, verify } from "@node-rs/argon2";

/** Argon2id parameters balanced for interactive logins on self-hosted hardware. */
const ARGON2_OPTIONS = {
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
  // Algorithm.Argon2id — numeric because const enums break under verbatimModuleSyntax.
  algorithm: 2 as const,
};

/** Used when no user matches so verify still runs (mitigates trivial timing leaks). */
export const DUMMY_PASSWORD_HASH = hashSync("dashora-timing-placeholder", ARGON2_OPTIONS);

export async function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

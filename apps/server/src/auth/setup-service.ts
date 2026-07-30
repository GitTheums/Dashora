import { eq } from "drizzle-orm";
import type { FastifyBaseLogger } from "fastify";
import type { DashoraDatabase } from "../db/client.js";
import {
  ACTIVE_SETUP_TOKEN_ID,
  type SetupTokenRecord,
  createSetupTokensRepository,
} from "../db/repositories/setup-tokens.js";
import { setupTokens, users } from "../db/schema.js";
import { nowEpochMillis } from "../db/timestamps.js";
import { hashPassword } from "./password.js";
import { generateOpaqueToken, hashToken, safeEqualStrings } from "./tokens.js";

export type SetupTokenFailureReason =
  | "missing_token"
  | "invalid_token"
  | "expired_token"
  | "setup_already_completed"
  | "validation_error"
  | "server_error";

export const SETUP_ERROR_MESSAGES: Record<SetupTokenFailureReason, string> = {
  missing_token: "Setup token is required",
  invalid_token: "Setup token is invalid",
  expired_token: "Setup token has expired",
  setup_already_completed: "Setup is already completed",
  validation_error: "Invalid setup payload",
  server_error: "Unexpected server error",
};

export type SetupCompleteInput = {
  token: string;
  email: string;
  displayName: string;
  password: string;
};

export type SetupCompleteSuccess = {
  ok: true;
  user: {
    id: string;
    email: string;
    displayName: string;
    passwordHash: string;
    createdAt: number;
    updatedAt: number;
  };
};

export type SetupCompleteFailure = {
  ok: false;
  reason: SetupTokenFailureReason;
};

export type EnsureSetupTokenResult = {
  created: boolean;
  hasValidToken: boolean;
  expiresAt: number | null;
  /** Present only when a new token was just created — never re-read from storage. */
  plaintextToken: string | null;
};

export type SetupService = {
  isSetupRequired: () => Promise<boolean>;
  getActiveTokenMeta: () => Promise<{
    exists: boolean;
    valid: boolean;
    expiresAt: number | null;
    createdAt: number | null;
  }>;
  ensureIssued: (log: FastifyBaseLogger, publicBaseUrl: string) => Promise<EnsureSetupTokenResult>;
  completeSetup: (
    input: SetupCompleteInput,
  ) => Promise<SetupCompleteSuccess | SetupCompleteFailure>;
  /** In-process plaintext retained only after a new issue (tests / diagnostics). Never persisted. */
  getPlaintextForTests: () => string | null;
  /** Test helper: clear persisted token without deleting users. */
  clearTokenForTests: () => Promise<void>;
  /** Test helper: force-expire the active token. */
  expireActiveTokenForTests: () => Promise<void>;
};

export type CreateSetupServiceOptions = {
  db: DashoraDatabase;
  setupTokenTtlMs: number;
  nodeEnv: "development" | "test" | "production";
};

function isValidRecord(
  record: SetupTokenRecord | undefined,
  now: number,
): record is SetupTokenRecord {
  return record !== undefined && record.expiresAt >= now;
}

export function createSetupService(options: CreateSetupServiceOptions): SetupService {
  const tokensRepo = createSetupTokensRepository(options.db);
  let plaintextForTests: string | null = null;

  async function isSetupRequired(): Promise<boolean> {
    const rows = await options.db.select({ id: users.id }).from(users).limit(1);
    return rows.length === 0;
  }

  async function getActiveTokenMeta() {
    const now = nowEpochMillis();
    const active = await tokensRepo.getActive();
    if (!active) {
      return { exists: false, valid: false, expiresAt: null, createdAt: null };
    }
    const valid = active.expiresAt >= now;
    return {
      exists: true,
      valid,
      expiresAt: active.expiresAt,
      createdAt: active.createdAt,
    };
  }

  async function ensureIssued(
    log: FastifyBaseLogger,
    publicBaseUrl: string,
  ): Promise<EnsureSetupTokenResult> {
    if (!(await isSetupRequired())) {
      await tokensRepo.deleteAll();
      if (options.nodeEnv === "development") {
        log.info(
          { setupRequired: false, validTokenExists: false },
          "Setup not required — admin user already exists",
        );
      }
      return { created: false, hasValidToken: false, expiresAt: null, plaintextToken: null };
    }

    const now = nowEpochMillis();
    await tokensRepo.deleteExpired(now);

    const existing = await tokensRepo.getActive();
    if (isValidRecord(existing, now)) {
      if (options.nodeEnv === "development") {
        log.info(
          {
            setupRequired: true,
            validTokenExists: true,
            tokenExpiresAt: new Date(existing.expiresAt).toISOString(),
          },
          "Reusing persisted first-run setup token",
        );
      }
      return {
        created: false,
        hasValidToken: true,
        expiresAt: existing.expiresAt,
        plaintextToken: null,
      };
    }

    const plaintextToken = generateOpaqueToken();
    plaintextForTests = plaintextToken;
    const createdAt = now;
    const expiresAt = now + options.setupTokenTtlMs;
    await tokensRepo.upsertActive({
      tokenHash: hashToken(plaintextToken),
      createdAt,
      expiresAt,
    });

    const base = publicBaseUrl.replace(/\/$/, "");
    const setupUrl = `${base}/setup?token=${encodeURIComponent(plaintextToken)}`;
    // Intentional one-time plaintext URL log. Structured logs redact req.body.token.
    log.info(`Dashora first-run setup required. Open: ${setupUrl}`);

    if (options.nodeEnv === "development") {
      log.info(
        {
          setupRequired: true,
          validTokenExists: true,
          tokenExpiresAt: new Date(expiresAt).toISOString(),
          tokenCreated: true,
        },
        "Generated new first-run setup token",
      );
    }

    return {
      created: true,
      hasValidToken: true,
      expiresAt,
      plaintextToken,
    };
  }

  async function completeSetup(
    input: SetupCompleteInput,
  ): Promise<SetupCompleteSuccess | SetupCompleteFailure> {
    if (!input.token) {
      return { ok: false, reason: "missing_token" };
    }

    // Hash outside the transaction so a hashing failure never consumes the token.
    let passwordHash: string;
    try {
      passwordHash = await hashPassword(input.password);
    } catch {
      return { ok: false, reason: "server_error" };
    }

    const submittedHash = hashToken(input.token);
    const now = nowEpochMillis();

    try {
      return options.db.transaction(
        (tx) => {
          const existingUsers = tx.select({ id: users.id }).from(users).all();
          if (existingUsers.length > 0) {
            return { ok: false as const, reason: "setup_already_completed" as const };
          }

          const active = tx
            .select()
            .from(setupTokens)
            .where(eq(setupTokens.id, ACTIVE_SETUP_TOKEN_ID))
            .get();

          if (!active) {
            return { ok: false as const, reason: "invalid_token" as const };
          }

          if (active.expiresAt < now) {
            tx.delete(setupTokens).where(eq(setupTokens.id, ACTIVE_SETUP_TOKEN_ID)).run();
            return { ok: false as const, reason: "expired_token" as const };
          }

          if (!safeEqualStrings(active.tokenHash, submittedHash)) {
            return { ok: false as const, reason: "invalid_token" as const };
          }

          const inserted = tx
            .insert(users)
            .values({
              email: input.email.toLowerCase(),
              displayName: input.displayName,
              passwordHash,
              createdAt: now,
              updatedAt: now,
            })
            .returning()
            .get();

          if (!inserted) {
            throw new Error("Failed to create admin user");
          }

          // Invalidate only after the admin row is written in the same transaction.
          tx.delete(setupTokens).where(eq(setupTokens.id, ACTIVE_SETUP_TOKEN_ID)).run();

          return { ok: true as const, user: inserted };
        },
        { behavior: "immediate" },
      );
    } catch {
      return { ok: false, reason: "server_error" };
    }
  }

  return {
    isSetupRequired,
    getActiveTokenMeta,
    ensureIssued,
    completeSetup,
    getPlaintextForTests() {
      return plaintextForTests;
    },
    async clearTokenForTests() {
      await tokensRepo.deleteAll();
      plaintextForTests = null;
    },
    async expireActiveTokenForTests() {
      const active = await tokensRepo.getActive();
      if (!active) {
        return;
      }
      await tokensRepo.upsertActive({
        tokenHash: active.tokenHash,
        createdAt: active.createdAt,
        expiresAt: nowEpochMillis() - 1,
      });
    },
  };
}

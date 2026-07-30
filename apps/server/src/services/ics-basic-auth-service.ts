import {
  type CreateIcsBasicAuthIntegrationRequest,
  ICS_BASIC_AUTH_INTEGRATION_PROVIDER,
  type IcsBasicAuthIntegrationPublic,
  type UpdateIcsBasicAuthIntegrationRequest,
} from "@dashora/shared";
import type { Repositories } from "../db/repositories/index.js";
import {
  SecretEncryptionError,
  decryptSecret,
  encryptSecret,
  requireSecretsEncryptionKey,
} from "../secrets/encryption.js";

const CREDENTIALS_SECRET_KEY = "basicAuth";
const SECRET_PREFIX = "ics-basic-auth:v1:";

function encodeBasicAuthSecret(username: string, password: string): string {
  return `${SECRET_PREFIX}${JSON.stringify({ username, password })}`;
}

export class IcsBasicAuthIntegrationServiceError extends Error {
  readonly code: "not_found" | "validation_error" | "encryption_unavailable" | "decrypt_failed";

  constructor(
    code: "not_found" | "validation_error" | "encryption_unavailable" | "decrypt_failed",
    message: string,
  ) {
    super(message);
    this.name = "IcsBasicAuthIntegrationServiceError";
    this.code = code;
  }
}

function toIso(epochMillis: number): string {
  return new Date(epochMillis).toISOString();
}

export type IcsBasicAuthIntegrationService = {
  list: (userId: string) => Promise<IcsBasicAuthIntegrationPublic[]>;
  create: (
    userId: string,
    input: CreateIcsBasicAuthIntegrationRequest,
  ) => Promise<IcsBasicAuthIntegrationPublic>;
  update: (
    userId: string,
    id: string,
    input: UpdateIcsBasicAuthIntegrationRequest,
  ) => Promise<IcsBasicAuthIntegrationPublic>;
  remove: (userId: string, id: string) => Promise<void>;
  /** Returns the encoded secret payload for widget getSecret, or null. */
  getSecretPayload: (userId: string, integrationId: string) => Promise<string | null>;
};

export function createIcsBasicAuthIntegrationService(options: {
  repos: Repositories;
  secretsEncryptionKey?: string;
}): IcsBasicAuthIntegrationService {
  async function toPublic(
    integration: Awaited<ReturnType<Repositories["integrations"]["findById"]>>,
  ): Promise<IcsBasicAuthIntegrationPublic | null> {
    if (!integration || integration.provider !== ICS_BASIC_AUTH_INTEGRATION_PROVIDER) {
      return null;
    }
    const secret = await options.repos.secrets.findByIntegrationAndKey(
      integration.id,
      CREDENTIALS_SECRET_KEY,
    );
    let usernameHint: string | null = null;
    if (secret) {
      try {
        const key = requireSecretsEncryptionKey(options.secretsEncryptionKey);
        const payload = decryptSecret(secret.ciphertext, key);
        if (payload.startsWith(SECRET_PREFIX)) {
          const parsed = JSON.parse(payload.slice(SECRET_PREFIX.length)) as { username?: unknown };
          if (typeof parsed.username === "string" && parsed.username.trim()) {
            usernameHint = parsed.username.trim().slice(0, 128);
          }
        }
      } catch {
        usernameHint = null;
      }
    }
    return {
      id: integration.id,
      provider: ICS_BASIC_AUTH_INTEGRATION_PROVIDER,
      name: integration.name,
      hasCredentials: Boolean(secret),
      usernameHint,
      createdAt: toIso(integration.createdAt),
      updatedAt: toIso(integration.updatedAt),
    };
  }

  return {
    async list(userId) {
      const rows = await options.repos.integrations.listByUser(userId);
      const out: IcsBasicAuthIntegrationPublic[] = [];
      for (const row of rows) {
        if (row.provider !== ICS_BASIC_AUTH_INTEGRATION_PROVIDER) {
          continue;
        }
        const publicRow = await toPublic(row);
        if (publicRow) {
          out.push(publicRow);
        }
      }
      return out;
    },

    async create(userId, input) {
      let key: Buffer;
      try {
        key = requireSecretsEncryptionKey(options.secretsEncryptionKey);
      } catch (error) {
        if (error instanceof SecretEncryptionError) {
          throw new IcsBasicAuthIntegrationServiceError(
            "encryption_unavailable",
            "Server is not configured to store secrets. Set SECRETS_ENCRYPTION_KEY.",
          );
        }
        throw error;
      }

      const integration = await options.repos.integrations.create({
        userId,
        provider: ICS_BASIC_AUTH_INTEGRATION_PROVIDER,
        name: input.name,
        config: {},
      });
      await options.repos.secrets.create({
        integrationId: integration.id,
        key: CREDENTIALS_SECRET_KEY,
        ciphertext: encryptSecret(encodeBasicAuthSecret(input.username, input.password), key),
      });
      const publicRow = await toPublic(integration);
      if (!publicRow) {
        throw new IcsBasicAuthIntegrationServiceError("not_found", "Integration was not created");
      }
      return publicRow;
    },

    async update(userId, id, input) {
      const existing = await options.repos.integrations.findById(id);
      if (
        !existing ||
        existing.userId !== userId ||
        existing.provider !== ICS_BASIC_AUTH_INTEGRATION_PROVIDER
      ) {
        throw new IcsBasicAuthIntegrationServiceError(
          "not_found",
          "ICS basic auth integration not found",
        );
      }

      if (input.username !== undefined && input.password !== undefined) {
        let key: Buffer;
        try {
          key = requireSecretsEncryptionKey(options.secretsEncryptionKey);
        } catch (error) {
          if (error instanceof SecretEncryptionError) {
            throw new IcsBasicAuthIntegrationServiceError(
              "encryption_unavailable",
              "Server is not configured to store secrets. Set SECRETS_ENCRYPTION_KEY.",
            );
          }
          throw error;
        }
        const ciphertext = encryptSecret(
          encodeBasicAuthSecret(input.username, input.password),
          key,
        );
        const secret = await options.repos.secrets.findByIntegrationAndKey(
          id,
          CREDENTIALS_SECRET_KEY,
        );
        if (secret) {
          await options.repos.secrets.update(secret.id, { ciphertext });
        } else {
          await options.repos.secrets.create({
            integrationId: id,
            key: CREDENTIALS_SECRET_KEY,
            ciphertext,
          });
        }
      }

      const updated =
        input.name !== undefined
          ? await options.repos.integrations.update(id, { name: input.name })
          : input.username !== undefined
            ? await options.repos.integrations.update(id, {})
            : existing;

      const publicRow = await toPublic(updated ?? existing);
      if (!publicRow) {
        throw new IcsBasicAuthIntegrationServiceError(
          "not_found",
          "ICS basic auth integration not found",
        );
      }
      return publicRow;
    },

    async remove(userId, id) {
      const existing = await options.repos.integrations.findById(id);
      if (
        !existing ||
        existing.userId !== userId ||
        existing.provider !== ICS_BASIC_AUTH_INTEGRATION_PROVIDER
      ) {
        throw new IcsBasicAuthIntegrationServiceError(
          "not_found",
          "ICS basic auth integration not found",
        );
      }
      await options.repos.integrations.deleteById(id);
    },

    async getSecretPayload(userId, integrationId) {
      const existing = await options.repos.integrations.findById(integrationId);
      if (
        !existing ||
        existing.userId !== userId ||
        existing.provider !== ICS_BASIC_AUTH_INTEGRATION_PROVIDER
      ) {
        return null;
      }
      const secret = await options.repos.secrets.findByIntegrationAndKey(
        integrationId,
        CREDENTIALS_SECRET_KEY,
      );
      if (!secret) {
        return null;
      }
      try {
        const key = requireSecretsEncryptionKey(options.secretsEncryptionKey);
        return decryptSecret(secret.ciphertext, key);
      } catch (error) {
        if (error instanceof SecretEncryptionError) {
          throw new IcsBasicAuthIntegrationServiceError(
            "decrypt_failed",
            "Could not decrypt the stored ICS basic auth credentials.",
          );
        }
        throw error;
      }
    },
  };
}

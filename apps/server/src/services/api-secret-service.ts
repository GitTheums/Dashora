import {
  API_SECRET_INTEGRATION_PROVIDER,
  type ApiSecretIntegrationPublic,
  type CreateApiSecretIntegrationRequest,
  type UpdateApiSecretIntegrationRequest,
} from "@dashora/shared";
import type { Repositories } from "../db/repositories/index.js";
import {
  SecretEncryptionError,
  decryptSecret,
  encryptSecret,
  requireSecretsEncryptionKey,
  tokenHint,
} from "../secrets/encryption.js";

const SECRET_KEY = "value";

export class ApiSecretServiceError extends Error {
  readonly code: "not_found" | "validation_error" | "encryption_unavailable" | "decrypt_failed";

  constructor(
    code: "not_found" | "validation_error" | "encryption_unavailable" | "decrypt_failed",
    message: string,
  ) {
    super(message);
    this.name = "ApiSecretServiceError";
    this.code = code;
  }
}

function toIso(epochMillis: number): string {
  return new Date(epochMillis).toISOString();
}

export type ApiSecretService = {
  list: (userId: string) => Promise<ApiSecretIntegrationPublic[]>;
  create: (
    userId: string,
    input: CreateApiSecretIntegrationRequest,
  ) => Promise<ApiSecretIntegrationPublic>;
  update: (
    userId: string,
    id: string,
    input: UpdateApiSecretIntegrationRequest,
  ) => Promise<ApiSecretIntegrationPublic>;
  remove: (userId: string, id: string) => Promise<void>;
  getSecret: (userId: string, integrationId: string) => Promise<string | null>;
};

export function createApiSecretService(options: {
  repos: Repositories;
  secretsEncryptionKey?: string;
}): ApiSecretService {
  async function toPublic(
    integration: Awaited<ReturnType<Repositories["integrations"]["findById"]>>,
  ): Promise<ApiSecretIntegrationPublic | null> {
    if (!integration || integration.provider !== API_SECRET_INTEGRATION_PROVIDER) {
      return null;
    }
    const secret = await options.repos.secrets.findByIntegrationAndKey(integration.id, SECRET_KEY);
    let hint: string | null = null;
    if (secret) {
      try {
        const key = requireSecretsEncryptionKey(options.secretsEncryptionKey);
        hint = tokenHint(decryptSecret(secret.ciphertext, key));
      } catch {
        hint = null;
      }
    }
    return {
      id: integration.id,
      provider: API_SECRET_INTEGRATION_PROVIDER,
      name: integration.name,
      hasSecret: Boolean(secret),
      secretHint: hint,
      createdAt: toIso(integration.createdAt),
      updatedAt: toIso(integration.updatedAt),
    };
  }

  return {
    async list(userId) {
      const rows = await options.repos.integrations.listByUser(userId);
      const out: ApiSecretIntegrationPublic[] = [];
      for (const row of rows) {
        if (row.provider !== API_SECRET_INTEGRATION_PROVIDER) {
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
          throw new ApiSecretServiceError(
            "encryption_unavailable",
            "Server is not configured to store secrets. Set SECRETS_ENCRYPTION_KEY.",
          );
        }
        throw error;
      }

      const integration = await options.repos.integrations.create({
        userId,
        provider: API_SECRET_INTEGRATION_PROVIDER,
        name: input.name,
        config: {},
      });
      await options.repos.secrets.create({
        integrationId: integration.id,
        key: SECRET_KEY,
        ciphertext: encryptSecret(input.secret, key),
      });
      const publicRow = await toPublic(integration);
      if (!publicRow) {
        throw new ApiSecretServiceError("validation_error", "Could not create API secret.");
      }
      return publicRow;
    },

    async update(userId, id, input) {
      const existing = await options.repos.integrations.findById(id);
      if (
        !existing ||
        existing.userId !== userId ||
        existing.provider !== API_SECRET_INTEGRATION_PROVIDER
      ) {
        throw new ApiSecretServiceError("not_found", "API secret not found.");
      }

      if (input.name !== undefined) {
        await options.repos.integrations.update(id, { name: input.name });
      }

      if (input.secret !== undefined) {
        let key: Buffer;
        try {
          key = requireSecretsEncryptionKey(options.secretsEncryptionKey);
        } catch (error) {
          if (error instanceof SecretEncryptionError) {
            throw new ApiSecretServiceError(
              "encryption_unavailable",
              "Server is not configured to store secrets. Set SECRETS_ENCRYPTION_KEY.",
            );
          }
          throw error;
        }
        const ciphertext = encryptSecret(input.secret, key);
        const current = await options.repos.secrets.findByIntegrationAndKey(id, SECRET_KEY);
        if (current) {
          await options.repos.secrets.update(current.id, { ciphertext });
        } else {
          await options.repos.secrets.create({
            integrationId: id,
            key: SECRET_KEY,
            ciphertext,
          });
        }
      }

      const updated = await options.repos.integrations.findById(id);
      const publicRow = await toPublic(updated);
      if (!publicRow) {
        throw new ApiSecretServiceError("not_found", "API secret not found.");
      }
      return publicRow;
    },

    async remove(userId, id) {
      const existing = await options.repos.integrations.findById(id);
      if (
        !existing ||
        existing.userId !== userId ||
        existing.provider !== API_SECRET_INTEGRATION_PROVIDER
      ) {
        throw new ApiSecretServiceError("not_found", "API secret not found.");
      }
      await options.repos.integrations.deleteById(id);
    },

    async getSecret(userId, integrationId) {
      const existing = await options.repos.integrations.findById(integrationId);
      if (
        !existing ||
        existing.userId !== userId ||
        existing.provider !== API_SECRET_INTEGRATION_PROVIDER
      ) {
        return null;
      }
      const secret = await options.repos.secrets.findByIntegrationAndKey(integrationId, SECRET_KEY);
      if (!secret) {
        return null;
      }
      try {
        const key = requireSecretsEncryptionKey(options.secretsEncryptionKey);
        return decryptSecret(secret.ciphertext, key);
      } catch {
        return null;
      }
    },
  };
}

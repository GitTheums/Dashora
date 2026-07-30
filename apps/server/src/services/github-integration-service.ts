import {
  type CreateGithubIntegrationRequest,
  GITHUB_INTEGRATION_PROVIDER,
  type GithubIntegrationPublic,
  type UpdateGithubIntegrationRequest,
} from "@dashora/shared";
import type { Repositories } from "../db/repositories/index.js";
import {
  SecretEncryptionError,
  decryptSecret,
  encryptSecret,
  requireSecretsEncryptionKey,
  tokenHint,
} from "../secrets/encryption.js";

const TOKEN_SECRET_KEY = "token";

export class GithubIntegrationServiceError extends Error {
  readonly code: "not_found" | "validation_error" | "encryption_unavailable" | "decrypt_failed";

  constructor(
    code: "not_found" | "validation_error" | "encryption_unavailable" | "decrypt_failed",
    message: string,
  ) {
    super(message);
    this.name = "GithubIntegrationServiceError";
    this.code = code;
  }
}

function toIso(epochMillis: number): string {
  return new Date(epochMillis).toISOString();
}

export type GithubIntegrationService = {
  list: (userId: string) => Promise<GithubIntegrationPublic[]>;
  create: (
    userId: string,
    input: CreateGithubIntegrationRequest,
  ) => Promise<GithubIntegrationPublic>;
  update: (
    userId: string,
    id: string,
    input: UpdateGithubIntegrationRequest,
  ) => Promise<GithubIntegrationPublic>;
  remove: (userId: string, id: string) => Promise<void>;
  getToken: (userId: string, integrationId: string) => Promise<string | null>;
};

export function createGithubIntegrationService(options: {
  repos: Repositories;
  secretsEncryptionKey?: string;
}): GithubIntegrationService {
  async function toPublic(
    integration: Awaited<ReturnType<Repositories["integrations"]["findById"]>>,
  ): Promise<GithubIntegrationPublic | null> {
    if (!integration || integration.provider !== GITHUB_INTEGRATION_PROVIDER) {
      return null;
    }
    const secret = await options.repos.secrets.findByIntegrationAndKey(
      integration.id,
      TOKEN_SECRET_KEY,
    );
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
      provider: GITHUB_INTEGRATION_PROVIDER,
      name: integration.name,
      hasToken: Boolean(secret),
      tokenHint: hint,
      createdAt: toIso(integration.createdAt),
      updatedAt: toIso(integration.updatedAt),
    };
  }

  return {
    async list(userId) {
      const rows = await options.repos.integrations.listByUser(userId);
      const out: GithubIntegrationPublic[] = [];
      for (const row of rows) {
        if (row.provider !== GITHUB_INTEGRATION_PROVIDER) {
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
          throw new GithubIntegrationServiceError(
            "encryption_unavailable",
            "Server is not configured to store secrets. Set SECRETS_ENCRYPTION_KEY.",
          );
        }
        throw error;
      }

      const integration = await options.repos.integrations.create({
        userId,
        provider: GITHUB_INTEGRATION_PROVIDER,
        name: input.name,
        config: {},
      });
      await options.repos.secrets.create({
        integrationId: integration.id,
        key: TOKEN_SECRET_KEY,
        ciphertext: encryptSecret(input.token, key),
      });
      const publicRow = await toPublic(integration);
      if (!publicRow) {
        throw new GithubIntegrationServiceError("not_found", "Integration was not created");
      }
      return publicRow;
    },

    async update(userId, id, input) {
      const existing = await options.repos.integrations.findById(id);
      if (
        !existing ||
        existing.userId !== userId ||
        existing.provider !== GITHUB_INTEGRATION_PROVIDER
      ) {
        throw new GithubIntegrationServiceError("not_found", "GitHub integration not found");
      }

      if (input.token !== undefined) {
        let key: Buffer;
        try {
          key = requireSecretsEncryptionKey(options.secretsEncryptionKey);
        } catch (error) {
          if (error instanceof SecretEncryptionError) {
            throw new GithubIntegrationServiceError(
              "encryption_unavailable",
              "Server is not configured to store secrets. Set SECRETS_ENCRYPTION_KEY.",
            );
          }
          throw error;
        }
        const ciphertext = encryptSecret(input.token, key);
        const secret = await options.repos.secrets.findByIntegrationAndKey(id, TOKEN_SECRET_KEY);
        if (secret) {
          await options.repos.secrets.update(secret.id, { ciphertext });
        } else {
          await options.repos.secrets.create({
            integrationId: id,
            key: TOKEN_SECRET_KEY,
            ciphertext,
          });
        }
      }

      const updated =
        input.name !== undefined
          ? await options.repos.integrations.update(id, { name: input.name })
          : input.token !== undefined
            ? await options.repos.integrations.update(id, {})
            : existing;

      const publicRow = await toPublic(updated ?? existing);
      if (!publicRow) {
        throw new GithubIntegrationServiceError("not_found", "GitHub integration not found");
      }
      return publicRow;
    },

    async remove(userId, id) {
      const existing = await options.repos.integrations.findById(id);
      if (
        !existing ||
        existing.userId !== userId ||
        existing.provider !== GITHUB_INTEGRATION_PROVIDER
      ) {
        throw new GithubIntegrationServiceError("not_found", "GitHub integration not found");
      }
      await options.repos.integrations.deleteById(id);
    },

    async getToken(userId, integrationId) {
      const existing = await options.repos.integrations.findById(integrationId);
      if (
        !existing ||
        existing.userId !== userId ||
        existing.provider !== GITHUB_INTEGRATION_PROVIDER
      ) {
        return null;
      }
      const secret = await options.repos.secrets.findByIntegrationAndKey(
        integrationId,
        TOKEN_SECRET_KEY,
      );
      if (!secret) {
        return null;
      }
      try {
        const key = requireSecretsEncryptionKey(options.secretsEncryptionKey);
        return decryptSecret(secret.ciphertext, key);
      } catch (error) {
        if (error instanceof SecretEncryptionError) {
          throw new GithubIntegrationServiceError(
            "decrypt_failed",
            "Could not decrypt the stored GitHub token.",
          );
        }
        throw error;
      }
    },
  };
}

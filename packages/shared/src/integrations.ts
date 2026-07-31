import { z } from "zod";

export const GITHUB_INTEGRATION_PROVIDER = "github" as const;
export const ICS_BASIC_AUTH_INTEGRATION_PROVIDER = "ics-basic-auth" as const;
export const API_SECRET_INTEGRATION_PROVIDER = "api-secret" as const;

export const githubIntegrationPublicSchema = z.object({
  id: z.string().uuid(),
  provider: z.literal(GITHUB_INTEGRATION_PROVIDER),
  name: z.string().min(1).max(80),
  hasToken: z.boolean(),
  /** Last four characters of the stored token when available; never the full secret. */
  tokenHint: z.string().min(1).max(8).nullable(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});

export type GithubIntegrationPublic = z.infer<typeof githubIntegrationPublicSchema>;

export const githubIntegrationsResponseSchema = z.object({
  integrations: z.array(githubIntegrationPublicSchema).max(50),
});

export type GithubIntegrationsResponse = z.infer<typeof githubIntegrationsResponseSchema>;

export const githubIntegrationResponseSchema = z.object({
  integration: githubIntegrationPublicSchema,
});

export type GithubIntegrationResponse = z.infer<typeof githubIntegrationResponseSchema>;

export const createGithubIntegrationRequestSchema = z.object({
  name: z.string().trim().min(1).max(80).default("GitHub"),
  token: z
    .string()
    .trim()
    .min(8, "Token is too short")
    .max(256, "Token is too long")
    .refine((value) => !/\s/.test(value), "Token must not contain whitespace"),
});

export type CreateGithubIntegrationRequest = z.infer<typeof createGithubIntegrationRequestSchema>;

export const updateGithubIntegrationRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    token: z
      .string()
      .trim()
      .min(8, "Token is too short")
      .max(256, "Token is too long")
      .refine((value) => !/\s/.test(value), "Token must not contain whitespace")
      .optional(),
  })
  .refine((value) => value.name !== undefined || value.token !== undefined, {
    message: "Provide a name and/or token to update",
  });

export type UpdateGithubIntegrationRequest = z.infer<typeof updateGithubIntegrationRequestSchema>;

export const deleteGithubIntegrationResponseSchema = z.object({
  deleted: z.literal(true),
});

export type DeleteGithubIntegrationResponse = z.infer<typeof deleteGithubIntegrationResponseSchema>;

export const icsBasicAuthIntegrationPublicSchema = z.object({
  id: z.string().uuid(),
  provider: z.literal(ICS_BASIC_AUTH_INTEGRATION_PROVIDER),
  name: z.string().min(1).max(80),
  hasCredentials: z.boolean(),
  /** Username only (never the password). */
  usernameHint: z.string().min(1).max(128).nullable(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});

export type IcsBasicAuthIntegrationPublic = z.infer<typeof icsBasicAuthIntegrationPublicSchema>;

export const icsBasicAuthIntegrationsResponseSchema = z.object({
  integrations: z.array(icsBasicAuthIntegrationPublicSchema).max(50),
});

export type IcsBasicAuthIntegrationsResponse = z.infer<
  typeof icsBasicAuthIntegrationsResponseSchema
>;

export const icsBasicAuthIntegrationResponseSchema = z.object({
  integration: icsBasicAuthIntegrationPublicSchema,
});

export type IcsBasicAuthIntegrationResponse = z.infer<typeof icsBasicAuthIntegrationResponseSchema>;

export const createIcsBasicAuthIntegrationRequestSchema = z.object({
  name: z.string().trim().min(1).max(80).default("ICS feed"),
  username: z.string().trim().min(1, "Username is required").max(128),
  password: z.string().min(1, "Password is required").max(256),
});

export type CreateIcsBasicAuthIntegrationRequest = z.infer<
  typeof createIcsBasicAuthIntegrationRequestSchema
>;

export const updateIcsBasicAuthIntegrationRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    username: z.string().trim().min(1).max(128).optional(),
    password: z.string().min(1).max(256).optional(),
  })
  .refine(
    (value) =>
      value.name !== undefined || value.username !== undefined || value.password !== undefined,
    {
      message: "Provide a name and/or credentials to update",
    },
  )
  .refine(
    (value) =>
      (value.username === undefined && value.password === undefined) ||
      (value.username !== undefined && value.password !== undefined),
    {
      message: "Username and password must be provided together",
    },
  );

export type UpdateIcsBasicAuthIntegrationRequest = z.infer<
  typeof updateIcsBasicAuthIntegrationRequestSchema
>;

export const deleteIcsBasicAuthIntegrationResponseSchema = z.object({
  deleted: z.literal(true),
});

export type DeleteIcsBasicAuthIntegrationResponse = z.infer<
  typeof deleteIcsBasicAuthIntegrationResponseSchema
>;

export const apiSecretIntegrationPublicSchema = z.object({
  id: z.string().uuid(),
  provider: z.literal(API_SECRET_INTEGRATION_PROVIDER),
  name: z.string().min(1).max(80),
  hasSecret: z.boolean(),
  /** Last four characters of the stored secret when available; never the full value. */
  secretHint: z.string().min(1).max(8).nullable(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});

export type ApiSecretIntegrationPublic = z.infer<typeof apiSecretIntegrationPublicSchema>;

export const apiSecretIntegrationsResponseSchema = z.object({
  integrations: z.array(apiSecretIntegrationPublicSchema).max(50),
});

export type ApiSecretIntegrationsResponse = z.infer<typeof apiSecretIntegrationsResponseSchema>;

export const apiSecretIntegrationResponseSchema = z.object({
  integration: apiSecretIntegrationPublicSchema,
});

export type ApiSecretIntegrationResponse = z.infer<typeof apiSecretIntegrationResponseSchema>;

export const createApiSecretIntegrationRequestSchema = z.object({
  name: z.string().trim().min(1).max(80).default("API secret"),
  secret: z
    .string()
    .min(1, "Secret is required")
    .max(4096, "Secret is too long")
    .refine((value) => !/[\r\n\0]/.test(value), "Secret must not contain control characters"),
});

export type CreateApiSecretIntegrationRequest = z.infer<
  typeof createApiSecretIntegrationRequestSchema
>;

export const updateApiSecretIntegrationRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    secret: z
      .string()
      .min(1, "Secret is required")
      .max(4096, "Secret is too long")
      .refine((value) => !/[\r\n\0]/.test(value), "Secret must not contain control characters")
      .optional(),
  })
  .refine((value) => value.name !== undefined || value.secret !== undefined, {
    message: "Provide a name and/or secret to update",
  });

export type UpdateApiSecretIntegrationRequest = z.infer<
  typeof updateApiSecretIntegrationRequestSchema
>;

export const deleteApiSecretIntegrationResponseSchema = z.object({
  deleted: z.literal(true),
});

export type DeleteApiSecretIntegrationResponse = z.infer<
  typeof deleteApiSecretIntegrationResponseSchema
>;

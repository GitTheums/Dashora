import { z } from "zod";

export const authUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string().min(1).max(120),
});

export type AuthUser = z.infer<typeof authUserSchema>;

export const authStatusResponseSchema = z.object({
  setupRequired: z.boolean(),
});

export type AuthStatusResponse = z.infer<typeof authStatusResponseSchema>;

/** Safe first-run setup probe — never includes the setup token. */
export const setupStatusResponseSchema = authStatusResponseSchema;

export type SetupStatusResponse = AuthStatusResponse;

export const authMeResponseSchema = z.object({
  user: authUserSchema,
});

export type AuthMeResponse = z.infer<typeof authMeResponseSchema>;

export const authCsrfResponseSchema = z.object({
  csrfToken: z.string().min(1),
});

export type AuthCsrfResponse = z.infer<typeof authCsrfResponseSchema>;

const passwordSchema = z
  .string()
  .min(12, "Password must be at least 12 characters")
  .max(128, "Password must be at most 128 characters");

export const setupRequestSchema = z.object({
  token: z.string().min(1).max(256),
  email: z.string().email().max(254),
  displayName: z.string().trim().min(1).max(120),
  password: passwordSchema,
});

export type SetupRequest = z.infer<typeof setupRequestSchema>;

export const setupResponseSchema = z.object({
  user: authUserSchema,
});

export type SetupResponse = z.infer<typeof setupResponseSchema>;

export const loginRequestSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(128),
});

export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const loginResponseSchema = z.object({
  user: authUserSchema,
});

export type LoginResponse = z.infer<typeof loginResponseSchema>;

export const logoutResponseSchema = z.object({
  ok: z.literal(true),
});

export type LogoutResponse = z.infer<typeof logoutResponseSchema>;

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
  }),
});

export type ApiError = z.infer<typeof apiErrorSchema>;

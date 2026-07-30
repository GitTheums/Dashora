import { z } from "zod";

const webEnvSchema = z.object({
  VITE_APP_NAME: z.string().min(1).default("Dashora"),
  VITE_API_BASE_URL: z.string().default(""),
  MODE: z.string().min(1),
  DEV: z.boolean(),
  PROD: z.boolean(),
  SSR: z.boolean(),
});

export type WebEnv = z.infer<typeof webEnvSchema>;

export function loadWebEnv(source: ImportMetaEnv): WebEnv {
  const result = webEnvSchema.safeParse(source);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid web environment: ${details}`);
  }
  return result.data;
}

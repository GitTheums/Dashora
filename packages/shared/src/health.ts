import { z } from "zod";

export const healthResponseSchema = z.object({
  status: z.literal("ok"),
  version: z.string().min(1),
  timestamp: z.string().datetime({ offset: true }),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

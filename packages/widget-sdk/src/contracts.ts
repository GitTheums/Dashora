import { z } from "zod";

/**
 * Canonical widget runtime states. Every widget surface must handle all of these.
 */
export const widgetStateSchema = z.enum([
  "loading",
  "empty",
  "stale",
  "error",
  "disabled",
  "configuration-required",
  "ready",
]);

export type WidgetState = z.infer<typeof widgetStateSchema>;

export const widgetDefinitionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  version: z.string().min(1),
  description: z.string().min(1),
  states: z.array(widgetStateSchema).nonempty(),
});

export type WidgetDefinition = z.infer<typeof widgetDefinitionSchema>;

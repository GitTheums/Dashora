import { z } from "zod";

/**
 * Canonical widget runtime states. Every widget surface must handle all of these.
 */
export const REQUIRED_WIDGET_STATES = [
  "loading",
  "refreshing",
  "success",
  "empty",
  "stale",
  "error",
  "disabled",
  "configuration-required",
] as const;

export const widgetStateSchema = z.enum(REQUIRED_WIDGET_STATES);

export type WidgetState = z.infer<typeof widgetStateSchema>;

/** States that may include a displayable data payload. */
export const DATAFUL_WIDGET_STATES = ["success", "stale", "refreshing"] as const;

export type DatafulWidgetState = (typeof DATAFUL_WIDGET_STATES)[number];

export function isDatafulWidgetState(state: WidgetState): state is DatafulWidgetState {
  return (DATAFUL_WIDGET_STATES as readonly string[]).includes(state);
}

export function assertCoversRequiredStates(
  states: readonly WidgetState[],
  widgetId?: string,
): void {
  const missing = REQUIRED_WIDGET_STATES.filter((required) => !states.includes(required));
  if (missing.length > 0) {
    const prefix = widgetId ? `Widget "${widgetId}"` : "Widget definition";
    throw new Error(`${prefix} is missing required states: ${missing.join(", ")}`);
  }
}

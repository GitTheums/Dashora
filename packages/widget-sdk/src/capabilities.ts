import { z } from "zod";

/**
 * Capability flags declare what the platform and operator UI may offer for a widget.
 */
export const widgetCapabilitiesSchema = z.object({
  /** Operator can trigger an immediate refresh from the widget chrome. */
  supportsManualRefresh: z.boolean(),
  /** Operator can override the default title on an instance. */
  supportsTitleOverride: z.boolean(),
  /** Widget cannot run without a linked integration / credential. */
  requiresIntegration: z.boolean(),
  /** Widget may be temporarily disabled without removing it from the layout. */
  supportsDisable: z.boolean().default(true),
  /** Widget exposes a settings form (config schema is non-empty / meaningful). */
  hasSettings: z.boolean().default(true),
});

export type WidgetCapabilities = z.infer<typeof widgetCapabilitiesSchema>;

export const DEFAULT_WIDGET_CAPABILITIES: WidgetCapabilities = {
  supportsManualRefresh: true,
  supportsTitleOverride: true,
  requiresIntegration: false,
  supportsDisable: true,
  hasSettings: true,
};

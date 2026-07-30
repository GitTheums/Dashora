import type { z } from "zod";
import type { WidgetCacheStatus } from "./cache.js";
import type { WidgetState } from "./states.js";

/**
 * Server-side context passed to a widget provider when resolving instance data.
 * Secrets are loaded only on the server — never forwarded to the browser.
 */
export type WidgetProviderContext<TConfig> = {
  instanceId: string;
  config: TConfig;
  /** Linked credential id when the widget requires an integration. */
  credentialId?: string;
  /** Resolves a credential secret by id. Returns null when missing. */
  getSecret?: (credentialId: string) => Promise<string | null>;
  /** Abort signal for outbound fetches. */
  signal?: AbortSignal;
  /** Injectable clock for tests. */
  now?: () => Date;
  /** When true, bypass cache and fetch fresh data (manual refresh). */
  forceRefresh?: boolean;
};

export type WidgetProviderResult<TData = unknown> = {
  state: WidgetState;
  data?: TData;
  message?: string;
  errorCode?: string;
  /** Optional cache hint returned by the provider for the envelope meta. */
  cacheStatus?: WidgetCacheStatus;
};

/**
 * Backend contract: fetch sanitized data for a widget instance.
 * Providers must never include secrets in `data` or `message`.
 */
export type WidgetProvider<TConfig = unknown, TData = unknown> = {
  id: string;
  fetch: (ctx: WidgetProviderContext<TConfig>) => Promise<WidgetProviderResult<TData>>;
};

/**
 * Erased provider type for heterogeneous server registries.
 * Callers should parse/validate config before invoking when using this form.
 */
export type AnyWidgetProvider = {
  id: string;
  fetch: (ctx: WidgetProviderContext<unknown>) => Promise<WidgetProviderResult<unknown>>;
};

export type DefineWidgetProviderInput<TConfig, TData> = {
  id: string;
  fetch: (ctx: WidgetProviderContext<TConfig>) => Promise<WidgetProviderResult<TData>>;
};

export function defineWidgetProvider<TConfig, TData>(
  input: DefineWidgetProviderInput<TConfig, TData>,
): WidgetProvider<TConfig, TData> {
  if (!input.id.trim()) {
    throw new Error("Widget provider id must be non-empty");
  }
  return {
    id: input.id,
    fetch: input.fetch,
  };
}

/**
 * Helper for providers that validate config with Zod before fetching.
 */
export function createValidatedProvider<TConfig extends z.ZodType, TData>(
  id: string,
  configSchema: TConfig,
  fetch: (ctx: WidgetProviderContext<z.infer<TConfig>>) => Promise<WidgetProviderResult<TData>>,
): WidgetProvider<z.infer<TConfig>, TData> {
  return defineWidgetProvider({
    id,
    fetch: async (ctx) => {
      const config = configSchema.parse(ctx.config);
      return fetch({ ...ctx, config });
    },
  });
}

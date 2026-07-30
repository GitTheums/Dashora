import { z } from "zod";

/** Built-in search engines with safe HTTPS templates. `{query}` is URL-encoded at build time. */
export const SEARCH_ENGINE_PRESETS = {
  duckduckgo: {
    id: "duckduckgo",
    label: "DuckDuckGo",
    template: "https://duckduckgo.com/?q={query}",
  },
  google: {
    id: "google",
    label: "Google",
    template: "https://www.google.com/search?q={query}",
  },
  bing: {
    id: "bing",
    label: "Bing",
    template: "https://www.bing.com/search?q={query}",
  },
  wikipedia: {
    id: "wikipedia",
    label: "Wikipedia",
    template: "https://en.wikipedia.org/w/index.php?search={query}",
  },
} as const;

export const searchEnginePresetIdSchema = z.enum([
  "duckduckgo",
  "google",
  "bing",
  "wikipedia",
  "custom",
]);

export type SearchEnginePresetId = z.infer<typeof searchEnginePresetIdSchema>;

export const searchQuickLinkSchema = z.object({
  id: z.string().uuid(),
  label: z.string().trim().min(1).max(40),
  url: z
    .string()
    .trim()
    .url()
    .refine((value) => /^https?:\/\//i.test(value), "Quick links must use http or https"),
});

export type SearchQuickLink = z.infer<typeof searchQuickLinkSchema>;

export const searchConfigSchema = z
  .object({
    engine: searchEnginePresetIdSchema.default("duckduckgo"),
    /** Required when engine is `custom`. Must include `{query}` and use https. */
    customTemplate: z.string().trim().max(500).optional(),
    /** Keyboard shortcut, e.g. `Ctrl+K`, `Meta+/`, or `/`. Empty disables. */
    keyboardShortcut: z.string().trim().max(32).default("/"),
    openInNewTab: z.boolean().default(false),
    placeholder: z.string().trim().min(1).max(80).default("Search the web…"),
    quickLinks: z.array(searchQuickLinkSchema).max(12).default([]),
    enabled: z.boolean().default(true),
  })
  .superRefine((value, ctx) => {
    if (value.engine === "custom") {
      const template = value.customTemplate?.trim() ?? "";
      if (!template) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Custom search template is required",
          path: ["customTemplate"],
        });
        return;
      }
      const check = validateSearchTemplate(template);
      if (!check.ok) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: check.error,
          path: ["customTemplate"],
        });
      }
    }
  });

export type SearchConfig = z.infer<typeof searchConfigSchema>;

export const SEARCH_DEFAULT_CONFIG: SearchConfig = searchConfigSchema.parse({});

export const searchDataSchema = z.object({
  engineId: searchEnginePresetIdSchema,
  engineLabel: z.string().min(1),
  template: z.string().min(1),
  placeholder: z.string().min(1),
  keyboardShortcut: z.string(),
  openInNewTab: z.boolean(),
  quickLinks: z.array(searchQuickLinkSchema),
});

export type SearchData = z.infer<typeof searchDataSchema>;

export type SearchTemplateValidation =
  | { ok: true; template: string }
  | { ok: false; error: string };

/**
 * Validates a search URL template. Only http(s) absolute URLs with a `{query}`
 * placeholder are accepted — blocks javascript:, data:, and relative schemes.
 */
export function validateSearchTemplate(raw: string): SearchTemplateValidation {
  const template = raw.trim();
  if (!template.includes("{query}")) {
    return { ok: false, error: "Template must include a {query} placeholder" };
  }
  if (
    [...template].some((char) => {
      const code = char.charCodeAt(0);
      return code <= 0x1f || code === 0x7f;
    })
  ) {
    return { ok: false, error: "Template contains control characters" };
  }
  const probe = template.replaceAll("{query}", "dashora");
  let url: URL;
  try {
    url = new URL(probe);
  } catch {
    return { ok: false, error: "Template must be an absolute URL" };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, error: "Only http and https search URLs are allowed" };
  }
  if (url.username || url.password) {
    return { ok: false, error: "Search URLs must not include credentials" };
  }
  return { ok: true, template };
}

/** Builds a navigation URL for a query. Returns null when the template is unsafe. */
export function buildSearchUrl(template: string, query: string): string | null {
  const validated = validateSearchTemplate(template);
  if (!validated.ok) {
    return null;
  }
  const encoded = encodeURIComponent(query.trim());
  if (!encoded) {
    return null;
  }
  const built = validated.template.replaceAll("{query}", encoded);
  try {
    const url = new URL(built);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

export function resolveSearchTemplate(config: SearchConfig): SearchTemplateValidation {
  if (config.engine === "custom") {
    return validateSearchTemplate(config.customTemplate ?? "");
  }
  const preset = SEARCH_ENGINE_PRESETS[config.engine];
  return { ok: true, template: preset.template };
}

export function resolveSearchData(config: SearchConfig): SearchData | null {
  const resolved = resolveSearchTemplate(config);
  if (!resolved.ok) {
    return null;
  }
  const engineLabel =
    config.engine === "custom" ? "Custom" : SEARCH_ENGINE_PRESETS[config.engine].label;
  return searchDataSchema.parse({
    engineId: config.engine,
    engineLabel,
    template: resolved.template,
    placeholder: config.placeholder,
    keyboardShortcut: config.keyboardShortcut,
    openInNewTab: config.openInNewTab,
    quickLinks: config.quickLinks,
  });
}

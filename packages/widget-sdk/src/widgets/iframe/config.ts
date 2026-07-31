import { z } from "zod";

function isValidEmbedUrl(value: string): boolean {
  if (!/^https:\/\//i.test(value)) {
    return false;
  }
  try {
    const parsed = new URL(value);
    if (parsed.username || parsed.password) {
      return false;
    }
    const host = parsed.hostname.toLowerCase();
    return host !== "localhost" && !host.endsWith(".localhost");
  } catch {
    return false;
  }
}

const embedUrlSchema = z
  .string()
  .trim()
  .min(1)
  .max(2048)
  .url()
  .refine((value) => isValidEmbedUrl(value), "Embed URLs must be https without credentials");

const hostnameAllowSchema = z
  .string()
  .trim()
  .min(1)
  .max(253)
  .regex(
    /^(?:\*\.)?(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i,
    "Allow-list entries must be hostnames (optional *. prefix)",
  );

export const iframeAspectRatioSchema = z.enum(["16:9", "4:3", "1:1", "21:9", "3:4", "custom"]);
export type IframeAspectRatio = z.infer<typeof iframeAspectRatioSchema>;

export const IFRAME_ASPECT_RATIO_VALUES: Record<Exclude<IframeAspectRatio, "custom">, number> = {
  "16:9": 16 / 9,
  "4:3": 4 / 3,
  "1:1": 1,
  "21:9": 21 / 9,
  "3:4": 3 / 4,
};

export const iframeSandboxFlagsSchema = z.object({
  allowScripts: z.boolean().default(false),
  allowSameOrigin: z.boolean().default(false),
  allowForms: z.boolean().default(false),
  allowPopups: z.boolean().default(false),
  allowPopupsToEscapeSandbox: z.boolean().default(false),
  allowDownloads: z.boolean().default(false),
  allowModals: z.boolean().default(false),
});

export type IframeSandboxFlags = z.infer<typeof iframeSandboxFlagsSchema>;

export const iframeConfigSchema = z
  .object({
    url: z.string().trim().max(2048).default(""),
    aspectRatio: iframeAspectRatioSchema.default("16:9"),
    /** Used when aspectRatio is `custom` (width / height). */
    customAspectRatio: z
      .number()
      .finite()
      .min(0.25)
      .max(4)
      .default(16 / 9),
    sandbox: iframeSandboxFlagsSchema.default({}),
    /** Optional hostname allow list. Empty means any valid https URL. */
    allowList: z.array(hostnameAllowSchema).max(50).default([]),
    /** Accessible name for the iframe element. */
    frameTitle: z.string().trim().min(1).max(80).default("Embedded content"),
    enabled: z.boolean().default(true),
  })
  .superRefine((config, ctx) => {
    if (!config.url.trim()) {
      return;
    }
    if (!isValidEmbedUrl(config.url)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Embed URLs must be https without credentials (localhost is not allowed)",
        path: ["url"],
      });
      return;
    }
    if (config.allowList.length === 0) {
      return;
    }
    const host = new URL(config.url).hostname.toLowerCase();
    const allowed = config.allowList.some((entry) => hostnameMatchesAllow(entry, host));
    if (!allowed) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "URL host is not in the allow list",
        path: ["url"],
      });
    }
  });

export type IframeConfig = z.infer<typeof iframeConfigSchema>;

export const IFRAME_DEFAULT_CONFIG: IframeConfig = iframeConfigSchema.parse({});

export const iframeEmbedProbeSchema = z.object({
  checkedAt: z.string().datetime({ offset: true }),
  /** True when headers indicate the target refuses framing. */
  embeddingRefused: z.boolean(),
  /** Operator-safe explanation when embedding may fail. */
  warning: z.string().max(400).nullable(),
  urlLabel: z.string().max(300),
});

export type IframeEmbedProbe = z.infer<typeof iframeEmbedProbeSchema>;

export const iframeDataSchema = z.object({
  url: z.string().url(),
  aspectRatio: z.number().finite().positive(),
  sandbox: z.string().max(300),
  frameTitle: z.string().min(1).max(80),
  embedProbe: iframeEmbedProbeSchema.nullable(),
});

export type IframeData = z.infer<typeof iframeDataSchema>;

export function hostnameMatchesAllow(pattern: string, hostname: string): boolean {
  const normalizedPattern = pattern.trim().toLowerCase();
  const host = hostname.trim().toLowerCase();
  if (normalizedPattern.startsWith("*.")) {
    const suffix = normalizedPattern.slice(2);
    return host === suffix || host.endsWith(`.${suffix}`);
  }
  return host === normalizedPattern;
}

export function resolveIframeAspectRatio(config: IframeConfig): number {
  if (config.aspectRatio === "custom") {
    return config.customAspectRatio;
  }
  return IFRAME_ASPECT_RATIO_VALUES[config.aspectRatio];
}

/**
 * Build the iframe sandbox attribute. Defaults are fully restrictive (empty token list).
 * Never includes allow-top-navigation or allow-top-navigation-by-user-activation.
 */
export function buildIframeSandboxAttribute(flags: IframeSandboxFlags): string {
  const parts: string[] = [];
  if (flags.allowScripts) {
    parts.push("allow-scripts");
  }
  if (flags.allowSameOrigin) {
    parts.push("allow-same-origin");
  }
  if (flags.allowForms) {
    parts.push("allow-forms");
  }
  if (flags.allowPopups) {
    parts.push("allow-popups");
  }
  if (flags.allowPopupsToEscapeSandbox) {
    parts.push("allow-popups-to-escape-sandbox");
  }
  if (flags.allowDownloads) {
    parts.push("allow-downloads");
  }
  if (flags.allowModals) {
    parts.push("allow-modals");
  }
  return parts.join(" ");
}

export function validateIframeUrl(
  url: string,
  allowList: string[] = [],
): { ok: true; url: string } | { ok: false; message: string } {
  const parsed = embedUrlSchema.safeParse(url);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid embed URL" };
  }
  if (allowList.length > 0) {
    const host = new URL(parsed.data).hostname.toLowerCase();
    const allowed = allowList.some((entry) => hostnameMatchesAllow(entry, host));
    if (!allowed) {
      return { ok: false, message: "URL host is not in the allow list" };
    }
  }
  return { ok: true, url: parsed.data };
}

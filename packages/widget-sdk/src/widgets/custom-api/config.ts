import { z } from "zod";

function isValidRequestUrl(value: string): boolean {
  if (!/^https?:\/\//i.test(value)) {
    return false;
  }
  try {
    const parsed = new URL(value);
    return !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}

/** Limited JSON path: `$.a.b[0].c` or `a.b[0].c` — no filters, scripts, or recursive descent. */
export const jsonPathSchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(
    /^\$?(?:\.?[A-Za-z_][A-Za-z0-9_]*|\[\d+\])+$/,
    "Use a simple path such as data.value or items[0].title",
  )
  .refine((value) => !value.includes(".."), "Recursive descent (..) is not allowed");

export const customApiMethodSchema = z.enum(["GET", "POST"]);
export type CustomApiMethod = z.infer<typeof customApiMethodSchema>;

export const customApiTemplateSchema = z.enum(["text", "metric", "list", "progress", "status"]);
export type CustomApiTemplate = z.infer<typeof customApiTemplateSchema>;

export const customApiStatusStateSchema = z.enum(["ok", "warn", "error", "unknown"]);
export type CustomApiStatusState = z.infer<typeof customApiStatusStateSchema>;

const headerNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9][A-Za-z0-9-_]*$/, "Invalid header name");

const headerLiteralSchema = z
  .string()
  .max(2048)
  .refine((value) => !/[\r\n\0]/.test(value), "Header values must not contain control characters");

export const customApiHeaderSchema = z
  .object({
    id: z.string().uuid(),
    name: headerNameSchema,
    /** Plain header value (never use for secrets). */
    value: headerLiteralSchema.optional().default(""),
    /** Server-stored api-secret integration id. */
    secretId: z.string().uuid().nullable().optional().default(null),
  })
  .superRefine((header, ctx) => {
    const hasSecret = typeof header.secretId === "string" && header.secretId.length > 0;
    const hasValue = header.value.trim().length > 0;
    if (!hasSecret && !hasValue) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Each header needs a value or a secret reference",
        path: ["value"],
      });
    }
  });

export type CustomApiHeader = z.infer<typeof customApiHeaderSchema>;

export const customApiMappingSchema = z.object({
  textPath: jsonPathSchema.optional(),
  metricValuePath: jsonPathSchema.optional(),
  metricLabelPath: jsonPathSchema.optional(),
  metricUnitPath: jsonPathSchema.optional(),
  listItemsPath: jsonPathSchema.optional(),
  listTitlePath: jsonPathSchema.optional(),
  listSubtitlePath: jsonPathSchema.optional(),
  listValuePath: jsonPathSchema.optional(),
  progressValuePath: jsonPathSchema.optional(),
  progressMaxPath: jsonPathSchema.optional(),
  progressLabelPath: jsonPathSchema.optional(),
  statusStatePath: jsonPathSchema.optional(),
  statusLabelPath: jsonPathSchema.optional(),
  statusDetailPath: jsonPathSchema.optional(),
});

export type CustomApiMapping = z.infer<typeof customApiMappingSchema>;

export const customApiConfigSchema = z
  .object({
    url: z.string().trim().max(2048).default(""),
    method: customApiMethodSchema.default("GET"),
    headers: z.array(customApiHeaderSchema).max(20).default([]),
    /** JSON body for POST requests (plain text, not evaluated). */
    body: z
      .string()
      .max(32_768)
      .default("")
      .refine((value) => !/[\0]/.test(value), "Body must not contain null bytes"),
    template: customApiTemplateSchema.default("text"),
    mapping: customApiMappingSchema.default({}),
    /** Operator opt-in to reach private/LAN targets (SSRF bypass). */
    allowPrivateNetwork: z.boolean().default(false),
    /** Request timeout in milliseconds (capped server-side). */
    timeoutMs: z.number().int().min(1_000).max(30_000).default(10_000),
    enabled: z.boolean().default(true),
  })
  .superRefine((config, ctx) => {
    if (!config.url.trim()) {
      return;
    }
    if (!isValidRequestUrl(config.url)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Request URLs must be absolute http(s) without credentials",
        path: ["url"],
      });
      return;
    }
    if (config.template === "text" && !config.mapping.textPath) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Text template requires a text path",
        path: ["mapping", "textPath"],
      });
    }
    if (config.template === "metric" && !config.mapping.metricValuePath) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Metric template requires a value path",
        path: ["mapping", "metricValuePath"],
      });
    }
    if (config.template === "list") {
      if (!config.mapping.listItemsPath) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "List template requires an items path",
          path: ["mapping", "listItemsPath"],
        });
      }
      if (!config.mapping.listTitlePath) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "List template requires a title path (relative to each item)",
          path: ["mapping", "listTitlePath"],
        });
      }
    }
    if (config.template === "progress" && !config.mapping.progressValuePath) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Progress template requires a value path",
        path: ["mapping", "progressValuePath"],
      });
    }
    if (config.template === "status") {
      if (!config.mapping.statusStatePath && !config.mapping.statusLabelPath) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Status template requires a state path and/or label path",
          path: ["mapping", "statusLabelPath"],
        });
      }
    }
  });

export type CustomApiConfig = z.infer<typeof customApiConfigSchema>;

export const CUSTOM_API_DEFAULT_CONFIG: CustomApiConfig = customApiConfigSchema.parse({});

export const customApiListItemSchema = z.object({
  title: z.string().min(1).max(200),
  subtitle: z.string().max(300).optional(),
  value: z.string().max(120).optional(),
});

export type CustomApiListItem = z.infer<typeof customApiListItemSchema>;

export const customApiPresentationSchema = z.object({
  template: customApiTemplateSchema,
  text: z
    .object({
      content: z.string().max(2_000),
    })
    .optional(),
  metric: z
    .object({
      value: z.string().max(80),
      label: z.string().max(120).optional(),
      unit: z.string().max(40).optional(),
    })
    .optional(),
  list: z
    .object({
      items: z.array(customApiListItemSchema).max(50),
    })
    .optional(),
  progress: z
    .object({
      value: z.number().finite(),
      max: z.number().finite().positive(),
      label: z.string().max(120).optional(),
    })
    .optional(),
  status: z
    .object({
      state: customApiStatusStateSchema,
      label: z.string().min(1).max(120),
      detail: z.string().max(300).optional(),
    })
    .optional(),
});

export type CustomApiPresentation = z.infer<typeof customApiPresentationSchema>;

export const customApiDataSchema = z.object({
  presentation: customApiPresentationSchema,
  httpStatus: z.number().int().min(100).max(599),
  fetchedAt: z.string().datetime({ offset: true }),
  /** Display-safe URL label (no query secrets). */
  urlLabel: z.string().min(1).max(300),
});

export type CustomApiData = z.infer<typeof customApiDataSchema>;

export const customApiPreviewRequestSchema = customApiConfigSchema;
export type CustomApiPreviewRequest = z.infer<typeof customApiPreviewRequestSchema>;

export const customApiPreviewResponseSchema = z.object({
  ok: z.boolean(),
  state: z.enum(["success", "empty", "error", "configuration-required"]),
  message: z.string().max(500).optional(),
  errorCode: z.string().max(64).optional(),
  data: customApiDataSchema.optional(),
  /** Redacted request summary for the settings UI. */
  requestSummary: z
    .object({
      method: customApiMethodSchema,
      urlLabel: z.string().max(300),
      headerNames: z.array(z.string().max(64)).max(20),
      allowPrivateNetwork: z.boolean(),
      timeoutMs: z.number().int(),
    })
    .optional(),
});

export type CustomApiPreviewResponse = z.infer<typeof customApiPreviewResponseSchema>;

export const CUSTOM_API_TEMPLATE_LABELS: Record<CustomApiTemplate, string> = {
  text: "Text",
  metric: "Metric",
  list: "List",
  progress: "Progress",
  status: "Status",
};

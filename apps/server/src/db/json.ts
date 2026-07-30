import { type ZodIssue, type ZodTypeAny, z } from "zod";

export class JsonValidationError extends Error {
  readonly field: string;
  override readonly cause: z.ZodError;

  constructor(field: string, cause: z.ZodError) {
    const details = cause.issues
      .map((issue: ZodIssue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; ");
    super(`Invalid JSON for ${field}: ${details}`);
    this.name = "JsonValidationError";
    this.field = field;
    this.cause = cause;
  }
}

/** Accept any JSON-serializable object/array/primitive tree (not undefined). */
export const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(jsonValueSchema),
  ]),
);

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export const jsonObjectSchema = z.record(jsonValueSchema);

export function serializeJson<T>(schema: ZodTypeAny, value: T, fieldName: string): string {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new JsonValidationError(fieldName, parsed.error);
  }
  return JSON.stringify(parsed.data);
}

export function parseJsonColumn<T>(schema: ZodTypeAny, raw: string, fieldName: string): T {
  let decoded: unknown;
  try {
    decoded = JSON.parse(raw) as unknown;
  } catch {
    throw new Error(`Invalid JSON text for ${fieldName}`);
  }
  const parsed = schema.safeParse(decoded);
  if (!parsed.success) {
    throw new JsonValidationError(fieldName, parsed.error);
  }
  return parsed.data as T;
}

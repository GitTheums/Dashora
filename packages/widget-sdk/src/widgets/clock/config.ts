import { z } from "zod";

export const clockHourFormatSchema = z.enum(["12", "24"]);
export type ClockHourFormat = z.infer<typeof clockHourFormatSchema>;

export const clockDateFormatSchema = z.enum(["full", "long", "medium", "short", "none"]);
export type ClockDateFormat = z.infer<typeof clockDateFormatSchema>;

const timezoneSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .refine((value) => {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, "Invalid IANA timezone");

export const clockConfigSchema = z
  .object({
    timezone: timezoneSchema.default("UTC"),
    hourFormat: clockHourFormatSchema.default("24"),
    showSeconds: z.boolean().default(false),
    secondaryTimezone: timezoneSchema.optional().nullable(),
    dateFormat: clockDateFormatSchema.default("medium"),
    enabled: z.boolean().default(true),
  })
  .superRefine((value, ctx) => {
    if (value.secondaryTimezone && value.secondaryTimezone.trim() === value.timezone.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Secondary timezone must differ from the primary timezone",
        path: ["secondaryTimezone"],
      });
    }
  });

export type ClockConfig = z.infer<typeof clockConfigSchema>;

export const CLOCK_DEFAULT_CONFIG: ClockConfig = clockConfigSchema.parse({});

export const clockFaceSchema = z.object({
  timezone: z.string().min(1),
  label: z.string().min(1),
  time: z.string().min(1),
  date: z.string().nullable(),
});

export type ClockFace = z.infer<typeof clockFaceSchema>;

export const clockDataSchema = z.object({
  primary: clockFaceSchema,
  secondary: clockFaceSchema.nullable(),
  generatedAt: z.string().datetime({ offset: true }),
});

export type ClockData = z.infer<typeof clockDataSchema>;

function timezoneLabel(timezone: string): string {
  return timezone.replaceAll("_", " ");
}

function formatTime(
  date: Date,
  timezone: string,
  hourFormat: ClockHourFormat,
  showSeconds: boolean,
): string {
  return new Intl.DateTimeFormat(undefined, {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
    ...(showSeconds ? { second: "2-digit" as const } : {}),
    hour12: hourFormat === "12",
  }).format(date);
}

function formatDate(date: Date, timezone: string, dateFormat: ClockDateFormat): string | null {
  if (dateFormat === "none") {
    return null;
  }
  return new Intl.DateTimeFormat(undefined, {
    timeZone: timezone,
    dateStyle: dateFormat,
  }).format(date);
}

export function buildClockData(config: ClockConfig, now: Date = new Date()): ClockData {
  const primary: ClockFace = {
    timezone: config.timezone,
    label: timezoneLabel(config.timezone),
    time: formatTime(now, config.timezone, config.hourFormat, config.showSeconds),
    date: formatDate(now, config.timezone, config.dateFormat),
  };
  const secondary =
    config.secondaryTimezone && config.secondaryTimezone.trim().length > 0
      ? {
          timezone: config.secondaryTimezone,
          label: timezoneLabel(config.secondaryTimezone),
          time: formatTime(now, config.secondaryTimezone, config.hourFormat, config.showSeconds),
          date: formatDate(now, config.secondaryTimezone, config.dateFormat),
        }
      : null;

  return clockDataSchema.parse({
    primary,
    secondary,
    generatedAt: now.toISOString(),
  });
}

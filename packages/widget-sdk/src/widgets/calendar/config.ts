import { z } from "zod";
import { newConfigEntryId } from "../_shared/ids.js";

export const calendarLayoutSchema = z.enum(["day", "agenda", "month-summary"]);
export type CalendarLayout = z.infer<typeof calendarLayoutSchema>;

/** Design-token accent keys for per-source calendar chrome. */
export const calendarColorTokenSchema = z.enum([
  "primary",
  "secondary",
  "success",
  "warning",
  "danger",
  "muted",
]);

export type CalendarColorToken = z.infer<typeof calendarColorTokenSchema>;

export const CALENDAR_COLOR_CSS: Record<CalendarColorToken, string> = {
  primary: "var(--ds-primary)",
  secondary: "var(--ds-secondary)",
  success: "var(--ds-success)",
  warning: "var(--ds-warning)",
  danger: "var(--ds-danger)",
  muted: "var(--ds-fg-muted)",
};

const httpsUrlSchema = z
  .string()
  .trim()
  .url()
  .refine((value) => /^https?:\/\//i.test(value), "Feed URLs must use http or https")
  .refine((value) => {
    try {
      const parsed = new URL(value);
      return !parsed.username && !parsed.password;
    } catch {
      return false;
    }
  }, "Feed URLs must not include credentials");

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

export const calendarFeedConfigSchema = z.object({
  id: z.string().uuid(),
  url: httpsUrlSchema,
  titleOverride: z.string().trim().max(80).optional().default(""),
  color: calendarColorTokenSchema.default("primary"),
  /** Optional server-stored basic-auth credential id. */
  credentialId: z.string().uuid().optional().nullable().default(null),
});

export type CalendarFeedConfig = z.infer<typeof calendarFeedConfigSchema>;

export const calendarConfigSchema = z.object({
  feeds: z.array(calendarFeedConfigSchema).max(10).default([]),
  layout: calendarLayoutSchema.default("agenda"),
  timezone: timezoneSchema.default("UTC"),
  /** How many days ahead of today to include (inclusive of today). */
  lookAheadDays: z.number().int().min(1).max(90).default(14),
  maxEvents: z.number().int().min(1).max(200).default(50),
  hideDescriptions: z.boolean().default(false),
  /** Replace PRIVATE/CONFIDENTIAL titles and clear details. */
  redactPrivateDetails: z.boolean().default(true),
  enabled: z.boolean().default(true),
});

export type CalendarConfig = z.infer<typeof calendarConfigSchema>;

export const CALENDAR_DEFAULT_CONFIG: CalendarConfig = calendarConfigSchema.parse({});

export const calendarFeedStatusSchema = z.enum(["ok", "empty", "error"]);
export type CalendarFeedStatus = z.infer<typeof calendarFeedStatusSchema>;

export const calendarFeedResultSchema = z.object({
  id: z.string().uuid(),
  url: z.string().url(),
  title: z.string().min(1).max(120),
  color: calendarColorTokenSchema,
  status: calendarFeedStatusSchema,
  message: z.string().max(240).optional(),
  eventCount: z.number().int().nonnegative(),
  cacheStatus: z.enum(["hit", "miss", "stale", "bypass"]).optional(),
  hasCredential: z.boolean().default(false),
});

export type CalendarFeedResult = z.infer<typeof calendarFeedResultSchema>;

export const calendarEventSchema = z.object({
  id: z.string().min(1).max(240),
  title: z.string().min(1).max(240),
  description: z.string().max(500).optional().default(""),
  location: z.string().max(240).optional().default(""),
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }),
  allDay: z.boolean(),
  /** YYYY-MM-DD for all-day events when known. */
  allDayDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  isPrivate: z.boolean(),
  feedId: z.string().uuid(),
  feedTitle: z.string().min(1).max(120),
  color: calendarColorTokenSchema,
});

export type CalendarEvent = z.infer<typeof calendarEventSchema>;

export const calendarDaySummarySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  eventCount: z.number().int().nonnegative(),
  isToday: z.boolean(),
});

export type CalendarDaySummary = z.infer<typeof calendarDaySummarySchema>;

export const calendarDataSchema = z.object({
  layout: calendarLayoutSchema,
  timezone: z.string().min(1),
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  lookAheadDays: z.number().int().positive(),
  hideDescriptions: z.boolean(),
  redactPrivateDetails: z.boolean(),
  events: z.array(calendarEventSchema).max(200),
  /** Present for month-summary layout (and useful elsewhere). */
  daySummaries: z.array(calendarDaySummarySchema).max(93).default([]),
  feeds: z.array(calendarFeedResultSchema).max(10),
  fetchedAt: z.string().datetime({ offset: true }),
  failedFeedCount: z.number().int().nonnegative(),
});

export type CalendarData = z.infer<typeof calendarDataSchema>;

export function newCalendarFeedId(): string {
  return newConfigEntryId();
}

import type { CalendarBasicAuth } from "./fetcher.js";

const PRIVATE_TITLE = "Private event";

export function stripControlChars(value: string, maxLength: number): string {
  let cleaned = "";
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code === 9 || code === 10 || code === 13 || (code >= 32 && code !== 127)) {
      cleaned += char;
    }
  }
  return cleaned.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

/**
 * Parses a server-stored basic-auth secret payload.
 * Format: `ics-basic-auth:v1:` + JSON `{"username":"...","password":"..."}`.
 */
export function parseBasicAuthSecret(raw: string | null | undefined): CalendarBasicAuth | null {
  if (!raw) {
    return null;
  }
  const prefix = "ics-basic-auth:v1:";
  if (!raw.startsWith(prefix)) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw.slice(prefix.length)) as {
      username?: unknown;
      password?: unknown;
    };
    if (typeof parsed.username !== "string" || typeof parsed.password !== "string") {
      return null;
    }
    const username = parsed.username.trim();
    const password = parsed.password;
    if (!username || password.length === 0) {
      return null;
    }
    return { username: username.slice(0, 128), password: password.slice(0, 256) };
  } catch {
    return null;
  }
}

export function encodeBasicAuthSecret(username: string, password: string): string {
  return `ics-basic-auth:v1:${JSON.stringify({ username, password })}`;
}

export function isPrivateClassification(classification: string | undefined): boolean {
  const upper = (classification ?? "").toUpperCase();
  return upper === "PRIVATE" || upper === "CONFIDENTIAL";
}

export function redactEventFields(input: {
  title: string;
  description: string;
  location: string;
  isPrivate: boolean;
  redactPrivateDetails: boolean;
  hideDescriptions: boolean;
}): { title: string; description: string; location: string } {
  let title = stripControlChars(input.title, 240) || "Untitled event";
  let description = stripControlChars(input.description, 500);
  let location = stripControlChars(input.location, 240);

  if (input.redactPrivateDetails && input.isPrivate) {
    title = PRIVATE_TITLE;
    description = "";
    location = "";
  }

  if (input.hideDescriptions) {
    description = "";
  }

  return { title, description, location };
}

/** YYYY-MM-DD for an instant in an IANA timezone. */
export function dateKeyInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

/** Start of a calendar day (00:00) in an IANA zone, as UTC ms. */
export function startOfDayInTimeZone(dateKey: string, timeZone: string): number {
  const [year, month, day] = dateKey.split("-").map(Number);
  const y = year ?? 1970;
  const m = month ?? 1;
  const d = day ?? 1;
  // Binary search / guess: iterate offsets similar to zonedLocalToUtc
  const utcGuess = Date.UTC(y, m - 1, d, 0, 0, 0);
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const read = (ms: number) => {
    const parts = dtf.formatToParts(new Date(ms));
    const get = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((part) => part.type === type)?.value);
    return Date.UTC(
      get("year"),
      get("month") - 1,
      get("day"),
      get("hour"),
      get("minute"),
      get("second"),
    );
  };
  return utcGuess - (read(utcGuess) - utcGuess);
}

export function addDaysToDateKey(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const ms = Date.UTC(year ?? 1970, (month ?? 1) - 1, (day ?? 1) + days);
  const date = new Date(ms);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatEventTime(iso: string, timeZone: string, allDay: boolean): string {
  if (allDay) {
    return "All day";
  }
  return new Intl.DateTimeFormat(undefined, {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatEventDate(
  iso: string,
  timeZone: string,
  allDay: boolean,
  allDayDate?: string,
): string {
  if (allDay && allDayDate) {
    const [y, m, d] = allDayDate.split("-").map(Number);
    return new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    }).format(new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)));
  }
  return new Intl.DateTimeFormat(undefined, {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(iso));
}

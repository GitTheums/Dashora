import type { WeatherUnits } from "./config.js";
import { temperatureUnitLabel, windSpeedUnitLabel } from "./config.js";

export function formatTemperature(value: number, units: WeatherUnits): string {
  const rounded = Math.round(value);
  return `${rounded}${temperatureUnitLabel(units)}`;
}

export function formatWindSpeed(value: number | null, units: WeatherUnits): string {
  if (value === null || !Number.isFinite(value)) {
    return "—";
  }
  return `${Math.round(value)} ${windSpeedUnitLabel(units)}`;
}

export function formatPrecipitationProbability(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "—";
  }
  return `${Math.max(0, Math.min(100, Math.round(value)))}%`;
}

/**
 * Formats an instant in the location timezone (falls back to UTC on invalid zones).
 */
export function formatInTimezone(
  iso: string,
  timezone: string,
  options: Intl.DateTimeFormatOptions,
): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  try {
    return new Intl.DateTimeFormat(undefined, { timeZone: timezone, ...options }).format(date);
  } catch {
    try {
      return new Intl.DateTimeFormat(undefined, { timeZone: "UTC", ...options }).format(date);
    } catch {
      return date.toISOString();
    }
  }
}

export function formatHourLabel(iso: string, timezone: string): string {
  return formatInTimezone(iso, timezone, { hour: "numeric" });
}

export function formatDayLabel(dateValue: string, timezone: string): string {
  // Daily points may be YYYY-MM-DD; append noon UTC for stable formatting.
  const iso = dateValue.includes("T") ? dateValue : `${dateValue}T12:00:00.000Z`;
  return formatInTimezone(iso, timezone, { weekday: "short" });
}

export function formatObservedAt(iso: string, timezone: string): string {
  return formatInTimezone(iso, timezone, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

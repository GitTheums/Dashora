/**
 * Relative timestamps for GitHub widgets (English UI).
 */
export function formatRelativeTimestamp(
  iso: string | null | undefined,
  nowMs = Date.now(),
): string {
  if (!iso) {
    return "";
  }
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) {
    return "";
  }
  const deltaSeconds = Math.round((then - nowMs) / 1000);
  const abs = Math.abs(deltaSeconds);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  if (abs < 60) {
    return rtf.format(deltaSeconds, "second");
  }
  const minutes = Math.round(deltaSeconds / 60);
  if (Math.abs(minutes) < 60) {
    return rtf.format(minutes, "minute");
  }
  const hours = Math.round(deltaSeconds / 3600);
  if (Math.abs(hours) < 48) {
    return rtf.format(hours, "hour");
  }
  const days = Math.round(deltaSeconds / 86_400);
  if (Math.abs(days) < 60) {
    return rtf.format(days, "day");
  }
  const months = Math.round(deltaSeconds / 2_592_000);
  if (Math.abs(months) < 24) {
    return rtf.format(months, "month");
  }
  const years = Math.round(deltaSeconds / 31_536_000);
  return rtf.format(years, "year");
}

export function formatCompactCount(value: number): string {
  if (!Number.isFinite(value) || value < 0) {
    return "0";
  }
  if (value < 1_000) {
    return String(Math.trunc(value));
  }
  if (value < 1_000_000) {
    const thousands = value / 1_000;
    const rounded = thousands >= 100 ? Math.round(thousands) : Math.round(thousands * 10) / 10;
    return `${rounded}k`;
  }
  const millions = value / 1_000_000;
  const rounded = millions >= 100 ? Math.round(millions) : Math.round(millions * 10) / 10;
  return `${rounded}M`;
}

export function buildLatestActivitySummary(
  pushedAt: string | null,
  updatedAt: string | null,
  nowMs = Date.now(),
): string {
  const basis = pushedAt ?? updatedAt;
  if (!basis) {
    return "No recent activity reported.";
  }
  const relative = formatRelativeTimestamp(basis, nowMs);
  if (!relative) {
    return "No recent activity reported.";
  }
  if (pushedAt && pushedAt === basis) {
    return `Last push ${relative}.`;
  }
  return `Last update ${relative}.`;
}

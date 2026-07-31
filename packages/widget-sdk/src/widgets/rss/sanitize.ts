/**
 * Plain-text sanitization for untrusted feed content.
 * Never use the output with dangerouslySetInnerHTML — text nodes only.
 */

const ENTITY_MAP: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decodeBasicEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-fA-F]+);/g, (_match, hex: string) => {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : "";
    })
    .replace(/&#(\d+);/g, (_match, dec: string) => {
      const code = Number.parseInt(dec, 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : "";
    })
    .replace(/&([a-zA-Z]+);/g, (match, name: string) => ENTITY_MAP[name.toLowerCase()] ?? match);
}

/**
 * Strips tags / scripts / styles and returns collapsed plain text.
 *
 * Entities are decoded *before* tag-stripping (not after) so an entity-encoded tag like
 * `&lt;script&gt;...&lt;/script&gt;` is normalized to a literal `<script>...</script>` and then
 * removed by the tag-stripping regexes below, instead of surviving into the final text as a
 * literal (inert, but still confusing/unexpected) tag string.
 */
export function stripHtmlToText(input: string | undefined | null, maxLength = 500): string {
  if (!input) {
    return "";
  }
  let text = decodeBasicEntities(input);
  text = text
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/?[^>]+>/g, " ");
  text = text.replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

/**
 * Allows only absolute http(s) URLs without credentials or control characters.
 */
export function sanitizeHttpUrl(value: string | undefined | null): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  for (let i = 0; i < trimmed.length; i += 1) {
    const code = trimmed.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f) {
      return null;
    }
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return null;
  }
  if (parsed.username || parsed.password) {
    return null;
  }
  return parsed.toString();
}

export function normalizeLinkForDedupe(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    const path = parsed.pathname.replace(/\/+$/, "") || "/";
    return `${parsed.protocol}//${parsed.host.toLowerCase()}${path}${parsed.search}`;
  } catch {
    return url.trim().toLowerCase();
  }
}

/**
 * Relative timestamp for feed items (English UI).
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

export function parseFeedDate(value: string | undefined | null): string | null {
  if (!value) {
    return null;
  }
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) {
    return null;
  }
  return new Date(ms).toISOString();
}

const SENSITIVE_HEADER_NAMES = new Set([
  "authorization",
  "proxy-authorization",
  "cookie",
  "set-cookie",
  "x-api-key",
  "x-auth-token",
  "x-cg-demo-api-key",
  "x-cg-pro-api-key",
]);

const SENSITIVE_QUERY_KEYS = new Set([
  "access_token",
  "api_key",
  "apikey",
  "auth",
  "authorization",
  "key",
  "password",
  "secret",
  "token",
]);

const REDACTED = "[Redacted]";

export function isSensitiveHeaderName(name: string): boolean {
  return SENSITIVE_HEADER_NAMES.has(name.toLowerCase());
}

export function isSensitiveQueryKey(key: string): boolean {
  const normalized = key.toLowerCase();
  if (SENSITIVE_QUERY_KEYS.has(normalized)) {
    return true;
  }
  return (
    normalized.includes("token") ||
    normalized.includes("secret") ||
    normalized.includes("password") ||
    normalized.endsWith("_key") ||
    normalized.endsWith("-key")
  );
}

/** Redact Authorization and other sensitive request/response headers. */
export function redactHeaders(
  headers: Headers | Record<string, string | undefined> | Iterable<[string, string]>,
): Record<string, string> {
  const out: Record<string, string> = {};
  const entries =
    headers instanceof Headers
      ? headers.entries()
      : Symbol.iterator in Object(headers)
        ? (headers as Iterable<[string, string]>)
        : Object.entries(headers as Record<string, string | undefined>).filter(
            (entry): entry is [string, string] => typeof entry[1] === "string",
          );

  for (const [name, value] of entries) {
    out[name] = isSensitiveHeaderName(name) ? REDACTED : value;
  }
  return out;
}

/**
 * Redact sensitive query parameter values from a URL string.
 * Returns a display-safe URL; never throws on malformed input.
 */
export function redactUrl(url: string): string {
  try {
    const parsed = new URL(url);
    for (const key of [...parsed.searchParams.keys()]) {
      if (isSensitiveQueryKey(key)) {
        parsed.searchParams.set(key, REDACTED);
      }
    }
    return parsed.toString();
  } catch {
    return "[invalid-url]";
  }
}

/** Build a diagnostics-safe label: host + pathname only (no query, no credentials). */
export function safeUrlLabel(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.username = "";
    parsed.password = "";
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return "[invalid-url]";
  }
}

const DENIED_HEADER_NAMES = new Set([
  "host",
  "content-length",
  "transfer-encoding",
  "connection",
  "keep-alive",
  "upgrade",
  "te",
  "trailer",
  "proxy-authorization",
  "proxy-connection",
  "cookie",
  "set-cookie",
  "origin",
  "referer",
  "x-forwarded-for",
  "x-forwarded-host",
  "x-forwarded-proto",
  "forwarded",
]);

export function isAllowedCustomApiHeaderName(name: string): boolean {
  const normalized = name.trim().toLowerCase();
  if (!normalized || DENIED_HEADER_NAMES.has(normalized)) {
    return false;
  }
  return /^[a-z0-9][a-z0-9-_]*$/.test(normalized);
}

export function sanitizeHeaderLiteral(value: string): string | null {
  if (/[\r\n\0]/.test(value)) {
    return null;
  }
  if (value.length > 2048) {
    return null;
  }
  return value;
}

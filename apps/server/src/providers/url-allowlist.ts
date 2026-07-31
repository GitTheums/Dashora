/**
 * Strict WHATWG URL helpers for provider allowlists.
 * Prefer exact hostname comparison over substring checks on the full URL string.
 */

export type AllowedHttpsUrlOptions = {
  /** Exact hostnames permitted (compared case-insensitively after URL normalization). */
  hostnames: readonly string[];
  /** When set, pathname must equal one of these values (no trailing-slash variants unless listed). */
  pathnames?: readonly string[];
  /** When true (default), reject URLs that include a non-default explicit port. */
  rejectNonDefaultPort?: boolean;
};

export type AllowedHttpsUrlResult =
  | { ok: true; url: URL; hostname: string }
  | { ok: false; reason: string };

function normalizeHostname(hostname: string): string {
  let normalized = hostname.trim().toLowerCase().replace(/\.$/, "");
  // Allowlist entries may include IPv6 brackets; WHATWG `hostname` omits them.
  if (normalized.startsWith("[") && normalized.endsWith("]")) {
    normalized = normalized.slice(1, -1);
  }
  return normalized;
}

/**
 * Parse `input` as an HTTPS URL and verify it matches an exact hostname allowlist.
 * Rejects credentials, unexpected ports, and deceptive suffix/prefix hosts.
 */
export function parseAllowedHttpsUrl(
  input: string,
  options: AllowedHttpsUrlOptions,
): AllowedHttpsUrlResult {
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    return { ok: false, reason: "malformed_url" };
  }

  if (parsed.protocol !== "https:") {
    return { ok: false, reason: "unsupported_protocol" };
  }

  if (parsed.username || parsed.password) {
    return { ok: false, reason: "embedded_credentials" };
  }

  const hostname = normalizeHostname(parsed.hostname);
  if (!hostname) {
    return { ok: false, reason: "invalid_hostname" };
  }

  const allowed = new Set(options.hostnames.map(normalizeHostname));
  if (!allowed.has(hostname)) {
    return { ok: false, reason: "unexpected_hostname" };
  }

  const rejectNonDefaultPort = options.rejectNonDefaultPort !== false;
  if (rejectNonDefaultPort && parsed.port !== "" && parsed.port !== "443") {
    return { ok: false, reason: "unexpected_port" };
  }

  if (options.pathnames) {
    const allowedPaths = new Set(options.pathnames);
    if (!allowedPaths.has(parsed.pathname)) {
      return { ok: false, reason: "unexpected_pathname" };
    }
  }

  return { ok: true, url: parsed, hostname };
}

/** True when `input` is an HTTPS URL whose hostname exactly matches one allowlisted host. */
export function isAllowedHttpsHostname(input: string, hostnames: readonly string[]): boolean {
  return parseAllowedHttpsUrl(input, { hostnames }).ok;
}

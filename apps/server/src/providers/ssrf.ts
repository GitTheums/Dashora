import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { ProviderError } from "./errors.js";

export type SsrfGuardOptions = {
  /** When true, private / loopback / link-local targets are allowed (operator opt-in). */
  allowPrivateNetwork?: boolean;
  /** Resolve hostnames and reject private resolved addresses. Default true. */
  resolveDns?: boolean;
};

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
  "metadata.goog",
  "kubernetes.default",
  "kubernetes.default.svc",
]);

const BLOCKED_HOSTNAME_SUFFIXES = [".localhost", ".local", ".internal", ".lan", ".home", ".corp"];

function normalizeHostname(hostname: string): string {
  return hostname.trim().toLowerCase().replace(/\.$/, "");
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) {
    return null;
  }
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) {
      return null;
    }
    const octet = Number(part);
    if (!Number.isInteger(octet) || octet < 0 || octet > 255) {
      return null;
    }
    value = (value << 8) | octet;
  }
  return value >>> 0;
}

function isPrivateIpv4(ip: string): boolean {
  const value = ipv4ToInt(ip);
  if (value === null) {
    return true;
  }
  // 0.0.0.0/8
  if (value >= 0x00000000 && value <= 0x00ffffff) {
    return true;
  }
  // 10.0.0.0/8
  if (value >= 0x0a000000 && value <= 0x0affffff) {
    return true;
  }
  // 127.0.0.0/8
  if (value >= 0x7f000000 && value <= 0x7fffffff) {
    return true;
  }
  // 169.254.0.0/16 (link-local + cloud metadata)
  if (value >= 0xa9fe0000 && value <= 0xa9feffff) {
    return true;
  }
  // 172.16.0.0/12
  if (value >= 0xac100000 && value <= 0xac1fffff) {
    return true;
  }
  // 192.168.0.0/16
  if (value >= 0xc0a80000 && value <= 0xc0a8ffff) {
    return true;
  }
  // 100.64.0.0/10 (CGNAT)
  if (value >= 0x64400000 && value <= 0x647fffff) {
    return true;
  }
  // 192.0.0.0/24, 192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24 (docs/special)
  if (
    (value >= 0xc0000000 && value <= 0xc00000ff) ||
    (value >= 0xc0000200 && value <= 0xc00002ff) ||
    (value >= 0xc6336400 && value <= 0xc63364ff) ||
    (value >= 0xcb007100 && value <= 0xcb0071ff)
  ) {
    return true;
  }
  // 224.0.0.0/4 multicast and 240.0.0.0/4 reserved
  if (value >= 0xe0000000) {
    return true;
  }
  return false;
}

function expandIpv6(ip: string): number[] | null {
  const trimmed = ip.toLowerCase();
  if (trimmed.includes(".")) {
    // IPv4-mapped handled separately
    return null;
  }
  const sides = trimmed.split("::");
  if (sides.length > 2) {
    return null;
  }
  const head = sides[0] ? sides[0].split(":").filter(Boolean) : [];
  const tail = sides.length === 2 && sides[1] ? sides[1].split(":").filter(Boolean) : [];
  if (sides.length === 1) {
    if (head.length !== 8) {
      return null;
    }
  } else {
    const missing = 8 - head.length - tail.length;
    if (missing < 0) {
      return null;
    }
    const zeros = Array.from({ length: missing }, () => "0");
    const full = [...head, ...zeros, ...tail];
    if (full.length !== 8) {
      return null;
    }
    return full.map((part) => Number.parseInt(part, 16));
  }
  return head.map((part) => Number.parseInt(part, 16));
}

function isPrivateIpv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::" || lower === "::1") {
    return true;
  }
  if (lower.startsWith("::ffff:")) {
    const mapped = lower.slice("::ffff:".length);
    if (isIP(mapped) === 4) {
      return isPrivateIpv4(mapped);
    }
  }
  const parts = expandIpv6(lower);
  if (!parts || parts.some((part) => !Number.isFinite(part))) {
    return true;
  }
  const first = parts[0];
  if (first === undefined) {
    return true;
  }
  // fe80::/10 link-local
  if ((first & 0xffc0) === 0xfe80) {
    return true;
  }
  // fc00::/7 unique local
  if ((first & 0xfe00) === 0xfc00) {
    return true;
  }
  // multicast ff00::/8
  if ((first & 0xff00) === 0xff00) {
    return true;
  }
  return false;
}

export function isPrivateOrLocalIp(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) {
    return isPrivateIpv4(ip);
  }
  if (version === 6) {
    return isPrivateIpv6(ip);
  }
  return true;
}

export function isBlockedHostname(hostname: string): boolean {
  const normalized = normalizeHostname(hostname);
  if (!normalized) {
    return true;
  }
  if (BLOCKED_HOSTNAMES.has(normalized)) {
    return true;
  }
  return BLOCKED_HOSTNAME_SUFFIXES.some((suffix) => normalized.endsWith(suffix));
}

export type SsrfValidationResult = {
  url: URL;
  /**
   * The specific IP address(es) validated as safe for this URL's hostname, when known. Used to
   * pin the outbound TCP connection so a second DNS lookup at connect time can't "rebind" to a
   * different (private) address than the one that was validated here. Undefined when the caller
   * opted out of DNS resolution (`resolveDns: false`) or private networks are allowed — in
   * those cases no pinning is applied and the platform resolver is used as-is.
   */
  addresses?: string[];
};

/**
 * Validate that a URL is safe for server-side fetching (SSRF guard).
 * Rejects non-http(s), credentialed URLs, blocked hostnames, and (by default) private IPs.
 */
export async function assertSafeOutboundUrl(
  url: string,
  options: SsrfGuardOptions = {},
): Promise<SsrfValidationResult> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch (error) {
    throw new ProviderError("invalid_url", { cause: error });
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new ProviderError("ssrf_blocked", {
      message: "Only http and https URLs are allowed.",
    });
  }
  if (parsed.username || parsed.password) {
    throw new ProviderError("ssrf_blocked", {
      message: "URLs must not include credentials.",
    });
  }

  const hostname = normalizeHostname(parsed.hostname);
  if (!hostname) {
    throw new ProviderError("ssrf_blocked", { message: "The URL hostname is invalid." });
  }

  if (isBlockedHostname(hostname)) {
    throw new ProviderError("ssrf_blocked", {
      message: "Requests to this hostname are blocked.",
    });
  }

  const allowPrivate = options.allowPrivateNetwork === true;
  const ipVersion = isIP(hostname);

  if (ipVersion && !allowPrivate && isPrivateOrLocalIp(hostname)) {
    throw new ProviderError("ssrf_blocked", {
      message: "Requests to private or local network addresses are blocked.",
    });
  }

  // A literal IP in the URL is its own "resolution" — safe to pin as-is.
  let addresses: string[] | undefined = ipVersion ? [hostname] : undefined;

  if (!ipVersion && options.resolveDns !== false && !allowPrivate) {
    try {
      const results = await lookup(hostname, { all: true, verbatim: true });
      if (results.length === 0) {
        throw new ProviderError("ssrf_blocked", {
          message: "The URL hostname could not be resolved.",
        });
      }
      for (const result of results) {
        if (isPrivateOrLocalIp(result.address)) {
          throw new ProviderError("ssrf_blocked", {
            message: "Requests to private or local network addresses are blocked.",
          });
        }
      }
      addresses = results.map((result) => result.address);
    } catch (error) {
      if (error instanceof ProviderError) {
        throw error;
      }
      throw new ProviderError("ssrf_blocked", {
        message: "The URL hostname could not be resolved safely.",
        cause: error,
      });
    }
  }

  return { url: parsed, ...(addresses ? { addresses } : {}) };
}

export function createSsrfUrlValidator(options: SsrfGuardOptions = {}) {
  return async (url: string): Promise<SsrfValidationResult> => {
    return assertSafeOutboundUrl(url, options);
  };
}

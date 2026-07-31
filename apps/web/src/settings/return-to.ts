const BLOCKED_FIRST_SEGMENTS = new Set(["login", "setup", "api"]);

/**
 * Validates a return path for in-app navigation.
 * Rejects absolute URLs, protocol-relative URLs, and auth/API destinations.
 */
export function parseSafeReturnTo(value: string | null | undefined, fallback = "/"): string {
  if (!value) {
    return fallback;
  }
  const trimmed = value.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return fallback;
  }
  if (trimmed.includes("://") || trimmed.includes("\\") || trimmed.includes("@")) {
    return fallback;
  }

  try {
    const url = new URL(trimmed, "http://dashora.local");
    if (url.origin !== "http://dashora.local") {
      return fallback;
    }
    const first = url.pathname.split("/").filter(Boolean)[0]?.toLowerCase();
    if (first && BLOCKED_FIRST_SEGMENTS.has(first)) {
      return fallback;
    }
    const path = url.pathname || "/";
    return url.search ? `${path}${url.search}` : path;
  } catch {
    return fallback;
  }
}

export function readReturnToFromSearch(search: string = window.location.search): string {
  return parseSafeReturnTo(new URLSearchParams(search).get("returnTo"), "/");
}

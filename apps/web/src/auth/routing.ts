export function getPath(): string {
  return window.location.pathname;
}

export function getPathWithSearch(): string {
  return `${window.location.pathname}${window.location.search}`;
}

/**
 * Client-side navigation. Accepts pathname or pathname + query.
 * When only a pathname is provided and it matches the current pathname,
 * an existing query string is preserved (e.g. `/setup?token=…`).
 */
export function navigate(path: string): void {
  const hasExplicitSearch = path.includes("?");
  const url = new URL(path, window.location.origin);
  const next = hasExplicitSearch
    ? `${url.pathname}${url.search}`
    : url.pathname === window.location.pathname
      ? `${window.location.pathname}${window.location.search}`
      : url.pathname;

  if (`${window.location.pathname}${window.location.search}` === next) {
    window.dispatchEvent(new PopStateEvent("popstate"));
    return;
  }
  window.history.pushState({}, "", next);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

/** Read the setup token exactly once from the URL — no trim/transform/localStorage. */
export function readSetupTokenFromLocation(search: string = window.location.search): string | null {
  return new URLSearchParams(search).get("token");
}

export function getPath(): string {
  return window.location.pathname;
}

/**
 * Client-side navigation. Never strips an existing query string when the
 * pathname is unchanged (preserves `/setup?token=…`).
 */
export function navigate(path: string): void {
  if (window.location.pathname === path) {
    window.dispatchEvent(new PopStateEvent("popstate"));
    return;
  }
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

/** Read the setup token exactly once from the URL — no trim/transform/localStorage. */
export function readSetupTokenFromLocation(search: string = window.location.search): string | null {
  return new URLSearchParams(search).get("token");
}

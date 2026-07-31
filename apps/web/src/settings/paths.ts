import { parseSafeReturnTo } from "./return-to.js";

export const SETTINGS_ROOT_PATH = "/settings";
export const SETTINGS_APPEARANCE_PATH = "/settings/appearance";
export const SETTINGS_ACCOUNT_PATH = "/settings/account";
export const SETTINGS_BACKUP_PATH = "/settings/backup";

export type SettingsSection = "appearance" | "account" | "backup";

export function isSettingsPath(pathname: string): boolean {
  return pathname === SETTINGS_ROOT_PATH || pathname.startsWith(`${SETTINGS_ROOT_PATH}/`);
}

export function isAppearanceSettingsPath(pathname: string): boolean {
  return pathname === SETTINGS_APPEARANCE_PATH;
}

export function isAccountSettingsPath(pathname: string): boolean {
  return pathname === SETTINGS_ACCOUNT_PATH;
}

export function isBackupSettingsPath(pathname: string): boolean {
  return pathname === SETTINGS_BACKUP_PATH;
}

function withReturnTo(path: string, returnTo?: string | null): string {
  if (!returnTo) {
    return path;
  }
  const safe = parseSafeReturnTo(returnTo, "");
  if (!safe || isSettingsPath(safe.split("?")[0] ?? "")) {
    return path;
  }
  const params = new URLSearchParams({ returnTo: safe });
  return `${path}?${params.toString()}`;
}

/** Build Appearance settings URL, optionally preserving a safe return path. */
export function settingsAppearanceHref(returnTo?: string | null): string {
  return withReturnTo(SETTINGS_APPEARANCE_PATH, returnTo);
}

/** Build Account settings URL, optionally preserving a safe return path. */
export function settingsAccountHref(returnTo?: string | null): string {
  return withReturnTo(SETTINGS_ACCOUNT_PATH, returnTo);
}

/** Build Backup settings URL, optionally preserving a safe return path. */
export function settingsBackupHref(returnTo?: string | null): string {
  return withReturnTo(SETTINGS_BACKUP_PATH, returnTo);
}

const AFTER_LOGIN_KEY = "dashora-after-login";

export function stashPathAfterLogin(pathWithSearch: string): void {
  if (typeof sessionStorage === "undefined") {
    return;
  }
  const safe = parseSafeReturnTo(pathWithSearch, "");
  if (!safe || safe === "/login" || safe === "/setup") {
    return;
  }
  sessionStorage.setItem(AFTER_LOGIN_KEY, safe);
}

export function consumePathAfterLogin(): string | null {
  if (typeof sessionStorage === "undefined") {
    return null;
  }
  const stored = sessionStorage.getItem(AFTER_LOGIN_KEY);
  sessionStorage.removeItem(AFTER_LOGIN_KEY);
  if (!stored) {
    return null;
  }
  return parseSafeReturnTo(stored, "");
}

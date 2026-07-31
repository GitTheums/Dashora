/** Stable client/server-safe UUID helper for widget config entries. */
export function newConfigEntryId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `a${Date.now().toString(16).padStart(11, "0")}-1111-4111-8111-${Math.floor(
    Math.random() * 1e12,
  )
    .toString(16)
    .padStart(12, "0")}`;
}

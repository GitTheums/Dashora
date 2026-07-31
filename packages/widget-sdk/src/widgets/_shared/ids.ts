import { createDashoraUuid } from "@dashora/shared";

/** Stable client/server-safe UUID helper for widget config entries. */
export function newConfigEntryId(): string {
  return createDashoraUuid();
}

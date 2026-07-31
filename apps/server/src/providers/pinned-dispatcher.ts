import type { LookupFunction } from "node:net";
import { isIP } from "node:net";
import { Agent, fetch as undiciFetch } from "undici";

/**
 * IMPORTANT: Node's global `fetch` is backed by a vendored Undici whose Dispatcher/Handler
 * contract must match the Agent you pass as `dispatcher`. On Node 26+, global fetch uses
 * Undici 8.x while this package depends on Undici 6.x — mixing them throws
 * `InvalidArgumentError: invalid onError method` (UND_ERR_INVALID_ARG) before any socket opens.
 *
 * Always pair Agents from this module with {@link pinnedFetch} (the same Undici package's
 * `fetch`). Never pass a pinned Agent into `globalThis.fetch`. Covered by
 * http-client.test.ts's "pins the connection..." tests.
 */
export const pinnedFetch = undiciFetch;

type PinnedLookupResult = { address: string; family: number };

function normalizeFamily(family: number | "IPv4" | "IPv6" | undefined): number {
  if (family === "IPv4") {
    return 4;
  }
  if (family === "IPv6") {
    return 6;
  }
  return family ?? 0;
}

function toLookupResults(addresses: string[]): PinnedLookupResult[] {
  return addresses
    .map((address) => ({ address, family: isIP(address) === 6 ? 6 : 4 }))
    .filter((entry) => entry.family === 4 || entry.family === 6);
}

/**
 * Builds a Node-compatible `lookup` function that ignores real DNS and always answers with a
 * pre-validated address set for exactly one hostname (case-insensitive). Exported separately
 * from `createPinnedDispatcher` so the resolution logic can be unit-tested without needing a
 * real socket/Agent.
 */
export function buildPinnedLookup(hostname: string, addresses: string[]): LookupFunction {
  const normalizedHost = hostname.toLowerCase();
  const results = toLookupResults(addresses);

  const lookup: LookupFunction = (host, optionsOrCallback, maybeCallback) => {
    const lookupOptions = typeof optionsOrCallback === "object" ? optionsOrCallback : {};
    // biome-ignore lint/suspicious/noExplicitAny: Node's overloaded LookupFunction callback shape
    const callback: any =
      typeof optionsOrCallback === "function" ? optionsOrCallback : maybeCallback;

    if (host.toLowerCase() !== normalizedHost) {
      callback(
        Object.assign(
          new Error(`Refusing DNS lookup for "${host}" on a dispatcher pinned to "${hostname}".`),
          { code: "EPINNEDHOST" },
        ),
        [],
      );
      return;
    }

    const family = normalizeFamily(lookupOptions.family);
    const filtered = family ? results.filter((entry) => entry.family === family) : results;
    if (filtered.length === 0) {
      callback(
        Object.assign(
          new Error(`No pinned address available for "${host}" with the requested IP family.`),
          { code: "ENOTFOUND" },
        ),
        [],
      );
      return;
    }

    if (lookupOptions.all) {
      callback(null, filtered);
      return;
    }

    const [first] = filtered;
    if (!first) {
      callback(
        Object.assign(new Error(`No pinned address available for "${host}".`), {
          code: "ENOTFOUND",
        }),
        [],
      );
      return;
    }
    callback(null, first.address, first.family);
  };

  return lookup;
}

/**
 * Builds an undici dispatcher whose DNS resolution is pinned to a pre-validated address set for
 * exactly one hostname. Used to close the gap between SSRF validation time and actual TCP
 * connect time — without this, a second DNS lookup performed by the HTTP stack at connect time
 * could resolve to a different (private/internal) address than the one that was validated
 * ("DNS rebinding"). Scoped to a single outbound request attempt: create and close a fresh
 * instance per call, never share across hostnames or requests.
 *
 * Must be used with {@link pinnedFetch} (same Undici package), not Node's global `fetch`.
 */
export function createPinnedDispatcher(hostname: string, addresses: string[]): Agent {
  return new Agent({
    connect: { lookup: buildPinnedLookup(hostname, addresses) },
  });
}

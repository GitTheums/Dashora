import { describe, expect, it, vi } from "vitest";
import { buildPinnedLookup } from "./pinned-dispatcher.js";

describe("buildPinnedLookup", () => {
  it("resolves the exact hostname it was pinned for to the given address", () => {
    const lookup = buildPinnedLookup("example.com", ["203.0.113.5"]);
    const callback = vi.fn();

    lookup("example.com", { family: 0 }, callback);

    expect(callback).toHaveBeenCalledWith(null, "203.0.113.5", 4);
  });

  it("matches hostnames case-insensitively", () => {
    const lookup = buildPinnedLookup("Example.COM", ["203.0.113.5"]);
    const callback = vi.fn();

    lookup("example.com", {}, callback);

    expect(callback).toHaveBeenCalledWith(null, "203.0.113.5", 4);
  });

  it("refuses to resolve a different hostname — this is the DNS-rebinding guard", () => {
    const lookup = buildPinnedLookup("example.com", ["203.0.113.5"]);
    const callback = vi.fn();

    // Simulates a redirect/rebinding attempt targeting an unrelated host through a dispatcher
    // that was only ever validated (and pinned) for "example.com".
    lookup("internal.attacker.test", {}, callback);

    expect(callback).toHaveBeenCalledTimes(1);
    const [error] = callback.mock.calls[0] as [Error];
    expect(error).toBeInstanceOf(Error);
    expect((error as NodeJS.ErrnoException).code).toBe("EPINNEDHOST");
  });

  it("returns all pinned addresses when options.all is set", () => {
    const lookup = buildPinnedLookup("example.com", ["203.0.113.5", "203.0.113.6"]);
    const callback = vi.fn();

    lookup("example.com", { all: true }, callback);

    expect(callback).toHaveBeenCalledWith(null, [
      { address: "203.0.113.5", family: 4 },
      { address: "203.0.113.6", family: 4 },
    ]);
  });

  it("filters by requested IP family", () => {
    const lookup = buildPinnedLookup("example.com", ["203.0.113.5", "2001:db8::1"]);
    const callback = vi.fn();

    lookup("example.com", { family: 6 }, callback);

    expect(callback).toHaveBeenCalledWith(null, "2001:db8::1", 6);
  });

  it("errors when no pinned address matches the requested family", () => {
    const lookup = buildPinnedLookup("example.com", ["203.0.113.5"]);
    const callback = vi.fn();

    lookup("example.com", { family: 6 }, callback);

    expect(callback).toHaveBeenCalledTimes(1);
    const [error] = callback.mock.calls[0] as [Error];
    expect((error as NodeJS.ErrnoException).code).toBe("ENOTFOUND");
  });

  it("accepts a callback in place of options for the 2-argument overload", () => {
    const lookup = buildPinnedLookup("example.com", ["203.0.113.5"]);
    const callback = vi.fn();

    // Node's dns.lookup-compatible signature also allows calling with just a callback (no
    // options object); the public LookupFunction type only declares the 3-arg form.
    // @ts-expect-error exercising the 2-argument runtime overload
    lookup("example.com", callback);

    expect(callback).toHaveBeenCalledWith(null, "203.0.113.5", 4);
  });
});

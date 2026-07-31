import { describe, expect, it } from "vitest";
import { ProviderError } from "./errors.js";
import { assertSafeOutboundUrl, isBlockedHostname, isPrivateOrLocalIp } from "./ssrf.js";

describe("isPrivateOrLocalIp", () => {
  it("flags common private and metadata ranges", () => {
    expect(isPrivateOrLocalIp("127.0.0.1")).toBe(true);
    expect(isPrivateOrLocalIp("10.0.0.5")).toBe(true);
    expect(isPrivateOrLocalIp("192.168.1.1")).toBe(true);
    expect(isPrivateOrLocalIp("172.16.0.1")).toBe(true);
    expect(isPrivateOrLocalIp("169.254.169.254")).toBe(true);
    expect(isPrivateOrLocalIp("::1")).toBe(true);
    expect(isPrivateOrLocalIp("8.8.8.8")).toBe(false);
    expect(isPrivateOrLocalIp("1.1.1.1")).toBe(false);
  });
});

describe("isBlockedHostname", () => {
  it("blocks localhost and local suffixes", () => {
    expect(isBlockedHostname("localhost")).toBe(true);
    expect(isBlockedHostname("foo.local")).toBe(true);
    expect(isBlockedHostname("metadata.google.internal")).toBe(true);
    expect(isBlockedHostname("example.com")).toBe(false);
  });
});

describe("assertSafeOutboundUrl", () => {
  it("rejects non-http schemes and credentialed URLs", async () => {
    await expect(assertSafeOutboundUrl("file:///etc/passwd")).rejects.toBeInstanceOf(ProviderError);
    await expect(assertSafeOutboundUrl("https://user:pass@example.com/")).rejects.toMatchObject({
      code: "ssrf_blocked",
    });
  });

  it("rejects literal private IPs unless allowPrivateNetwork is set", async () => {
    await expect(assertSafeOutboundUrl("http://127.0.0.1/")).rejects.toMatchObject({
      code: "ssrf_blocked",
    });
    await expect(assertSafeOutboundUrl("http://169.254.169.254/latest/")).rejects.toMatchObject({
      code: "ssrf_blocked",
    });
    const allowed = await assertSafeOutboundUrl("http://192.168.1.10/status", {
      allowPrivateNetwork: true,
      resolveDns: false,
    });
    expect(allowed.url.hostname).toBe("192.168.1.10");
    // A literal IP is its own "resolution" — safe to pin even with private networks allowed,
    // since no DNS lookup (and therefore no rebinding risk) was ever involved.
    expect(allowed.addresses).toEqual(["192.168.1.10"]);
  });

  it("allows public hostnames without DNS when resolveDns is false", async () => {
    const result = await assertSafeOutboundUrl("https://example.com/api", {
      resolveDns: false,
    });
    expect(result.url.protocol).toBe("https:");
    expect(result.url.hostname).toBe("example.com");
    expect(result.addresses).toBeUndefined();
  });

  it("returns the literal IP as its own pinned address", async () => {
    const result = await assertSafeOutboundUrl("http://93.184.216.34/", {
      resolveDns: false,
    });
    expect(result.addresses).toEqual(["93.184.216.34"]);
  });
});

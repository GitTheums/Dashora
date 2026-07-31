import { describe, expect, it } from "vitest";
import { isAllowedHttpsHostname, parseAllowedHttpsUrl } from "./url-allowlist.js";

const COINGECKO_HOSTS = ["api.coingecko.com", "pro-api.coingecko.com"] as const;

describe("parseAllowedHttpsUrl", () => {
  it("accepts a valid HTTPS provider URL", () => {
    const result = parseAllowedHttpsUrl("https://api.coingecko.com/api/v3/simple/price?ids=btc", {
      hostnames: COINGECKO_HOSTS,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.hostname).toBe("api.coingecko.com");
      expect(result.url.pathname).toBe("/api/v3/simple/price");
      expect(result.url.searchParams.get("ids")).toBe("btc");
    }
  });

  it("rejects wrong protocol", () => {
    expect(
      parseAllowedHttpsUrl("http://api.coingecko.com/api/v3", { hostnames: COINGECKO_HOSTS }),
    ).toEqual({ ok: false, reason: "unsupported_protocol" });
  });

  it("rejects deceptive suffix and prefix hosts", () => {
    expect(
      parseAllowedHttpsUrl("https://api.coingecko.com.attacker.example/api/v3", {
        hostnames: COINGECKO_HOSTS,
      }),
    ).toEqual({ ok: false, reason: "unexpected_hostname" });
    expect(
      parseAllowedHttpsUrl("https://attacker-api.coingecko.com/api/v3", {
        hostnames: COINGECKO_HOSTS,
      }),
    ).toEqual({ ok: false, reason: "unexpected_hostname" });
  });

  it("rejects embedded credentials", () => {
    expect(
      parseAllowedHttpsUrl("https://user:pass@api.coingecko.com/api/v3", {
        hostnames: COINGECKO_HOSTS,
      }),
    ).toEqual({ ok: false, reason: "embedded_credentials" });
  });

  it("rejects unexpected ports", () => {
    expect(
      parseAllowedHttpsUrl("https://api.coingecko.com:8443/api/v3", {
        hostnames: COINGECKO_HOSTS,
      }),
    ).toEqual({ ok: false, reason: "unexpected_port" });
  });

  it("preserves query parameter encoding via URLSearchParams", () => {
    const result = parseAllowedHttpsUrl(
      "https://api.coingecko.com/api/v3/search?query=bitcoin%20cash",
      { hostnames: COINGECKO_HOSTS },
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.url.searchParams.get("query")).toBe("bitcoin cash");
    }
  });

  it("normalizes uppercase hosts", () => {
    expect(isAllowedHttpsHostname("https://API.COINGECKO.COM/api/v3", COINGECKO_HOSTS)).toBe(true);
  });

  it("rejects malformed URLs", () => {
    expect(parseAllowedHttpsUrl("not a url", { hostnames: COINGECKO_HOSTS })).toEqual({
      ok: false,
      reason: "malformed_url",
    });
  });

  it("handles IPv4 and IPv6 literals when allowlisted", () => {
    expect(parseAllowedHttpsUrl("https://1.2.3.4/path", { hostnames: ["1.2.3.4"] })).toMatchObject({
      ok: true,
      hostname: "1.2.3.4",
    });
    // WHATWG hostname for IPv6 omits brackets; allowlist entries may include them.
    expect(
      parseAllowedHttpsUrl("https://[2001:db8::1]/path", { hostnames: ["2001:db8::1"] }),
    ).toMatchObject({ ok: true, hostname: "2001:db8::1" });
    expect(
      parseAllowedHttpsUrl("https://[2001:db8::1]/path", { hostnames: ["[2001:db8::1]"] }),
    ).toMatchObject({ ok: true, hostname: "2001:db8::1" });
    expect(
      parseAllowedHttpsUrl("https://[2001:db8::2]/path", { hostnames: ["2001:db8::1"] }),
    ).toEqual({ ok: false, reason: "unexpected_hostname" });
  });

  it("validates pathname when requested", () => {
    expect(
      parseAllowedHttpsUrl("https://api.coingecko.com/api/v3/ping", {
        hostnames: COINGECKO_HOSTS,
        pathnames: ["/api/v3/ping"],
      }),
    ).toMatchObject({ ok: true });
    expect(
      parseAllowedHttpsUrl("https://api.coingecko.com/api/v3/evil", {
        hostnames: COINGECKO_HOSTS,
        pathnames: ["/api/v3/ping"],
      }),
    ).toEqual({ ok: false, reason: "unexpected_pathname" });
  });
});

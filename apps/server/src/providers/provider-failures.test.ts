import { describe, expect, it } from "vitest";
import { ProviderError, toProviderError } from "./errors.js";

describe("provider failure normalization", () => {
  it("keeps ProviderError codes and strips unsafe messages for clients", () => {
    const error = new ProviderError("ssrf_blocked", {
      message: "Blocked host metadata.google.internal with token ghp_leak",
    });
    expect(error.code).toBe("ssrf_blocked");
    expect(error.toSafeError()).toEqual({
      code: "ssrf_blocked",
      message: "The request target is blocked by outbound network protections.",
    });
    expect(error.toSafeError().message).not.toContain("ghp_leak");
  });

  it("maps AbortError and unknown errors to safe codes", () => {
    const aborted = new Error("aborted");
    aborted.name = "AbortError";
    expect(toProviderError(aborted).code).toBe("aborted");

    const network = toProviderError(new Error("ECONNRESET secret=abc"));
    expect(network.code).toBe("network_error");
    expect(network.toSafeError().message).not.toContain("secret=");

    expect(toProviderError("boom").code).toBe("unknown");
  });

  it("marks transient failure codes as retryable", () => {
    expect(new ProviderError("timeout").retryable).toBe(true);
    expect(new ProviderError("rate_limited").retryable).toBe(true);
    expect(new ProviderError("network_error").retryable).toBe(true);
    expect(new ProviderError("circuit_open").retryable).toBe(false);
    expect(new ProviderError("ssrf_blocked").retryable).toBe(false);
    expect(new ProviderError("invalid_url").retryable).toBe(false);
  });
});

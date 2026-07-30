import { describe, expect, it, vi } from "vitest";
import { createAuthApi } from "./api.js";
import { navigate, readSetupTokenFromLocation } from "./routing.js";

describe("setup token URL handling", () => {
  it("reads the exact token via URLSearchParams without transforming it", () => {
    const token = "abcXYZ_-0123456789";
    expect(readSetupTokenFromLocation(`?token=${token}`)).toBe(token);
    expect(readSetupTokenFromLocation("?")).toBeNull();
    expect(readSetupTokenFromLocation("")).toBeNull();
  });

  it("does not strip the setup query string when navigating to the same path", () => {
    window.history.pushState({}, "", "/setup?token=keep-me");
    navigate("/setup");
    expect(window.location.pathname).toBe("/setup");
    expect(window.location.search).toBe("?token=keep-me");
  });
});

describe("auth API setup completion", () => {
  it("posts the exact URL token to /api/v1/setup/complete on the API origin", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (init) {
        calls.push({ url, init });
      } else {
        calls.push({ url });
      }
      if (url.endsWith("/api/v1/auth/csrf")) {
        return new Response(JSON.stringify({ csrfToken: "csrf-token" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (url.endsWith("/api/v1/setup/complete")) {
        return new Response(
          JSON.stringify({
            user: {
              id: "11111111-1111-4111-8111-111111111111",
              email: "admin@example.com",
              displayName: "Admin",
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response("not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const api = createAuthApi("");
    const exactToken = "exact-url-token-value";
    await api.setup({
      token: exactToken,
      email: "admin@example.com",
      displayName: "Admin",
      password: "correct-horse-battery",
    });

    const complete = calls.find((call) => call.url.endsWith("/api/v1/setup/complete"));
    expect(complete).toBeTruthy();
    expect(complete?.url).toBe("/api/v1/setup/complete");
    expect(JSON.parse(String(complete?.init?.body))).toMatchObject({ token: exactToken });

    vi.unstubAllGlobals();
  });
});

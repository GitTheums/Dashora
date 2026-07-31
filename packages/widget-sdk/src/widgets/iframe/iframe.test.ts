import { describe, expect, it, vi } from "vitest";
import { REQUIRED_WIDGET_STATES } from "../../states.js";
import type { IframeAdapter } from "./adapter.js";
import {
  IFRAME_DEFAULT_CONFIG,
  buildIframeSandboxAttribute,
  hostnameMatchesAllow,
  iframeConfigSchema,
  validateIframeUrl,
} from "./config.js";
import { iframeDefinition } from "./definition.js";
import { createIframeProvider } from "./provider.js";

describe("iframe definition", () => {
  it("covers every required runtime state", () => {
    expect(iframeDefinition.states).toEqual(REQUIRED_WIDGET_STATES);
    expect(iframeDefinition.id).toBe("iframe");
  });

  it("parses default config", () => {
    expect(iframeConfigSchema.parse({})).toEqual(IFRAME_DEFAULT_CONFIG);
  });

  it("rejects http and credentialed URLs", () => {
    expect(validateIframeUrl("http://example.com/").ok).toBe(false);
    expect(validateIframeUrl("https://user:pass@example.com/").ok).toBe(false);
  });

  it("enforces optional allow list", () => {
    expect(validateIframeUrl("https://evil.example/embed", ["trusted.example"]).ok).toBe(false);
    expect(validateIframeUrl("https://app.trusted.example/embed", ["*.trusted.example"]).ok).toBe(
      true,
    );
    expect(hostnameMatchesAllow("*.trusted.example", "app.trusted.example")).toBe(true);
  });

  it("builds restrictive sandbox tokens", () => {
    expect(buildIframeSandboxAttribute(IFRAME_DEFAULT_CONFIG.sandbox)).toBe("");
    expect(
      buildIframeSandboxAttribute({
        ...IFRAME_DEFAULT_CONFIG.sandbox,
        allowScripts: true,
        allowForms: true,
      }),
    ).toBe("allow-scripts allow-forms");
  });
});

describe("iframe provider", () => {
  it("returns configuration-required without a URL", async () => {
    const provider = createIframeProvider();
    const result = await provider.fetch({
      instanceId: "i1",
      config: IFRAME_DEFAULT_CONFIG,
    });
    expect(result.state).toBe("configuration-required");
  });

  it("returns success with sandbox metadata and embed warning", async () => {
    const adapter: IframeAdapter = {
      id: "fake",
      probeEmbedding: vi.fn(async () => ({
        checkedAt: "2026-07-31T08:00:00.000Z",
        embeddingRefused: true,
        warning: "The target sets X-Frame-Options: DENY and will refuse embedding.",
        urlLabel: "https://example.com/embed",
      })),
    };
    const provider = createIframeProvider({ adapter });
    const result = await provider.fetch({
      instanceId: "i2",
      config: iframeConfigSchema.parse({
        url: "https://example.com/embed",
        sandbox: { allowScripts: true },
      }),
    });
    expect(result.state).toBe("success");
    expect(result.data?.sandbox).toBe("allow-scripts");
    expect(result.data?.embedProbe?.embeddingRefused).toBe(true);
  });
});

import { describe, expect, it, vi } from "vitest";
import { REQUIRED_WIDGET_STATES } from "../../states.js";
import type { CustomApiAdapter } from "./adapter.js";
import { CustomApiAdapterError } from "./adapter.js";
import {
  CUSTOM_API_DEFAULT_CONFIG,
  type CustomApiConfig,
  customApiConfigSchema,
} from "./config.js";
import { customApiDefinition } from "./definition.js";
import { parseJsonPath, readJsonPath } from "./json-path.js";
import { mapJsonToPresentation } from "./map-response.js";
import { createCustomApiProvider } from "./provider.js";

function baseConfig(overrides: Partial<CustomApiConfig> = {}): CustomApiConfig {
  return customApiConfigSchema.parse({
    ...CUSTOM_API_DEFAULT_CONFIG,
    url: "https://api.example.com/status",
    template: "metric",
    mapping: { metricValuePath: "value", metricLabelPath: "label" },
    ...overrides,
  });
}

function createAdapter(overrides: Partial<CustomApiAdapter> = {}): CustomApiAdapter {
  return {
    id: "fake-custom-api",
    fetch: vi.fn(async () => ({
      data: {
        presentation: {
          template: "metric" as const,
          metric: { value: "42", label: "Widgets" },
        },
        httpStatus: 200,
        fetchedAt: "2026-07-31T08:00:00.000Z",
        urlLabel: "https://api.example.com/status",
      },
      cacheStatus: "miss" as const,
    })),
    ...overrides,
  };
}

describe("custom-api definition", () => {
  it("covers every required runtime state", () => {
    expect(customApiDefinition.states).toEqual(REQUIRED_WIDGET_STATES);
    expect(customApiDefinition.id).toBe("custom-api");
  });

  it("parses default config", () => {
    expect(customApiConfigSchema.parse({})).toEqual(CUSTOM_API_DEFAULT_CONFIG);
  });

  it("rejects credentialed URLs", () => {
    expect(() =>
      customApiConfigSchema.parse({
        url: "https://user:pass@example.com/",
      }),
    ).toThrow();
  });
});

describe("json path", () => {
  it("reads nested properties and indexes", () => {
    expect(parseJsonPath("$.items[0].title")).toEqual([
      { kind: "property", name: "items" },
      { kind: "index", index: 0 },
      { kind: "property", name: "title" },
    ]);
    expect(readJsonPath({ items: [{ title: "Hello" }] }, "items[0].title")).toBe("Hello");
  });

  it("rejects unsafe path forms", () => {
    expect(parseJsonPath("a..b")).toBeNull();
    expect(parseJsonPath("a[?(@.x)]")).toBeNull();
  });
});

describe("mapJsonToPresentation", () => {
  it("maps metric and list templates without HTML", () => {
    const metric = mapJsonToPresentation({ value: "<b>9</b>", label: "CPU" }, baseConfig());
    expect(metric?.metric?.value).toBe("<b>9</b>");
    expect(metric?.template).toBe("metric");

    const list = mapJsonToPresentation(
      { items: [{ title: "One", subtitle: "A" }] },
      baseConfig({
        template: "list",
        mapping: {
          listItemsPath: "items",
          listTitlePath: "title",
          listSubtitlePath: "subtitle",
        },
      }),
    );
    expect(list?.list?.items).toEqual([{ title: "One", subtitle: "A" }]);
  });
});

describe("custom-api provider", () => {
  it("returns configuration-required without a URL", async () => {
    const provider = createCustomApiProvider({ adapter: createAdapter() });
    const result = await provider.fetch({
      instanceId: "c1",
      config: CUSTOM_API_DEFAULT_CONFIG,
    });
    expect(result.state).toBe("configuration-required");
  });

  it("returns success from the adapter", async () => {
    const provider = createCustomApiProvider({ adapter: createAdapter() });
    const result = await provider.fetch({
      instanceId: "c2",
      config: baseConfig(),
    });
    expect(result.state).toBe("success");
    expect(result.data?.presentation.metric?.value).toBe("42");
  });

  it("surfaces adapter SSRF errors safely", async () => {
    const provider = createCustomApiProvider({
      adapter: createAdapter({
        fetch: vi.fn(async () => {
          throw new CustomApiAdapterError(
            "ssrf_blocked",
            "Requests to private or local network addresses are blocked.",
          );
        }),
      }),
    });
    const result = await provider.fetch({
      instanceId: "c3",
      config: baseConfig({ url: "http://127.0.0.1/" }),
    });
    expect(result.state).toBe("error");
    expect(result.errorCode).toBe("ssrf_blocked");
    expect(result.message).not.toMatch(/127\.0\.0\.1/);
  });
});

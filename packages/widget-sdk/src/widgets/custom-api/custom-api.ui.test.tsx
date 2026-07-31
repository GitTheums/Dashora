import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { REQUIRED_WIDGET_STATES } from "../../states.js";
import {
  CUSTOM_API_DEFAULT_CONFIG,
  type CustomApiConfig,
  type CustomApiData,
  customApiConfigSchema,
} from "./config.js";
import { CustomApiRenderer } from "./renderer.js";
import { CustomApiSettings } from "./settings.js";

const sampleConfig: CustomApiConfig = customApiConfigSchema.parse({
  ...CUSTOM_API_DEFAULT_CONFIG,
  url: "https://api.example.com/status",
  template: "metric",
  mapping: { metricValuePath: "value" },
});

const sampleData: CustomApiData = {
  presentation: {
    template: "metric",
    metric: { value: "42", label: "Widgets", unit: "%" },
  },
  httpStatus: 200,
  fetchedAt: "2026-07-31T08:00:00.000Z",
  urlLabel: "https://api.example.com/status",
};

afterEach(() => {
  cleanup();
});

describe("CustomApiRenderer", () => {
  it.each(REQUIRED_WIDGET_STATES)("renders state=%s", (state) => {
    render(
      <CustomApiRenderer
        instanceId="1"
        title="Custom API"
        config={sampleConfig}
        state={state}
        {...(state === "success" || state === "empty" || state === "stale" || state === "refreshing"
          ? { data: sampleData }
          : {})}
        message={`msg-${state}`}
      />,
    );
    expect(
      document.querySelector(`[data-widget="custom-api"][data-state="${state}"]`),
    ).toBeTruthy();
  });
});

describe("CustomApiSettings", () => {
  it("renders the settings form", () => {
    render(
      <CustomApiSettings
        instanceId="1"
        config={sampleConfig}
        onChange={() => undefined}
        integrationsClient={{
          list: async () => ({ integrations: [] }),
          create: async () => {
            throw new Error("unused");
          },
          update: async () => {
            throw new Error("unused");
          },
          remove: async () => undefined,
        }}
        apiClient={{
          fetchData: async () => {
            throw new Error("unused");
          },
          preview: async () => ({ ok: true, state: "success" }),
        }}
      />,
    );
    expect(document.querySelector('form[aria-label="Custom API settings"]')).toBeTruthy();
  });
});

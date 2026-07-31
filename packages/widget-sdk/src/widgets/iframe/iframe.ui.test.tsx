import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { REQUIRED_WIDGET_STATES } from "../../states.js";
import {
  IFRAME_DEFAULT_CONFIG,
  type IframeConfig,
  type IframeData,
  iframeConfigSchema,
} from "./config.js";
import { IframeRenderer } from "./renderer.js";
import { IframeSettings } from "./settings.js";

const sampleConfig: IframeConfig = iframeConfigSchema.parse({
  ...IFRAME_DEFAULT_CONFIG,
  url: "https://example.com/embed",
});

const sampleData: IframeData = {
  url: "https://example.com/embed",
  aspectRatio: 16 / 9,
  sandbox: "allow-scripts",
  frameTitle: "Embedded content",
  embedProbe: {
    checkedAt: "2026-07-31T08:00:00.000Z",
    embeddingRefused: true,
    warning: "The target sets X-Frame-Options: DENY and will refuse embedding.",
    urlLabel: "https://example.com/embed",
  },
};

afterEach(() => {
  cleanup();
});

describe("IframeRenderer", () => {
  it.each(REQUIRED_WIDGET_STATES)("renders state=%s", (state) => {
    render(
      <IframeRenderer
        instanceId="1"
        title="iFrame"
        config={sampleConfig}
        state={state}
        {...(state === "success" || state === "empty" || state === "stale" || state === "refreshing"
          ? { data: sampleData }
          : {})}
        message={`msg-${state}`}
      />,
    );
    expect(document.querySelector(`[data-widget="iframe"][data-state="${state}"]`)).toBeTruthy();
  });

  it("renders a sandboxed iframe", () => {
    render(
      <IframeRenderer
        instanceId="1"
        title="iFrame"
        config={sampleConfig}
        state="success"
        data={sampleData}
      />,
    );
    const frame = document.querySelector("iframe");
    expect(frame?.getAttribute("sandbox")).toBe("allow-scripts");
    expect(frame?.getAttribute("src")).toBe("https://example.com/embed");
  });
});

describe("IframeSettings", () => {
  it("renders the settings form", () => {
    render(<IframeSettings instanceId="1" config={sampleConfig} onChange={() => undefined} />);
    expect(document.querySelector('form[aria-label="iFrame settings"]')).toBeTruthy();
  });
});

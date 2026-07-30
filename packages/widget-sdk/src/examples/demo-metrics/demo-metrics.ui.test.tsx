import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { REQUIRED_WIDGET_STATES } from "../../states.js";
import { DEMO_METRICS_DEFAULT_CONFIG, type DemoMetricsData } from "./config.js";
import { DemoMetricsRenderer } from "./renderer.js";
import { DemoMetricsSettings } from "./settings.js";

const sampleData: DemoMetricsData = {
  label: "Active sessions",
  value: 42,
  warningThreshold: 80,
  unit: "count",
  generatedAt: "2026-07-30T11:00:00.000Z",
};

afterEach(() => {
  cleanup();
});

describe("DemoMetricsRenderer", () => {
  it.each(REQUIRED_WIDGET_STATES)("renders state=%s", (state) => {
    const props =
      state === "success" || state === "stale" || state === "refreshing"
        ? {
            instanceId: "1",
            title: "Demo Metrics",
            config: DEMO_METRICS_DEFAULT_CONFIG,
            state,
            data: sampleData,
            message: `msg-${state}`,
          }
        : {
            instanceId: "1",
            title: "Demo Metrics",
            config: DEMO_METRICS_DEFAULT_CONFIG,
            state,
            message: `msg-${state}`,
          };

    render(<DemoMetricsRenderer {...props} />);

    expect(screen.getByRole("heading", { name: "Demo Metrics" })).toBeTruthy();
    expect(document.querySelector(`[data-state="${state}"]`)).toBeTruthy();
  });
});

describe("DemoMetricsSettings", () => {
  it("updates config fields and submits", () => {
    const onChange = vi.fn();
    const onSubmit = vi.fn();

    render(
      <DemoMetricsSettings
        instanceId="1"
        config={DEMO_METRICS_DEFAULT_CONFIG}
        onChange={onChange}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.change(screen.getByLabelText("Metric label"), {
      target: { value: "Queue depth" },
    });
    expect(onChange).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Save settings" }));
    expect(onSubmit).toHaveBeenCalled();
  });
});

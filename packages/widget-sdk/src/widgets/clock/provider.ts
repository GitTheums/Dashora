import { defineWidgetProvider } from "../../provider.js";
import { type ClockConfig, type ClockData, buildClockData, clockConfigSchema } from "./config.js";
import { CLOCK_WIDGET_ID } from "./definition.js";

export const clockProvider = defineWidgetProvider<ClockConfig, ClockData>({
  id: CLOCK_WIDGET_ID,
  fetch: async (ctx) => {
    const config = clockConfigSchema.parse(ctx.config);
    const now = ctx.now?.() ?? new Date();

    if (!config.enabled) {
      return { state: "disabled", message: "Clock is disabled in settings." };
    }

    try {
      const data = buildClockData(config, now);
      return {
        state: "success",
        data,
        cacheStatus: "miss",
      };
    } catch {
      return {
        state: "configuration-required",
        message: "Set a valid IANA timezone in settings.",
      };
    }
  },
});

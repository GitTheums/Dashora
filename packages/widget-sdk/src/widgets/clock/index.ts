export {
  CLOCK_DEFAULT_CONFIG,
  clockConfigSchema,
  clockDataSchema,
  clockFaceSchema,
  clockHourFormatSchema,
  clockDateFormatSchema,
  buildClockData,
  type ClockConfig,
  type ClockData,
  type ClockFace,
  type ClockHourFormat,
  type ClockDateFormat,
} from "./config.js";
export { CLOCK_WIDGET_ID, clockDefinition } from "./definition.js";
export { clockProvider } from "./provider.js";
export { ClockRenderer } from "./renderer.js";
export { ClockSettings } from "./settings.js";

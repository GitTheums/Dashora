import {
  type CustomApiConfig,
  type CustomApiPresentation,
  type CustomApiStatusState,
  customApiPresentationSchema,
} from "./config.js";
import { readJsonPath, valueToNumber, valueToPlainText } from "./json-path.js";

function normalizeStatusState(value: unknown): CustomApiStatusState {
  const text = valueToPlainText(value, 40)?.toLowerCase();
  if (!text) {
    return "unknown";
  }
  if (["ok", "success", "healthy", "up", "green", "pass", "true", "1"].includes(text)) {
    return "ok";
  }
  if (["warn", "warning", "degraded", "yellow"].includes(text)) {
    return "warn";
  }
  if (["error", "fail", "failed", "critical", "down", "red", "false", "0"].includes(text)) {
    return "error";
  }
  return "unknown";
}

/**
 * Map a JSON response into the limited Custom API presentation model.
 * Never returns HTML or executable content — plain strings/numbers only.
 */
export function mapJsonToPresentation(
  json: unknown,
  config: CustomApiConfig,
): CustomApiPresentation | null {
  const mapping = config.mapping;

  if (config.template === "text") {
    if (!mapping.textPath) {
      return null;
    }
    const content = valueToPlainText(readJsonPath(json, mapping.textPath), 2_000);
    if (!content) {
      return null;
    }
    return customApiPresentationSchema.parse({
      template: "text",
      text: { content },
    });
  }

  if (config.template === "metric") {
    if (!mapping.metricValuePath) {
      return null;
    }
    const value = valueToPlainText(readJsonPath(json, mapping.metricValuePath), 80);
    if (!value) {
      return null;
    }
    const label = mapping.metricLabelPath
      ? (valueToPlainText(readJsonPath(json, mapping.metricLabelPath), 120) ?? undefined)
      : undefined;
    const unit = mapping.metricUnitPath
      ? (valueToPlainText(readJsonPath(json, mapping.metricUnitPath), 40) ?? undefined)
      : undefined;
    return customApiPresentationSchema.parse({
      template: "metric",
      metric: {
        value,
        ...(label ? { label } : {}),
        ...(unit ? { unit } : {}),
      },
    });
  }

  if (config.template === "list") {
    if (!mapping.listItemsPath || !mapping.listTitlePath) {
      return null;
    }
    const rawItems = readJsonPath(json, mapping.listItemsPath);
    if (!Array.isArray(rawItems)) {
      return null;
    }
    const items = [];
    for (const item of rawItems.slice(0, 50)) {
      const title = valueToPlainText(readJsonPath(item, mapping.listTitlePath), 200);
      if (!title) {
        continue;
      }
      const subtitle = mapping.listSubtitlePath
        ? (valueToPlainText(readJsonPath(item, mapping.listSubtitlePath), 300) ?? undefined)
        : undefined;
      const value = mapping.listValuePath
        ? (valueToPlainText(readJsonPath(item, mapping.listValuePath), 120) ?? undefined)
        : undefined;
      items.push({
        title,
        ...(subtitle ? { subtitle } : {}),
        ...(value ? { value } : {}),
      });
    }
    if (items.length === 0) {
      return null;
    }
    return customApiPresentationSchema.parse({
      template: "list",
      list: { items },
    });
  }

  if (config.template === "progress") {
    if (!mapping.progressValuePath) {
      return null;
    }
    const value = valueToNumber(readJsonPath(json, mapping.progressValuePath));
    if (value === null) {
      return null;
    }
    const maxRaw = mapping.progressMaxPath
      ? valueToNumber(readJsonPath(json, mapping.progressMaxPath))
      : 100;
    const max = maxRaw && maxRaw > 0 ? maxRaw : 100;
    const label = mapping.progressLabelPath
      ? (valueToPlainText(readJsonPath(json, mapping.progressLabelPath), 120) ?? undefined)
      : undefined;
    return customApiPresentationSchema.parse({
      template: "progress",
      progress: {
        value: Math.max(0, value),
        max,
        ...(label ? { label } : {}),
      },
    });
  }

  // status
  const state = mapping.statusStatePath
    ? normalizeStatusState(readJsonPath(json, mapping.statusStatePath))
    : "unknown";
  const label =
    (mapping.statusLabelPath
      ? valueToPlainText(readJsonPath(json, mapping.statusLabelPath), 120)
      : null) ?? state.toUpperCase();
  const detail = mapping.statusDetailPath
    ? (valueToPlainText(readJsonPath(json, mapping.statusDetailPath), 300) ?? undefined)
    : undefined;

  return customApiPresentationSchema.parse({
    template: "status",
    status: {
      state,
      label,
      ...(detail ? { detail } : {}),
    },
  });
}

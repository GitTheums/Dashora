import type { ComponentType } from "react";
import type { z } from "zod";
import type { AnyWidgetDefinition, WidgetDefinition } from "../definition.js";
import type { WidgetDataResponse } from "../envelope.js";
import type { AnyWidgetProvider, WidgetProvider } from "../provider.js";
import type { WidgetState } from "../states.js";

export type WidgetRendererProps<TData = unknown, TConfig = unknown> = {
  instanceId: string;
  title: string;
  config: TConfig;
  state: WidgetState;
  data?: TData;
  message?: string;
  response?: WidgetDataResponse;
  onRefresh?: () => void;
  onOpenSettings?: () => void;
};

export type WidgetSettingsProps<TConfig = unknown> = {
  instanceId: string;
  config: TConfig;
  onChange: (next: TConfig) => void;
  onSubmit?: (next: TConfig) => void;
  disabled?: boolean;
};

export type WidgetRendererComponent<TData = unknown, TConfig = unknown> = ComponentType<
  WidgetRendererProps<TData, TConfig>
>;

export type WidgetSettingsComponent<TConfig = unknown> = ComponentType<
  WidgetSettingsProps<TConfig>
>;

export type WidgetRegistryEntry<TConfig extends z.ZodType = z.ZodTypeAny, TData = unknown> = {
  definition: WidgetDefinition<TConfig>;
  provider?: WidgetProvider<z.infer<TConfig>, TData>;
  Renderer?: WidgetRendererComponent<TData, z.infer<TConfig>>;
  Settings?: WidgetSettingsComponent<z.infer<TConfig>>;
};

export type AnyWidgetRegistryEntry = {
  definition: AnyWidgetDefinition;
  provider?: AnyWidgetProvider;
  Renderer?: WidgetRendererComponent;
  Settings?: WidgetSettingsComponent;
};

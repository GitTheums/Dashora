export {
  TWITCH_DEFAULT_CONFIG,
  isTwitchConfigured,
  newTwitchChannelId,
  twitchChannelConfigSchema,
  twitchConfigSchema,
  twitchDataSchema,
  twitchItemSchema,
  twitchLayoutSchema,
  type TwitchChannelConfig,
  type TwitchConfig,
  type TwitchData,
  type TwitchItem,
  type TwitchLayout,
} from "./config.js";
export { TWITCH_WIDGET_ID, twitchDefinition } from "./definition.js";
export { createTwitchProvider, type TwitchProviderDeps } from "./provider.js";
export type {
  TwitchAdapter,
  TwitchChannelPayload,
  TwitchChannelsFetchRequest,
  TwitchChannelsFetchResult,
  TwitchCredentials,
} from "./adapter.js";
export { FeedAdapterError, isFeedAdapterError } from "./adapter.js";

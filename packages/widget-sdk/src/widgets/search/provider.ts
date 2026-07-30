import { defineWidgetProvider } from "../../provider.js";
import {
  type SearchConfig,
  type SearchData,
  resolveSearchData,
  searchConfigSchema,
} from "./config.js";
import { SEARCH_WIDGET_ID } from "./definition.js";

export const searchProvider = defineWidgetProvider<SearchConfig, SearchData>({
  id: SEARCH_WIDGET_ID,
  fetch: async (ctx) => {
    const config = searchConfigSchema.parse(ctx.config);

    if (!config.enabled) {
      return { state: "disabled", message: "Search is disabled in settings." };
    }

    const data = resolveSearchData(config);
    if (!data) {
      return {
        state: "configuration-required",
        message: "Choose a search engine or provide a safe custom template with {query}.",
      };
    }

    return {
      state: "success",
      data,
      cacheStatus: "miss",
    };
  },
});

import { defineWidgetProvider } from "../../provider.js";
import {
  type BookmarksConfig,
  type BookmarksData,
  bookmarksConfigSchema,
  resolveBookmarksData,
} from "./config.js";
import { BOOKMARKS_WIDGET_ID } from "./definition.js";

export const bookmarksProvider = defineWidgetProvider<BookmarksConfig, BookmarksData>({
  id: BOOKMARKS_WIDGET_ID,
  fetch: async (ctx) => {
    const config = bookmarksConfigSchema.parse(ctx.config);

    if (!config.enabled) {
      return { state: "disabled", message: "Bookmarks is disabled in settings." };
    }

    const data = resolveBookmarksData(config);
    if (data.totalItems === 0) {
      return {
        state: "empty",
        data,
        message: "Add bookmark groups and links in settings.",
        cacheStatus: "miss",
      };
    }

    return {
      state: "success",
      data,
      cacheStatus: "miss",
    };
  },
});

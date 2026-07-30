import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { REQUIRED_WIDGET_STATES } from "../../states.js";
import { SEARCH_DEFAULT_CONFIG, type SearchData } from "./config.js";
import { SearchRenderer } from "./renderer.js";
import { SearchSettings } from "./settings.js";

const sampleData: SearchData = {
  engineId: "duckduckgo",
  engineLabel: "DuckDuckGo",
  template: "https://duckduckgo.com/?q={query}",
  placeholder: "Search the web…",
  keyboardShortcut: "/",
  openInNewTab: false,
  quickLinks: [],
};

afterEach(() => {
  cleanup();
});

describe("SearchRenderer", () => {
  it.each(REQUIRED_WIDGET_STATES)("renders state=%s", (state) => {
    render(
      <SearchRenderer
        instanceId="1"
        title="Search"
        config={SEARCH_DEFAULT_CONFIG}
        state={state}
        {...(state === "success" || state === "stale" || state === "refreshing"
          ? { data: sampleData }
          : {})}
        message={`msg-${state}`}
      />,
    );
    expect(document.querySelector(`[data-widget="search"][data-state="${state}"]`)).toBeTruthy();
  });
});

describe("SearchSettings", () => {
  it("renders engine control", () => {
    render(
      <SearchSettings instanceId="1" config={SEARCH_DEFAULT_CONFIG} onChange={() => undefined} />,
    );
    expect(screen.getByLabelText("Search engine")).toBeTruthy();
  });
});

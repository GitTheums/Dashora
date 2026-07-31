import { afterEach, describe, expect, it } from "vitest";

describe("Vitest localStorage polyfill", () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it("reads and writes values through window.localStorage", () => {
    window.localStorage.setItem("dashora-test-key", "hello");
    expect(window.localStorage.getItem("dashora-test-key")).toBe("hello");
    expect(globalThis.localStorage.getItem("dashora-test-key")).toBe("hello");
  });

  it("clears storage between tests (isolation via setup beforeEach)", () => {
    expect(window.localStorage.getItem("dashora-test-key")).toBeNull();
    window.localStorage.setItem("dashora-test-key", "should-not-leak");
    expect(window.localStorage.length).toBe(1);
  });

  it("does not emit Node's experimental localStorage warning when accessed", () => {
    const warnings: string[] = [];
    const onWarning = (warning: Error) => {
      warnings.push(warning.message);
    };
    process.on("warning", onWarning);
    try {
      window.localStorage.setItem("warn-check", "1");
      expect(window.localStorage.getItem("warn-check")).toBe("1");
      // Touch globalThis too — this is what triggers Node 26's ExperimentalWarning
      // when the experimental built-in is still installed.
      globalThis.localStorage.setItem("warn-check-global", "2");
      expect(globalThis.localStorage.getItem("warn-check-global")).toBe("2");
    } finally {
      process.off("warning", onWarning);
    }

    expect(warnings.some((message) => message.includes("localStorage"))).toBe(false);
    expect(warnings.some((message) => message.includes("--localstorage-file"))).toBe(false);
  });
});

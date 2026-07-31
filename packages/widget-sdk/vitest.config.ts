import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: [
        "src/cache.ts",
        "src/migration.ts",
        "src/envelope.ts",
        "src/states.ts",
        "src/definition.ts",
        "src/registry/**/*.{ts,tsx}",
      ],
      // types.ts is type-only (erased at emit); it has no runtime values/functions to cover.
      exclude: ["src/**/*.test.ts", "src/**/*.test.tsx", "src/registry/types.ts"],
      thresholds: {
        lines: 65,
        functions: 65,
        branches: 55,
        statements: 65,
      },
    },
  },
});

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: [
        "src/auth/**/*.ts",
        "src/secrets/**/*.ts",
        "src/providers/ssrf.ts",
        "src/providers/swr-cache.ts",
        "src/providers/errors.ts",
        "src/services/backup-service.ts",
        "src/routes/auth.ts",
        "src/routes/dashboard.ts",
        "src/routes/backup.ts",
        "src/routes/integrations.ts",
      ],
      exclude: ["src/**/*.test.ts", "src/**/*.test.tsx"],
      thresholds: {
        // Focused on security- and persistence-critical modules.
        lines: 60,
        functions: 55,
        branches: 50,
        statements: 60,
      },
    },
  },
});

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseServerEnv } from "@dashora/shared";
import { hashPassword } from "../auth/password.js";
import { generateOpaqueToken, hashToken } from "../auth/tokens.js";
import { openDatabaseFromDataDir } from "../db/client.js";
import { createRepositories } from "../db/repositories/index.js";
import { nowEpochMillis } from "../db/timestamps.js";
import { loadEnvFile } from "../load-env.js";

/**
 * Development-only seed. Refuses to run when NODE_ENV=production.
 * Creates a demo operator, dashboard, page, widget, layout, integration, and settings.
 */
async function main(): Promise<void> {
  loadEnvFile();

  const packageJsonPath = resolve(dirname(fileURLToPath(import.meta.url)), "../../package.json");
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { version: string };
  const env = parseServerEnv(process.env, { version: packageJson.version });

  if (env.NODE_ENV === "production") {
    throw new Error("Refusing to seed the database when NODE_ENV=production");
  }

  const opened = openDatabaseFromDataDir(env.DASHORA_DATA_DIR, { migrate: true });
  const repos = createRepositories(opened.db);

  try {
    const existing = await repos.users.findByEmail("operator@localhost");
    if (existing) {
      console.info(`Seed skipped: user ${existing.email} already exists (${existing.id})`);
      return;
    }

    const now = nowEpochMillis();
    const passwordHash = await hashPassword("dashora-dev-password");

    const user = await repos.users.create({
      email: "operator@localhost",
      displayName: "Local Operator",
      passwordHash,
      createdAt: now,
      updatedAt: now,
    });

    const dashboard = await repos.dashboards.create({
      ownerUserId: user.id,
      name: "Dashboard",
      slug: "default",
    });

    const defaultPages = [
      { title: "Home", slug: "home", icon: "home", sortOrder: 0 },
      { title: "Markets", slug: "markets", icon: "chart", sortOrder: 1 },
      { title: "Gaming", slug: "gaming", icon: "gamepad", sortOrder: 2 },
      { title: "Homelab", slug: "homelab", icon: "server", sortOrder: 3 },
    ] as const;

    const pages = [];
    for (const page of defaultPages) {
      pages.push(
        await repos.pages.create({
          dashboardId: dashboard.id,
          title: page.title,
          slug: page.slug,
          icon: page.icon,
          sortOrder: page.sortOrder,
        }),
      );
    }

    const page = pages[0];
    if (!page) {
      throw new Error("Failed to seed default pages");
    }
    const integration = await repos.integrations.create({
      userId: user.id,
      provider: "demo",
      name: "Demo integration",
      config: { baseUrl: "https://example.invalid" },
    });

    await repos.secrets.create({
      integrationId: integration.id,
      key: "api_token",
      // Placeholder ciphertext — real encryption lands with the secrets feature.
      ciphertext: `dev-ciphertext:${generateOpaqueToken(16)}`,
    });

    const widget = await repos.widgets.create({
      pageId: page.id,
      type: "clock",
      title: "Clock",
      config: { timezone: "UTC" },
      integrationId: integration.id,
    });

    await repos.widgetLayouts.create({
      widgetId: widget.id,
      pageId: page.id,
      colStart: 1,
      colSpan: 4,
      rowOrder: 0,
      rowSpan: 1,
    });

    await repos.settings.upsert({
      userId: user.id,
      key: "theme",
      value: "system",
    });

    await repos.sessions.create({
      userId: user.id,
      tokenHash: hashToken(generateOpaqueToken()),
      expiresAt: now + 7 * 24 * 60 * 60 * 1000,
    });

    console.info(`Seeded development database at ${opened.databasePath}`);
    console.info(`Dev user email: ${user.email} (see seed script for local password)`);
  } finally {
    opened.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});

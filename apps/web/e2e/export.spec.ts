import { expect, test } from "@playwright/test";
import { mockSession } from "./helpers/mock-api.js";

test("exports configuration from Settings → Backup", async ({ page }) => {
  const session = await mockSession(page, { withLayout: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");

  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("link", { name: "Backup" }).click();
  await expect(page.getByRole("heading", { name: "Backup" })).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download backup" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/dashora-backup-.*\.json/);

  const exported = session.getLastExported() as { format?: string; formatVersion?: number } | null;
  expect(exported?.format).toBe("dashora-config");
  expect(exported?.formatVersion).toBe(1);
});

import { expect, test } from "@playwright/test";
import { mockSession } from "./helpers/mock-api.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

test("adding Weather from the catalog persists distinct UUID instance ids", async ({ page }) => {
  const pageErrors: Error[] = [];
  page.on("pageerror", (error) => {
    pageErrors.push(error);
  });

  const session = await mockSession(page, { withLayout: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1, name: "Home" })).toBeVisible();
  await page.getByRole("button", { name: "Edit dashboard" }).click();

  await page.getByRole("button", { name: "Add widget" }).click();
  await expect(page.getByRole("dialog", { name: "Add widget" })).toBeVisible();
  await page.getByLabel("Search widgets").fill("weather");
  await expect(page.getByText("Weather", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Add to page" }).click();

  await expect(page.getByRole("dialog", { name: "Widget settings" })).toBeVisible({
    timeout: 10_000,
  });
  await page.getByRole("button", { name: "Cancel" }).click();

  const homeLayout = session.layouts.get(
    session.pages.find((entry) => entry.slug === "home")?.id ?? "",
  );
  expect(homeLayout).toBeTruthy();
  const weatherWidgets = (homeLayout?.widgets ?? []).filter(
    (widget) => widget["kind"] === "widget" && widget["type"] === "weather",
  );
  expect(weatherWidgets.length).toBeGreaterThanOrEqual(1);
  const firstId = String(weatherWidgets[0]?.["id"] ?? "");
  expect(firstId).toMatch(UUID_RE);
  expect(firstId).not.toBe("weather");

  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Home" })).toBeVisible({
    timeout: 10_000,
  });
  await page.getByRole("button", { name: "Edit dashboard" }).click();
  await expect(page.locator(`[data-widget-id="${firstId}"]`)).toBeVisible();

  await page.getByRole("button", { name: "Add widget" }).click();
  await page.getByLabel("Search widgets").fill("weather");
  await page.getByRole("button", { name: "Add to page" }).click();
  await expect(page.getByRole("dialog", { name: "Widget settings" })).toBeVisible({
    timeout: 10_000,
  });
  await page.getByRole("button", { name: "Cancel" }).click();

  const afterSecond = session.layouts.get(
    session.pages.find((entry) => entry.slug === "home")?.id ?? "",
  );
  const weatherAfter = (afterSecond?.widgets ?? []).filter(
    (widget) => widget["kind"] === "widget" && widget["type"] === "weather",
  );
  expect(weatherAfter.length).toBeGreaterThanOrEqual(2);
  const ids = weatherAfter.map((widget) => String(widget["id"]));
  expect(ids.every((id) => UUID_RE.test(id))).toBe(true);
  expect(new Set(ids).size).toBe(ids.length);
  expect(ids.every((id) => id !== "weather")).toBe(true);

  expect(pageErrors, pageErrors.map((error) => error.message).join("\n")).toEqual([]);
});

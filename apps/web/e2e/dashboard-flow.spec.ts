import { expect, test } from "@playwright/test";
import { WEATHER_ID, mockSession } from "./helpers/mock-api.js";

test("create a page, add and configure a widget, then persist after refresh", async ({ page }) => {
  const session = await mockSession(page, { withLayout: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1, name: "Home" })).toBeVisible();

  await page.getByRole("button", { name: "Edit dashboard" }).click();
  await page.getByRole("button", { name: "Add page" }).click();
  await expect(page.getByRole("dialog", { name: "Create page" })).toBeVisible();
  await page.getByLabel("Name").fill("Ops");
  await expect(page.getByLabel("Slug")).toHaveValue("ops");
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Ops" })).toBeVisible({
    timeout: 10_000,
  });
  expect(session.pages.some((entry) => entry.slug === "ops")).toBe(true);

  // Return to Home so layout persistence uses the seeded page id.
  await page
    .getByRole("navigation", { name: "Dashboard pages" })
    .getByRole("button", { name: "Home", exact: true })
    .click();
  await expect(page.getByRole("heading", { level: 1, name: "Home" })).toBeVisible();

  await page.getByRole("button", { name: "Add widget" }).click();
  await expect(page.getByRole("dialog", { name: "Add widget" })).toBeVisible();
  await page.getByLabel("Search widgets").fill("clock");
  await expect(page.getByText("Clock", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Add to page" }).click();

  await expect(page.getByRole("button", { name: "Clock actions" })).toBeVisible({
    timeout: 10_000,
  });
  await page.getByRole("button", { name: "Clock actions" }).click();
  await page.getByRole("menuitem", { name: "Settings" }).click();
  await expect(page.getByRole("dialog", { name: "Widget settings" })).toBeVisible();
  await page.getByLabel("Title").fill("Desk clock");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Desk clock")).toBeVisible({ timeout: 5_000 });
  await expect(page.getByText("Layout saved")).toBeVisible({ timeout: 5_000 });

  await page.getByRole("button", { name: "Finish editing dashboard" }).click();
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Home" })).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.getByText("Desk clock")).toBeVisible();
  await expect(
    page
      .getByRole("navigation", { name: "Dashboard pages" })
      .getByRole("button", { name: "Ops", exact: true }),
  ).toBeVisible();
});

test("drag and resize a widget and keep the layout after refresh", async ({ page }) => {
  await mockSession(page, { withLayout: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");

  await page.getByRole("button", { name: "Edit dashboard" }).click();
  const widget = page.locator(`[data-widget-id="${WEATHER_ID}"]`);
  await expect(widget).toBeVisible();

  const original = await widget.evaluate((el) => {
    const item = el.closest(".dash-layout__item") as HTMLElement | null;
    if (!item) {
      return null;
    }
    const rect = item.getBoundingClientRect();
    return { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
  });
  expect(original).not.toBeNull();
  if (!original) {
    return;
  }

  const handle = widget.locator(".dashora-widget-drag-handle");
  const handleBox = await handle.boundingBox();
  expect(handleBox).not.toBeNull();
  if (!handleBox) {
    return;
  }

  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    handleBox.x + handleBox.width / 2 + 160,
    handleBox.y + handleBox.height / 2 + 180,
    { steps: 16 },
  );
  await page.mouse.up();

  const afterDrag = await widget.evaluate((el) => {
    const item = el.closest(".dash-layout__item") as HTMLElement | null;
    if (!item) {
      return null;
    }
    const rect = item.getBoundingClientRect();
    return { top: rect.top, left: rect.left };
  });
  expect(afterDrag).not.toBeNull();
  if (!afterDrag) {
    return;
  }
  expect(Math.abs(afterDrag.left - original.left)).toBeGreaterThan(40);

  const item = page.locator(`.dash-layout__item:has([data-widget-id="${WEATHER_ID}"])`);
  const resizeHandle = item.locator(".react-resizable-handle-se");
  const resizeBox = await resizeHandle.boundingBox();
  expect(resizeBox).not.toBeNull();
  if (!resizeBox) {
    return;
  }
  await page.mouse.move(resizeBox.x + resizeBox.width / 2, resizeBox.y + resizeBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(resizeBox.x + 80, resizeBox.y + 60, { steps: 12 });
  await page.mouse.up();

  await expect(page.getByText("Layout saved")).toBeVisible({ timeout: 5_000 });

  const beforeReload = await widget.evaluate((el) => {
    const layoutItem = el.closest(".dash-layout__item") as HTMLElement | null;
    if (!layoutItem) {
      return null;
    }
    const rect = layoutItem.getBoundingClientRect();
    return { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
  });

  await page.reload();
  await page.getByRole("button", { name: "Edit dashboard" }).click();
  const afterReload = await widget.evaluate((el) => {
    const layoutItem = el.closest(".dash-layout__item") as HTMLElement | null;
    if (!layoutItem) {
      return null;
    }
    const rect = layoutItem.getBoundingClientRect();
    return { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
  });
  expect(beforeReload).not.toBeNull();
  expect(afterReload).not.toBeNull();
  if (!beforeReload || !afterReload) {
    return;
  }
  expect(Math.abs(afterReload.left - beforeReload.left)).toBeLessThan(8);
  expect(Math.abs(afterReload.top - beforeReload.top)).toBeLessThan(8);
  expect(Math.abs(afterReload.width - beforeReload.width)).toBeLessThan(16);
});

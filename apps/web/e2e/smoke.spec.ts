import { type Page, expect, test } from "@playwright/test";

const DASHBOARD_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const HOME_PAGE_ID = "bbbbbbbb-bbbb-4bbb-8bbb-000000000001";
const WEATHER_ID = "a1111111-1111-4111-8111-111111111101";

type LayoutDocument = {
  version: 1;
  widgets: Array<{ id: string; title: string; description?: string; tone?: string }>;
  layouts: {
    lg: Array<{ i: string; x: number; y: number; w: number; h: number }>;
    md: Array<{ i: string; x: number; y: number; w: number; h: number }>;
    sm: Array<{ i: string; x: number; y: number; w: number; h: number }>;
  };
};

function defaultLayout(): LayoutDocument {
  const ids = {
    weather: WEATHER_ID,
    calendar: "a1111111-1111-4111-8111-111111111102",
    markets: "a1111111-1111-4111-8111-111111111103",
    services: "a1111111-1111-4111-8111-111111111104",
    feed: "a1111111-1111-4111-8111-111111111105",
    notes: "a1111111-1111-4111-8111-111111111106",
    bookmarks: "a1111111-1111-4111-8111-111111111107",
    status: "a1111111-1111-4111-8111-111111111108",
  };
  return {
    version: 1,
    widgets: [
      { id: ids.weather, title: "Weather", description: "Placeholder conditions", tone: "accent" },
      { id: ids.calendar, title: "Calendar", description: "Upcoming events placeholder" },
      { id: ids.markets, title: "Markets", description: "Ticker placeholder" },
      {
        id: ids.services,
        title: "Services",
        description: "Health checks placeholder",
        tone: "muted",
      },
      { id: ids.feed, title: "Feed", description: "Headlines placeholder" },
      { id: ids.notes, title: "Notes", description: "Scratch pad placeholder", tone: "muted" },
      { id: ids.bookmarks, title: "Bookmarks", description: "Quick links placeholder" },
      { id: ids.status, title: "Status", description: "System status placeholder", tone: "accent" },
    ],
    layouts: {
      lg: [
        { i: ids.weather, x: 0, y: 0, w: 4, h: 2 },
        { i: ids.calendar, x: 4, y: 0, w: 4, h: 2 },
        { i: ids.markets, x: 8, y: 0, w: 4, h: 2 },
        { i: ids.services, x: 0, y: 2, w: 6, h: 2 },
        { i: ids.feed, x: 6, y: 2, w: 6, h: 3 },
        { i: ids.notes, x: 0, y: 5, w: 4, h: 2 },
        { i: ids.bookmarks, x: 4, y: 5, w: 4, h: 2 },
        { i: ids.status, x: 8, y: 5, w: 4, h: 1 },
      ],
      md: [
        { i: ids.weather, x: 0, y: 0, w: 4, h: 2 },
        { i: ids.calendar, x: 4, y: 0, w: 4, h: 2 },
        { i: ids.markets, x: 0, y: 2, w: 4, h: 2 },
        { i: ids.services, x: 4, y: 2, w: 4, h: 2 },
        { i: ids.feed, x: 0, y: 4, w: 8, h: 3 },
        { i: ids.notes, x: 0, y: 7, w: 4, h: 2 },
        { i: ids.bookmarks, x: 4, y: 7, w: 4, h: 2 },
        { i: ids.status, x: 0, y: 9, w: 8, h: 1 },
      ],
      sm: [
        { i: ids.weather, x: 0, y: 0, w: 4, h: 2 },
        { i: ids.calendar, x: 0, y: 2, w: 4, h: 2 },
        { i: ids.markets, x: 0, y: 4, w: 4, h: 2 },
        { i: ids.services, x: 0, y: 6, w: 4, h: 2 },
        { i: ids.feed, x: 0, y: 8, w: 4, h: 3 },
        { i: ids.notes, x: 0, y: 11, w: 4, h: 2 },
        { i: ids.bookmarks, x: 0, y: 13, w: 4, h: 2 },
        { i: ids.status, x: 0, y: 15, w: 4, h: 1 },
      ],
    },
  };
}

async function mockAuthenticatedSession(page: Page, options?: { withLayout?: boolean }) {
  const now = Date.now();
  const pages = [
    { name: "Home", slug: "home", icon: "home" },
    { name: "Markets", slug: "markets", icon: "chart" },
    { name: "Gaming", slug: "gaming", icon: "gamepad" },
    { name: "Homelab", slug: "homelab", icon: "server" },
  ].map((entry, index) => ({
    id: `bbbbbbbb-bbbb-4bbb-8bbb-${String(index + 1).padStart(12, "0")}`,
    dashboardId: DASHBOARD_ID,
    name: entry.name,
    slug: entry.slug,
    icon: entry.icon,
    accent: null,
    sortOrder: index,
    createdAt: now,
    updatedAt: now,
  }));

  const layouts = new Map<string, LayoutDocument>();

  await page.route("**/api/v1/setup/status", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ setupRequired: false }),
    });
  });
  await page.route("**/api/v1/auth/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: {
          id: "11111111-1111-4111-8111-111111111111",
          email: "thom@example.com",
          displayName: "Thom",
        },
      }),
    });
  });
  await page.route("**/api/v1/auth/csrf", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ csrfToken: "test-csrf" }),
    });
  });
  await page.route("**/api/v1/dashboard", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        dashboard: {
          id: DASHBOARD_ID,
          name: "Dashboard",
          slug: "default",
          pages,
          createdAt: now,
          updatedAt: now,
        },
      }),
    });
  });

  if (options?.withLayout) {
    await page.route("**/api/v1/dashboard/pages/*/layout", async (route) => {
      const url = new URL(route.request().url());
      const parts = url.pathname.split("/");
      const pageId = parts[parts.indexOf("pages") + 1] ?? HOME_PAGE_ID;
      if (route.request().method() === "GET") {
        const stored = layouts.get(pageId);
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            pageId,
            layout: stored ?? defaultLayout(),
            updatedAt: stored ? Date.now() : 0,
            isDefault: !stored,
          }),
        });
        return;
      }
      if (route.request().method() === "PUT") {
        const body = route.request().postDataJSON() as { layout: LayoutDocument };
        layouts.set(pageId, body.layout);
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            pageId,
            layout: body.layout,
            updatedAt: Date.now(),
            isDefault: false,
          }),
        });
        return;
      }
      await route.fallback();
    });
  }
}

test("shows a signed-out state when the API is unreachable", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Server unreachable" })).toBeVisible();
  await expect(page.getByText("Signed out")).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
});

test("floating navigation stays sticky while account row scrolls away", async ({ page }) => {
  await mockAuthenticatedSession(page, { withLayout: true });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");

  const session = page.locator(".app-header__session");
  const sticky = page.locator("header.app-header__nav-sticky");
  const navPill = page.locator(".top-nav__inner");

  await expect(session).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Dashboard pages" })).toBeVisible();
  await expect(page.getByLabel(/Weather widget/i)).toBeVisible();

  const atTop = await page.evaluate(() => {
    const sessionEl = document.querySelector(".app-header__session");
    const stickyEl = document.querySelector("header.app-header__nav-sticky");
    const pillEl = document.querySelector(".top-nav__inner");
    if (!sessionEl || !stickyEl || !pillEl) {
      return { ok: false as const };
    }
    return {
      ok: true as const,
      stickyPosition: getComputedStyle(stickyEl).position,
      sessionTop: sessionEl.getBoundingClientRect().top,
      pillTop: pillEl.getBoundingClientRect().top,
    };
  });
  expect(atTop.ok).toBe(true);
  if (!atTop.ok) {
    return;
  }
  expect(atTop.stickyPosition).toBe("sticky");
  expect(atTop.sessionTop).toBeGreaterThanOrEqual(0);
  expect(atTop.pillTop).toBeGreaterThan(atTop.sessionTop);

  await expect(page).toHaveScreenshot("floating-nav-top-desktop.png", {
    animations: "disabled",
    maxDiffPixelRatio: 0.03,
    clip: { x: 0, y: 0, width: 1280, height: 160 },
  });

  await page.evaluate(() => window.scrollTo(0, 900));
  await page.waitForTimeout(150);

  const scrolled = await page.evaluate(() => {
    const sessionEl = document.querySelector(".app-header__session");
    const stickyEl = document.querySelector("header.app-header__nav-sticky");
    const pillEl = document.querySelector(".top-nav__inner");
    if (!sessionEl || !stickyEl || !pillEl) {
      return { ok: false as const };
    }

    const sessionRect = sessionEl.getBoundingClientRect();
    const pillRect = pillEl.getBoundingClientRect();
    const stickyStyle = getComputedStyle(stickyEl);

    const pillProbe = document.elementFromPoint(
      pillRect.left + pillRect.width / 2,
      pillRect.top + pillRect.height / 2,
    );

    return {
      ok: true as const,
      stickyPosition: stickyStyle.position,
      stickyZ: stickyStyle.zIndex,
      sessionBottom: sessionRect.bottom,
      pillTop: pillRect.top,
      pillInsideSticky: stickyEl.contains(pillEl),
      probeInsidePill: pillProbe ? stickyEl.contains(pillProbe) : false,
    };
  });

  expect(scrolled.ok).toBe(true);
  if (!scrolled.ok) {
    return;
  }
  expect(scrolled.stickyPosition).toBe("sticky");
  expect(Number(scrolled.stickyZ)).toBeGreaterThanOrEqual(100);
  expect(scrolled.sessionBottom).toBeLessThanOrEqual(0);
  expect(scrolled.pillTop).toBeGreaterThanOrEqual(8);
  expect(scrolled.pillTop).toBeLessThanOrEqual(24);
  expect(scrolled.pillInsideSticky).toBe(true);
  expect(scrolled.probeInsidePill).toBe(true);

  await expect(navPill).toHaveScreenshot("floating-nav-scrolled-desktop.png", {
    animations: "disabled",
    maxDiffPixelRatio: 0.02,
  });
  await expect(session).not.toBeInViewport();
  await expect(sticky).toBeInViewport();
});

test("floating navigation works on mobile light theme", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockAuthenticatedSession(page, { withLayout: true });
  await page.goto("/");
  await page.evaluate(() => {
    document.documentElement.setAttribute("data-theme", "light");
  });

  await expect(page.getByText("Signed in as Thom")).toBeVisible();
  await expect(page).toHaveScreenshot("floating-nav-top-mobile.png", {
    animations: "disabled",
    maxDiffPixelRatio: 0.03,
    clip: { x: 0, y: 0, width: 390, height: 140 },
  });

  await page.evaluate(() => window.scrollTo(0, 700));
  await page.waitForTimeout(150);

  const layering = await page.evaluate(() => {
    const sessionEl = document.querySelector(".app-header__session");
    const stickyEl = document.querySelector("header.app-header__nav-sticky");
    const pillEl = document.querySelector(".top-nav__inner");
    if (!sessionEl || !stickyEl || !pillEl) {
      return { ok: false as const };
    }
    const pillRect = pillEl.getBoundingClientRect();
    const probe = document.elementFromPoint(
      pillRect.left + pillRect.width / 2,
      pillRect.top + pillRect.height / 2,
    );
    return {
      ok: true as const,
      sticky: getComputedStyle(stickyEl).position === "sticky",
      sessionBottom: sessionEl.getBoundingClientRect().bottom,
      pillTop: pillRect.top,
      radius: getComputedStyle(pillEl).borderRadius,
      probeInsideNav: probe ? stickyEl.contains(probe) : false,
    };
  });

  expect(layering.ok).toBe(true);
  if (!layering.ok) {
    return;
  }
  expect(layering.sticky).toBe(true);
  expect(layering.sessionBottom).toBeLessThanOrEqual(0);
  expect(layering.pillTop).toBeGreaterThanOrEqual(4);
  expect(layering.pillTop).toBeLessThanOrEqual(24);
  expect(layering.radius).not.toBe("0px");
  expect(layering.probeInsideNav).toBe(true);

  await expect(page.locator(".top-nav__inner")).toHaveScreenshot(
    "floating-nav-scrolled-mobile.png",
    {
      animations: "disabled",
      maxDiffPixelRatio: 0.02,
    },
  );
});

test("page ellipsis menu opens above sticky navigation without navigating", async ({ page }) => {
  await mockAuthenticatedSession(page, { withLayout: true });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1, name: "Home" })).toBeVisible();
  await page.getByRole("button", { name: "Edit dashboard" }).click();

  const markets = page.getByRole("button", { name: "Markets" });
  const marketsWrap = markets.locator(
    "xpath=ancestor::*[contains(@class,'top-nav__page-wrap')][1]",
  );
  await marketsWrap.getByRole("button", { name: "Page actions for Markets" }).click();

  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "Rename page" })).toBeVisible();

  const layering = await page.evaluate(() => {
    const menuEl = document.querySelector('[role="menu"]');
    const stickyEl = document.querySelector("header.app-header__nav-sticky");
    if (!menuEl || !stickyEl) {
      return { ok: false as const };
    }
    const menuZ = Number(getComputedStyle(menuEl).zIndex);
    const stickyZ = Number(getComputedStyle(stickyEl).zIndex);
    return {
      ok: true as const,
      portaled: menuEl.parentElement === document.body,
      menuZ,
      stickyZ,
      position: getComputedStyle(menuEl).position,
    };
  });
  expect(layering.ok).toBe(true);
  if (!layering.ok) {
    return;
  }
  expect(layering.portaled).toBe(true);
  expect(layering.position).toBe("fixed");
  expect(layering.menuZ).toBeGreaterThan(layering.stickyZ);

  await expect(page).toHaveURL(/\/(home)?$/);
  await expect(page.getByRole("heading", { level: 1, name: "Home" })).toBeVisible();
});

test("first drag and resize persist without jumping back", async ({ page }) => {
  await mockAuthenticatedSession(page, { withLayout: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1, name: "Home" })).toBeVisible();
  await page.getByRole("button", { name: "Edit dashboard" }).click();

  const widget = page.locator(`[data-widget-id="${WEATHER_ID}"]`);
  await expect(widget).toBeVisible();

  const original = await widget.evaluate((el) => {
    const item = el.closest(".dash-layout__item") as HTMLElement | null;
    if (!item) {
      return null;
    }
    const rect = item.getBoundingClientRect();
    return {
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    };
  });
  expect(original).not.toBeNull();
  if (!original) {
    return;
  }

  const handle = widget.locator(".dashora-widget-drag-handle");
  await expect(handle).toHaveClass(/dashora-widget-drag-handle/);
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
  expect(Math.abs(afterDrag.top - original.top)).toBeGreaterThan(40);

  // Ensure it does not snap back to the original position after release.
  await page.waitForTimeout(150);
  const settled = await widget.evaluate((el) => {
    const item = el.closest(".dash-layout__item") as HTMLElement | null;
    if (!item) {
      return null;
    }
    const rect = item.getBoundingClientRect();
    return { top: rect.top, left: rect.left };
  });
  expect(settled).not.toBeNull();
  if (!settled) {
    return;
  }
  expect(Math.abs(settled.left - original.left)).toBeGreaterThan(40);
  expect(Math.abs(settled.top - original.top)).toBeGreaterThan(40);
  // Allow compacting/subpixel settle, but reject a full snap-back toward origin.
  expect(Math.abs(settled.left - afterDrag.left)).toBeLessThan(
    Math.abs(afterDrag.left - original.left) * 0.5,
  );
  expect(Math.abs(settled.top - afterDrag.top)).toBeLessThan(
    Math.abs(afterDrag.top - original.top) * 0.5,
  );

  await expect(page.getByText("Layout saved")).toBeVisible({ timeout: 5_000 });

  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Home" })).toBeVisible();
  await page.getByRole("button", { name: "Edit dashboard" }).click();
  const widgetAfterReload = page.locator(`[data-widget-id="${WEATHER_ID}"]`);
  await expect(widgetAfterReload).toBeVisible();

  const reloaded = await widgetAfterReload.evaluate((el) => {
    const item = el.closest(".dash-layout__item") as HTMLElement | null;
    if (!item) {
      return null;
    }
    const rect = item.getBoundingClientRect();
    return { top: rect.top, left: rect.left };
  });
  expect(reloaded).not.toBeNull();
  if (!reloaded) {
    return;
  }
  expect(Math.abs(reloaded.left - original.left)).toBeGreaterThan(40);
  expect(Math.abs(reloaded.top - original.top)).toBeGreaterThan(40);

  const item = page.locator(`.dash-layout__item:has([data-widget-id="${WEATHER_ID}"])`);
  const beforeResize = await item.boundingBox();
  expect(beforeResize).not.toBeNull();
  if (!beforeResize) {
    return;
  }

  const resizeHandle = item.locator(".react-resizable-handle-se");
  await expect(resizeHandle).toBeVisible();
  const resizeBox = await resizeHandle.boundingBox();
  expect(resizeBox).not.toBeNull();
  if (!resizeBox) {
    return;
  }

  await page.mouse.move(resizeBox.x + resizeBox.width / 2, resizeBox.y + resizeBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    resizeBox.x + resizeBox.width / 2 + 100,
    resizeBox.y + resizeBox.height / 2 + 80,
    { steps: 12 },
  );
  await page.mouse.up();

  const afterResize = await item.boundingBox();
  expect(afterResize).not.toBeNull();
  if (!afterResize) {
    return;
  }
  expect(afterResize.width).toBeGreaterThan(beforeResize.width + 20);
  expect(afterResize.height).toBeGreaterThan(beforeResize.height + 10);

  await page.waitForTimeout(150);
  const resizeSettled = await item.boundingBox();
  expect(resizeSettled).not.toBeNull();
  if (!resizeSettled) {
    return;
  }
  expect(Math.abs(resizeSettled.width - afterResize.width)).toBeLessThan(40);
  expect(Math.abs(resizeSettled.height - afterResize.height)).toBeLessThan(40);
  expect(resizeSettled.width).toBeGreaterThan(beforeResize.width + 16);
  expect(resizeSettled.height).toBeGreaterThan(beforeResize.height + 8);
  await expect(page.getByText("Layout saved")).toBeVisible({ timeout: 5_000 });
});

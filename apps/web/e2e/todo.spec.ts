import { type Page, expect, test } from "@playwright/test";

const DASHBOARD_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const HOME_PAGE_ID = "bbbbbbbb-bbbb-4bbb-8bbb-000000000001";
const TODO_INSTANCE_ID = "c1111111-1111-4111-8111-111111111201";

type TodoItem = {
  id: string;
  title: string;
  completed: boolean;
  dueAt: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

type LayoutDocument = {
  version: 1;
  widgets: Array<Record<string, unknown>>;
  layouts: {
    lg: Array<{ i: string; x: number; y: number; w: number; h: number }>;
    md: Array<{ i: string; x: number; y: number; w: number; h: number }>;
    sm: Array<{ i: string; x: number; y: number; w: number; h: number }>;
  };
};

function todoLayout(): LayoutDocument {
  return {
    version: 1,
    widgets: [
      {
        kind: "widget",
        id: TODO_INSTANCE_ID,
        type: "todo",
        title: "Todo",
        enabled: true,
        refreshIntervalSeconds: null,
        config: { viewMode: "detailed", showCompleted: true, enabled: true },
        schemaVersion: 1,
        lastUpdatedAt: null,
      },
    ],
    layouts: {
      lg: [{ i: TODO_INSTANCE_ID, x: 0, y: 0, w: 4, h: 4 }],
      md: [{ i: TODO_INSTANCE_ID, x: 0, y: 0, w: 4, h: 4 }],
      sm: [{ i: TODO_INSTANCE_ID, x: 0, y: 0, w: 4, h: 4 }],
    },
  };
}

function newId(): string {
  return crypto.randomUUID();
}

async function mockTodoDashboard(page: Page, store: { items: TodoItem[] }) {
  const now = Date.now();
  const pages = [
    {
      id: HOME_PAGE_ID,
      dashboardId: DASHBOARD_ID,
      name: "Home",
      slug: "home",
      icon: "home",
      accent: null,
      sortOrder: 0,
      createdAt: now,
      updatedAt: now,
    },
  ];

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
  await page.route(`**/api/v1/dashboard/pages/${HOME_PAGE_ID}/layout**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        pageId: HOME_PAGE_ID,
        layout: todoLayout(),
        updatedAt: Date.now(),
        isDefault: false,
      }),
    });
  });

  await page.route(`**/api/v1/widgets/todo/instances/${TODO_INSTANCE_ID}/**`, async (route) => {
    const method = route.request().method();
    const url = new URL(route.request().url());
    const path = url.pathname;
    const itemsBase = `/api/v1/widgets/todo/instances/${TODO_INSTANCE_ID}/items`;

    if (method === "GET" && path.endsWith("/items")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items: store.items }),
      });
      return;
    }

    if (method === "POST" && path.endsWith("/items")) {
      const body = route.request().postDataJSON() as { title: string; dueAt?: string | null };
      const item: TodoItem = {
        id: newId(),
        title: body.title,
        completed: false,
        dueAt: body.dueAt ?? null,
        sortOrder: store.items.length,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      store.items.push(item);
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ item }),
      });
      return;
    }

    if (method === "PUT" && path.endsWith("/items/order")) {
      const body = route.request().postDataJSON() as { orderedIds: string[] };
      store.items = body.orderedIds.map((id, sortOrder) => {
        const existing = store.items.find((item) => item.id === id);
        if (!existing) {
          throw new Error(`missing ${id}`);
        }
        return { ...existing, sortOrder };
      });
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items: store.items }),
      });
      return;
    }

    if (path.startsWith(`${itemsBase}/`) && !path.endsWith("/order")) {
      const itemId = path.slice(itemsBase.length + 1);
      if (method === "PATCH") {
        const body = route.request().postDataJSON() as {
          title?: string;
          completed?: boolean;
          dueAt?: string | null;
        };
        const index = store.items.findIndex((item) => item.id === itemId);
        const current = store.items[index];
        if (index < 0 || !current) {
          await route.fulfill({ status: 404, body: "{}" });
          return;
        }
        const updated: TodoItem = {
          ...current,
          title: body.title ?? current.title,
          completed: body.completed ?? current.completed,
          dueAt: body.dueAt === undefined ? current.dueAt : body.dueAt,
          updatedAt: new Date().toISOString(),
        };
        store.items[index] = updated;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ item: updated }),
        });
        return;
      }
      if (method === "DELETE") {
        store.items = store.items.filter((item) => item.id !== itemId);
        await route.fulfill({ status: 204, body: "" });
        return;
      }
    }

    await route.fulfill({ status: 404, body: "{}" });
  });
}

test("todo widget works in view mode without layout helper text", async ({ page }) => {
  const store = { items: [] as TodoItem[] };
  await mockTodoDashboard(page, store);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");

  const todo = page.getByLabel(/Todo widget/i);
  await expect(todo).toBeVisible();
  await expect(page.getByText(/Your dashboard is in view mode/i)).toHaveCount(0);
  await expect(page.locator(".dash-shell__lede")).toHaveCount(0);

  const input = todo.getByPlaceholder("Add a task…");
  await expect(input).toBeVisible();
  await input.fill("Ship Todo fix");
  await todo.getByRole("button", { name: "Add" }).click();
  await expect(todo.getByText("Ship Todo fix")).toBeVisible();

  const beforeBox = await todo.boundingBox();
  await todo.getByLabel("Complete Ship Todo fix").click();
  await expect(todo.getByLabel("Reopen Ship Todo fix")).toBeVisible();

  await page.reload();
  await expect(page.getByLabel(/Todo widget/i).getByLabel("Reopen Ship Todo fix")).toBeVisible();

  await page
    .getByLabel(/Todo widget/i)
    .getByLabel("Reopen Ship Todo fix")
    .click();
  await expect(page.getByLabel(/Todo widget/i).getByLabel("Complete Ship Todo fix")).toBeVisible();

  await page
    .getByLabel(/Todo widget/i)
    .getByRole("button", { name: "Edit Ship Todo fix" })
    .click();
  const edit = page.getByLabel(/Todo widget/i).getByLabel("Edit Ship Todo fix");
  await edit.fill("Ship Todo fix v2");
  await edit.press("Enter");
  await expect(page.getByLabel(/Todo widget/i).getByText("Ship Todo fix v2")).toBeVisible();

  await page
    .getByLabel(/Todo widget/i)
    .getByRole("button", { name: "Delete Ship Todo fix v2" })
    .click();
  await expect(page.getByLabel(/Todo widget/i).getByText("Ship Todo fix v2")).toHaveCount(0);

  const afterBox = await page.getByLabel(/Todo widget/i).boundingBox();
  expect(beforeBox && afterBox).toBeTruthy();
  if (beforeBox && afterBox) {
    expect(Math.abs(afterBox.x - beforeBox.x)).toBeLessThan(2);
    expect(Math.abs(afterBox.y - beforeBox.y)).toBeLessThan(2);
  }
});

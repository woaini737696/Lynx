import { test, expect } from "@playwright/test";

/**
 * 看板流程 E2E 测试
 * 依赖 globalSetup 提供的 storageState（已登录状态）
 */
test.describe("看板流程", () => {
  test("访问 /board 页面应正常加载并显示三列看板", async ({ page }) => {
    await page.goto("/board");
    await expect(page).toHaveTitle(/LynnHub/);

    // 等待页面加载完成，三列看板标题应可见
    await expect(page.getByText("北极星", { exact: true })).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByText("战役", { exact: true })).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByText("任务", { exact: true })).toBeVisible({
      timeout: 15000,
    });
  });

  test("GET /api/tasks 应返回任务数据", async ({ request }) => {
    const res = await request.get("/api/tasks");
    expect(res.ok(), "/api/tasks 应返回 200").toBeTruthy();
    const body = await res.json();
    expect(body, "响应应包含 tasks 字段").toHaveProperty("tasks");
    expect(Array.isArray(body.tasks), "tasks 应为数组").toBeTruthy();
  });

  test("看板页面应显示任务数量统计", async ({ page }) => {
    await page.goto("/board");
    // 等待列标题可见，说明页面已加载
    await expect(page.getByText("北极星", { exact: true })).toBeVisible({
      timeout: 15000,
    });
    // 每列应有 x/limit 的数量显示（如 0/3, 0/5, 0/10）
    await expect(page.locator("text=/\\d+\\/\\d+/").first()).toBeVisible({
      timeout: 10000,
    });
  });
});

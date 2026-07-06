import { test, expect } from "@playwright/test";

/**
 * 飞书任务模块 Smoke 冒烟测试
 * - 页面路由：/ai/lark-tasks（src/app/ai/lark-tasks/page.tsx）
 * - API 端点：/api/lark-tasks（GET 返回 tasks/assignees/tasklists/subtaskMap）
 * - 关键 UI：PageHeader 标题"飞书任务"、副标题"双向同步飞书任务中心"，
 *            "连接飞书"按钮（未连接时）或"已连接"按钮（已连接时）、
 *            "同步"按钮、"新建任务"按钮
 * 依赖 globalSetup 提供的 storageState（已登录状态）
 */
test.describe("飞书任务模块", () => {
  test("访问 /ai/lark-tasks 页面应正常加载", async ({ page }) => {
    const res = await page.goto("/ai/lark-tasks");
    expect(res?.ok(), "页面应返回 200").toBeTruthy();
    await expect(page).toHaveTitle(/LynnHub/);
    await expect(page).toHaveURL(/\/ai\/lark-tasks/);
  });

  test("页面应显示飞书任务标题与同步相关按钮", async ({ page }) => {
    await page.goto("/ai/lark-tasks");
    // 主标题
    await expect(page.getByText("飞书任务", { exact: true }).first()).toBeVisible({
      timeout: 15000,
    });
    // 副标题
    await expect(
      page.getByText("双向同步飞书任务中心，一键收敛到决策看板")
    ).toBeVisible({ timeout: 15000 });
    // 同步按钮（无论连接状态都存在）
    await expect(page.getByRole("button", { name: /同步/ }).first()).toBeVisible({
      timeout: 15000,
    });
    // 新建任务按钮
    await expect(
      page.getByRole("button", { name: /新建任务/ }).first()
    ).toBeVisible({ timeout: 15000 });
  });

  test("页面应显示「连接飞书」按钮或「已连接」状态之一", async ({ page }) => {
    await page.goto("/ai/lark-tasks");
    // 等待页面头部加载完成
    await expect(page.getByText("飞书任务", { exact: true }).first()).toBeVisible({
      timeout: 15000,
    });
    // 二选一：未连接显示"连接飞书"，已连接显示带"已连接"或飞书账号名称的按钮
    // 使用 locator.or() 表示"任一可见即通过"，避免 Promise.race 的 reject 时序问题
    const connectBtn = page.getByRole("button", { name: /连接飞书/ });
    const connectedBtn = page.getByRole("button", { name: /已连接|断开/ });
    await expect(connectBtn.or(connectedBtn).first()).toBeVisible({
      timeout: 15000,
    });
  });

  test("GET /api/lark-tasks 应返回 200 且包含 tasks 字段", async ({ request }) => {
    const res = await request.get("/api/lark-tasks?view=my");
    expect(res.ok(), "/api/lark-tasks 应返回 200").toBeTruthy();
    const body = await res.json();
    // 接口契约：返回 tasks 数组（可能为空）
    expect(body, "响应应包含 tasks 字段").toHaveProperty("tasks");
    expect(Array.isArray(body.tasks), "tasks 应为数组").toBeTruthy();
  });

  test("GET /api/lark-tasks?meta=true 应返回筛选元数据", async ({ request }) => {
    const res = await request.get("/api/lark-tasks?meta=true");
    expect(res.ok(), "/api/lark-tasks?meta=true 应返回 200").toBeTruthy();
    const body = await res.json();
    // meta 模式返回 assignees / tasklists / syncState
    expect(body, "响应应包含 assignees 字段").toHaveProperty("assignees");
    expect(body, "响应应包含 tasklists 字段").toHaveProperty("tasklists");
    expect(Array.isArray(body.assignees), "assignees 应为数组").toBeTruthy();
    expect(Array.isArray(body.tasklists), "tasklists 应为数组").toBeTruthy();
  });

  test("页面应显示任务列表或空状态提示", async ({ page }) => {
    await page.goto("/ai/lark-tasks");
    // 等待页面加载完成
    await expect(page.getByText("飞书任务", { exact: true }).first()).toBeVisible({
      timeout: 15000,
    });
    // 等待数据加载：要么看到任务卡片（含"共 N 个主任务"），要么看到空状态"暂无飞书任务"/"暂无未完成任务"等
    await expect(
      page.locator("text=/共 \\d+ 个主任务|暂无.*任务|未找到匹配的任务/")
    ).toBeVisible({ timeout: 20000 });
  });
});

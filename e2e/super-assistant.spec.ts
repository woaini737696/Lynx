import { test, expect } from "@playwright/test";

/**
 * 灵思超级助理模块 Smoke 冒烟测试
 * - 页面路由：/ai/assistant（src/app/ai/assistant/page.tsx）
 * - API 端点：/api/ai/chat/sessions（GET 返回 { sessions: [...] }）
 * - 关键 UI：Header 标题"奇思超级助理"、副标题"基于你的记忆图谱..."、
 *            消息输入框（placeholder 含"输入消息，Enter 发送"）、
 *            历史对话按钮、新对话按钮、设置按钮
 * 依赖 globalSetup 提供的 storageState（已登录状态）
 */
test.describe("灵思超级助理模块", () => {
  test("访问 /ai/assistant 页面应正常加载", async ({ page }) => {
    const res = await page.goto("/ai/assistant");
    expect(res?.ok(), "页面应返回 200").toBeTruthy();
    await expect(page).toHaveTitle(/LynnHub/);
    await expect(page).toHaveURL(/\/ai\/assistant/);
  });

  test("页面应显示超级助理标题与副标题", async ({ page }) => {
    await page.goto("/ai/assistant");
    // 主标题
    await expect(page.getByText("奇思超级助理", { exact: false }).first()).toBeVisible({
      timeout: 15000,
    });
    // 副标题
    await expect(
      page.getByText("基于你的记忆图谱和认知库提供个性化协助")
    ).toBeVisible({ timeout: 15000 });
  });

  test("页面应显示消息输入框与发送按钮", async ({ page }) => {
    await page.goto("/ai/assistant");
    // 等待 Header 加载完成
    await expect(page.getByText("奇思超级助理", { exact: false }).first()).toBeVisible({
      timeout: 15000,
    });
    // 输入框（placeholder 含"输入消息"或"Enter 发送"）
    await expect(
      page.locator('input[placeholder*="输入消息"], input[placeholder*="Enter 发送"]')
    ).toBeVisible({ timeout: 15000 });
  });

  test("页面应显示历史对话、新对话、设置等头部按钮", async ({ page }) => {
    await page.goto("/ai/assistant");
    // 等待 Header 加载完成
    await expect(page.getByText("奇思超级助理", { exact: false }).first()).toBeVisible({
      timeout: 15000,
    });
    // 头部应有多个按钮：历史对话、新对话、设置、清空（带 title 属性）
    await expect(
      page.locator('button[title="历史对话"]')
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.locator('button[title="新对话"]')
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.locator('button[title="设置"]')
    ).toBeVisible({ timeout: 10000 });
  });

  test("GET /api/ai/chat/sessions 应返回 200 且包含 sessions 数组", async ({ request }) => {
    const res = await request.get("/api/ai/chat/sessions");
    expect(res.ok(), "/api/ai/chat/sessions 应返回 200").toBeTruthy();
    const body = await res.json();
    // 接口契约：返回 { sessions: [...] }，每条会话含 id/title/updatedAt 等
    expect(body, "响应应包含 sessions 字段").toHaveProperty("sessions");
    expect(Array.isArray(body.sessions), "sessions 应为数组").toBeTruthy();
    // 若有会话，验证字段结构
    if (body.sessions.length > 0) {
      const session = body.sessions[0];
      expect(session).toHaveProperty("id");
      expect(session).toHaveProperty("title");
      expect(session).toHaveProperty("updatedAt");
    }
  });

  test("点击历史对话按钮应展开会话列表面板", async ({ page }) => {
    await page.goto("/ai/assistant");
    // 等待 Header 加载完成
    await expect(page.getByText("奇思超级助理", { exact: false }).first()).toBeVisible({
      timeout: 15000,
    });
    // 点击"历史对话"按钮
    await page.locator('button[title="历史对话"]').click();
    // 会话列表面板标题"历史对话"应可见
    await expect(page.getByText("历史对话", { exact: true }).first()).toBeVisible({
      timeout: 10000,
    });
  });
});

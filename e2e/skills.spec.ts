import { test, expect } from "@playwright/test";

/**
 * 技能管理模块 Smoke 冒烟测试
 * - 页面路由：/skills（src/app/skills/page.tsx）
 * - API 端点：/api/skills（GET 返回 { success, data, total, hasMore, cursor }）
 * - 关键 UI：PageHeader 标题"技能管理"、副标题"可复用的 AI 技能模板..."，
 *            "新建"按钮、"导入"按钮、"AI 生成"按钮、分类侧边栏
 * 依赖 globalSetup 提供的 storageState（已登录状态）
 */
test.describe("技能管理模块", () => {
  test("访问 /skills 页面应正常加载", async ({ page }) => {
    const res = await page.goto("/skills");
    expect(res?.ok(), "页面应返回 200").toBeTruthy();
    await expect(page).toHaveTitle(/LynnHub/);
    await expect(page).toHaveURL(/\/skills/);
  });

  test("页面应显示技能管理标题与新建/导入/AI 生成按钮", async ({ page }) => {
    await page.goto("/skills");
    // 主标题
    await expect(page.getByText("技能管理", { exact: true }).first()).toBeVisible({
      timeout: 15000,
    });
    // 副标题
    await expect(
      page.getByText("可复用的 AI 技能模板：创建、导入、AI 生成、导出")
    ).toBeVisible({ timeout: 15000 });
    // "新建"按钮（PageHeader 中）
    await expect(
      page.getByRole("button", { name: /新建/ }).first()
    ).toBeVisible({ timeout: 15000 });
    // "导入"按钮
    await expect(
      page.getByRole("button", { name: /导入/ }).first()
    ).toBeVisible({ timeout: 15000 });
    // "AI 生成"按钮
    await expect(
      page.getByRole("button", { name: /AI 生成/ }).first()
    ).toBeVisible({ timeout: 15000 });
  });

  test("页面应显示技能列表或空状态提示", async ({ page }) => {
    await page.goto("/skills");
    // 等待页面加载完成
    await expect(page.getByText("技能管理", { exact: true }).first()).toBeVisible({
      timeout: 15000,
    });
    // 数据加载后：要么显示技能卡片列表，要么显示空状态"暂无技能"
    await expect(
      page.locator("text=/暂无技能|未匹配到结果|参数|使用/")
    ).toBeVisible({ timeout: 20000 });
  });

  test("GET /api/skills 应返回 200 且包含技能数据数组", async ({ request }) => {
    const res = await request.get("/api/skills?category=all");
    expect(res.ok(), "/api/skills 应返回 200").toBeTruthy();
    const body = await res.json();
    // 接口契约：使用 paginatedResponse 返回 { success, data, total, hasMore, cursor }
    expect(body, "响应应包含 success 字段").toHaveProperty("success");
    expect(body.success, "success 应为 true").toBeTruthy();
    expect(body, "响应应包含 data 字段").toHaveProperty("data");
    expect(Array.isArray(body.data), "data 应为数组").toBeTruthy();
    expect(body, "响应应包含 total 字段").toHaveProperty("total");
  });

  test("点击「新建」按钮应打开新建技能弹窗", async ({ page }) => {
    await page.goto("/skills");
    // 等待页面加载完成
    await expect(page.getByText("技能管理", { exact: true }).first()).toBeVisible({
      timeout: 15000,
    });
    // 点击 PageHeader 中的"新建"按钮（位于操作区，含 Plus 图标）
    await page.getByRole("button", { name: /新建/ }).first().click();
    // 弹窗标题"新建技能"应可见
    await expect(page.getByText("新建技能", { exact: true })).toBeVisible({
      timeout: 5000,
    });
    // 弹窗中应有"名称"和"描述"必填字段
    await expect(page.getByText("名称", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("描述", { exact: true }).first()).toBeVisible();
  });
});

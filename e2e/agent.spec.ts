import { test, expect } from "@playwright/test";

/**
 * 灵思 Agent (Hermes) 模块 Smoke 冒烟测试
 *
 * 说明：项目未提供独立的"灵思 Agent"页面（无 /agent 或 /hermes 路由）。
 * Hermes Agent 的能力通过以下方式暴露：
 *   1. /settings/remote-control 页面（"远程操控"）：管理运行 Hermes Agent 的桌面端设备
 *      —— 路由文件：src/app/settings/remote-control/page.tsx
 *   2. /api/hermes/* 系列 API：状态查询、配置、远程命令等
 *   3. /ai/assistant 页面内集成的"奇思 Agent 模式"切换
 * 因此本 spec 选择 /settings/remote-control 作为最接近的页面入口进行冒烟测试，
 * 并验证 /api/hermes/status 端点的可访问性与返回结构。
 *
 * 依赖 globalSetup 提供的 storageState（已登录状态）
 */
test.describe("灵思 Agent 模块", () => {
  test("访问 /settings/remote-control 页面应正常加载", async ({ page }) => {
    const res = await page.goto("/settings/remote-control");
    expect(res?.ok(), "页面应返回 200").toBeTruthy();
    await expect(page).toHaveTitle(/LynnHub/);
    await expect(page).toHaveURL(/\/settings\/remote-control/);
  });

  test("页面应显示远程操控标题与设备管理区域", async ({ page }) => {
    await page.goto("/settings/remote-control");
    // 主标题
    await expect(page.getByText("远程操控", { exact: true }).first()).toBeVisible({
      timeout: 15000,
    });
    // 副标题包含"在线设备"统计
    await expect(page.locator("text=/在线设备 \\d+ 台/")).toBeVisible({
      timeout: 15000,
    });
    // 应有"下发远程指令"区域或空状态/设备列表
    await expect(
      page.locator("text=/下发远程指令|请在电脑上下载并启动奇思桌面端|暂无.*设备/")
    ).toBeVisible({ timeout: 20000 });
  });

  test("GET /api/hermes/status 应返回 200 且包含 Agent 状态字段", async ({ request }) => {
    const res = await request.get("/api/hermes/status");
    expect(res.ok(), "/api/hermes/status 应返回 200").toBeTruthy();
    const body = await res.json();
    // 接口契约：返回 installed/connected/config/devices 等字段
    expect(body, "响应应包含 installed 字段").toHaveProperty("installed");
    expect(body, "响应应包含 connected 字段").toHaveProperty("connected");
    expect(body, "响应应包含 devices 字段").toHaveProperty("devices");
    expect(Array.isArray(body.devices), "devices 应为数组").toBeTruthy();
  });

  test("GET /api/hermes/latest-json 应返回 200（应用版本清单）", async ({ request }) => {
    const res = await request.get("/api/hermes/latest-json");
    // 该端点返回 Hermes Agent 安装包的版本清单（latest.json）
    expect(res.ok(), "/api/hermes/latest-json 应返回 200").toBeTruthy();
    // 验证返回的是 JSON（不应是 HTML 错误页）
    const contentType = res.headers()["content-type"] || "";
    expect(contentType, "Content-Type 应为 JSON").toContain("json");
  });

  test("页面应显示已连接的桌面端设备或空状态引导", async ({ page }) => {
    await page.goto("/settings/remote-control");
    // 等待页面加载完成
    await expect(page.getByText("远程操控", { exact: true }).first()).toBeVisible({
      timeout: 15000,
    });
    // 数据加载后：要么显示在线设备卡片，要么显示"请在电脑上下载并启动奇思桌面端"空引导
    await expect(
      page.locator("text=/请在电脑上下载并启动奇思桌面端|在线|离线|待执行|已下发/")
    ).toBeVisible({ timeout: 20000 });
  });
});

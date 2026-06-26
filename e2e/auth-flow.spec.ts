import { test, expect } from "@playwright/test";
import { cleanupTestData } from "./helpers/auth";

/**
 * 登录流程 E2E 测试
 * 注意：大部分测试依赖 globalSetup 保存的 storageState（已登录状态）
 * 需要未登录状态的测试使用单独的 context
 */
test.describe("认证流程", () => {
  test.afterEach(async ({ request }) => {
    await cleanupTestData(request, ["E2E"]);
  });

  test("未登录访问 / 应重定向到 /login", async ({ browser }) => {
    // 使用全新上下文，不携带 storageState 中的 cookie
    const context = await browser.newContext({ storageState: undefined });
    const page = await context.newPage();
    const res = await page.goto("/");
    expect(res?.url(), "URL 应包含 /login").toContain("/login");
    expect(page.url(), "页面 URL 应为 /login").toContain("/login");
    await context.close();
  });

  test("登录页应正常渲染", async ({ browser }) => {
    // 登录页不需要认证，使用全新上下文
    const context = await browser.newContext({ storageState: undefined });
    const page = await context.newPage();
    await page.goto("/login");
    await expect(page).toHaveTitle(/LynnHub/);
    // 默认账号提示（使用 exact 匹配避免 strict mode violation）
    await expect(page.getByText("admin", { exact: true })).toBeVisible();
    await expect(page.getByText("admin123", { exact: true })).toBeVisible();
    await context.close();
  });

  test("使用 admin/admin123 登录后跳转首页", async ({ browser }) => {
    // 使用全新上下文测试完整登录流程
    const context = await browser.newContext({ storageState: undefined });
    const page = await context.newPage();

    // 通过 UI 登录
    await page.goto("/login");
    await page.fill('input[id="username"]', "admin");
    await page.fill('input[id="password"]', "admin123");
    await page.click('button[type="submit"]');

    // 等待跳转到首页（去掉 /login）
    await page.waitForURL((url) => !url.pathname.startsWith("/login"), {
      timeout: 15000,
    });
    expect(page.url(), "登录后应离开 /login").not.toMatch(/\/login/);
    await context.close();
  });

  test("登录后访问 /api/ideas 应返回 JSON", async ({ request }) => {
    // 使用 globalSetup 提供的 storageState（已登录）
    const res = await request.get("/api/ideas");
    expect(res.ok(), "/api/ideas 应返回 200").toBeTruthy();
    const body = await res.json();
    expect(body, "响应体应包含 ideas 字段").toHaveProperty("ideas");
    expect(Array.isArray(body.ideas), "ideas 应为数组").toBeTruthy();
  });

  test("未登录访问 /api/ideas 应被重定向到登录页", async ({ browser }) => {
    // 使用全新的浏览器上下文，确保不携带任何 cookie
    const context = await browser.newContext({ storageState: undefined });
    const request = context.request;
    // 不跟随重定向，检查原始状态码
    const res = await request.get("/api/ideas", {
      failOnStatusCode: false,
      maxRedirects: 0,
    });
    // middleware 会将未认证请求重定向到 /login（307 或 302）
    const status = res.status();
    expect(
      status === 307 || status === 302,
      `未登录应被重定向（307/302），实际状态码：${status}`
    ).toBeTruthy();
    await context.close();
  });
});

import { expect, type Page, type APIRequestContext } from "@playwright/test";

/**
 * 登录辅助函数
 * 流程：
 *   1. GET /api/auth/csrf 获取 CSRF token
 *   2. POST /api/auth/callback/credentials 提交登录表单
 *
 * 使用 request context 复用 cookie jar，保证后续 API 调用已登录
 */
export async function login(
  request: APIRequestContext,
  username = "admin",
  password = "admin123"
): Promise<void> {
  // 1. 获取 CSRF token
  const csrfRes = await request.get("/api/auth/csrf");
  expect(csrfRes.ok(), "GET /api/auth/csrf 应返回 200").toBeTruthy();
  const { csrfToken } = await csrfRes.json();
  expect(csrfToken, "csrfToken 不应为空").toBeTruthy();

  // 2. 提交登录表单（form-urlencoded）
  const loginRes = await request.post("/api/auth/callback/credentials", {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    form: {
      csrfToken,
      username,
      password,
      redirect: "false",
      callbackUrl: "/",
    },
    maxRedirects: 0,
  });
  // next-auth v5 在 redirect:false 时返回 200；其他情况可能 302
  expect(
    loginRes.ok() || loginRes.status() === 302,
    `登录请求应成功，实际状态码：${loginRes.status()}`
  ).toBeTruthy();
}

/**
 * 通过 page 上下文登录（保留 cookie 到浏览器会话）
 */
export async function loginViaPage(page: Page): Promise<void> {
  await login(page.request);
}

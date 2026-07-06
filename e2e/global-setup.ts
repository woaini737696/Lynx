import { request, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

/**
 * 全局设置：登录一次并保存 storageState，供所有测试复用
 * 避免每个测试都发起登录请求，防止触发速率限制（429）
 */
async function globalSetup() {
  // __dirname 是 e2e/ 目录，storageState 保存到 e2e/.auth/
  const storageStatePath = path.join(__dirname, ".auth/storage-state.json");
  const storageStateDir = path.dirname(storageStatePath);
  if (!fs.existsSync(storageStateDir)) {
    fs.mkdirSync(storageStateDir, { recursive: true });
  }

  const requestContext = await request.newContext({
    baseURL: "http://localhost:5176",
  });

  try {
    // 1. 获取 CSRF token
    const csrfRes = await requestContext.get("/api/auth/csrf");
    expect(csrfRes.ok(), "GET /api/auth/csrf 应返回 200").toBeTruthy();
    const { csrfToken } = await csrfRes.json();

    // 2. 提交登录表单
    const loginRes = await requestContext.post(
      "/api/auth/callback/credentials",
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        form: {
          csrfToken,
          username: "admin",
          // 测试密码从环境变量读取，默认 admin123（仅本地测试用）
          password: process.env.TEST_ADMIN_PASSWORD || "admin123",
          redirect: "false",
          callbackUrl: "/",
        },
        maxRedirects: 0,
      }
    );
    expect(
      loginRes.ok() || loginRes.status() === 302,
      `全局登录应成功，实际状态码：${loginRes.status()}`
    ).toBeTruthy();

    // 3. 保存 storageState（包含 cookie）
    await requestContext.storageState({ path: storageStatePath });
    console.log("[globalSetup] 登录成功，storageState 已保存");
  } finally {
    await requestContext.dispose();
  }
}

export default globalSetup;

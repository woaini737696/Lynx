import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E 配置
 * - baseURL: http://localhost:3000
 * - 仅使用 chromium（通过 msedge channel）
 * - 复用已运行的 dev server，不启动新进程
 * - 使用 globalSetup 登录一次，所有测试复用 storageState
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "list",
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  // 全局设置：登录一次并保存 storageState
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    headless: true,
    // 复用全局登录的 storageState
    storageState: "./e2e/.auth/storage-state.json",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // 优先使用系统已安装的 Edge 浏览器（channel），避免下载 Chromium
        channel: "msedge",
      },
    },
  ],
  // 复用已在 http://localhost:3000 运行的 dev server，不启动新进程
  // 如需自动启动，可取消下方注释
  // webServer: {
  //   command: "npm run dev",
  //   url: "http://localhost:3000",
  //   reuseExistingServer: true,
  //   timeout: 120_000,
  // },
});

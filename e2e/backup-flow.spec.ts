import { test, expect } from "@playwright/test";

/**
 * 备份流程 E2E 测试
 * 依赖 globalSetup 提供的 storageState（已登录状态）
 */
test.describe("备份流程", () => {
  test("GET /api/backup/export 应返回 JSON 且包含 ideas/tasks 等字段", async ({
    request,
  }) => {
    const res = await request.get("/api/backup/export");
    expect(res.ok(), "/api/backup/export 应返回 200").toBeTruthy();
    const body = await res.json();
    // 验证返回 JSON 结构
    expect(body, "响应应包含 exportedAt 字段").toHaveProperty("exportedAt");
    expect(body, "响应应包含 version 字段").toHaveProperty("version");
    expect(body, "响应应包含 data 字段").toHaveProperty("data");

    // data 应包含各类型字段
    const data = body.data;
    expect(data, "data 应包含 ideas 字段").toHaveProperty("ideas");
    expect(data, "data 应包含 tasks 字段").toHaveProperty("tasks");
    expect(data, "data 应包含 conversations 字段").toHaveProperty(
      "conversations"
    );
    expect(data, "data 应包含 cognitions 字段").toHaveProperty("cognitions");
    expect(data, "data 应包含 memories 字段").toHaveProperty("memories");
    expect(data, "data 应包含 skills 字段").toHaveProperty("skills");
    expect(data, "data 应包含 flows 字段").toHaveProperty("flows");

    // 各字段应为数组
    expect(Array.isArray(data.ideas), "ideas 应为数组").toBeTruthy();
    expect(Array.isArray(data.tasks), "tasks 应为数组").toBeTruthy();
  });

  test("GET /api/backup/export?type=ideas 应只导出 ideas", async ({
    request,
  }) => {
    const res = await request.get("/api/backup/export?type=ideas");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.data).toHaveProperty("ideas");
    // 单类型导出时其他字段应不存在
    expect(body.data).not.toHaveProperty("tasks");
  });

  test("GET /api/backup/export?type=tasks 应只导出 tasks", async ({
    request,
  }) => {
    const res = await request.get("/api/backup/export?type=tasks");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.data).toHaveProperty("tasks");
    expect(body.data).not.toHaveProperty("ideas");
  });

  test("备份响应应包含 version 字段", async ({ request }) => {
    const res = await request.get("/api/backup/export");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.version, "version 应为字符串").toBeTruthy();
    expect(typeof body.version).toBe("string");
  });
});

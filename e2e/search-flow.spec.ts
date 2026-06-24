import { test, expect } from "@playwright/test";

/**
 * 搜索流程 E2E 测试
 * 依赖 globalSetup 提供的 storageState（已登录状态）
 */
test.describe("搜索流程", () => {
  test("GET /api/search?q=AI 应返回 JSON 且有搜索结果结构", async ({ request }) => {
    const res = await request.get("/api/search?q=AI");
    expect(res.ok(), "/api/search?q=AI 应返回 200").toBeTruthy();
    const body = await res.json();
    // 验证返回 JSON 结构
    expect(body, "响应应包含 results 字段").toHaveProperty("results");
    expect(body, "响应应包含 q 字段").toHaveProperty("q");
    expect(body.q, "q 应为 AI").toBe("AI");
    expect(Array.isArray(body.results), "results 应为数组").toBeTruthy();
  });

  test("GET /api/search 无 q 参数应返回空结果", async ({ request }) => {
    const res = await request.get("/api/search");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.results, "无 q 时 results 应为空数组").toEqual([]);
    expect(body.total, "total 应为 0").toBe(0);
  });

  test("GET /api/search?q=test 应返回带 total 字段的响应", async ({ request }) => {
    const res = await request.get("/api/search?q=test");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body).toHaveProperty("total");
    expect(typeof body.total).toBe("number");
  });

  test("搜索结果项应包含必要字段", async ({ request }) => {
    // 先创建一条灵感，确保有可搜索的内容
    const uniqueContent = `E2E搜索测试-AI内容-${Date.now()}`;
    await request.post("/api/ideas", {
      data: { content: uniqueContent },
    });

    // 搜索包含 "E2E搜索测试" 的内容
    const res = await request.get(
      `/api/search?q=${encodeURIComponent("E2E搜索测试")}`
    );
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.results.length, "应至少有 1 条搜索结果").toBeGreaterThan(0);

    const firstResult = body.results[0];
    expect(firstResult).toHaveProperty("id");
    expect(firstResult).toHaveProperty("type");
    expect(firstResult).toHaveProperty("title");
    expect(firstResult).toHaveProperty("snippet");
    expect(firstResult).toHaveProperty("createdAt");
  });
});

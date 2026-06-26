import { test, expect } from "@playwright/test";
import { cleanupTestData } from "./helpers/auth";

/**
 * 灵感创建与流转 E2E 测试
 * 依赖 globalSetup 提供的 storageState（已登录状态）
 */
test.describe("灵感创建与流转", () => {
  test.afterEach(async ({ request }) => {
    await cleanupTestData(request, ["E2E"]);
  });

  test("创建新灵感并验证出现在列表中", async ({ request, page }) => {
    const uniqueContent = `E2E测试灵感-${Date.now()}-AI助手`;

    // 1. POST /api/ideas 创建灵感
    const createRes = await request.post("/api/ideas", {
      data: { content: uniqueContent },
    });
    expect(createRes.ok(), "创建灵感应返回 200").toBeTruthy();
    const createBody = await createRes.json();
    expect(createBody.success, "响应应包含 success:true").toBeTruthy();
    expect(createBody.id, "响应应包含 id").toBeTruthy();

    // 2. GET /api/ideas 验证灵感出现在列表中
    const listRes = await request.get("/api/ideas");
    expect(listRes.ok()).toBeTruthy();
    const listBody = await listRes.json();
    const found = (listBody.ideas as Array<{ id: string; content: string }>).find(
      (i) => i.id === createBody.id
    );
    expect(found, "新创建的灵感应出现在列表中").toBeTruthy();
    expect(found?.content, "灵感内容应匹配").toBe(uniqueContent);

    // 3. 访问 /inbox 页面验证渲染
    await page.goto("/inbox");
    await expect(page).toHaveTitle(/LynnHub/);
  });

  test("将灵感移动到看板（status=board）", async ({ request }) => {
    // 1. 先创建一条灵感
    const uniqueContent = `E2E看板测试-${Date.now()}`;
    const createRes = await request.post("/api/ideas", {
      data: { content: uniqueContent },
    });
    expect(createRes.ok()).toBeTruthy();
    const { id } = await createRes.json();

    // 2. PATCH /api/ideas/[id] 更新 status=board
    const patchRes = await request.patch(`/api/ideas/${id}`, {
      data: { action: "board", column: "task" },
    });
    // 满额时返回 409，正常情况下 200
    if (patchRes.status() === 409) {
      // 看板已满，跳过验证（环境限制）
      test.skip(true, "看板 task 列已满，跳过验证");
    }
    expect(patchRes.ok(), `移动到看板应成功，实际状态：${patchRes.status()}`).toBeTruthy();
    const patchBody = await patchRes.json();
    expect(patchBody.success, "应返回 success:true").toBeTruthy();
    expect(patchBody.task, "应返回 task 对象").toBeTruthy();
    expect(patchBody.task.column, "task 应在 task 列").toBe("task");
  });

  test("GET /api/ideas 返回结构正确", async ({ request }) => {
    const res = await request.get("/api/ideas");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body).toHaveProperty("ideas");
    expect(Array.isArray(body.ideas)).toBeTruthy();
    // 每条灵感应有 id 和 content
    if (body.ideas.length > 0) {
      const idea = body.ideas[0];
      expect(idea).toHaveProperty("id");
      expect(idea).toHaveProperty("content");
    }
  });
});

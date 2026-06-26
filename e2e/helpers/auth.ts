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

/**
 * 清理 e2e 测试数据：按内容前缀（默认 "E2E"）匹配并通过 API 删除
 *
 * 实现思路：
 *   - GET /api/ideas 拉取所有 inbox 灵感，过滤 content.startsWith(prefix)，批量 DELETE /api/ideas
 *   - GET /api/tasks 拉取任务，过滤前缀后逐个 DELETE /api/tasks/[id]
 *   - GET /api/memory 拉取记忆图谱节点，过滤前缀后逐个 DELETE /api/memory/[id]
 *   - GET /api/cognitions 仅查询；Cognition 无 DELETE API，记录警告由数据库脚本清理
 *
 * 注意：本函数为 best-effort 清理，某些场景（如 Idea 已转 board）GET /api/ideas 不会返回，
 *      需配合 scripts/cleanup-e2e-data.ts 做数据库层兜底清理。
 *
 * @param request 已登录的 APIRequestContext（继承 storageState）
 * @param prefixes 内容前缀数组，默认 ["E2E"]
 */
export async function cleanupTestData(
  request: APIRequestContext,
  prefixes: string[] = ["E2E"]
): Promise<void> {
  const matches = (content: string | undefined | null): boolean =>
    !!content && prefixes.some((p) => content.startsWith(p));

  // 1. Ideas — GET /api/ideas（仅 inbox），批量 DELETE /api/ideas
  try {
    const ideasRes = await request.get("/api/ideas");
    if (ideasRes.ok()) {
      const { ideas } = await ideasRes.json();
      const idsToDelete = (ideas as Array<{ id: string; content: string }>)
        .filter((i) => matches(i.content))
        .map((i) => i.id);
      if (idsToDelete.length > 0) {
        await request.delete("/api/ideas", { data: { ids: idsToDelete } });
      }
    }
  } catch (e) {
    console.warn("[cleanupTestData] 清理 Idea 失败:", e);
  }

  // 2. Tasks — GET /api/tasks，逐个 DELETE /api/tasks/[id]
  try {
    const tasksRes = await request.get("/api/tasks");
    if (tasksRes.ok()) {
      const { tasks } = await tasksRes.json();
      const toDelete = (tasks as Array<{ id: string; content: string }>).filter(
        (t) => matches(t.content)
      );
      for (const t of toDelete) {
        await request.delete(`/api/tasks/${t.id}`);
      }
    }
  } catch (e) {
    console.warn("[cleanupTestData] 清理 Task 失败:", e);
  }

  // 3. Memory — GET /api/memory（返回 nodes/edges），逐个 DELETE /api/memory/[id]
  try {
    const memRes = await request.get("/api/memory");
    if (memRes.ok()) {
      const { nodes } = await memRes.json();
      const toDelete = (
        nodes as Array<{ id: string; fullContent?: string; label?: string }>
      ).filter((n) => matches(n.fullContent) || matches(n.label));
      for (const n of toDelete) {
        await request.delete(`/api/memory/${n.id}`);
      }
    }
  } catch (e) {
    console.warn("[cleanupTestData] 清理 Memory 失败:", e);
  }

  // 4. Cognition — 仅查询；无 DELETE API，记录警告
  try {
    const cogRes = await request.get("/api/cognitions");
    if (cogRes.ok()) {
      const { cognitions } = await cogRes.json();
      const e2eCount = (cognitions as Array<{ id: string; content: string }>).filter(
        (c) => matches(c.content)
      ).length;
      if (e2eCount > 0) {
        console.warn(
          `[cleanupTestData] 检测到 ${e2eCount} 条 E2E Cognition，但 Cognition 无 DELETE API，请运行 npx tsx scripts/cleanup-e2e-data.ts 清理`
        );
      }
    }
  } catch (e) {
    console.warn("[cleanupTestData] 查询 Cognition 失败:", e);
  }
}

/**
 * 核心功能自测脚本
 * 覆盖：登录/灵感/看板/记忆/认知/技能/巡检/备份/权限
 * 测试后自动清理创建的脏数据
 */
import "dotenv/config";

const BASE = "http://localhost:5176";
const USERNAME = process.env.TEST_USER || "lynn";
const PASSWORD = process.env.TEST_PASS || "lynn123";

let TOKEN = "";
let USER_ID = "";

interface Case {
  module: string;
  name: string;
  status: "pass" | "fail" | "warn";
  http: number;
  ms: number;
  detail: string;
}
const cases: Case[] = [];

function authHeaders(): HeadersInit {
  return { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` };
}

async function req(method: string, path: string, body?: unknown, timeoutMs = 15000): Promise<{ status: number; text: string; obj: any; ms: number }> {
  const t0 = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const resp = await fetch(`${BASE}${path}`, {
      method,
      headers: authHeaders(),
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
    const text = await resp.text();
    let obj: any = null;
    try { obj = JSON.parse(text); } catch {}
    return { status: resp.status, text, obj, ms: Date.now() - t0 };
  } finally {
    clearTimeout(timer);
  }
}

function record(module: string, name: string, r: { status: number; text?: string; obj: any; ms: number }, passCond: (o: any, s: number) => boolean, detailFn?: (o: any) => string): void {
  const ok = passCond(r.obj, r.status);
  cases.push({
    module,
    name,
    status: ok ? "pass" : r.status >= 500 ? "fail" : "warn",
    http: r.status,
    ms: r.ms,
    detail: detailFn ? detailFn(r.obj) : (r.obj?.error || r.text?.slice(0, 80) || ""),
  });
}

async function login(): Promise<void> {
  const r = await req("POST", "/api/auth/token", { username: USERNAME, password: PASSWORD }, 5000);
  if (!r.obj?.token) throw new Error(`登录失败 ${r.status}: ${r.text}`);
  TOKEN = r.obj.token;
  USER_ID = r.obj.user?.id || "";
  cases.push({ module: "登录", name: "POST /api/auth/token", status: "pass", http: r.status, ms: r.ms, detail: `user=${r.obj.user?.username}, role=${r.obj.user?.role}` });
  console.log(`✅ 登录成功 user=${r.obj.user?.username} role=${r.obj.user?.role}`);
  console.log(`   user_id=${USER_ID}`);
}

// ========== 灵感 ==========
async function testIdeas(): Promise<void> {
  console.log("\n--- 灵感 ---");
  const list = await req("GET", "/api/ideas");
  record("灵感", "GET /api/ideas 列表", list, (o, s) => s === 200 && Array.isArray(o?.ideas), (o) => `count=${o?.ideas?.length ?? 0}`);

  const created = await req("POST", "/api/ideas", { content: "[自测] 临时灵感-请忽略", source: "lightning" });
  record("灵感", "POST /api/ideas 创建", created, (o, s) => (s === 200 || s === 201) && !!o?.id, (o) => `id=${o?.id}`);
  const ideaId = created.obj?.id;

  if (ideaId) {
    const del = await req("DELETE", "/api/ideas", { ids: [ideaId] });
    record("灵感", "DELETE /api/ideas 清理", del, (o, s) => s === 200 && o?.success, (o) => `deleted=${o?.deleted}`);
  }
}

// ========== 看板任务 ==========
async function testTasks(): Promise<void> {
  console.log("\n--- 看板任务 ---");
  const list = await req("GET", "/api/tasks");
  record("看板", "GET /api/tasks 列表", list, (o, s) => s === 200 && Array.isArray(o?.tasks), (o) => `count=${o?.tasks?.length ?? 0}`);

  const created = await req("POST", "/api/tasks", { content: "[自测] 临时任务-请忽略", column: "task" });
  record("看板", "POST /api/tasks 创建", created, (o, s) => (s === 200 || s === 201) && !!o?.task?.id, (o) => `id=${o?.task?.id ?? ""}`);
  const taskId = created.obj?.task?.id;

  if (taskId) {
    const patch = await req("PATCH", `/api/tasks/${taskId}`, { status: "done" }, 30000);
    record("看板", "PATCH /api/tasks/:id 更新(done)", patch, (o, s) => s === 200 && o?.task?.status === "done", (o) => `cognitionExtracted=${o?.cognitionExtracted}`);

    const del = await req("DELETE", `/api/tasks/${taskId}`);
    record("看板", "DELETE /api/tasks/:id 清理", del, (o, s) => s === 200 && o?.success, () => "soft-delete");
  }
}

// ========== 认知 ==========
async function testCognitions(): Promise<void> {
  console.log("\n--- 认知 ---");
  const list = await req("GET", "/api/cognitions");
  record("认知", "GET /api/cognitions 列表", list, (o, s) => s === 200 && Array.isArray(o?.cognitions), (o) => `count=${o?.cognitions?.length ?? 0}`);

  // 传 type 直接写入，避免触发 AI 提取（快速验证）
  const created = await req("POST", "/api/cognitions", { content: "[自测] 临时认知-请忽略", type: "method", source: "manual" });
  record("认知", "POST /api/cognitions 创建(type=method)", created, (o, s) => (s === 200 || s === 201) && o?.success && Array.isArray(o?.created), (o) => `count=${o?.count ?? 0}, ids=${(o?.created || []).map((c: any) => c.id).join(",")}`);
  const cogIds: string[] = (created.obj?.created || []).map((c: any) => c.id);

  for (const id of cogIds) {
    if (id) {
      const del = await req("DELETE", `/api/cognitions/${id}`);
      record("认知", `DELETE /api/cognitions/:id 清理`, del, (o, s) => s === 200 || s === 404, () => "");
    }
  }
}

// ========== 记忆 ==========
async function testMemory(): Promise<void> {
  console.log("\n--- 记忆 ---");
  const list = await req("GET", "/api/memory");
  record("记忆", "GET /api/memory 图谱", list, (o, s) => s === 200 && o?.stats, (o) => `nodes=${o?.stats?.total ?? 0}, edges=${o?.stats?.edges ?? 0}, mode=${o?.stats?.mode ?? ""}`);

  // PATCH 鉴权检查（带无效 token，应返回 401 JSON；无 token 会被 middleware 重定向到登录页返回 200 HTML，不作为端点鉴权判断依据）
  const t0 = Date.now();
  let badStatus = 0;
  let badBody = "";
  try {
    const resp = await fetch(`${BASE}/api/memory/nonexistent-id`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: "Bearer invalid.token.here" },
      body: JSON.stringify({ label: "test" }),
    });
    badStatus = resp.status;
    badBody = await resp.text();
  } catch {}
  cases.push({
    module: "记忆",
    name: "PATCH /api/memory/:id 无效token(鉴权检查)",
    status: badStatus === 401 ? "pass" : "fail",
    http: badStatus,
    ms: Date.now() - t0,
    detail: badStatus === 401 ? "正确拒绝" : `⚠️ 未拒绝，返回 ${badStatus}`,
  });
}

// ========== 技能 ==========
async function testSkills(): Promise<void> {
  console.log("\n--- 技能 ---");
  const r = await req("POST", "/api/skills/generate", { workLog: "测试工作日志：完成了登录功能开发" }, 45000);
  record("技能", "POST /api/skills/generate", r, (o, s) => s === 200 && !!o?.skill?.name, (o) => `name=${o?.skill?.name ?? ""}, fallback=${o?.fallback ?? false}${o?.fallbackReason ? "(" + o.fallbackReason + ")" : ""}`);
}

// ========== 巡检 ==========
async function testPatrol(): Promise<void> {
  console.log("\n--- 巡检 ---");
  // 先尝试获取 rules
  const rulesR = await req("GET", "/api/patrol/rules", undefined, 5000);
  let ruleId = "";
  if (rulesR.status === 200 && Array.isArray(rulesR.obj?.rules) && rulesR.obj.rules.length > 0) {
    ruleId = rulesR.obj.rules[0].id;
    record("巡检", "GET /api/patrol/rules 列表", rulesR, (o, s) => s === 200, (o) => `count=${o?.rules?.length ?? 0}`);
  } else {
    cases.push({ module: "巡检", name: "GET /api/patrol/rules 列表", status: "warn", http: rulesR.status, ms: rulesR.ms, detail: "无规则或端点不存在" });
  }

  if (ruleId) {
    const r = await req("POST", "/api/patrol/run", { ruleId }, 45000);
    record("巡检", "POST /api/patrol/run", r, (o, s) => s === 200 && o?.success, (o) => `hitCount=${o?.hitCount ?? 0}, results=${o?.results?.length ?? 0}`);
  } else {
    cases.push({ module: "巡检", name: "POST /api/patrol/run", status: "warn", http: 0, ms: 0, detail: "跳过（无 ruleId）" });
  }
}

// ========== 对话 ==========
async function testConversations(): Promise<void> {
  console.log("\n--- 对话 ---");
  const list = await req("GET", "/api/conversations");
  record("对话", "GET /api/conversations 列表", list, (o, s) => s === 200 && Array.isArray(o?.conversations), (o) => `count=${o?.conversations?.length ?? 0}`);

  // useAI=false 避免慢
  const created = await req("POST", "/api/conversations", { source: "self-test", rawContent: "[自测] 临时对话-请忽略", title: "自测对话", useAI: false }, 15000);
  record("对话", "POST /api/conversations 创建(useAI=false)", created, (o, s) => (s === 200 || s === 201) && !!o?.conversation?.id, (o) => `id=${o?.conversation?.id ?? ""}`);
  const convId = created.obj?.conversation?.id;

  if (convId) {
    const del = await req("DELETE", `/api/conversations/${convId}`);
    record("对话", "DELETE /api/conversations/:id 清理", del, (o, s) => s === 200 || s === 404, () => "");
  }
}

// ========== 备份 ==========
async function testBackup(): Promise<void> {
  console.log("\n--- 备份 ---");
  const r = await req("GET", "/api/backup/export?type=ideas", undefined, 15000);
  record("备份", "GET /api/backup/export?type=ideas", r, (o, s) => s === 200 && o?.data, (o) => `version=${o?.version ?? ""}, ideas=${o?.data?.ideas?.length ?? 0}`);
}

// ========== 权限 ==========
async function testPermissions(): Promise<void> {
  console.log("\n--- 权限 ---");
  const r = await req("GET", "/api/admin/roles", undefined, 5000);
  record("权限", "GET /api/admin/roles", r, (o, s) => s === 200 && Array.isArray(o?.roles) && Array.isArray(o?.permissions), (o) => `roles=${o?.roles?.length ?? 0}, permCatalog=${o?.permissions?.length ?? 0}`);

  // 权限拒绝测试：用无效 token
  const t0 = Date.now();
  let badStatus = 0;
  try {
    const resp = await fetch(`${BASE}/api/ideas`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer invalid.token.here" },
      body: JSON.stringify({ content: "should-reject" }),
    });
    badStatus = resp.status;
  } catch {}
  cases.push({
    module: "权限",
    name: "POST /api/ideas 无效token(拒绝检查)",
    status: badStatus === 401 ? "pass" : "fail",
    http: badStatus,
    ms: Date.now() - t0,
    detail: badStatus === 401 ? "正确拒绝" : `⚠️ 未拒绝，返回 ${badStatus}`,
  });
}

async function main() {
  console.log("=== LynnHub 核心功能自测 ===");
  console.log(`目标: ${BASE}`);
  console.log(`时间: ${new Date().toISOString()}`);

  await login();
  await testIdeas();
  await testTasks();
  await testCognitions();
  await testMemory();
  await testSkills();
  await testPatrol();
  await testConversations();
  await testBackup();
  await testPermissions();

  console.log("\n=== 自测结果汇总 ===\n");
  console.log("| 模块 | 用例 | 状态 | HTTP | 耗时 | 详情 |");
  console.log("|---|---|---|---|---|---|");
  const stats: Record<string, { pass: number; warn: number; fail: number }> = {};
  for (const c of cases) {
    const icon = c.status === "pass" ? "✅" : c.status === "warn" ? "⚠️" : "❌";
    console.log(`| ${c.module} | ${c.name} | ${icon} | ${c.http} | ${c.ms}ms | ${c.detail} |`);
    if (!stats[c.module]) stats[c.module] = { pass: 0, warn: 0, fail: 0 };
    stats[c.module][c.status]++;
  }
  const total = { pass: cases.filter(c => c.status === "pass").length, warn: cases.filter(c => c.status === "warn").length, fail: cases.filter(c => c.status === "fail").length };
  console.log(`\n汇总: ✅ ${total.pass} 通过  ⚠️ ${total.warn} 警告  ❌ ${total.fail} 失败 / 共 ${cases.length} 项`);
  process.exit(total.fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error("FATAL:", e); process.exit(2); });

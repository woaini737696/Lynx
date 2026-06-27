/**
 * AI 响应速度测试脚本
 * 测试场景：流式首字延迟、总延迟、工具调用
 * 自动通过 /api/auth/token 登录获取 dev server 端签发的 JWT token
 */
import "dotenv/config";

const BASE = "http://localhost:5176";
const USERNAME = process.env.TEST_USER || "lynn";
const PASSWORD = process.env.TEST_PASS || "lynn123";

let TOKEN = "";

async function login(): Promise<void> {
  const resp = await fetch(`${BASE}/api/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`登录失败 ${resp.status}: ${t}`);
  }
  const obj = await resp.json() as { token: string };
  TOKEN = obj.token;
  console.log(`✅ 登录成功 (${USERNAME})，token 长度=${TOKEN.length}`);
}

interface TestResult {
  name: string;
  status: "pass" | "fail" | "warn";
  httpCode: number;
  firstByteMs?: number;
  totalMs: number;
  firstDeltaMs?: number;
  deltaCount?: number;
  totalChars?: number;
  notes?: string;
}

const results: TestResult[] = [];

async function testNonStreamChat(): Promise<TestResult> {
  const t0 = Date.now();
  const body = JSON.stringify({
    messages: [{ role: "user", content: "用一句话介绍你自己" }],
    provider: "deepseek",
    stream: false,
  });
  try {
    const resp = await fetch(`${BASE}/api/ai/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
      body,
    });
    const totalMs = Date.now() - t0;
    const text = await resp.text();
    let contentLen = 0;
    try {
      const obj = JSON.parse(text);
      contentLen = obj.content?.length || 0;
    } catch {}
    return {
      name: "非流式 chat",
      status: resp.ok ? "pass" : "fail",
      httpCode: resp.status,
      totalMs,
      totalChars: contentLen,
      notes: resp.ok ? `内容长度=${contentLen}` : text.slice(0, 150),
    };
  } catch (e) {
    return { name: "非流式 chat", status: "fail", httpCode: 0, totalMs: Date.now() - t0, notes: (e as Error).message };
  }
}

async function testStreamChat(): Promise<TestResult> {
  const t0 = Date.now();
  const body = JSON.stringify({
    messages: [{ role: "user", content: "用一句话介绍你自己" }],
    provider: "deepseek",
    stream: true,
  });
  try {
    const resp = await fetch(`${BASE}/api/ai/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
      body,
    });
    if (!resp.ok || !resp.body) {
      return { name: "流式 chat", status: "fail", httpCode: resp.status, totalMs: Date.now() - t0, notes: "no body" };
    }
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let firstDeltaMs: number | undefined;
    let deltaCount = 0;
    let totalChars = 0;
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        const t = line.trim();
        if (!t.startsWith("data:")) continue;
        const payload = t.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const obj = JSON.parse(payload);
          if (obj.type === "delta" && typeof obj.content === "string") {
            if (firstDeltaMs === undefined) firstDeltaMs = Date.now() - t0;
            deltaCount++;
            totalChars += obj.content.length;
          }
        } catch {}
      }
    }
    const totalMs = Date.now() - t0;
    return {
      name: "流式 chat",
      status: firstDeltaMs !== undefined ? "pass" : "warn",
      httpCode: resp.status,
      firstDeltaMs,
      totalMs,
      deltaCount,
      totalChars,
      notes: firstDeltaMs === undefined ? "未收到 delta" : undefined,
    };
  } catch (e) {
    return { name: "流式 chat", status: "fail", httpCode: 0, totalMs: Date.now() - t0, notes: (e as Error).message };
  }
}

async function testAssistantModeStream(): Promise<TestResult> {
  const t0 = Date.now();
  const body = JSON.stringify({
    messages: [{ role: "user", content: "查看最近的灵感" }],
    provider: "deepseek",
    stream: true,
    assistantMode: true,
  });
  try {
    const resp = await fetch(`${BASE}/api/ai/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
      body,
    });
    if (!resp.ok || !resp.body) {
      return { name: "助理模式流式 + 工具调用", status: "fail", httpCode: resp.status, totalMs: Date.now() - t0, notes: "no body" };
    }
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let firstByteMs: number | undefined;
    let firstDeltaMs: number | undefined;
    let toolStart: string | undefined;
    let toolDone: boolean = false;
    let deltaCount = 0;
    let totalChars = 0;
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (firstByteMs === undefined) firstByteMs = Date.now() - t0;
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        const t = line.trim();
        if (!t.startsWith("data:")) continue;
        const payload = t.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const obj = JSON.parse(payload);
          if (obj.type === "thinking" && firstDeltaMs === undefined) {
            // thinking 事件：标记首反馈时间
          }
          if (obj.type === "tool_start") {
            toolStart = obj.tool;
            if (firstDeltaMs === undefined) firstDeltaMs = Date.now() - t0;
          }
          if (obj.type === "tool_done") toolDone = true;
          if (obj.type === "delta" && typeof obj.content === "string") {
            if (firstDeltaMs === undefined) firstDeltaMs = Date.now() - t0;
            deltaCount++;
            totalChars += obj.content.length;
          }
        } catch {}
      }
    }
    const totalMs = Date.now() - t0;
    return {
      name: "助理模式流式 + 工具调用",
      status: firstDeltaMs !== undefined ? "pass" : "warn",
      httpCode: resp.status,
      firstByteMs,
      firstDeltaMs,
      totalMs,
      deltaCount,
      totalChars,
      notes: `toolStart=${toolStart || "无"}, toolDone=${toolDone}`,
    };
  } catch (e) {
    return { name: "助理模式流式 + 工具调用", status: "fail", httpCode: 0, totalMs: Date.now() - t0, notes: (e as Error).message };
  }
}

async function main() {
  console.log("=== AI 响应速度测试 ===\n");

  await login();

  console.log("[1/3] 非流式 chat ...");
  results.push(await testNonStreamChat());

  console.log("[2/3] 流式 chat ...");
  results.push(await testStreamChat());

  console.log("[3/3] 助理模式流式 + 工具调用 ...");
  results.push(await testAssistantModeStream());

  console.log("\n=== 测试结果 ===\n");
  console.log("| 测试项 | 状态 | HTTP | 首字延迟 | 总延迟 | delta数 | 内容长度 | 备注 |");
  console.log("|---|---|---|---|---|---|---|---|");
  for (const r of results) {
    const status = r.status === "pass" ? "✅" : r.status === "warn" ? "⚠️" : "❌";
    console.log(
      `| ${r.name} | ${status} | ${r.httpCode} | ${r.firstDeltaMs ?? r.firstByteMs ?? "-"}ms | ${r.totalMs}ms | ${r.deltaCount ?? "-"} | ${r.totalChars ?? "-"} | ${r.notes ?? ""} |`
    );
  }

  // 性能评估
  console.log("\n=== 性能评估 ===");
  for (const r of results) {
    if (r.firstDeltaMs !== undefined) {
      if (r.firstDeltaMs < 1500) {
        console.log(`✅ ${r.name}: 首字延迟 ${r.firstDeltaMs}ms (优秀，<1500ms)`);
      } else if (r.firstDeltaMs < 3000) {
        console.log(`⚠️ ${r.name}: 首字延迟 ${r.firstDeltaMs}ms (可接受，<3000ms)`);
      } else {
        console.log(`❌ ${r.name}: 首字延迟 ${r.firstDeltaMs}ms (过慢，>3000ms)`);
      }
    }
  }
}

main().catch(console.error);

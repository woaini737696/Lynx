import { cloudApi, getCloudEndpoint } from "./cloud-api";
import { useAuthStore } from "@/stores/authStore";

// ============ 类型定义（对齐 Web 端） ============

export interface TokenUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

export interface ToolCalled {
  tool: string;
  args: Record<string, unknown>;
  result: unknown;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  time: string;
  provider?: string;
  model?: string;
  usage?: TokenUsage;
  streaming?: boolean;
  toolCalled?: ToolCalled | null;
  hermesMode?: boolean;
  hermesFallback?: boolean;
  feedback?: "good" | "bad" | null;
  feedbackReason?: string | null;
  error?: boolean;
  /** 流式工具调用进度（tool_start/tool_done 期间设置） */
  toolProgress?: {
    tool: string;
    status: "running" | "done";
    args?: Record<string, unknown>;
    result?: unknown;
  } | null;
}

export interface ChatSession {
  id: string;
  title: string;
  provider?: string;
  model?: string;
  pinned?: boolean;
  messageCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface QuickCommand {
  label: string;
  description: string;
  message: string;
  icon: string;
}

// ============ 快捷指令（对齐 Web 端 QUICK_COMMANDS） ============

export const QUICK_COMMANDS: QuickCommand[] = [
  {
    label: "今日概览",
    description: "查看今天的灵感、任务和统计",
    message: "给我一个今日概览：今天有多少灵感、看板任务进度、最近记忆",
    icon: "📋",
  },
  {
    label: "创建灵感",
    description: "快速记录一个新灵感",
    message: "帮我创建一个灵感：",
    icon: "💡",
  },
  {
    label: "看板状态",
    description: "查看决策看板统计",
    message: "看板状态如何？本周完成了多少任务？",
    icon: "📊",
  },
  {
    label: "搜索记忆",
    description: "语义搜索记忆图谱",
    message: "帮我搜索记忆：",
    icon: "🔍",
  },
  {
    label: "执行巡检",
    description: "运行AI巡检检查",
    message: "跑一下AI巡检，看看有什么需要关注的",
    icon: "🛡️",
  },
  {
    label: "执行技能",
    description: "运行一个技能模板",
    message: "列出可用技能，我想执行一个",
    icon: "⚡",
  },
];

// ============ 会话 API 封装 ============

export async function listSessions(): Promise<ChatSession[]> {
  const res = await cloudApi.get<{ sessions?: ChatSession[] }>("/api/ai/chat/sessions?limit=30");
  return res.sessions || [];
}

export async function createSession(title?: string): Promise<ChatSession> {
  // Web 端 API 返回 { session: ChatSession }，需解构
  const res = await cloudApi.post<{ session: ChatSession }>("/api/ai/chat/sessions", { title });
  return res.session;
}

export async function getSession(id: string): Promise<{ session: ChatSession; messages: Message[] }> {
  // Web 端 API 返回 { session: { ..., messages: [...] } }，messages 嵌套在 session 内
  const res = await cloudApi.get<{ session: ChatSession & { messages?: Message[] } }>(
    `/api/ai/chat/sessions/${id}`
  );
  const rawMessages = res.session?.messages || [];
  const messages = rawMessages.map((m) => ({
    ...m,
    time: m.time || new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
  }));
  return { session: res.session, messages };
}

export async function deleteSession(id: string): Promise<void> {
  await cloudApi.delete(`/api/ai/chat/sessions/${id}`);
}

export async function appendMessage(
  sessionId: string,
  msg: { role: string; content: string; provider?: string; model?: string }
): Promise<void> {
  // 防御：无 sessionId 时静默跳过（避免拼出 /sessions/undefined/messages 导致 404）
  if (!sessionId) return;
  await cloudApi.post(`/api/ai/chat/sessions/${sessionId}/messages`, msg);
}

export async function feedbackMessage(
  messageId: string,
  feedback: "good" | "bad" | null,
  reason?: string
): Promise<void> {
  await cloudApi.patch(`/api/ai/chat/messages/${messageId}/feedback`, { feedback, reason });
}

// ============ AI 对话调用（流式 SSE，WebView2 完全支持） ============

export interface ChatResponse {
  content: string;
  provider?: string;
  model?: string;
  usage?: TokenUsage;
  toolCalled?: ToolCalled | null;
  hermesMode?: boolean;
  hermesFallback?: boolean;
  messageId?: string;
}

/** 流式回调：用于实时更新 UI（delta 增量、工具进度、思考状态等） */
export interface ChatStreamCallbacks {
  /** 收到 meta 事件：provider/model/hermes 标记 */
  onMeta?: (meta: {
    provider?: string;
    model?: string;
    hermesMode?: boolean;
    hermesFallback?: boolean;
  }) => void;
  /** 收到 thinking 事件：第一轮 LLM 思考中 */
  onThinking?: (content?: string) => void;
  /** 收到 tool_start 事件：工具开始执行 */
  onToolStart?: (tool: string, args?: Record<string, unknown>) => void;
  /** 收到 tool_done 事件：工具执行完成 */
  onToolDone?: (
    tool: string,
    result: unknown,
    toolCalled?: ToolCalled | null
  ) => void;
  /** 收到 delta 事件：增量内容 + 累积内容 */
  onDelta?: (chunk: string, fullContent: string) => void;
  /** 流结束：最终结果（含 usage/toolCalled/模型信息） */
  onDone?: (meta: {
    content: string;
    provider?: string;
    model?: string;
    usage?: TokenUsage;
    toolCalled?: ToolCalled | null;
    hermesMode?: boolean;
    hermesFallback?: boolean;
    messageId?: string;
  }) => void;
  /** 流式错误 */
  onError?: (err: Error) => void;
}

export async function chatCompletion(
  params: {
    messages: { role: string; content: string }[];
    sessionId?: string;
    signal?: AbortSignal;
  },
  callbacks?: ChatStreamCallbacks
): Promise<ChatResponse> {
  const base = getCloudEndpoint().replace(/\/+$/, "");
  const url = `${base}/api/ai/chat`;
  const token = useAuthStore.getState().token;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // P0 修复：添加 60 秒超时保护，防止网络挂起导致"无回复、无反应"
  // 简化实现：避免 AbortSignal.any() 兼容性问题，手动转发外部 signal
  const timeoutCtrl = new AbortController();
  const timeoutId = setTimeout(() => timeoutCtrl.abort(), 60000);
  // 如果外部传了 signal，转发 abort 事件
  if (params.signal) {
    if (params.signal.aborted) {
      clearTimeout(timeoutId);
      throw new Error("用户中止");
    }
    params.signal.addEventListener("abort", () => {
      clearTimeout(timeoutId);
      timeoutCtrl.abort();
    });
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        messages: params.messages,
        stream: true,
        assistantMode: true,
        sessionId: params.sessionId,
      }),
      signal: timeoutCtrl.signal,
    });
  } catch (err) {
    clearTimeout(timeoutId);
    const isUserAbort = params.signal?.aborted;
    const isTimeout = timeoutCtrl.signal.aborted && !isUserAbort;
    const e = isTimeout
      ? new Error("请求超时（60秒），请检查网络后重试")
      : err instanceof Error
        ? new Error(`网络请求失败: ${err.message}`)
        : new Error("网络请求失败，请检查网络连接");
    if (!isUserAbort) callbacks?.onError?.(e);
    throw e;
  }
  clearTimeout(timeoutId);

  if (!res.ok || !res.body) {
    let errMsg = `请求失败（${res.status}）`;
    try {
      const errData = await res.json();
      errMsg = errData?.error || errData?.message || errMsg;
    } catch {
      // 非 JSON 错误响应
    }
    // 任务2: 移除手动触发的 LOGIN_REQUIRED_EVENT 事件
    // 401 统一由 cloudApi 的 401 拦截器处理（其他 cloudApi 调用触发）
    // 这里仅抛出错误，错误消息会显示在聊天区，不会弹出 LoginModal 遮盖聊天区
    const e = new Error(errMsg);
    callbacks?.onError?.(e);
    throw e;
  }

  // 解析 SSE 流：meta / thinking / tool_start / tool_done / delta / done / error
  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let aiContent = "";
  let provider: string | undefined;
  let model: string | undefined;
  let usage: TokenUsage | undefined;
  let toolCalled: ToolCalled | null = null;
  let hermesMode: boolean | undefined;
  let hermesFallback: boolean | undefined;
  let serverMessageId: string | undefined;

  // P0 修复：跟踪 SSE error 事件，避免被外层 catch 吞掉后空回复覆盖错误消息
  let sseError: Error | null = null;

  outer: while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      // P0 修复：只捕获 JSON 解析错误，不捕获 SSE error 事件
      let evt: {
        type: string;
        content?: string;
        tool?: string;
        args?: Record<string, unknown>;
        result?: unknown;
        toolCalled?: ToolCalled | null;
        provider?: string;
        model?: string;
        usage?: TokenUsage;
        hermesMode?: boolean;
        hermesFallback?: boolean;
        message?: string;
        messageId?: string;
      };
      try {
        evt = JSON.parse(data);
      } catch {
        // 忽略 SSE 行 JSON 解析错误（非 JSON 格式）
        continue;
      }

      if (evt.type === "meta") {
        provider = evt.provider;
        model = evt.model;
        if (evt.hermesMode) hermesMode = true;
        if (evt.hermesFallback) hermesFallback = true;
        callbacks?.onMeta?.({ provider, model, hermesMode, hermesFallback });
      } else if (evt.type === "thinking") {
        callbacks?.onThinking?.(evt.content);
      } else if (evt.type === "tool_start") {
        callbacks?.onToolStart?.(evt.tool || "工具", evt.args);
      } else if (evt.type === "tool_done") {
        if (evt.toolCalled) toolCalled = evt.toolCalled;
        callbacks?.onToolDone?.(
          evt.tool || "工具",
          evt.result,
          evt.toolCalled
        );
      } else if (evt.type === "delta" && typeof evt.content === "string") {
        aiContent += evt.content;
        callbacks?.onDelta?.(evt.content, aiContent);
      } else if (evt.type === "done") {
        // P0 修复：done 事件处理后立即 break，避免挂起等待更多数据
        if (evt.usage) usage = evt.usage;
        if (evt.provider) provider = evt.provider;
        if (evt.model) model = evt.model;
        if (evt.toolCalled) toolCalled = evt.toolCalled;
        if (evt.hermesMode) hermesMode = true;
        if (evt.hermesFallback) hermesFallback = true;
        if (evt.messageId) serverMessageId = evt.messageId;
        break outer;
      } else if (evt.type === "error") {
        // P0 修复：error 事件不再被外层 catch 吞掉，记录错误并 break
        const errMsg = evt.message || "流式响应异常";
        sseError = new Error(errMsg);
        callbacks?.onError?.(sseError);
        break outer;
      }
    }
  }

  // P0 修复：如果 SSE 返回了 error 事件，抛出错误而不是返回空回复
  if (sseError) {
    throw sseError;
  }

  const response: ChatResponse = {
    content: aiContent,
    provider,
    model,
    usage,
    toolCalled,
    hermesMode,
    hermesFallback,
    messageId: serverMessageId,
  };

  callbacks?.onDone?.({
    content: aiContent,
    provider,
    model,
    usage,
    toolCalled,
    hermesMode,
    hermesFallback,
    messageId: serverMessageId,
  });

  return response;
}

/**
 * 逐字显示模拟流式效果（用于不支持 SSE 的端点，如 /api/ai/idea-chat）
 * chunkSize=4, 16ms/块
 *
 * 注意：AI 助理主聊天已切换到真实 SSE 流式（chatCompletion），不再使用此函数。
 * 此函数保留供 InboxPage 的 idea-chat 端点使用。
 */
export async function streamSimulate(
  fullText: string,
  onChunk: (partial: string) => void,
  signal?: AbortSignal
): Promise<void> {
  const chunkSize = 4;
  for (let i = 0; i < fullText.length; i += chunkSize) {
    if (signal?.aborted) return;
    await new Promise((r) => setTimeout(r, 16));
    onChunk(fullText.slice(0, i + chunkSize));
  }
}

// ============ Markdown 渲染（简化版） ============

/**
 * 将 markdown 文本渲染为 HTML
 * 支持：代码块（```）、行内代码（`）、粗体（**）、斜体（*）、
 *       标题（# ## ###）、无序列表（-）、有序列表（1.）、引用（>）、链接（[text](url)）
 */
export function renderMarkdown(text: string): string {
  if (!text) return "";

  const blocks = splitMarkdownBlocks(text);
  return blocks.map(renderBlock).join("");
}

function splitMarkdownBlocks(text: string): Array<string | { type: "code"; content: string; lang: string }> {
  const blocks: Array<string | { type: "code"; content: string; lang: string }> = [];
  const lines = text.split("\n");
  let current: string[] = [];
  let inCodeBlock = false;
  let codeLang = "";

  for (const line of lines) {
    const codeFenceMatch = line.match(/^```(\w*)$/);
    if (codeFenceMatch) {
      if (inCodeBlock) {
        // 结束代码块
        current.push(line);
        blocks.push({ type: "code", content: current.join("\n"), lang: codeLang });
        current = [];
        inCodeBlock = false;
        codeLang = "";
      } else {
        // 开始代码块：先 flush 普通文本
        if (current.length > 0) {
          blocks.push(current.join("\n"));
          current = [];
        }
        inCodeBlock = true;
        codeLang = codeFenceMatch[1] || "";
        current.push(line);
      }
    } else {
      current.push(line);
    }
  }
  if (current.length > 0) {
    if (inCodeBlock) {
      blocks.push({ type: "code", content: current.join("\n"), lang: codeLang });
    } else {
      blocks.push(current.join("\n"));
    }
  }
  return blocks;
}

function renderBlock(block: string | { type: "code"; content: string; lang: string }): string {
  if (typeof block !== "string") {
    // 代码块
    const lines = block.content.split("\n");
    // 去掉首尾的 ```
    const codeLines = lines.slice(1, -1);
    const code = codeLines.join("\n");
    const escaped = escapeHtml(code);
    return `<pre class="md-code-block"><code class="md-code-lang-${block.lang || "text"}">${escaped}</code></pre>`;
  }

  // 普通文本块：按行处理
  const lines = block.split("\n");
  const result: string[] = [];
  let listType: "ul" | "ol" | null = null;
  let listItems: string[] = [];

  const flushList = () => {
    if (listType && listItems.length > 0) {
      const tag = listType;
      const items = listItems.map((it) => `<li>${renderInline(it)}</li>`).join("");
      result.push(`<${tag} class="md-list">${items}</${tag}>`);
      listItems = [];
      listType = null;
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();

    // 空行
    if (!trimmed) {
      flushList();
      continue;
    }

    // 标题
    const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      flushList();
      const level = headingMatch[1].length;
      result.push(`<h${level} class="md-heading md-h${level}">${renderInline(headingMatch[2])}</h${level}>`);
      continue;
    }

    // 引用
    const quoteMatch = trimmed.match(/^>\s*(.*)$/);
    if (quoteMatch) {
      flushList();
      result.push(`<blockquote class="md-quote">${renderInline(quoteMatch[1])}</blockquote>`);
      continue;
    }

    // 无序列表
    const ulMatch = trimmed.match(/^[-*+]\s+(.+)$/);
    if (ulMatch) {
      if (listType !== "ul") flushList();
      listType = "ul";
      listItems.push(ulMatch[1]);
      continue;
    }

    // 有序列表
    const olMatch = trimmed.match(/^\d+\.\s+(.+)$/);
    if (olMatch) {
      if (listType !== "ol") flushList();
      listType = "ol";
      listItems.push(olMatch[1]);
      continue;
    }

    // 普通段落
    flushList();
    result.push(`<p class="md-paragraph">${renderInline(trimmed)}</p>`);
  }
  flushList();

  return result.join("");
}

function renderInline(text: string): string {
  let result = text;
  // 行内代码（先处理，避免代码内容被后续规则破坏）
  result = result.replace(/`([^`]+)`/g, '<code class="md-inline-code">$1</code>');
  // 粗体
  result = result.replace(/\*\*([^*]+)\*\*/g, '<strong class="md-bold">$1</strong>');
  // 斜体
  result = result.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em class="md-italic">$1</em>');
  // 链接：仅允许 http/https/mailto 协议，阻断 javascript:/data: 等
  result = result.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_fullMatch, label: string, url: string) => {
      const trimmedUrl = url.trim();
      const isSafe = /^(https?:\/\/|mailto:)/i.test(trimmedUrl);
      if (!isSafe) return escapeHtml(label);
      return `<a class="md-link" href="${escapeAttr(trimmedUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`;
    }
  );
  return result;
}

/** 转义 HTML 属性值（用于 href 等） */
function escapeAttr(text: string): string {
  return escapeHtml(text);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * 生成工具调用的摘要文案
 */
export function summarizeToolResult(toolCalled: ToolCalled | null | undefined): string {
  if (!toolCalled) return "";
  const { tool, result } = toolCalled;
  if (Array.isArray(result)) {
    return `${tool} · ${result.length} 项`;
  }
  if (result && typeof result === "object") {
    const obj = result as Record<string, unknown>;
    if ("count" in obj) return `${tool} · ${obj.count} 条`;
    if ("created" in obj) return `${tool} · 已创建`;
    if ("success" in obj) return `${tool} · ${obj.success ? "成功" : "失败"}`;
    if ("output" in obj) return `${tool} · 已执行`;
  }
  return tool;
}

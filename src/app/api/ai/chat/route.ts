import { NextRequest, NextResponse } from "next/server";
import {
  chat,
  chatStream,
  getLLMConfigForUser,
  type ChatMessage,
  type ChatResponse,
  type MultimodalContent,
  type LLMProvider,
  type ReasoningMode,
} from "@/lib/ai-provider";
import { prisma } from "@/lib/db";
import { rateLimit, getClientKey } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/auth-utils";
import {
  AI_ASSISTANT_SYSTEM_PROMPT,
  parseAction,
  stripAction,
} from "@/lib/ai-assistant-tools";
import { executeTool } from "../assistant/tool-executor";
import { executeAssistantViaHermes, learnTaskPattern } from "@/lib/hermes-client";
import { getFeedbackContext } from "@/lib/hermes-learner";
import { deductCredits, calculateCreditsCost, hasEnoughCredits, InsufficientCreditsError } from "@/lib/wallet";

/** 扣除 AI 对话的 Credits（按实际 token 消耗） */
async function chargeAICredits(
  userId: string,
  usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined,
  model: string | undefined,
  sessionId?: string
): Promise<void> {
  if (!usage) return;
  const totalTokens = usage.total_tokens ?? (usage.prompt_tokens ?? 0) + (usage.completion_tokens ?? 0);
  if (totalTokens <= 0) return;
  const cost = calculateCreditsCost(totalTokens, model);
  if (cost <= 0n) return;
  try {
    await deductCredits(userId, cost, "ai_chat", `AI对话消耗 ${totalTokens} tokens`, {
      model: model ?? "unknown",
      promptTokens: usage.prompt_tokens ?? 0,
      completionTokens: usage.completion_tokens ?? 0,
      totalTokens,
      sessionId,
    });
  } catch (e) {
    if (e instanceof InsufficientCreditsError) {
      // Credits 不足时只记录日志，不阻断响应（避免用户已收到回复却报错）
      console.warn(`[Credits] 用户 ${userId} Credits 不足，本次消耗 ${cost} 未扣除`);
    } else {
      console.error("[Credits] 扣费失败:", e);
    }
  }
}

// ============ 关键词意图检测（Fallback）============
// 当 AI 没有输出 action 块时，用关键词匹配检测用户意图
function detectIntent(text: string): { tool: string; args: Record<string, any> } | null {
  const t = text.toLowerCase();

  // 灵感相关
  if (/查看|看看|有什么|列出|显示|搜索.*灵感|灵感.*列表/.test(text) && /灵感|idea/.test(text)) {
    return { tool: "searchIdeas", args: { query: text.replace(/帮我|看看|查看|列出|显示|最近|有什么|的|灵感|idea/g, "").trim() || "" } };
  }
  if (/创建|新建|添加|记录.*灵感|灵感.*创建/.test(text) && /灵感|idea/.test(text)) {
    const content = text.replace(/帮我|创建|新建|添加|记录|一个|灵感|idea|：|:/g, "").trim();
    if (content) return { tool: "createIdea", args: { content } };
  }

  // 看板/任务相关
  if (/看板|任务.*列表|列出.*任务|有什么任务|查看.*任务/.test(text) && !/完成|创建|新建/.test(text)) {
    return { tool: "searchTasks", args: { status: "active" } };
  }
  if (/创建|新建|添加.*任务|任务.*创建/.test(text) && /任务|task/.test(text)) {
    const content = text.replace(/帮我|创建|新建|添加|一个|任务|task|：|:/g, "").trim();
    if (content) return { tool: "createTask", args: { content, column: "task" } };
  }

  // 飞书任务下发：给XX下发任务：XXX / 创建飞书任务 / 下发飞书任务
  if (/下发.*任务|飞书.*任务|任务.*下发|创建.*飞书.*任务/.test(text)) {
    let assignees: string[] = [];
    let summary = "";
    let due: string | undefined;
    // 提取负责人：给张三下发任务 / 给张三、李四下发任务
    const assigneeMatch = text.match(/给\s*([\u4e00-\u9fa5A-Za-z0-9·、\s]+?)\s*(?:下发|派发|分配|安排)/);
    if (assigneeMatch) {
      assignees = assigneeMatch[1]
        .split(/[、,，\s]+/)
        .map((s) => s.trim())
        .filter(Boolean);
    }
    // 提取任务标题：冒号后的内容，去掉"本周五前/本周X前"等时间词作为 due
    const colonIdx = text.search(/[：:]/);
    if (colonIdx >= 0) {
      let rest = text.slice(colonIdx + 1).trim();
      // 提取截止时间词
      const dueMatch = rest.match(/(本周五|本周六|本周日|本周一|本周二|本周三|本周四|本月底|今天|明天|后天|下周五|下周一)前?/);
      if (dueMatch) {
        due = dueMatch[1];
        rest = rest.replace(dueMatch[0], "").trim();
      }
      summary = rest.replace(/^完成|^去完成|^做/, "").trim();
    } else if (assignees.length > 0) {
      // 无冒号时取"下发任务"后的内容
      const after = text.split(/下发任务|派发任务|安排任务/)[1];
      if (after) summary = after.trim();
    }
    if (summary) {
      return {
        tool: "createLarkTask",
        args: {
          summary,
          assignees: assignees.length > 0 ? assignees : undefined,
          due,
        },
      };
    }
  }
  if (/完成.*任务|任务.*完成|标记.*done/.test(text)) {
    return { tool: "completeTask", args: {} };
  }
  if (/统计|完成.*多少|多少.*完成|进度|概览|board.*stat/.test(t)) {
    return { tool: "getBoardStats", args: {} };
  }

  // 记忆/认知相关
  if (/搜索|查找|找.*记忆|记忆.*搜索|语义搜索/.test(text) && /记忆|memory/.test(text)) {
    const query = text.replace(/帮我|搜索|查找|找|关于|的|记忆|memory|语义搜索/g, "").trim();
    return { tool: "semanticSearch", args: { query: query || "test" } };
  }
  if (/重建|刷新.*记忆|记忆.*重建|rebuild.*memory/.test(t)) {
    return { tool: "rebuildMemory", args: {} };
  }
  if (/认知|cognition|经验|方法论/.test(text) && /查看|看看|列出|显示|有什么/.test(text)) {
    return { tool: "getCognitions", args: { type: "all", limit: 10 } };
  }

  // 技能/工作流相关
  if (/列出|查看|有什么.*技能|技能.*列表|skill.*list/.test(text) && /技能|skill/.test(text)) {
    return { tool: "listSkills", args: {} };
  }
  if (/执行|运行.*技能|技能.*执行|run.*skill/.test(text) && /技能|skill/.test(text)) {
    return { tool: "listSkills", args: {} };
  }
  if (/列出|查看|有什么.*工作流|工作流.*列表|flow.*list/.test(text) && /工作流|flow/.test(text)) {
    return { tool: "listFlows", args: {} };
  }
  if (/执行|运行.*工作流|工作流.*执行|run.*flow/.test(text) && /工作流|flow/.test(text)) {
    return { tool: "listFlows", args: {} };
  }

  // 巡检/通知相关
  if (/巡检|patrol|检查|跑一下/.test(text) && !/编辑|修改|创建|配置/.test(text)) {
    return { tool: "runPatrol", args: {} };
  }
  if (/列出|查看.*巡检规则|巡检规则.*列表/.test(text)) {
    return { tool: "listPatrolRules", args: {} };
  }
  if (/巡检.*结果|结果.*巡检|patrol.*result/.test(t)) {
    return { tool: "getPatrolResults", args: { limit: 5 } };
  }
  if (/发送.*通知|通知.*发送|send.*notification/.test(t)) {
    return { tool: "sendNotification", args: { title: "Lynx 通知", body: text.replace(/帮我|发送|通知|send|notification/g, "").trim() || "测试通知" } };
  }
  if (/导出|备份|export|backup/.test(t)) {
    return { tool: "exportBackup", args: { type: "all" } };
  }

  // 今日概览
  if (/今日|今天|概览|总览|overview/.test(text) && !/具体|详情/.test(text)) {
    return { tool: "getBoardStats", args: {} };
  }

  // hermesExecute 兜底：本地电脑操作类意图（打开浏览器/应用/运行命令等）
  if (/打开|启动|运行|执行|操控|控制|截.*屏|截图/.test(text) && /浏览器|记事本|应用|程序|软件|电脑|桌面|文件|命令|脚本|终端|cmd|powershell/.test(text)) {
    return { tool: "hermesExecute", args: { prompt: text } };
  }
  // 纯"打开XX"类（如"打开浏览器"）
  if (/^打开|^启动|^运行/.test(text) && text.length < 30) {
    return { tool: "hermesExecute", args: { prompt: text } };
  }

  return null;
}

// ============ 服务端自动持久化 assistant 消息（幂等）============
// 流式输出结束后调用：将 assistant 回复写入 ChatMessage 表
// 幂等处理：若会话最新一条 assistant 消息内容相同，则复用其 id，避免前端重复 POST 导致重复写入
async function persistAssistantMessageSafely(opts: {
  sessionId?: string;
  content: string;
  provider?: string;
  model?: string;
  tokens?: number;
}): Promise<string | null> {
  const { sessionId, content, provider, model, tokens } = opts;
  if (!sessionId || !content) return null;
  try {
    // 幂等检查：取该会话最新一条消息，若同样为 assistant 且 content 完全相同，则复用
    const latest = await prisma.chatMessage.findFirst({
      where: { sessionId },
      orderBy: { createdAt: "desc" },
      select: { id: true, role: true, content: true },
    });
    if (latest && latest.role === "assistant" && latest.content === content) {
      return latest.id;
    }
    const created = await prisma.chatMessage.create({
      data: {
        sessionId,
        role: "assistant",
        content,
        provider: provider || null,
        model: model || null,
        tokens: tokens ?? null,
      },
      select: { id: true },
    });
    // 更新会话 updatedAt（触发列表排序刷新）
    await prisma.chatSession.update({
      where: { id: sessionId },
      data: { updatedAt: new Date() },
    }).catch(() => {
      // 会话更新失败不影响主流程
    });
    return created.id;
  } catch (e) {
    // 持久化失败不阻塞流式响应（已通过 done 事件返回内容给前端）
    return null;
  }
}

// POST /api/ai/chat
// Request: { messages, provider?, model?, reasoningMode?, temperature?, maxTokens?, stream? }
// - messages 中 content 可为字符串或多模态数组 [{ type: "text", text }, { type: "image_url", image_url: { url } }]
// - stream 为 true 时返回 SSE 流式响应（逐字输出）
// - 否则返回完整 JSON：{ content, provider, model, usage }
// 限流：20 次/分钟
export async function POST(req: NextRequest) {
  try {
    // ============ Rate Limiting ============
    const ip = getClientKey(req);
    const rl = rateLimit(`ai-chat:${ip}`, 20, 60 * 1000);
    if (!rl.success) {
      return NextResponse.json(
        { error: "请求过于频繁，请稍后再试" },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": "20",
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(Math.floor(rl.resetAt / 1000)),
            "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)),
          },
        }
      );
    }

    // ============ 统一鉴权：所有模式都需要登录 ============
    const authResult = await requireAuth();
    if (authResult.error) return authResult.error;

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "请求体格式错误，需为 JSON" },
        { status: 400 }
      );
    }

    const {
      messages,
      provider,
      model,
      reasoningMode,
      temperature,
      maxTokens,
      stream,
      assistantMode,
      sessionId,
    } = body as {
      messages?: unknown;
      provider?: string;
      model?: string;
      reasoningMode?: string;
      temperature?: number;
      maxTokens?: number;
      stream?: boolean;
      assistantMode?: boolean;
      sessionId?: string;
    };

    // 校验 messages
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "messages 必须为非空数组" },
        { status: 400 }
      );
    }

    // 校验每条消息格式（支持字符串和多模态数组两种 content）
    const validRoles = new Set(["system", "user", "assistant"]);
    const cleanMessages: ChatMessage[] = [];
    for (const m of messages) {
      if (
        !m ||
        typeof m !== "object" ||
        typeof (m as { role?: unknown }).role !== "string"
      ) {
        return NextResponse.json(
          { error: "messages 中每项需包含 role 字符串" },
          { status: 400 }
        );
      }
      const role = (m as { role: string }).role;
      if (!validRoles.has(role)) {
        return NextResponse.json(
          { error: `无效的 role：${role}` },
          { status: 400 }
        );
      }
      const rawContent = (m as { content?: unknown }).content;
      // content 可为字符串或多模态内容数组
      if (typeof rawContent === "string") {
        cleanMessages.push({
          role: role as ChatMessage["role"],
          content: rawContent,
        });
      } else if (Array.isArray(rawContent)) {
        // 校验多模态内容数组
        const parts: MultimodalContent[] = [];
        for (const part of rawContent) {
          if (!part || typeof part !== "object") continue;
          if (part.type === "text" && typeof part.text === "string") {
            parts.push({ type: "text", text: part.text });
          } else if (
            part.type === "image_url" &&
            part.image_url &&
            typeof part.image_url.url === "string"
          ) {
            parts.push({
              type: "image_url",
              image_url: { url: part.image_url.url },
            });
          }
        }
        if (parts.length === 0) {
          return NextResponse.json(
            { error: "多模态消息 content 数组不能为空" },
            { status: 400 }
          );
        }
        cleanMessages.push({
          role: role as ChatMessage["role"],
          content: parts,
        });
      } else {
        return NextResponse.json(
          { error: "messages 中 content 需为字符串或多模态数组" },
          { status: 400 }
        );
      }
    }

    // 校验 provider
    let resolvedProvider: LLMProvider | undefined;
    if (provider !== undefined && provider !== null) {
      if (provider !== "deepseek" && provider !== "mimo") {
        return NextResponse.json(
          { error: `不支持的 provider：${provider}` },
          { status: 400 }
        );
      }
      resolvedProvider = provider;
    }

    // 校验 reasoningMode
    let resolvedReasoningMode: ReasoningMode | undefined;
    if (reasoningMode !== undefined && reasoningMode !== null) {
      if (
        reasoningMode !== "fast" &&
        reasoningMode !== "standard" &&
        reasoningMode !== "deep"
      ) {
        return NextResponse.json(
          { error: `不支持的 reasoningMode：${reasoningMode}` },
          { status: 400 }
        );
      }
      resolvedReasoningMode = reasoningMode;
    }
    // 校验数值参数
    if (
      temperature !== undefined &&
      (typeof temperature !== "number" ||
        temperature < 0 ||
        temperature > 2)
    ) {
      return NextResponse.json(
        { error: "temperature 需为 0-2 之间的数字" },
        { status: 400 }
      );
    }
    if (
      maxTokens !== undefined &&
      (typeof maxTokens !== "number" || maxTokens <= 0)
    ) {
      return NextResponse.json(
        { error: "maxTokens 需为正整数" },
        { status: 400 }
      );
    }

    // ============ AI 助理模式（Function Calling）============
    // 启用后：用 AI_ASSISTANT_SYSTEM_PROMPT 作为系统提示词，
    // 解析 AI 回复中的 action JSON 块，执行对应工具，
    // 再基于工具结果生成最终回复。返回 { content, toolCalled }
    //
    // 支持 stream=true：将第二轮 LLM 回复流式输出，并推送阶段事件（thinking/tool/replying）
    if (assistantMode === true) {
      const user = authResult.user!;

      // ============ 加载职业空间（system prompt + 工具白名单）============
      // 用户登录后按 Role.profession 自动加载 admin 在 /admin/profession-workspaces 配置的内容
      let professionSystemPrompt = "";
      let allowedTools: string[] | null = null; // null = 全部工具可用
      let professionDefaultProvider: string | null = null;
      let professionDefaultModel: string | null = null;
      let professionDefaultReasoningMode: string | null = null;
      let assistantName = "Lynn";
      let personaStyle = "";
      let distilledStyle = "";
      let styleStrength = 0.7;
      let hermesTakeover = false;

      // 并行加载职业空间 + AI 助理设置（两者相互独立，避免串行 DB 往返）
      const [professionResult, aiSettingsResult] = await Promise.allSettled([
        (async () => {
          const dbUser = await prisma.user.findUnique({
            where: { id: user.id },
            select: { role: true, profession: true },
          });
          if (!dbUser) return null;
          const roleRow = await prisma.role.findUnique({
            where: { name: dbUser.role },
            select: { profession: true },
          });
          const professionKey = roleRow?.profession || dbUser.profession || null;
          if (!professionKey) return null;
          const ws = await prisma.professionWorkspace.findUnique({
            where: { profession: professionKey },
          });
          return ws && ws.enabled ? ws : null;
        })(),
        prisma.aISetting.findFirst(),
      ]);

      if (professionResult.status === "fulfilled" && professionResult.value) {
        const ws = professionResult.value;
        professionSystemPrompt = ws.systemPrompt?.trim() || "";
        const tools = ws.allowedTools as string[] | null;
        if (Array.isArray(tools) && tools.length > 0) {
          allowedTools = tools;
        }
        professionDefaultProvider = ws.defaultProvider || null;
        professionDefaultModel = ws.defaultModel || null;
        professionDefaultReasoningMode = ws.defaultReasoningMode || null;
      }

      if (aiSettingsResult.status === "fulfilled" && aiSettingsResult.value) {
        const aiSettings = aiSettingsResult.value;
        assistantName = aiSettings.assistantName || "Lynn";
        personaStyle = aiSettings.personaStyle || "";
        distilledStyle = aiSettings.distilledStyle || "";
        styleStrength = aiSettings.styleStrength ?? 0.7;
        hermesTakeover = aiSettings.hermesTakeover ?? false;
      }

      // 应用职业空间默认 model（仅在用户未显式传 provider/model/reasoningMode 时生效）
      if (!resolvedProvider && professionDefaultProvider === "deepseek") {
        resolvedProvider = "deepseek";
      } else if (!resolvedProvider && professionDefaultProvider === "mimo") {
        resolvedProvider = "mimo";
      }
      if (!resolvedReasoningMode && professionDefaultReasoningMode) {
        const m = professionDefaultReasoningMode;
        if (m === "fast" || m === "standard" || m === "deep" || m === "thinking") {
          resolvedReasoningMode = m as ReasoningMode;
        }
      }

      // ============ Hermes Agent 接管模式（模式 C）============
      // 开启后：用户消息直接传给 Hermes Agent（带持久化 profile + 记忆上下文 + --learn 自动学习）
      // Hermes 输出作为助理回复，失败时回退到 LLM + Function Calling 模式
      let hermesFallback = false;
      if (hermesTakeover) {
        // 提取最后一条用户消息
        const lastUserMsg = cleanMessages.filter((m) => m.role === "user").pop();
        const userText = typeof lastUserMsg?.content === "string" ? lastUserMsg.content : "";
        if (userText.trim()) {
          // ============ 系统工具意图检测 ============
          // Hermes 不知 Lynx 数据库，对于创建灵感/任务/看板等系统工具意图，
          // 跳过 Hermes Takeover，直接走 LLM + Function Calling 路径，避免走错路径（如建 md 文件）
          const systemIntent = detectIntent(userText);
          if (systemIntent) {
            // 命中系统工具意图，回退到 LLM + Function Calling
            hermesFallback = true;
          } else {
            // P0 修复：Hermes Takeover 快速失败
            // 旧逻辑：直接调用 Hermes（8 秒超时），Hermes 不可用时用户白等 8 秒
            // 新逻辑：先查 WS 网关在线设备（2 秒超时），无设备直接跳过 Hermes 调用
            let hermesAvailable = false;
            try {
              const wsGatewayUrl = process.env.WS_GATEWAY_URL || "http://localhost:3001";
              const deviceResp = await fetch(
                `${wsGatewayUrl}/devices?userId=${user.id}`,
                {
                  headers: { "X-Internal-Key": process.env.INTERNAL_API_KEY || "" },
                  signal: AbortSignal.timeout(2000),
                }
              );
              if (deviceResp.ok) {
                const deviceData = await deviceResp.json();
                const devices = Array.isArray(deviceData.devices) ? deviceData.devices : [];
                hermesAvailable = devices.length > 0;
              }
            } catch (e) {
              console.warn("[chat] 查询 Hermes 在线设备失败，跳过 Takeover:", e);
            }

            // 调用 Hermes（3 秒超时，原 8 秒过长）；无在线设备时跳过，hermesResult 为 null
            // 使用 const 声明，确保 TypeScript 在嵌套回调（async start）中也能正确收窄 null
            const hermesResult = hermesAvailable
              ? await executeAssistantViaHermes(user.id, userText, 3)
              : null;
            if (!hermesAvailable) {
              console.log("[chat] Hermes Takeover 已开启但无在线设备，直接使用 LLM");
            }
            if (hermesResult?.success) {
              // 异步学习任务模式（非阻塞，不影响响应延迟）
              learnTaskPattern(user.id, userText, hermesResult.output).catch(() => {
                // 学习失败不影响主流程
              });

              // 流式分支：把 Hermes 输出作为 delta 推送
              if (stream === true) {
                const encoder = new TextEncoder();
                const streamBody = new ReadableStream<Uint8Array>({
                  async start(controller) {
                    const send = (obj: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
                    try {
                      send({ type: "meta", provider: "hermes", model: "hermes-agent", hermesMode: true });
                      if (hermesResult.output) {
                        // 分块推送（模拟流式效果）
                        const chunks = hermesResult.output.match(/[\s\S]{1,40}/g) || [hermesResult.output];
                        for (const chunk of chunks) {
                          send({ type: "delta", content: chunk });
                        }
                      }
                      // 服务端自动持久化 assistant 消息（幂等），返回 messageId 供前端去重
                      const hermesMessageId = await persistAssistantMessageSafely({
                        sessionId,
                        content: hermesResult.output || "",
                        provider: "hermes",
                        model: "hermes-agent",
                      });
                      send({
                        type: "done",
                        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
                        toolCalled: null,
                        hermesMode: true,
                        ...(hermesMessageId ? { messageId: hermesMessageId, sessionId } : {}),
                        ...(hermesFallback ? { hermesFallback: true } : {}),
                      });
                    } finally {
                      controller.close();
                    }
                  },
                });
                return new Response(streamBody, {
                  headers: {
                    "Content-Type": "text/event-stream; charset=utf-8",
                    "Cache-Control": "no-cache, no-transform",
                    Connection: "keep-alive",
                    "X-Accel-Buffering": "no",
                  },
                });
              }

              return NextResponse.json({
                content: hermesResult.output,
                provider: "hermes",
                model: "hermes-agent",
                usage: {
                  prompt_tokens: 0,
                  completion_tokens: 0,
                  total_tokens: 0,
                },
                toolCalled: null,
                hermesMode: true,
                learned: hermesResult.learned,
                durationMs: hermesResult.durationMs,
              });
            }
            // Hermes 执行失败/超时/无在线设备 → 回退到 LLM + Function Calling 模式（继续往下执行）
            hermesFallback = true;
          }
        }
      }

      // 构建最终 system prompt：基础工具能力 + 自定义风格
      let finalSystemPrompt = AI_ASSISTANT_SYSTEM_PROMPT;
      const styleParts: string[] = [];
      if (personaStyle.trim()) {
        styleParts.push(`## 聊天风格要求\n${personaStyle.trim()}`);
      }
      if (distilledStyle.trim()) {
        // 根据风格强度调整指令措辞
        const strengthDesc = styleStrength >= 0.8
          ? "请严格模仿以下风格特征与用户对话，尽可能还原说话方式"
          : styleStrength >= 0.4
          ? "请参考以下风格特征与用户对话，适度融入但保持 AI 助理的专业性"
          : "请在保持 AI 助理专业性的前提下，轻微参考以下风格特征";
        styleParts.push(`## 蒸馏的真人聊天风格\n${strengthDesc}（风格强度：${Math.round(styleStrength * 100)}%）：\n${distilledStyle.trim()}`);
      }
      if (styleParts.length > 0) {
        // 将风格要求插入到 system prompt 的"重要约束"之前
        finalSystemPrompt = AI_ASSISTANT_SYSTEM_PROMPT.replace(
          "## 重要约束",
          `${styleParts.join("\n\n")}\n\n## 重要约束`
        );
      }
      // 替换助理名称
      finalSystemPrompt = finalSystemPrompt.replace(/Lynx 的 AI 助理/g, `${assistantName}（Lynx AI 助理）`);

      // 注入用户历史反馈（bad case）到 system prompt，让 AI 避免重复类似错误
      const feedbackCtx = await getFeedbackContext();
      if (feedbackCtx) {
        finalSystemPrompt = finalSystemPrompt + feedbackCtx;
      }

      // 注入职业 system prompt 追加（按 Role.profession 加载 admin 配置的工作空间）
      if (professionSystemPrompt) {
        finalSystemPrompt = finalSystemPrompt.replace(
          "## 重要约束",
          `## 职业空间设定\n${professionSystemPrompt}\n\n## 重要约束`
        );
      }

      // 注入工具白名单到 system prompt（告诉 AI 只允许调用列表内的工具）
      if (Array.isArray(allowedTools) && allowedTools.length > 0) {
        finalSystemPrompt = finalSystemPrompt.replace(
          "## 工具调用规则（最重要！必须严格遵守！）",
          `## 可用工具白名单（本岗位仅允许使用以下工具）\n${allowedTools.map((t) => `- ${t}`).join("\n")}\n\n## 工具调用规则（最重要！必须严格遵守！）`
        );
      }

      // 注入 AI 助理系统提示词（替换或前置到 messages）
      const assistantMessages: ChatMessage[] = [
        { role: "system", content: finalSystemPrompt },
        ...cleanMessages.filter((m) => m.role !== "system"),
      ];

      // 获取用户级 AI Key 配置（优先级：用户自配 > 全局 AISetting > env）
      // 如果用户配置了自己的 Key，则用用户的 Key；否则用全局配置
      let userApiKey: string | undefined;
      let userBaseUrl: string | undefined;
      try {
        const userConfig = await getLLMConfigForUser(user.id, resolvedProvider);
        userApiKey = userConfig.userKeyUsed ? userConfig.apiKey : undefined;
        userBaseUrl = userConfig.userKeyUsed ? userConfig.baseUrl : undefined;
        // 如果用户有偏好 provider 且未显式传入，使用用户偏好
        if (!resolvedProvider && userConfig.provider) {
          resolvedProvider = userConfig.provider;
        }
      } catch {
        // 获取失败回退到全局配置
      }

      // 第一轮：调用 AI 决定是否需要调用工具（流式优化：边收 token 边推送 thinking 事件）
      // 当 stream=true 时，第一轮也走流式，让用户实时看到"正在思考"的内容
      let firstResult: ChatResponse | null = null;

      if (stream === true) {
        // 流式第一轮：收集完整内容用于解析 action，同时推送 thinking 事件给前端
        const encoder = new TextEncoder();
        const streamBody = new ReadableStream<Uint8Array>({
          async start(controller) {
            const send = (obj: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
            let firstContent = "";
            let firstProvider: string | undefined;
            let firstModel: string | undefined;
            let firstUsage: any;
            let action: { tool: string; args: any } | null = null;
            let toolExecuted = false;
            try {
              // 先推 meta 事件
              send({ type: "meta", provider: resolvedProvider, model });

              // 第一轮流式调用
              for await (const evt of chatStream(assistantMessages, {
                provider: resolvedProvider,
                model,
                reasoningMode: resolvedReasoningMode,
                temperature,
                maxTokens,
                apiKey: userApiKey,
                baseUrl: userBaseUrl,
              })) {
                if (evt.type === "meta") {
                  firstProvider = evt.provider;
                  firstModel = evt.model;
                } else if (evt.type === "delta") {
                  firstContent += evt.content;
                  // 推送 thinking 事件让前端显示"正在思考..."
                  send({ type: "thinking", content: "正在思考..." });
                } else if (evt.type === "done") {
                  firstUsage = evt.usage;
                  break;
                } else if (evt.type === "error") {
                  send(evt);
                  return;
                }
              }

              firstResult = {
                content: firstContent,
                provider: (firstProvider || resolvedProvider || "unknown") as LLMProvider,
                model: firstModel || model || "unknown",
                usage: firstUsage,
              };

              // 解析 action
              action = parseAction(firstContent);

              // Fallback：关键词意图检测
              if (!action) {
                const lastUserMsg = cleanMessages.filter((m) => m.role === "user").pop();
                const userText = typeof lastUserMsg?.content === "string" ? lastUserMsg.content : "";
                action = detectIntent(userText);
              }

              // 无 action：直接把完整内容作为 delta 推送
              if (!action) {
                const finalContent = stripAction(firstContent);
                if (finalContent) send({ type: "delta", content: finalContent });
                // 异步学习
                const lastUserMsgForLearn = cleanMessages.filter((m) => m.role === "user").pop();
                const userTextForLearn = typeof lastUserMsgForLearn?.content === "string" ? lastUserMsgForLearn.content : "";
                if (userTextForLearn.trim()) {
                  learnTaskPattern(user.id, userTextForLearn, firstContent).catch(() => {});
                }
                // 服务端自动持久化 assistant 消息（幂等），返回 messageId 供前端去重
                const noActionMessageId = await persistAssistantMessageSafely({
                  sessionId,
                  content: finalContent,
                  provider: firstProvider,
                  model: firstModel,
                  tokens: firstUsage?.total_tokens,
                });
                send({
                  type: "done",
                  usage: firstUsage,
                  toolCalled: null,
                  ...(noActionMessageId ? { messageId: noActionMessageId, sessionId } : {}),
                  ...(hermesFallback ? { hermesFallback: true } : {}),
                });
                return;
              }

              // 有 action：校验工具白名单
              if (Array.isArray(allowedTools) && allowedTools.length > 0 && !allowedTools.includes(action.tool)) {
                const blockedContent = `你的岗位工作空间未授权使用工具「${action.tool}」。当前岗位可用工具：${allowedTools.join("、")}`;
                send({ type: "delta", content: blockedContent });
                // 服务端自动持久化 assistant 消息（幂等），返回 messageId 供前端去重
                const blockedMessageId = await persistAssistantMessageSafely({
                  sessionId,
                  content: blockedContent,
                  provider: firstProvider,
                  model: firstModel,
                  tokens: firstUsage?.total_tokens,
                });
                send({
                  type: "done",
                  usage: firstUsage,
                  toolCalled: {
                    tool: action.tool,
                    args: action.args,
                    result: { error: `工具未授权`, allowedTools },
                  },
                  ...(blockedMessageId ? { messageId: blockedMessageId, sessionId } : {}),
                  ...(hermesFallback ? { hermesFallback: true } : {}),
                });
                return;
              }

              // 有 action：推送工具执行进度事件
              send({ type: "tool_start", tool: action.tool, args: action.args });
              const toolResult = await executeTool(action.tool, action.args, user);
              send({ type: "tool_done", tool: action.tool, toolCalled: { tool: action.tool, args: action.args, result: toolResult } });
              toolExecuted = true;

              // 第二轮：把工具结果拼成新消息，流式输出最终回复
              const toolResultStr = JSON.stringify(toolResult).slice(0, 8000);
              const secondMessages: ChatMessage[] = [
                ...assistantMessages,
                { role: "assistant", content: firstContent },
                {
                  role: "user",
                  content: `工具 ${action.tool} 执行完成，结果如下：

\`\`\`json
${toolResultStr}
\`\`\`

请基于以上工具结果，给出有价值的总结和建议。如果工具执行失败，告知用户原因并给出建议。`,
                },
              ];

              let secondUsage: any;
              let secondContent = "";
              for await (const evt of chatStream(secondMessages, {
                provider: resolvedProvider,
                model,
                reasoningMode: resolvedReasoningMode,
                temperature,
                maxTokens,
                apiKey: userApiKey,
                baseUrl: userBaseUrl,
              })) {
                if (evt.type === "meta") {
                  // 不重复推 meta
                } else if (evt.type === "delta") {
                  secondContent += evt.content;
                  send(evt);
                } else if (evt.type === "done") {
                  secondUsage = evt.usage;
                  // 异步学习
                  const lastUserMsgForLearn = cleanMessages.filter((m) => m.role === "user").pop();
                  const userTextForLearn = typeof lastUserMsgForLearn?.content === "string" ? lastUserMsgForLearn.content : "";
                  if (userTextForLearn.trim()) {
                    learnTaskPattern(user.id, userTextForLearn, secondContent).catch(() => {});
                  }
                  // 服务端自动持久化 assistant 消息（幂等），返回 messageId 供前端去重
                  const secondMessageId = await persistAssistantMessageSafely({
                    sessionId,
                    content: secondContent,
                    provider: firstProvider,
                    model: firstModel,
                    tokens: (firstUsage?.total_tokens || 0) + (secondUsage?.total_tokens || 0),
                  });
                  send({
                    type: "done",
                    usage: {
                      prompt_tokens: (firstUsage?.prompt_tokens || 0) + (secondUsage?.prompt_tokens || 0),
                      completion_tokens: (firstUsage?.completion_tokens || 0) + (secondUsage?.completion_tokens || 0),
                      total_tokens: (firstUsage?.total_tokens || 0) + (secondUsage?.total_tokens || 0),
                    },
                    provider: firstProvider,
                    model: firstModel,
                    toolCalled: { tool: action.tool, args: action.args, result: toolResult },
                    ...(secondMessageId ? { messageId: secondMessageId, sessionId } : {}),
                    ...(hermesFallback ? { hermesFallback: true } : {}),
                  });
                  return;
                } else if (evt.type === "error") {
                  send(evt);
                  return;
                }
              }
            } catch (e) {
              send({ type: "error", message: (e as Error).message || "流式响应异常" });
            } finally {
              controller.close();
            }
          },
        });

        return new Response(streamBody, {
          headers: {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no",
          },
        });
      }

      // 非流式分支：保持原有的同步 chat 调用
      const firstResultSync = await chat(assistantMessages, {
        provider: resolvedProvider,
        model,
        reasoningMode: resolvedReasoningMode,
        temperature,
        maxTokens,
        apiKey: userApiKey,
        baseUrl: userBaseUrl,
      });

      firstResult = firstResultSync;

      // 解析 action
      let action = parseAction(firstResultSync.content);

      // Fallback：如果 AI 没输出 action 块，用关键词意图检测
      if (!action) {
        const lastUserMsg = cleanMessages.filter((m) => m.role === "user").pop();
        const userText = typeof lastUserMsg?.content === "string" ? lastUserMsg.content : "";
        action = detectIntent(userText);
      }

      // 无 action：直接返回回复（去除可能的 action 块）
      if (!action) {
        // 异步学习任务模式（非阻塞，让每次交互都成为学习机会）
        const lastUserMsgForLearn = cleanMessages.filter((m) => m.role === "user").pop();
        const userTextForLearn = typeof lastUserMsgForLearn?.content === "string" ? lastUserMsgForLearn.content : "";
        if (userTextForLearn.trim()) {
          learnTaskPattern(user.id, userTextForLearn, firstResultSync.content).catch(() => {
            // 学习失败不影响主流程
          });
        }

        // 非流式分支：直接返回 JSON（流式分支已在上方提前 return）
        await chargeAICredits(user.id, firstResultSync.usage, firstResultSync.model, sessionId);
        return NextResponse.json({
          content: stripAction(firstResultSync.content),
          provider: firstResultSync.provider,
          model: firstResultSync.model,
          usage: firstResultSync.usage,
          toolCalled: null,
          ...(hermesFallback ? { hermesFallback: true } : {}),
        });
      }

      // 有 action：先校验工具白名单（职业空间限制）
      if (Array.isArray(allowedTools) && allowedTools.length > 0 && !allowedTools.includes(action.tool)) {
        const blockedContent = `你的岗位工作空间未授权使用工具「${action.tool}」。当前岗位可用工具：${allowedTools.join("、")}`;
        const blockedToolCalled = {
          tool: action.tool,
          args: action.args,
          result: { error: `工具未授权`, allowedTools },
        };

        // 非流式分支：直接返回 JSON（流式分支已在上方提前 return）
        return NextResponse.json({
          content: blockedContent,
          provider: firstResultSync.provider,
          model: firstResultSync.model,
          usage: firstResultSync.usage,
          toolCalled: blockedToolCalled,
          ...(hermesFallback ? { hermesFallback: true } : {}),
        });
      }

      // 有 action：执行工具
      const toolResult = await executeTool(action.tool, action.args, user);

      // 第二轮：把工具结果拼成新消息，让 AI 生成最终回复
      const toolResultStr = JSON.stringify(toolResult).slice(0, 8000);
      const secondMessages: ChatMessage[] = [
        ...assistantMessages,
        { role: "assistant", content: firstResultSync.content },
        {
          role: "user",
          content: `工具 ${action.tool} 执行完成，结果如下：

\`\`\`json
${toolResultStr}
\`\`\`

请基于以上工具结果，给出有价值的总结和建议。如果工具执行失败，告知用户原因并给出建议。`,
        },
      ];

      // ============ 非流式分支：第二轮 LLM 调用同步等结果 ============
      const secondResult = await chat(secondMessages, {
        provider: resolvedProvider,
        model,
        reasoningMode: resolvedReasoningMode,
        temperature,
        maxTokens,
        apiKey: userApiKey,
        baseUrl: userBaseUrl,
      });

      // 异步学习任务模式（非阻塞，让每次交互都成为学习机会）
      const lastUserMsgForLearn = cleanMessages.filter((m) => m.role === "user").pop();
      const userTextForLearn = typeof lastUserMsgForLearn?.content === "string" ? lastUserMsgForLearn.content : "";
      if (userTextForLearn.trim()) {
        learnTaskPattern(user.id, userTextForLearn, secondResult.content).catch(() => {
          // 学习失败不影响主流程
        });
      }

      // 扣除 Credits（两轮调用合并计费）
      const combinedUsage = {
        prompt_tokens:
          (firstResultSync.usage?.prompt_tokens || 0) +
          (secondResult.usage?.prompt_tokens || 0),
        completion_tokens:
          (firstResultSync.usage?.completion_tokens || 0) +
          (secondResult.usage?.completion_tokens || 0),
        total_tokens:
          (firstResultSync.usage?.total_tokens || 0) +
          (secondResult.usage?.total_tokens || 0),
      };
      await chargeAICredits(user.id, combinedUsage, secondResult.model, sessionId);

      return NextResponse.json({
        content: stripAction(secondResult.content),
        provider: secondResult.provider,
        model: secondResult.model,
        usage: combinedUsage,
        toolCalled: {
          tool: action.tool,
          args: action.args,
          result: toolResult,
        },
        ...(hermesFallback ? { hermesFallback: true } : {}),
      });
    }

    // ============ 流式响应（SSE）============
    if (stream === true) {
      const encoder = new TextEncoder();
      const streamBody = new ReadableStream<Uint8Array>({
        async start(controller) {
          const send = (obj: unknown) => {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
          };
          try {
            for await (const evt of chatStream(cleanMessages, {
              provider: resolvedProvider,
              model,
              reasoningMode: resolvedReasoningMode,
              temperature,
              maxTokens,
            })) {
              send(evt);
              // 遇到 error / done 后结束流
              if (evt.type === "error" || evt.type === "done") {
                break;
              }
            }
          } catch (e) {
            send({ type: "error", message: (e as Error).message || "流式响应异常" });
          } finally {
            controller.close();
          }
        },
      });

      return new Response(streamBody, {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        },
      });
    }

    // ============ 非流式响应（原有逻辑）============
    const result = await chat(cleanMessages, {
      provider: resolvedProvider,
      model,
      reasoningMode: resolvedReasoningMode,
      temperature,
      maxTokens,
    });

    // 扣除 Credits（非阻断式）
    await chargeAICredits(authResult.user!.id, result.usage, result.model, sessionId);

    return NextResponse.json({
      content: result.content,
      provider: result.provider,
      model: result.model,
      usage: result.usage,
    });
  } catch (e) {
    const msg = (e as Error).message || "服务器错误";
    // 区分配置错误（400）和其他错误（500）
    const status =
      msg.includes("未配置") || msg.includes("不支持的 provider")
        ? 400
        : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

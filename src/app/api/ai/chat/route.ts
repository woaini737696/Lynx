import { NextRequest, NextResponse } from "next/server";
import {
  chat,
  chatStream,
  type ChatMessage,
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
    return { tool: "sendNotification", args: { title: "LynnHub 通知", body: text.replace(/帮我|发送|通知|send|notification/g, "").trim() || "测试通知" } };
  }
  if (/导出|备份|export|backup/.test(t)) {
    return { tool: "exportBackup", args: { type: "all" } };
  }

  // 今日概览
  if (/今日|今天|概览|总览|overview/.test(text) && !/具体|详情/.test(text)) {
    return { tool: "getBoardStats", args: {} };
  }

  return null;
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
    } = body as {
      messages?: unknown;
      provider?: string;
      model?: string;
      reasoningMode?: string;
      temperature?: number;
      maxTokens?: number;
      stream?: boolean;
      assistantMode?: boolean;
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
    if (assistantMode === true) {
      // 工具执行需要登录用户
      const auth = await requireAuth();
      if (auth.error) return auth.error;
      const user = auth.user;

      // ============ 加载职业工作空间（system prompt + 工具白名单）============
      // 用户登录后按 Role.profession 自动加载 admin 在 /admin/profession-workspaces 配置的内容
      let professionSystemPrompt = "";
      let allowedTools: string[] | null = null; // null = 全部工具可用
      let professionDefaultProvider: string | null = null;
      let professionDefaultModel: string | null = null;
      let professionDefaultReasoningMode: string | null = null;
      try {
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { role: true, profession: true },
        });
        if (dbUser) {
          const roleRow = await prisma.role.findUnique({
            where: { name: dbUser.role },
            select: { profession: true },
          });
          const professionKey = roleRow?.profession || dbUser.profession || null;
          if (professionKey) {
            const ws = await prisma.professionWorkspace.findUnique({
              where: { profession: professionKey },
            });
            if (ws && ws.enabled) {
              professionSystemPrompt = ws.systemPrompt?.trim() || "";
              const tools = ws.allowedTools as string[] | null;
              if (Array.isArray(tools) && tools.length > 0) {
                allowedTools = tools;
              }
              professionDefaultProvider = ws.defaultProvider || null;
              professionDefaultModel = ws.defaultModel || null;
              professionDefaultReasoningMode = ws.defaultReasoningMode || null;
            }
          }
        }
      } catch {
        // 加载失败不阻断对话
      }

      // 应用职业工作空间默认 model（仅在用户未显式传 provider/model/reasoningMode 时生效）
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

      // 读取 AI 助理设置（助理名称、风格描述、蒸馏风格、风格强度）
      let assistantName = "Lynn";
      let personaStyle = "";
      let distilledStyle = "";
      let styleStrength = 0.7;
      let hermesTakeover = false;
      try {
        const aiSettings = await prisma.aISetting.findFirst();
        if (aiSettings) {
          assistantName = aiSettings.assistantName || "Lynn";
          personaStyle = aiSettings.personaStyle || "";
          distilledStyle = aiSettings.distilledStyle || "";
          styleStrength = aiSettings.styleStrength ?? 0.7;
          hermesTakeover = aiSettings.hermesTakeover ?? false;
        }
      } catch {
        // 读取失败不阻断对话
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
          const hermesResult = await executeAssistantViaHermes(user.id, userText, 120);
          if (hermesResult.success) {
            // 异步学习任务模式（非阻塞，不影响响应延迟）
            learnTaskPattern(user.id, userText, hermesResult.output).catch(() => {
              // 学习失败不影响主流程
            });

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
          // Hermes 执行失败 → 回退到 LLM + Function Calling 模式（继续往下执行）
          hermesFallback = true;
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
      finalSystemPrompt = finalSystemPrompt.replace(/LynnHub 的 AI 助理/g, `${assistantName}（LynnHub AI 助理）`);

      // 注入职业 system prompt 追加（按 Role.profession 加载 admin 配置的工作空间）
      if (professionSystemPrompt) {
        finalSystemPrompt = finalSystemPrompt.replace(
          "## 重要约束",
          `## 职业工作空间设定\n${professionSystemPrompt}\n\n## 重要约束`
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

      // 第一轮：调用 AI 决定是否需要调用工具
      const firstResult = await chat(assistantMessages, {
        provider: resolvedProvider,
        model,
        reasoningMode: resolvedReasoningMode,
        temperature,
        maxTokens,
      });

      // 解析 action
      let action = parseAction(firstResult.content);

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
          learnTaskPattern(user.id, userTextForLearn, firstResult.content).catch(() => {
            // 学习失败不影响主流程
          });
        }

        return NextResponse.json({
          content: stripAction(firstResult.content),
          provider: firstResult.provider,
          model: firstResult.model,
          usage: firstResult.usage,
          toolCalled: null,
          ...(hermesFallback ? { hermesFallback: true } : {}),
        });
      }

      // 有 action：先校验工具白名单（职业工作空间限制）
      if (Array.isArray(allowedTools) && allowedTools.length > 0 && !allowedTools.includes(action.tool)) {
        return NextResponse.json({
          content: `你的岗位工作空间未授权使用工具「${action.tool}」。当前岗位可用工具：${allowedTools.join("、")}`,
          provider: firstResult.provider,
          model: firstResult.model,
          usage: firstResult.usage,
          toolCalled: {
            tool: action.tool,
            args: action.args,
            result: { error: `工具未授权`, allowedTools },
          },
          ...(hermesFallback ? { hermesFallback: true } : {}),
        });
      }

      // 有 action：执行工具
      const toolResult = await executeTool(action.tool, action.args, user);

      // 第二轮：把工具结果拼成新消息，让 AI 生成最终回复
      const toolResultStr = JSON.stringify(toolResult).slice(0, 8000);
      const secondMessages: ChatMessage[] = [
        ...assistantMessages,
        { role: "assistant", content: firstResult.content },
        {
          role: "user",
          content: `工具 ${action.tool} 执行完成，结果如下：

\`\`\`json
${toolResultStr}
\`\`\`

请基于以上工具结果，给出有价值的总结和建议。如果工具执行失败，告知用户原因并给出建议。`,
        },
      ];

      const secondResult = await chat(secondMessages, {
        provider: resolvedProvider,
        model,
        reasoningMode: resolvedReasoningMode,
        temperature,
        maxTokens,
      });

      // 异步学习任务模式（非阻塞，让每次交互都成为学习机会）
      const lastUserMsgForLearn = cleanMessages.filter((m) => m.role === "user").pop();
      const userTextForLearn = typeof lastUserMsgForLearn?.content === "string" ? lastUserMsgForLearn.content : "";
      if (userTextForLearn.trim()) {
        learnTaskPattern(user.id, userTextForLearn, secondResult.content).catch(() => {
          // 学习失败不影响主流程
        });
      }

      return NextResponse.json({
        content: stripAction(secondResult.content),
        provider: secondResult.provider,
        model: secondResult.model,
        usage: {
          prompt_tokens:
            (firstResult.usage?.prompt_tokens || 0) +
            (secondResult.usage?.prompt_tokens || 0),
          completion_tokens:
            (firstResult.usage?.completion_tokens || 0) +
            (secondResult.usage?.completion_tokens || 0),
          total_tokens:
            (firstResult.usage?.total_tokens || 0) +
            (secondResult.usage?.total_tokens || 0),
        },
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

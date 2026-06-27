import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { chat, type ChatMessage } from "@/lib/ai-provider";
import { rateLimit, getClientKey } from "@/lib/rate-limit";
import { prisma } from "@/lib/db";

// 巡检规则配置助手系统提示词
const PATROL_CONFIG_SYSTEM_PROMPT = `你是 Lynx 的巡检规则配置助手，帮助用户通过自然语言配置 AI 巡检规则。

## 巡检规则参数说明

1. **name**（规则名称）：简短的规则名，如"灵感墓地复活检查"
2. **description**（描述）：规则的详细说明
3. **scope**（巡检对象）：必填，可选值：
   - "inbox"：巡检 Inbox 中的灵感
   - "board"：巡检决策看板上的活跃任务
   - "graveyard"：巡检灵感墓地中的放弃灵感
   - "all"：巡检以上全部
4. **triggerTime**（触发时间）：HH:mm 格式（如 "10:00" 表示每天 10:00 触发），或 "manual" 表示仅手动触发
5. **prompt**（巡检提示词）：AI 用于分析数据的系统提示词，描述巡检的判断逻辑和关注点
6. **threshold**（匹配阈值）：0-1 之间的浮点数，默认 0.75
7. **notifyChannels**（通知渠道）：数组，可选值：
   - "toast"：应用内 toast 提示
   - "notification"：浏览器通知
   - "push"：Web Push 推送
   - "feishu"：飞书消息通知
8. **enabled**（是否启用）：布尔值，默认 true

## 你的任务

1. 理解用户的巡检需求，主动询问缺失的关键信息（至少需要明确 scope 和巡检目标）
2. 提取规则参数，构造规则草案
3. 返回 JSON 格式响应：
   {
     "reply": "给用户的回复（自然语言，简洁友好）",
     "suggestedRule": {
       "name": "规则名称",
       "description": "描述",
       "scope": "inbox|board|graveyard|all",
       "triggerTime": "HH:mm 或 manual",
       "prompt": "巡检提示词",
       "threshold": 0.75,
       "notifyChannels": ["toast", "notification"],
       "enabled": true
     }
   }

## 注意事项

- 如果用户描述不够清晰，suggestedRule 可以为 null，并在 reply 中引导用户补充信息
- prompt 字段要写得具体可执行，包含判断标准和输出格式要求
- 默认 triggerTime 为 "manual"，除非用户明确指定时间
- 默认 notifyChannels 为 ["toast", "notification"]
- 只输出 JSON，不要其他内容`;

// AI 对话配置巡检规则
export async function POST(req: NextRequest) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    // 限流：10 次/分钟
    const clientKey = getClientKey(req);
    const rl = rateLimit(`patrol-config-chat:${user.id}:${clientKey}`, 10, 60_000);
    if (!rl.success) {
      return NextResponse.json(
        { error: "请求过于频繁，请稍后再试" },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { message, history, editRuleId } = body as {
      message?: string;
      history?: ChatMessage[];
      editRuleId?: string;
    };

    if (!message || typeof message !== "string" || !message.trim()) {
      return NextResponse.json({ error: "message 不能为空" }, { status: 400 });
    }

    // 构造系统提示词（编辑模式时追加编辑上下文）
    let systemPrompt = PATROL_CONFIG_SYSTEM_PROMPT;
    let editingRule: {
      id: string;
      name: string;
      description: string;
      scope: string;
      triggerTime: string;
      prompt: string;
      threshold: number;
      notifyChannels: string[];
      enabled: boolean;
    } | null = null;

    // 如果传入 editRuleId，进入编辑模式：拉取规则详情并追加编辑提示
    if (editRuleId && typeof editRuleId === "string") {
      const existing = await prisma.patrolRule.findUnique({ where: { id: editRuleId } });
      if (!existing) {
        return NextResponse.json({ error: "待编辑的规则不存在" }, { status: 404 });
      }
      if (user.role !== "admin" && existing.userId !== user.id) {
        return NextResponse.json({ error: "无权访问" }, { status: 403 });
      }

      editingRule = {
        id: existing.id,
        name: existing.name,
        description: existing.description || "",
        scope: existing.scope,
        triggerTime: existing.triggerTime,
        prompt: existing.prompt,
        threshold: existing.threshold,
        notifyChannels: Array.isArray(existing.notifyChannels)
          ? (existing.notifyChannels as unknown as string[])
          : [],
        enabled: existing.enabled,
      };

      systemPrompt = `${PATROL_CONFIG_SYSTEM_PROMPT}

## 当前模式：编辑现有规则

用户正在编辑规则（ID: ${editingRule.id}），规则当前详情如下：
${JSON.stringify(editingRule, null, 2)}

请根据用户描述建议修改哪些字段。返回的 suggestedRule 必须包含完整规则（含 id 字段），即：
- 保留用户未提及的字段为原值
- 仅修改用户明确要求变更的字段
- suggestedRule 中必须包含 "id": "${editingRule.id}"

返回 JSON 格式：
{
  "reply": "给用户的回复（说明修改了哪些字段）",
  "suggestedRule": {
    "id": "${editingRule.id}",
    "name": "...",
    "description": "...",
    "scope": "...",
    "triggerTime": "...",
    "prompt": "...",
    "threshold": 0.75,
    "notifyChannels": ["..."],
    "enabled": true
  }
}`;
    }

    // 构造消息列表
    const messages: ChatMessage[] = [];
    if (Array.isArray(history)) {
      // 限制历史长度，避免 token 超限
      const recentHistory = history.slice(-10);
      for (const msg of recentHistory) {
        if (msg && (msg.role === "user" || msg.role === "assistant") && typeof msg.content === "string") {
          messages.push({ role: msg.role, content: msg.content });
        }
      }
    }
    messages.push({ role: "user", content: message });

    // 调用 AI
    const aiResp = await chat(messages, {
      system: systemPrompt,
      reasoningMode: "standard",
      temperature: 0.5,
    });

    // 解析 AI 返回的 JSON
    let reply = aiResp.content;
    let suggestedRule: {
      id?: string;
      name: string;
      description: string;
      scope: string;
      triggerTime: string;
      prompt: string;
      threshold: number;
      notifyChannels: string[];
      enabled: boolean;
    } | null = null;

    try {
      const jsonMatch = aiResp.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.reply) {
          reply = parsed.reply;
        }
        if (parsed.suggestedRule && typeof parsed.suggestedRule === "object") {
          const sr = parsed.suggestedRule;
          // 校验必要字段
          if (sr.scope && sr.prompt) {
            suggestedRule = {
              // 编辑模式：保留 id（前端据此区分创建/编辑）
              id: typeof sr.id === "string" ? sr.id : undefined,
              name: String(sr.name || "未命名规则"),
              description: String(sr.description || ""),
              scope: String(sr.scope),
              triggerTime: String(sr.triggerTime || "manual"),
              prompt: String(sr.prompt),
              threshold: Number(sr.threshold) || 0.75,
              notifyChannels: Array.isArray(sr.notifyChannels)
                ? sr.notifyChannels.map(String)
                : ["toast", "notification"],
              enabled: sr.enabled !== false,
            };
          }
        }
      }
    } catch {
      // JSON 解析失败，仅返回原始回复
    }

    return NextResponse.json({ reply, suggestedRule });
  } catch (e) {
    console.error("AI 对话配置失败:", e);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

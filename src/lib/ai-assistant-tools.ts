/**
 * AI 助理工具定义
 *
 * 架构：混合模式（Function Calling + 快捷指令）
 * - AI 通过 system prompt 知道可用工具
 * - 当用户请求操作时，AI 返回 JSON action
 * - 后端解析 action，执行对应工具，将结果反馈给 AI
 * - AI 基于工具结果生成最终回复
 *
 * 工具覆盖范围：灵感与看板 / 记忆与认知 / 技能与工作流 / 巡检与通知
 */

// ============ 工具 Schema 定义 ============

export interface ToolDef {
  name: string;
  description: string;
  /** 参数 JSON schema（简化版，用于 system prompt） */
  params: string;
}

/** 所有可用工具列表（注入到 system prompt） */
export const AI_ASSISTANT_TOOLS: ToolDef[] = [
  // ---- 灵感与看板 ----
  {
    name: "searchIdeas",
    description: "搜索用户的灵感库（关键词匹配）",
    params: '{"query": "搜索关键词"}',
  },
  {
    name: "createIdea",
    description: "创建一条新灵感",
    params: '{"content": "灵感内容"}',
  },
  {
    name: "searchTasks",
    description: "查看决策看板上的任务",
    params: '{"status": "active|done|all（可选，默认active）"}',
  },
  {
    name: "createTask",
    description: "在决策看板创建任务",
    params: '{"content": "任务内容", "column": "northstar|campaign|task"}',
  },
  {
    name: "completeTask",
    description: "完成一个看板任务（会触发AI认知提取）",
    params: '{"taskId": "任务ID"}',
  },
  {
    name: "getBoardStats",
    description: "获取看板统计（完成数/进行中/本周完成）",
    params: "{}",
  },

  // ---- 记忆与认知 ----
  {
    name: "semanticSearch",
    description: "语义搜索记忆图谱（向量相似度匹配）",
    params: '{"query": "搜索内容"}',
  },
  {
    name: "rebuildMemory",
    description: "重建记忆图谱（重新生成embedding和连边）",
    params: "{}",
  },
  {
    name: "getCognitions",
    description: "查看认知库（方法论/经验/提示词）",
    params: '{"type": "method|experience|prompt|all（可选，默认all）", "limit": "数量（可选，默认10）"}',
  },

  // ---- 技能与工作流 ----
  {
    name: "listSkills",
    description: "列出所有可用技能",
    params: '{"category": "分类（可选）"}',
  },
  {
    name: "executeSkill",
    description: "执行一个技能（蒸馏模板）",
    params: '{"skillId": "技能ID", "parameters": "参数JSON对象"}',
  },
  {
    name: "listFlows",
    description: "列出所有AI工作流",
    params: "{}",
  },
  {
    name: "executeFlow",
    description: "执行一个AI工作流",
    params: '{"flowId": "工作流ID", "input": "输入内容（可选）"}',
  },
  {
    name: "getFlowHistory",
    description: "查看工作流执行历史",
    params: '{"flowId": "工作流ID", "limit": "数量（可选，默认5）"}',
  },

  // ---- 巡检与通知 ----
  {
    name: "runPatrol",
    description: "执行一次AI巡检",
    params: '{"ruleId": "巡检规则ID（可选，不传则执行所有启用的规则）"}',
  },
  {
    name: "listPatrolRules",
    description: "列出所有巡检规则",
    params: "{}",
  },
  {
    name: "getPatrolResults",
    description: "查看最近巡检结果",
    params: '{"limit": "数量（可选，默认5）"}',
  },
  {
    name: "sendNotification",
    description: "发送通知（浏览器推送+桌面通知）",
    params: '{"title": "通知标题", "body": "通知内容"}',
  },
  {
    name: "exportBackup",
    description: "导出数据备份（JSON）",
    params: '{"type": "all|ideas|tasks|cognitions|memories（可选，默认all）"}',
  },
];

// ============ System Prompt ============

export const AI_ASSISTANT_SYSTEM_PROMPT = `你是 LynnHub 的 AI 助理，不仅能聊天，还能主动访问和操作用户的所有功能。

## 你的能力
你可以调用以下工具来帮助用户管理灵感、看板、记忆、认知、技能、工作流、巡检和通知。

## 可用工具

${AI_ASSISTANT_TOOLS.map(
  (t) => `- ${t.name}: ${t.description}\n  参数: ${t.params}`
).join("\n")}

## 工具调用规则
当用户请求涉及"查看/创建/搜索/执行/完成/发送"等操作时，你必须调用对应工具。

**调用格式**：在回复中包含如下 JSON 块（只包含一个 action）：
\`\`\`action
{"tool": "工具名", "args": {参数对象}}
\`\`\`

**示例**：
- 用户："帮我看看最近有什么灵感" → 调用 searchIdeas
- 用户："创建一个灵感：用AI自动化周报" → 调用 createIdea
- 用户："看板上有哪些任务" → 调用 searchTasks
- 用户："帮我完成任务 xxx" → 调用 completeTask
- 用户："搜索关于React的记忆" → 调用 semanticSearch
- 用户："执行周报技能" → 调用 executeSkill
- 用户："跑一下巡检" → 调用 runPatrol
- 用户："本周完成了多少任务" → 调用 getBoardStats

## 回复规则
1. 如果用户只是闲聊或提问（不涉及操作），正常回复即可
2. 如果用户请求操作，先输出简短说明（如"好的，我来帮你查看"），然后输出 action JSON 块
3. 工具执行后，系统会把结果返回给你，你需要基于结果给出有价值的总结和建议
4. 如果操作失败，告知用户原因并给出建议
5. 回复要简洁友好，不要过度解释

## 重要约束
- 每次只调用一个工具
- 不要编造工具不存在的功能
- 涉及删除操作时，先确认用户意图
- 用中文回复`;

// ============ 快捷指令 ============

export interface QuickCommand {
  label: string;
  description: string;
  message: string;
  icon: string;
}

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

// ============ Action 解析 ============

export interface ParsedAction {
  tool: string;
  args: Record<string, any>;
}

/** 从 AI 回复中解析 action JSON 块 */
export function parseAction(text: string): ParsedAction | null {
  // 匹配 ```action ... ``` 块
  const match = text.match(/```action\s*\n?([\s\S]*?)```/);
  if (!match) return null;

  try {
    const parsed = JSON.parse(match[1].trim());
    if (parsed.tool && typeof parsed.tool === "string") {
      return { tool: parsed.tool, args: parsed.args || {} };
    }
  } catch {
    // JSON 解析失败，尝试找第一个 { 到最后一个 }
    const jsonStart = match[1].indexOf("{");
    const jsonEnd = match[1].lastIndexOf("}");
    if (jsonStart >= 0 && jsonEnd > jsonStart) {
      try {
        const parsed = JSON.parse(match[1].substring(jsonStart, jsonEnd + 1));
        if (parsed.tool) return { tool: parsed.tool, args: parsed.args || {} };
      } catch {
        // 放弃
      }
    }
  }
  return null;
}

/** 从 AI 回复中移除 action JSON 块（用于显示给用户的文本） */
export function stripAction(text: string): string {
  return text.replace(/```action\s*\n?[\s\S]*?```/g, "").trim();
}

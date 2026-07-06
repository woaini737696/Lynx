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

  // ---- 飞书任务 ----
  {
    name: "createLarkTask",
    description:
      "解析自然语言创建飞书任务。提取任务标题、负责人、截止时间，返回任务卡片数据供用户确认下发。不直接创建任务。当用户说「给XX下发任务」「创建飞书任务」「下发飞书任务」时使用。截止时间需解析为 ISO 字符串（如「本周五前」→对应日期的 ISO）。",
    params:
      '{"summary": "任务标题", "assignees": ["负责人姓名数组"], "due": "截止时间 ISO 字符串", "description": "任务描述（可选）"}',
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
  {
    name: "hermesExecute",
    description: "操控用户本地电脑：打开浏览器/应用、运行 Shell 命令、操作文件、截图、键盘输入、鼠标点击、调用 Skills Hub 技能。当用户要求打开/启动/运行/操控本地任何应用、浏览器、文件或命令时，必须调用此工具，不要回复教程或操作步骤。",
    params: '{"prompt": "任务描述（如：打开浏览器、打开记事本、运行dir命令）", "mode": "computer_use|shell|auto（可选，默认auto）", "workDir": "工作目录（可选）", "timeout": 120}',
  },
  {
    name: "hermesListSkills",
    description: "列出 Hermes Skills Hub 可用技能（672+ 官方技能）",
    params: '{"category": "技能分类（可选）"}',
  },
  {
    name: "hermesStatus",
    description: "查询 Hermes Agent 安装和运行状态",
    params: "{}",
  },
];

// ============ System Prompt ============

export const AI_ASSISTANT_SYSTEM_PROMPT = `你是奇思的 AI 助理，能聊天，也能主动操作用户的所有功能。

## 可用工具

${AI_ASSISTANT_TOOLS.map(
  (t) => `- ${t.name}: ${t.description}\n  参数: ${t.params}`
).join("\n")}

## 工具调用规则（必须严格遵守！）

当用户请求涉及"查看/创建/搜索/执行/完成/发送/列出/跑一下"等操作时，你**必须**调用对应工具。

### 本地电脑操作（hermesExecute）专属规则（最高优先级！）

当用户请求涉及"打开浏览器/打开应用/启动XX/操控电脑/桌面操作/运行命令/执行脚本/操作文件/新建文件夹/截图/键盘输入/鼠标点击"等**任何本地电脑操作**时，你**必须**调用 hermesExecute 工具，**绝对不要**回复教程、操作步骤或引导文案！

示例（必须严格遵守）：
- 用户："打开浏览器" → 必须调用 hermesExecute({"prompt": "打开默认浏览器"})
- 用户："打开浏览器搜索小红书" → 必须调用 hermesExecute({"prompt": "打开浏览器并搜索小红书"})
- 用户："打开记事本" → 必须调用 hermesExecute({"prompt": "打开记事本"})
- 用户："运行 dir 命令" → 必须调用 hermesExecute({"prompt": "运行 dir 命令", "mode": "shell"})
- 用户："帮我截个屏" → 必须调用 hermesExecute({"prompt": "截取当前屏幕"})
- 用户："打开文件管理器" → 必须调用 hermesExecute({"prompt": "打开文件管理器"})

**再次强调：遇到本地操作类请求，直接调用 hermesExecute，不要回复"你可以按照以下步骤..."这类教程！**

**调用方法**：在回复末尾添加 action 代码块：

\`\`\`action
{"tool": "工具名", "args": {"参数名": "参数值"}}
\`\`\`

### 示例

用户："帮我看看最近有什么灵感"
回复：好的，我来帮你查看最近的灵感。

\`\`\`action
{"tool": "searchIdeas", "args": {"query": ""}}
\`\`\`

### 关键规则
1. 涉及操作时，**必须**在回复末尾包含 action 代码块
2. action 代码块前可有简短文字说明
3. 每次只调用一个工具
4. 纯闲聊不涉及操作时正常回复，不加 action 块
5. 工具执行后基于结果给出有价值的总结和建议
6. 回复要简洁友好

## 重要约束
- 涉及删除操作时，先确认用户意图
- 不要编造工具不存在的功能
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

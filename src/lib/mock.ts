import { fakerZH_CN as faker } from "@faker-js/faker";

// 灵感内容池 - 真实的个人灵感样本
const IDEA_TEMPLATES = [
  "用向量数据库做灵感相似度匹配，自动关联历史想法",
  "做一个 AI 自动发推特的项目，每天定时发布思考",
  "Kimi 长对话提取了3个提示词模板，应该入库",
  "用物理阻断代替提醒，看板满额就不能加新任务",
  "把每天的 AI 对话自动归档，提取结论和待办",
  "设计一个收敛仪式，每晚23点强制处理inbox",
  "灵感墓地要记录复活条件，系统自动监测",
  "今日聚焦只显示3张卡片，物理隔离其他内容",
  "认知库自动提取方法论，越用越聪明",
  "用嵌入向量做记忆图谱，相似度>0.8自动连边",
  "把 Claude 对话中的高价值提示词沉淀下来",
  "决策看板三列：北极星3/战役5/任务10，满额阻断",
  "闪电输入3秒完成，分类交给系统",
  "AI工作流标准化，提示词复用",
  "个人知识管理应该三层：捕获→收敛→复利",
  "用机制替代意志力，强制收敛比自律有效",
  "对话资产不能浪费，每次AI对话都有价值",
  "记忆持久化是核心，不能让灵感过期",
  "把经验变成认知库，吃到复利",
  "极简设计，零学习成本，捕获比整理重要100倍",
  "DeepSeek 国内直连性价比高，适合日常任务",
  "GPT-5.6 推理能力强，适合复杂分析",
  "用 Webhook 接入 AI 对话，自动捕获",
  "每个灵感都要有归属：看板/延后/墓地",
  "认知库三类：方法论/经验/提示词",
];

// 对话标题池
const CONVERSATION_TITLES = [
  "设计灵感收敛系统的数据模型",
  "LynnHub 三层架构讨论",
  "AI 工作流标准化方案",
  "向量检索实现方案对比",
  "深色主题配色系统设计",
  "Next.js 部署到 ECS 最佳实践",
  "Prisma + MySQL schema 设计",
  "记忆图谱可视化方案",
  "收敛仪式交互流程",
  "对话资产提取提示词优化",
];

// 对话内容样本
const CONVERSATION_CONTENT = `【用户】: 帮我设计一个灵感收敛系统的数据模型
【AI】: 建议采用三层数据模型：
1. Idea表存储原始灵感
2. Task表存储看板任务
3. Memory表存储关联节点
关键约束：北极星≤3，战役≤5，任务≤10

【用户】: 那记忆图谱怎么实现自动关联？
【AI】: 用嵌入向量计算相似度，阈值>0.8自动连边。低于阈值的手动关联，平衡自动化和控制权。

【用户】: 满额阻断怎么实现？
【AI】: 在 API 层做校验，插入前 count 当前列，超限返回 409。前端展示"满额"状态，禁用新增按钮。`;

// 任务内容池
const TASK_TEMPLATES = {
  northstar: [
    "LynnHub MVP 上线",
    "个人认知操作系统成型",
    "AI工作流标准化",
  ],
  campaign: [
    "闪电输入浮窗开发",
    "对话资产提取器",
    "记忆图谱可视化",
    "收敛仪式定时器",
    "认知库自动提取",
    "灵感墓地复活监测",
  ],
  task: [
    "配置 Tailwind 深色主题",
    "faker 中文 mock 数据",
    "SQLite schema 设计",
    "shadcn 组件初始化",
    "Dockerfile 编写",
    "Nginx 反代配置",
    "快捷键注册",
    "Prisma 模型定义",
    "Zustand store 搭建",
    "今日聚焦页面",
    "决策看板拖拽",
    "对话资产列表",
  ],
};

// 认知库内容池
const COGNITION_TEMPLATES = {
  method: [
    "三层数据模型法：捕获层(原始)→收敛层(结构化)→复利层(关联)，适用于所有个人知识管理系统",
    "满额阻断比提醒有效100倍，物理限制才能对抗注意力分散",
    "向量相似度>0.8自动连边，低于阈值手动关联，平衡自动化和控制权",
    "收敛仪式用机制替代意志力，固定时间强制处理inbox",
    "对话资产提取四要素：结论/待办/数据/提示词，结构化保存AI对话价值",
  ],
  experience: [
    "个人工具优先选 SQLite/MySQL 单文件，零运维，后续再迁移",
    "Next.js App Router 配合 shadcn/ui 开发效率最高",
    "深色主题用 HSL 变量定义，方便统一调整",
    "Ctrl+Space 作为全局快捷键冲突最少",
    "faker 中文版生成 mock 数据最接近真实体验",
  ],
  prompt: [
    "把以下对话提取为：1.结论 2.待办 3.数据 4.可复用提示词，用JSON输出",
    "设计{系统名}的数据模型，要求：1.列出核心表 2.说明关联方式 3.给出实现建议",
    "分析以下灵感，提取：1.核心观点 2.可执行动作 3.关联标签",
    "将以下内容归纳为方法论/经验/提示词三类，每类给出摘要",
    "对比{方案A}和{方案B}，从开发成本/维护性/扩展性三维度评估",
  ],
};

// 灵感墓地样本
const GRAVEYARD_TEMPLATES = [
  {
    content: "做一个 AI 自动发推特的项目",
    reason: "当前 LynnHub 未上线，精力不应分散到新项目",
    condition: "当 LynnHub 用户数 > 100 或连续使用 30 天后",
  },
  {
    content: "开发一个独立的笔记 App",
    reason: "LynnHub 已覆盖笔记功能，重复造轮子",
    condition: "当 LynnHub 无法满足笔记需求且有具体痛点时",
  },
  {
    content: "做一个 AI 代码审查工具",
    reason: "偏离认知操作系统核心目标",
    condition: "当 LynnHub 稳定运行 3 个月且有余力时",
  },
];

export function generateIdeas(count: number = 20) {
  return Array.from({ length: count }, () => ({
    content: faker.helpers.arrayElement(IDEA_TEMPLATES),
    source: faker.helpers.arrayElement(["lightning", "conversation"]),
    status: faker.helpers.arrayElement(["inbox", "board", "graveyard"]),
    tags: faker.helpers.arrayElements(
      ["AI", "工作流", "设计", "开发", "灵感", "记忆", "认知", "工具"],
      { min: 1, max: 3 }
    ),
    createdAt: faker.date.recent({ days: 7 }),
  }));
}

export function generateConversations(count: number = 8) {
  return Array.from({ length: count }, () => {
    const title = faker.helpers.arrayElement(CONVERSATION_TITLES);
    return {
      source: faker.helpers.arrayElement(["kimi", "claude", "codex", "gpt"]),
      title,
      rawContent: CONVERSATION_CONTENT,
      conclusions: [
        `核心结论：${title}需要分层设计`,
        `关键决策：采用三层数据模型`,
      ],
      todos: [
        "设计 Idea 表 schema",
        "实现嵌入向量计算",
        "设置 0.8 连边阈值",
      ],
      prompts: [
        `设计{系统名}的数据模型，要求：1.列出核心表 2.说明关联方式 3.给出实现建议`,
      ],
      data: [`相似度阈值 0.8`, `三层架构`, `28轮对话`],
      capturedAt: faker.date.recent({ days: 7 }),
    };
  });
}

export function generateTasks() {
  const tasks: Array<{
    content: string;
    column: "northstar" | "campaign" | "task";
    position: number;
    status: string;
  }> = [];

  // 北极星 3 个（满）
  TASK_TEMPLATES.northstar.forEach((content, i) => {
    tasks.push({
      content,
      column: "northstar",
      position: i,
      status: "active",
    });
  });

  // 战役 4 个
  TASK_TEMPLATES.campaign.slice(0, 4).forEach((content, i) => {
    tasks.push({
      content,
      column: "campaign",
      position: i,
      status: "active",
    });
  });

  // 任务 7 个
  TASK_TEMPLATES.task.slice(0, 7).forEach((content, i) => {
    tasks.push({
      content,
      column: "task",
      position: i,
      status: faker.helpers.arrayElement(["active", "done"]),
    });
  });

  return tasks;
}

export function generateCognitions(count: number = 12) {
  const types = ["method", "experience", "prompt"] as const;
  return Array.from({ length: count }, () => {
    const type = faker.helpers.arrayElement(types);
    const templates = COGNITION_TEMPLATES[type];
    return {
      type,
      content: faker.helpers.arrayElement(templates),
      source: faker.helpers.arrayElement(["conversation", "idea", "manual"]),
      tags: faker.helpers.arrayElements(
        ["AI", "设计", "开发", "方法论", "经验", "提示词"],
        { min: 1, max: 2 }
      ),
      createdAt: faker.date.recent({ days: 14 }),
    };
  });
}

export function generateGraveyard() {
  return GRAVEYARD_TEMPLATES.map((g) => ({
    content: g.content,
    reason: g.reason,
    reviveCondition: g.condition,
    abandonedAt: faker.date.recent({ days: 14 }),
  }));
}

export function generateMemories(count: number = 15) {
  const types = ["idea", "conversation", "cognition"] as const;
  return Array.from({ length: count }, () => ({
    type: faker.helpers.arrayElement(types),
    refId: faker.string.uuid(),
    content: faker.helpers.arrayElement(IDEA_TEMPLATES),
    connections: faker.helpers.arrayElements(
      Array.from({ length: 10 }, () => faker.string.uuid()),
      { min: 0, max: 4 }
    ),
    strength: faker.number.float({ min: 0.3, max: 1, fractionDigits: 2 }),
    createdAt: faker.date.recent({ days: 14 }),
  }));
}

export function generateDailyFocus() {
  return {
    date: new Date(),
    cardIds: [], // 将在 seed 时关联实际 task id
    generatedAt: new Date(),
    status: "pending",
  };
}

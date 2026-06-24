import { PrismaClient, Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// 工具函数：生成最近 N 天内的随机日期
function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(9 + Math.floor(Math.random() * 10), Math.floor(Math.random() * 60), 0, 0);
  return d;
}

// 工具函数：生成未来 N 天内的日期
function daysAhead(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(18, 0, 0, 0);
  return d;
}

async function main() {
  console.log("🌱 开始 seed LynnHub 全量数据 (MySQL)...");

  // ============ 0. 创建 admin 用户 ============
  const adminPasswordHash = await bcrypt.hash("admin123", 10);
  await prisma.user.deleteMany({});
  const adminUser = await prisma.user.create({
    data: {
      username: "admin",
      passwordHash: adminPasswordHash,
      email: "admin@lynnhub.local",
      displayName: "管理员",
      role: "admin",
    },
  });
  console.log("  ✓ 创建 admin 用户 (admin/admin123)");

  // ============ 清空旧数据（按外键依赖顺序） ============
  await prisma.dailyFocusItem.deleteMany();
  await prisma.dailyFocus.deleteMany();
  await prisma.skillReview.deleteMany();
  await prisma.skillVersion.deleteMany();
  await prisma.skill.deleteMany();
  await prisma.larkTask.deleteMany();
  await prisma.memory.deleteMany();
  await prisma.graveyard.deleteMany();
  await prisma.cognition.deleteMany();
  await prisma.task.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.idea.deleteMany();
  console.log("  ✓ 清空旧数据");

  // ============ 1. Idea（灵感）10 条 ============
  const ideaData = [
    { content: "用AI自动整理飞书任务优先级，按截止时间和重要度排序", status: "inbox", tags: ["AI", "飞书"] },
    { content: "做一个记忆图谱可视化，用 D3 力导向图展示节点关联", status: "inbox", tags: ["记忆", "可视化"] },
    { content: "闪电输入支持语音转文字，3秒说完即归档", status: "board", tags: ["闪电输入", "语音"] },
    { content: "对话资产自动提取提示词模板，沉淀到认知库", status: "board", tags: ["对话", "提示词"] },
    { content: "灵感墓地复活监测：每周扫描一次，满足条件自动归档到 inbox", status: "board", tags: ["墓地", "自动化"] },
    { content: "今日聚焦卡片支持拖拽排序，物理隔离其他任务", status: "inbox", tags: ["聚焦", "交互"] },
    { content: "用嵌入向量做记忆图谱，相似度>0.8自动连边", status: "inbox", tags: ["向量", "记忆"] },
    { content: "决策看板三列满额阻断：北极星3/战役5/任务10", status: "board", tags: ["看板", "机制"] },
    { content: "做一个独立的笔记 App 覆盖笔记功能", status: "graveyard", tags: ["笔记"] },
    { content: "开发一个 AI 代码审查工具", status: "graveyard", tags: ["AI", "代码"] },
  ];

  const ideas = [];
  for (let i = 0; i < ideaData.length; i++) {
    const d = ideaData[i];
    const idea = await prisma.idea.create({
      data: {
        content: d.content,
        source: i % 3 === 0 ? "conversation" : "lightning",
        status: d.status,
        tags: d.tags,
        userId: adminUser.id,
        createdAt: daysAgo(Math.floor(i * 2.5)),
      },
    });
    ideas.push(idea);
  }
  console.log(`  ✓ 生成 ${ideas.length} 条灵感`);

  // ============ 2. Task（决策看板任务）15 条 ============
  const taskTemplates: Array<{ content: string; column: "northstar" | "campaign" | "task"; status: "active" | "done" | "dropped" }> = [
    // 北极星 3 条
    { content: "LynnHub MVP 上线并稳定运行", column: "northstar", status: "active" },
    { content: "个人认知操作系统成型，三层数据模型跑通", column: "northstar", status: "active" },
    { content: "AI 工作流标准化，提示词复用率达到 80%", column: "northstar", status: "active" },
    // 战役 5 条
    { content: "闪电输入浮窗开发，支持全局快捷键唤起", column: "campaign", status: "active" },
    { content: "对话资产提取器，自动抓取 Kimi/Claude 对话", column: "campaign", status: "active" },
    { content: "记忆图谱可视化，D3 力导向图渲染", column: "campaign", status: "active" },
    { content: "收敛仪式定时器，每晚 23 点强制处理 inbox", column: "campaign", status: "done" },
    { content: "认知库自动提取方法论，越用越聪明", column: "campaign", status: "active" },
    // 任务 7 条
    { content: "配置 Tailwind 深色主题，HSL 变量定义", column: "task", status: "done" },
    { content: "Prisma + MySQL schema 设计与迁移", column: "task", status: "done" },
    { content: "shadcn/ui 组件初始化，Button/Card/Dialog", column: "task", status: "done" },
    { content: "Zustand store 搭建，闪电输入状态管理", column: "task", status: "active" },
    { content: "今日聚焦页面，3 张卡片物理隔离", column: "task", status: "active" },
    { content: "决策看板拖拽，三列满额阻断逻辑", column: "task", status: "active" },
    { content: "灵感墓地复活监测定时任务", column: "task", status: "dropped" },
  ];

  const tasks = [];
  // 按列分组生成 position
  const columnCount: Record<string, number> = { northstar: 0, campaign: 0, task: 0 };
  for (let i = 0; i < taskTemplates.length; i++) {
    const t = taskTemplates[i];
    const position = columnCount[t.column]++;
    // 部分任务关联灵感
    const sourceId = i < ideas.length && ideas[i].status === "board" ? ideas[i].id : null;
    const task = await prisma.task.create({
      data: {
        content: t.content,
        column: t.column,
        position,
        status: t.status,
        sourceId,
        userId: adminUser.id,
        createdAt: daysAgo(Math.floor(i * 1.8)),
      },
    });
    tasks.push(task);
  }
  console.log(`  ✓ 生成 ${tasks.length} 个看板任务`);

  // ============ 3. Conversation（对话资产）5 条 ============
  const conversationData = [
    {
      source: "kimi",
      title: "设计灵感收敛系统的数据模型",
      rawContent: "【用户】: 帮我设计一个灵感收敛系统的数据模型\n【AI】: 建议采用三层数据模型：1. Idea表存储原始灵感 2. Task表存储看板任务 3. Memory表存储关联节点。关键约束：北极星≤3，战役≤5，任务≤10。",
      conclusions: ["采用三层数据模型：Idea/Task/Memory", "看板三列满额阻断：3/5/10"],
      todos: ["设计 Idea 表 schema", "实现 Task 满额阻断校验", "搭建 Memory 关联表"],
      prompts: ["设计{系统名}的数据模型，要求：1.列出核心表 2.说明关联方式 3.给出实现建议"],
      data: ["28轮对话", "三层数据模型", "满额阻断机制"],
    },
    {
      source: "claude",
      title: "LynnHub 三层架构讨论",
      rawContent: "【用户】: LynnHub 的三层架构怎么设计？\n【AI】: 捕获层(原始)→收敛层(结构化)→复利层(关联)。捕获层用闪电输入，收敛层用决策看板，复利层用记忆图谱。",
      conclusions: ["三层架构：捕获/收敛/复利", "收敛层用决策看板物理阻断"],
      todos: ["实现闪电输入浮窗", "搭建决策看板三列", "设计记忆图谱连边规则"],
      prompts: ["对比{方案A}和{方案B}，从开发成本/维护性/扩展性三维度评估"],
      data: ["三层架构", "物理阻断", "15轮对话"],
    },
    {
      source: "codex",
      title: "AI 工作流标准化方案",
      rawContent: "【用户】: 如何标准化 AI 工作流？\n【AI】: 1. 提示词模板化，用 {{param}} 占位 2. 对话资产结构化存储 3. 认知库自动提取方法论。",
      conclusions: ["提示词模板化是标准化的基础", "对话资产四要素：结论/待办/数据/提示词"],
      todos: ["设计提示词模板格式", "实现对话资产提取器", "搭建认知库分类体系"],
      prompts: ["把以下对话提取为：1.结论 2.待办 3.数据 4.可复用提示词，用JSON输出"],
      data: ["提示词模板", "四要素提取", "22轮对话"],
    },
    {
      source: "kimi",
      title: "向量检索实现方案对比",
      rawContent: "【用户】: 向量检索用 MySQL 还是专用向量库？\n【AI】: MVP 阶段用 MySQL 存 embedding 字节流，应用层计算相似度。数据量大后再迁移到 Milvus/Qdrant。",
      conclusions: ["MVP 用 MySQL 存 embedding", "数据量大后迁移到 Milvus"],
      todos: ["实现 embedding 存储为 LongBlob", "搭建应用层相似度计算", "预留向量库迁移接口"],
      prompts: ["分析以下灵感，提取：1.核心观点 2.可执行动作 3.关联标签"],
      data: ["MySQL LongBlob", "应用层相似度", "0.8 连边阈值"],
    },
    {
      source: "claude",
      title: "收敛仪式交互流程",
      rawContent: "【用户】: 收敛仪式怎么设计交互？\n【AI】: 每晚 23 点弹窗强制处理 inbox，每个灵感必须选择：看板/延后/墓地。用机制替代意志力。",
      conclusions: ["收敛仪式固定 23 点触发", "每个灵感必须三选一：看板/延后/墓地"],
      todos: ["实现定时器 23 点触发", "设计三选一交互弹窗", "记录墓地复活条件"],
      prompts: ["将以下内容归纳为方法论/经验/提示词三类，每类给出摘要"],
      data: ["机制替代意志力", "三选一收敛", "18轮对话"],
    },
  ];

  const conversations = [];
  for (let i = 0; i < conversationData.length; i++) {
    const c = conversationData[i];
    const conv = await prisma.conversation.create({
      data: {
        source: c.source,
        title: c.title,
        rawContent: c.rawContent,
        conclusions: c.conclusions,
        todos: c.todos,
        prompts: c.prompts,
        data: c.data,
        userId: adminUser.id,
        capturedAt: daysAgo(Math.floor(i * 3)),
      },
    });
    conversations.push(conv);
  }
  console.log(`  ✓ 生成 ${conversations.length} 条对话资产`);

  // ============ 4. Cognition（认知库）8 条 ============
  const cognitionData = [
    { type: "method", content: "三层数据模型法：捕获层(原始)→收敛层(结构化)→复利层(关联)，适用于所有个人知识管理系统", source: "conversation", tags: ["方法论", "架构"] },
    { type: "method", content: "满额阻断比提醒有效100倍，物理限制才能对抗注意力分散", source: "idea", tags: ["方法论", "机制"] },
    { type: "method", content: "向量相似度>0.8自动连边，低于阈值手动关联，平衡自动化和控制权", source: "conversation", tags: ["方法论", "向量"] },
    { type: "method", content: "收敛仪式用机制替代意志力，固定时间强制处理inbox", source: "conversation", tags: ["方法论", "习惯"] },
    { type: "experience", content: "个人工具优先选 MySQL 单库，零运维，后续再迁移", source: "manual", tags: ["经验", "技术选型"] },
    { type: "experience", content: "Next.js App Router 配合 shadcn/ui 开发效率最高", source: "manual", tags: ["经验", "前端"] },
    { type: "experience", content: "深色主题用 HSL 变量定义，方便统一调整色阶", source: "manual", tags: ["经验", "设计"] },
    { type: "prompt", content: "把以下对话提取为：1.结论 2.待办 3.数据 4.可复用提示词，用JSON输出", source: "conversation", tags: ["提示词", "提取"] },
  ];

  const cognitions = [];
  for (let i = 0; i < cognitionData.length; i++) {
    const c = cognitionData[i];
    // 部分认知关联灵感或对话
    const ideaId = c.source === "idea" && i < ideas.length ? ideas[i].id : null;
    const conversationId = c.source === "conversation" && i < conversations.length ? conversations[i % conversations.length].id : null;
    const cog = await prisma.cognition.create({
      data: {
        type: c.type,
        content: c.content,
        source: c.source,
        ideaId,
        conversationId,
        tags: c.tags,
        userId: adminUser.id,
        createdAt: daysAgo(Math.floor(i * 2)),
      },
    });
    cognitions.push(cog);
  }
  console.log(`  ✓ 生成 ${cognitions.length} 条认知`);

  // ============ 5. Memory（记忆节点）20 条 ============
  const memoryData = [
    { type: "idea", content: "用AI自动整理飞书任务优先级", strength: 0.95 },
    { type: "idea", content: "做一个记忆图谱可视化", strength: 0.88 },
    { type: "idea", content: "闪电输入支持语音转文字", strength: 0.72 },
    { type: "idea", content: "对话资产自动提取提示词模板", strength: 0.91 },
    { type: "idea", content: "灵感墓地复活监测机制", strength: 0.65 },
    { type: "idea", content: "今日聚焦卡片拖拽排序", strength: 0.55 },
    { type: "idea", content: "用嵌入向量做记忆图谱自动连边", strength: 0.93 },
    { type: "idea", content: "决策看板三列满额阻断", strength: 0.86 },
    { type: "conversation", content: "三层数据模型设计讨论", strength: 0.89 },
    { type: "conversation", content: "LynnHub 三层架构讨论", strength: 0.84 },
    { type: "conversation", content: "AI 工作流标准化方案", strength: 0.78 },
    { type: "conversation", content: "向量检索实现方案对比", strength: 0.81 },
    { type: "conversation", content: "收敛仪式交互流程", strength: 0.76 },
    { type: "conversation", content: "对话资产提取四要素", strength: 0.69 },
    { type: "conversation", content: "提示词模板化设计", strength: 0.73 },
    { type: "cognition", content: "三层数据模型方法论", strength: 0.92 },
    { type: "cognition", content: "满额阻断机制", strength: 0.87 },
    { type: "cognition", content: "向量相似度自动连边", strength: 0.85 },
    { type: "cognition", content: "收敛仪式机制替代意志力", strength: 0.79 },
    { type: "cognition", content: "对话资产提取提示词", strength: 0.82 },
  ];

  const memories = [];
  for (let i = 0; i < memoryData.length; i++) {
    const m = memoryData[i];
    // 关联对应的实体
    let ideaId: string | null = null;
    let conversationId: string | null = null;
    let cognitionId: string | null = null;
    let content = m.content;

    if (m.type === "idea" && i < ideas.length) {
      ideaId = ideas[i].id;
      content = ideas[i].content;
    } else if (m.type === "conversation") {
      const convIdx = i - 8; // 8 个 idea 之后是 conversation
      if (convIdx >= 0 && convIdx < conversations.length) {
        conversationId = conversations[convIdx].id;
        content = conversations[convIdx].title;
      }
    } else if (m.type === "cognition") {
      const cogIdx = i - 15; // 15 个之后是 cognition
      if (cogIdx >= 0 && cogIdx < cognitions.length) {
        cognitionId = cognitions[cogIdx].id;
        content = cognitions[cogIdx].content;
      }
    }

    const mem = await prisma.memory.create({
      data: {
        type: m.type,
        ideaId,
        conversationId,
        cognitionId,
        content,
        connections: [], // 先创建，后面再更新连接
        strength: m.strength,
        userId: adminUser.id,
        createdAt: daysAgo(Math.floor(i * 1.2)),
      },
    });
    memories.push(mem);
  }

  // 为记忆节点建立连接关系（指向同类型或其他类型的记忆）
  for (let i = 0; i < memories.length; i++) {
    const mem = memories[i];
    // 每个节点连接 1-4 个其他节点
    const connectionCount = Math.min(4, Math.max(1, Math.floor(memories.length / 5)));
    const connections: string[] = [];
    for (let j = 0; j < connectionCount; j++) {
      const targetIdx = (i + j + 1) % memories.length;
      if (targetIdx !== i) {
        connections.push(memories[targetIdx].id);
      }
    }
    await prisma.memory.update({
      where: { id: mem.id },
      data: { connections },
    });
  }
  console.log(`  ✓ 生成 ${memories.length} 条记忆节点`);

  // ============ 6. Graveyard（灵感墓地）3 条 ============
  const graveyardData = [
    {
      content: "做一个 AI 自动发推特的项目",
      reason: "当前 LynnHub 未上线，精力不应分散到新项目",
      reviveCondition: "当 LynnHub 用户数 > 100 或连续使用 30 天后",
    },
    {
      content: "开发一个独立的笔记 App",
      reason: "LynnHub 已覆盖笔记功能，重复造轮子",
      reviveCondition: "当 LynnHub 无法满足笔记需求且有具体痛点时",
    },
    {
      content: "做一个 AI 代码审查工具",
      reason: "偏离认知操作系统核心目标",
      reviveCondition: "当 LynnHub 稳定运行 3 个月且有余力时",
    },
  ];

  const graveyardItems = [];
  for (let i = 0; i < graveyardData.length; i++) {
    const g = graveyardData[i];
    const abandonedAt = daysAgo(20 - i * 3);
    // 创建对应的灵感（status=graveyard）
    const idea = await prisma.idea.create({
      data: {
        content: g.content,
        source: "lightning",
        status: "graveyard",
        tags: ["墓地"],
        userId: adminUser.id,
        createdAt: daysAgo(25 - i * 3),
      },
    });
    const grave = await prisma.graveyard.create({
      data: {
        originalIdeaId: idea.id,
        reason: g.reason,
        reviveCondition: g.reviveCondition,
        abandonedAt,
      },
    });
    graveyardItems.push(grave);
  }
  console.log(`  ✓ 生成 ${graveyardItems.length} 条灵感墓地`);

  // ============ 7. Skill（技能）10 条 + SkillVersion ============
  const skillData = [
    {
      name: "财务月报生成",
      description: "自动生成月度财务报告，包含收入/支出/利润分析和趋势图表",
      category: "finance",
      content: "## 财务月报生成\n\n### 步骤\n1. 收集当月收入数据\n2. 收集当月支出数据\n3. 计算利润和环比\n4. 生成趋势图表\n5. 输出 Markdown 报告\n\n### 注意事项\n- 数据精度保留两位小数\n- 同比环比都要计算",
      parameters: [{ name: "month", type: "string", required: true, description: "报告月份 YYYY-MM" }, { name: "currency", type: "string", required: false, description: "币种，默认 CNY" }],
      promptTemplate: "请根据以下数据生成{{month}}的财务月报：\n收入：{{income}}\n支出：{{expense}}\n要求：1. 计算利润 2. 同比环比 3. 输出 Markdown 表格",
      tags: ["财务", "月报", "自动化"],
    },
    {
      name: "项目周报生成",
      description: "汇总本周项目进展，自动生成结构化周报",
      category: "report",
      content: "## 项目周报生成\n\n### 输入\n- 本周完成的任务\n- 遇到的问题\n- 下周计划\n\n### 输出格式\n1. 本周进展\n2. 风险与问题\n3. 下周计划",
      parameters: [{ name: "project", type: "string", required: true, description: "项目名称" }, { name: "week", type: "string", required: true, description: "周次" }],
      promptTemplate: "请为项目{{project}}生成第{{week}}周周报，包含：本周进展、风险问题、下周计划。",
      tags: ["周报", "项目"],
    },
    {
      name: "代码审查助手",
      description: "对代码进行结构化审查，输出改进建议",
      category: "review",
      content: "## 代码审查\n\n### 审查维度\n1. 代码风格\n2. 性能问题\n3. 安全隐患\n4. 可维护性\n5. 测试覆盖\n\n### 输出\n按严重程度分级：critical/major/minor/suggestion",
      parameters: [{ name: "language", type: "string", required: true, description: "编程语言" }, { name: "code", type: "string", required: true, description: "待审查代码" }],
      promptTemplate: "请审查以下{{language}}代码，按 critical/major/minor/suggestion 分级输出问题：\n```\n{{code}}\n```",
      tags: ["代码", "审查"],
    },
    {
      name: "知识库问答",
      description: "基于知识库内容回答问题，支持上下文检索",
      category: "knowledge",
      content: "## 知识库问答\n\n### 流程\n1. 解析用户问题\n2. 检索知识库相关内容\n3. 综合上下文生成答案\n4. 标注引用来源\n\n### 优化\n- 相似度阈值 0.8\n- Top-K = 5",
      parameters: [{ name: "question", type: "string", required: true, description: "用户问题" }, { name: "topK", type: "number", required: false, description: "返回结果数，默认5" }],
      promptTemplate: "基于以下知识库内容回答问题：\n知识库：{{knowledge}}\n问题：{{question}}\n要求标注引用来源。",
      tags: ["知识库", "问答"],
    },
    {
      name: "会议纪要生成",
      description: "从会议录音/文字记录生成结构化纪要",
      category: "meeting",
      content: "## 会议纪要生成\n\n### 输出结构\n1. 会议基本信息（时间/参会人）\n2. 讨论议题\n3. 决议事项\n4. 待办任务（含负责人和截止时间）\n5. 下次会议安排",
      parameters: [{ name: "transcript", type: "string", required: true, description: "会议文字记录" }, { name: "meetingTitle", type: "string", required: false, description: "会议标题" }],
      promptTemplate: "请根据以下会议记录生成结构化纪要：\n{{transcript}}\n要求包含：议题、决议、待办（含负责人和截止时间）。",
      tags: ["会议", "纪要"],
    },
    {
      name: "产品需求文档生成",
      description: "根据需求描述生成 PRD 文档",
      category: "product",
      content: "## PRD 生成\n\n### 文档结构\n1. 背景与目标\n2. 用户故事\n3. 功能需求\n4. 非功能需求\n5. 交互流程\n6. 数据指标\n7. 排期建议",
      parameters: [{ name: "feature", type: "string", required: true, description: "功能描述" }, { name: "audience", type: "string", required: false, description: "目标用户" }],
      promptTemplate: "请为以下功能生成 PRD：\n功能：{{feature}}\n目标用户：{{audience}}\n包含背景、用户故事、功能需求、数据指标。",
      tags: ["产品", "PRD"],
    },
    {
      name: "自定义工作流",
      description: "通用自定义工作流模板，可灵活配置",
      category: "custom",
      content: "## 自定义工作流\n\n### 配置项\n- 输入参数\n- 处理步骤\n- 输出格式\n\n### 使用场景\n- 数据清洗\n- 批量处理\n- 格式转换",
      parameters: [{ name: "input", type: "string", required: true, description: "输入内容" }, { name: "steps", type: "array", required: false, description: "处理步骤" }],
      promptTemplate: "请按照以下步骤处理输入：\n步骤：{{steps}}\n输入：{{input}}",
      tags: ["通用", "工作流"],
    },
    {
      name: "季度财务总结",
      description: "生成季度财务总结报告，含同比环比分析",
      category: "finance",
      content: "## 季度财务总结\n\n### 内容\n1. 季度收入汇总\n2. 季度支出汇总\n3. 利润分析\n4. 同比环比\n5. 趋势预测",
      parameters: [{ name: "quarter", type: "string", required: true, description: "季度 YYYY-Qn" }],
      promptTemplate: "请生成{{quarter}}季度财务总结，包含收入、支出、利润、同比环比分析。",
      tags: ["财务", "季度"],
    },
    {
      name: "代码重构建议",
      description: "分析代码并提供重构建议",
      category: "review",
      content: "## 代码重构\n\n### 审查点\n1. 重复代码\n2. 过长函数\n3. 过深嵌套\n4. 命名规范\n5. 设计模式应用\n\n### 输出\n- 问题列表\n- 重构建议\n- 示例代码",
      parameters: [{ name: "code", type: "string", required: true, description: "待重构代码" }],
      promptTemplate: "请分析以下代码并提供重构建议：\n```\n{{code}}\n```\n输出：问题列表、重构建议、示例代码。",
      tags: ["重构", "代码"],
    },
    {
      name: "技术文档生成",
      description: "根据代码或接口生成技术文档",
      category: "knowledge",
      content: "## 技术文档生成\n\n### 文档类型\n1. API 文档\n2. 架构文档\n3. 使用说明\n4. 部署文档\n\n### 输出格式\nMarkdown，含代码示例和表格",
      parameters: [{ name: "type", type: "string", required: true, description: "文档类型" }, { name: "source", type: "string", required: true, description: "源代码或接口" }],
      promptTemplate: "请根据以下内容生成{{type}}文档：\n{{source}}\n要求：含代码示例、参数表格、使用说明。",
      tags: ["文档", "技术"],
    },
  ];

  const skills = [];
  for (let i = 0; i < skillData.length; i++) {
    const s = skillData[i];
    const createdAt = daysAgo(28 - i * 2);
    const skill = await prisma.skill.create({
      data: {
        name: s.name,
        description: s.description,
        category: s.category,
        content: s.content,
        parameters: s.parameters as Prisma.InputJsonValue,
        promptTemplate: s.promptTemplate,
        source: i % 3 === 0 ? "ai-generated" : i % 3 === 1 ? "manual" : "imported",
        tags: s.tags,
        usageCount: Math.floor(Math.random() * 50),
        userId: adminUser.id,
        createdAt,
        updatedAt: daysAgo(Math.max(0, 28 - i * 2 - 5)),
      },
    });

    // 为每个 Skill 创建 2-3 个 SkillVersion
    const versionCount = 2 + (i % 2); // 2 或 3 个版本
    for (let v = 1; v <= versionCount; v++) {
      await prisma.skillVersion.create({
        data: {
          skillId: skill.id,
          version: v,
          name: v === 1 ? s.name : `${s.name} v${v}`,
          description: v === versionCount ? s.description : `${s.description}（历史版本 ${v}）`,
          category: s.category,
          content: v === versionCount ? s.content : `${s.content}\n\n<!-- 历史版本 ${v} -->`,
          parameters: s.parameters as Prisma.InputJsonValue,
          promptTemplate: s.promptTemplate,
          tags: s.tags as Prisma.InputJsonValue,
          createdAt: daysAgo(28 - i * 2 - (versionCount - v) * 3),
        },
      });
    }
    skills.push(skill);
  }
  console.log(`  ✓ 生成 ${skills.length} 个技能（含版本历史）`);

  // ============ 8. SkillReview（技能评论）20 条 ============
  const reviewComments = [
    "非常实用，节省了我大量时间",
    "提示词设计得很好，输出质量高",
    "参数配置灵活，适配多种场景",
    "效果一般，还需要优化",
    "模板很完整，开箱即用",
    "生成的报告结构清晰",
    "响应速度有点慢，但结果不错",
    "对中文支持很好",
    "缺少一些边界情况处理",
    "整体满意，推荐使用",
    "帮助我规范了工作流",
    "文档很详细，上手快",
    "部分功能可以再完善",
    "性价比很高",
    "稳定可靠，已纳入日常工具",
    "界面友好，操作简单",
    "输出格式标准化做得好",
    "希望能增加更多模板",
    "准确度满足业务需求",
    "体验流畅，无明显bug",
  ];

  const authors = ["Lynn", "张三", "李四", "王五", "赵六", "匿名用户", "钱七", "孙八"];
  for (let i = 0; i < 20; i++) {
    const skill = skills[i % skills.length];
    const rating = ((i % 5) + 1); // 1-5 循环
    await prisma.skillReview.create({
      data: {
        skillId: skill.id,
        rating,
        comment: reviewComments[i],
        author: authors[i % authors.length],
        userId: adminUser.id,
        createdAt: daysAgo(Math.floor(i * 1.3)),
      },
    });
  }
  console.log(`  ✓ 生成 20 条技能评论`);

  // ============ 9. LarkTask（飞书任务）15 条 ============
  const larkTaskData = [
    {
      guid: "lark-task-001",
      summary: "完成 LynnHub 闪电输入浮窗开发",
      description: "实现全局快捷键唤起浮窗，3秒完成灵感捕获",
      completed: false,
      dueAt: daysAhead(2),
      priority: 2,
      assignees: [{ open_id: "ou_lyn", name: "Lynn" }],
      followers: [{ open_id: "ou_zhang", name: "张三" }],
    },
    {
      guid: "lark-task-002",
      summary: "设计决策看板三列满额阻断逻辑",
      description: "北极星≤3，战役≤5，任务≤10，满额时禁用新增按钮",
      completed: true,
      dueAt: daysAgo(5),
      priority: 1,
      assignees: [{ open_id: "ou_lyn", name: "Lynn" }],
      followers: [{ open_id: "ou_li", name: "李四" }],
    },
    {
      guid: "lark-task-003",
      summary: "对接 Kimi 对话资产抓取",
      description: "通过 Webhook 自动捕获 Kimi 长对话，提取结论和待办",
      completed: false,
      dueAt: daysAhead(5),
      priority: 2,
      assignees: [{ open_id: "ou_wang", name: "王五" }],
      followers: [{ open_id: "ou_lyn", name: "Lynn" }, { open_id: "ou_zhao", name: "赵六" }],
    },
    {
      guid: "lark-task-004",
      summary: "实现记忆图谱 D3 力导向图可视化",
      description: "节点表示记忆，边表示关联，相似度>0.8自动连边",
      completed: false,
      dueAt: daysAhead(7),
      priority: 1,
      assignees: [{ open_id: "ou_lyn", name: "Lynn" }],
      followers: [],
    },
    {
      guid: "lark-task-005",
      summary: "配置 Tailwind 深色主题",
      description: "用 HSL 变量定义色阶，支持明暗切换",
      completed: true,
      dueAt: daysAgo(10),
      priority: 0,
      assignees: [{ open_id: "ou_lyn", name: "Lynn" }],
      followers: [],
    },
    {
      guid: "lark-task-006",
      summary: "Prisma + MySQL schema 设计",
      description: "设计 Idea/Task/Memory/Conversation 等核心表",
      completed: true,
      dueAt: daysAgo(12),
      priority: 1,
      assignees: [{ open_id: "ou_lyn", name: "Lynn" }],
      followers: [{ open_id: "ou_wang", name: "王五" }],
    },
    {
      guid: "lark-task-007",
      summary: "收敛仪式定时器开发",
      description: "每晚 23 点弹窗强制处理 inbox，三选一：看板/延后/墓地",
      completed: false,
      dueAt: daysAhead(3),
      priority: 2,
      assignees: [{ open_id: "ou_zhang", name: "张三" }],
      followers: [{ open_id: "ou_lyn", name: "Lynn" }],
    },
    {
      guid: "lark-task-008",
      summary: "灵感墓地复活监测",
      description: "每周扫描墓地，满足复活条件自动归档到 inbox",
      completed: false,
      dueAt: daysAhead(10),
      priority: 0,
      assignees: [{ open_id: "ou_lyn", name: "Lynn" }],
      followers: [],
    },
    {
      guid: "lark-task-009",
      summary: "认知库自动提取方法论",
      description: "从对话资产中提取方法论/经验/提示词三类认知",
      completed: false,
      dueAt: daysAhead(8),
      priority: 1,
      assignees: [{ open_id: "ou_li", name: "李四" }],
      followers: [{ open_id: "ou_lyn", name: "Lynn" }],
    },
    {
      guid: "lark-task-010",
      summary: "shadcn/ui 组件初始化",
      description: "引入 Button/Card/Dialog/Toast 等基础组件",
      completed: true,
      dueAt: daysAgo(15),
      priority: 0,
      assignees: [{ open_id: "ou_lyn", name: "Lynn" }],
      followers: [],
    },
    {
      guid: "lark-task-011",
      summary: "Zustand store 搭建",
      description: "闪电输入状态管理，看板拖拽状态",
      completed: false,
      dueAt: daysAhead(1),
      priority: 2,
      assignees: [{ open_id: "ou_lyn", name: "Lynn" }],
      followers: [{ open_id: "ou_wang", name: "王五" }],
    },
    {
      guid: "lark-task-012",
      summary: "今日聚焦页面开发",
      description: "3 张卡片物理隔离，拖拽排序",
      completed: false,
      dueAt: daysAhead(4),
      priority: 1,
      assignees: [{ open_id: "ou_zhao", name: "赵六" }],
      followers: [{ open_id: "ou_lyn", name: "Lynn" }],
    },
    {
      guid: "lark-task-013",
      summary: "对话资产列表页开发",
      description: "展示 Kimi/Claude/Codex 对话，支持筛选和详情",
      completed: true,
      dueAt: daysAgo(8),
      priority: 1,
      assignees: [{ open_id: "ou_lyn", name: "Lynn" }],
      followers: [],
    },
    {
      guid: "lark-task-014",
      summary: "向量检索方案调研",
      description: "对比 MySQL 存 embedding 和专用向量库的方案",
      completed: true,
      dueAt: daysAgo(6),
      priority: 0,
      assignees: [{ open_id: "ou_wang", name: "王五" }],
      followers: [{ open_id: "ou_lyn", name: "Lynn" }],
    },
    {
      guid: "lark-task-015",
      summary: "快捷键注册与冲突检测",
      description: "Ctrl+Space 全局唤起闪电输入，检测冲突",
      completed: false,
      dueAt: daysAhead(6),
      priority: 2,
      assignees: [{ open_id: "ou_lyn", name: "Lynn" }],
      followers: [{ open_id: "ou_zhang", name: "张三" }, { open_id: "ou_li", name: "李四" }],
    },
  ];

  for (let i = 0; i < larkTaskData.length; i++) {
    const t = larkTaskData[i];
    const createdAt = daysAgo(25 - i);
    const completedAt = t.completed ? daysAgo(Math.max(0, 20 - i)) : null;
    await prisma.larkTask.create({
      data: {
        guid: t.guid,
        summary: t.summary,
        description: t.description,
        createdAt,
        updatedAt: t.completed ? completedAt : daysAgo(Math.max(0, 5 - (i % 5))),
        dueAt: t.dueAt,
        dueIsAllDay: false,
        startAt: daysAgo(Math.max(0, 20 - i)),
        startIsAllDay: false,
        url: `https://feishu.cn/tasks/${t.guid}`,
        completed: t.completed,
        completedAt,
        status: t.completed ? "completed" : "incomplete",
        priority: t.priority,
        assignees: t.assignees as Prisma.InputJsonValue,
        collaborators: [] as Prisma.InputJsonValue,
        followers: t.followers as Prisma.InputJsonValue,
        creator: { open_id: "ou_lyn", name: "Lynn" } as Prisma.InputJsonValue,
        tasklist: { guid: "tl-001", name: "LynnHub 开发" } as Prisma.InputJsonValue,
        members: t.assignees as Prisma.InputJsonValue,
        repeatRule: "",
        location: Prisma.JsonNull,
        origin: Prisma.JsonNull,
        shortcuts: [] as Prisma.InputJsonValue,
        reminders: [{ type: 0, time: "1h" }] as Prisma.InputJsonValue,
        attachments: [] as Prisma.InputJsonValue,
        customCompleteRule: "",
        customCompleted: t.completed,
        originPlugin: Prisma.JsonNull,
        commentCount: Math.floor(Math.random() * 5),
        followerCount: t.followers.length,
        subtaskCount: Math.floor(Math.random() * 3),
        syncedAt: new Date(),
      },
    });
  }
  console.log(`  ✓ 生成 ${larkTaskData.length} 条飞书任务`);

  // ============ 10. DailyFocus（今日聚焦）关联 3-5 个 Task ============
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const activeTasks = tasks.filter((t) => t.status === "active");
  const focusTaskCount = Math.min(5, Math.max(3, activeTasks.length));
  const focusTasks = activeTasks.slice(0, focusTaskCount);

  if (focusTasks.length > 0) {
    const dailyFocus = await prisma.dailyFocus.create({
      data: {
        date: today,
        cardIds: focusTasks.map((t) => t.id),
        generatedAt: new Date(),
        status: "pending",
        userId: adminUser.id,
      },
    });
    await Promise.all(
      focusTasks.map((task, i) =>
        prisma.dailyFocusItem.create({
          data: {
            dailyFocusId: dailyFocus.id,
            taskId: task.id,
            position: i,
            completed: false,
          },
        })
      )
    );
    console.log(`  ✓ 生成今日聚焦 ${focusTasks.length} 张卡片`);
  }

  console.log("✅ Seed 完成！");
  console.log(`  - Idea: ${ideas.length}`);
  console.log(`  - Task: ${tasks.length}`);
  console.log(`  - Conversation: ${conversations.length}`);
  console.log(`  - Memory: ${memories.length}`);
  console.log(`  - Cognition: ${cognitions.length}`);
  console.log(`  - Graveyard: ${graveyardItems.length}`);
  console.log(`  - Skill: ${skills.length}`);
  console.log(`  - SkillReview: 20`);
  console.log(`  - LarkTask: ${larkTaskData.length}`);
  console.log(`  - DailyFocus: 1`);
}

main()
  .catch((e) => {
    console.error("❌ Seed 失败:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

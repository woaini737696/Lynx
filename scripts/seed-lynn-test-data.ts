/**
 * Lynn 账号测试数据生成脚本
 *
 * 用途：为 lynn 账号生成一批完整的测试数据，覆盖所有核心功能模块，
 *       方便验证功能正常运行。
 *
 * 覆盖模块：
 *   - 灵感（inbox/board/graveyard 三种状态）
 *   - 决策看板任务（northstar/campaign/task 三列）
 *   - 对话资产（kimi/claude 两个来源）
 *   - 认知库（method/experience/prompt 三类）
 *   - 记忆节点（关联灵感/对话/认知）
 *   - AI 对话会话 + 消息
 *   - 技能（多个分类）
 *   - AI 工作流
 *   - 钱包（Credits + S币）
 *   - 会员（PRO 档位）
 *   - 订阅订单
 *
 * 幂等性：所有测试数据 content/title 以 "[测试]" 前缀标记，
 *         重复运行时先清理旧测试数据再创建新数据。
 *
 * 运行方式：npx tsx scripts/seed-lynn-test-data.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const TAG = "[测试]";

async function main() {
  console.log("🌱 开始为 lynn 账号生成测试数据...\n");

  // 1. 查找 lynn 用户
  const lynn = await prisma.user.findFirst({
    where: { username: "lynn" },
    select: { id: true, username: true, displayName: true, role: true },
  });

  if (!lynn) {
    console.error("❌ 未找到 lynn 用户，请先创建 lynn 账号");
    process.exit(1);
  }

  console.log(`✓ 找到用户: ${lynn.username} (${lynn.displayName}), id=${lynn.id}, role=${lynn.role}\n`);

  const userId = lynn.id;

  // 2. 清理旧测试数据（幂等）
  console.log("🧹 清理旧测试数据...");
  await cleanOldTestData(userId);
  console.log("✓ 旧测试数据清理完成\n");

  // 3. 创建测试数据
  console.log("📦 创建新测试数据...");

  // ===== 3.1 灵感（inbox 5 条 + board 3 条 + graveyard 2 条）=====
  const ideas = await Promise.all([
    prisma.idea.create({ data: { content: `${TAG}用 AI 自动生成每日工作汇报，提取飞书任务和对话资产`, source: "lightning", status: "inbox", userId, tags: JSON.stringify(["AI", "自动化"]) } }),
    prisma.idea.create({ data: { content: `${TAG}记忆图谱支持时间轴视图，展示认知演进历程`, source: "lightning", status: "inbox", userId, tags: JSON.stringify(["可视化", "记忆"]) } }),
    prisma.idea.create({ data: { content: `${TAG}闪电输入支持图片粘贴，OCR 自动提取文字`, source: "lightning", status: "inbox", userId, tags: JSON.stringify(["闪电输入", "OCR"]) } }),
    prisma.idea.create({ data: { content: `${TAG}技能广场增加评分排序和下载量排行榜`, source: "lightning", status: "inbox", userId, tags: JSON.stringify(["技能", "广场"]) } }),
    prisma.idea.create({ data: { content: `${TAG}Lynx Agent 支持语音指令，解放双手`, source: "lightning", status: "inbox", userId, tags: JSON.stringify(["Agent", "语音"]) } }),
    prisma.idea.create({ data: { content: `${TAG}决策看板增加燃尽图，可视化任务完成进度`, source: "lightning", status: "board", userId, tags: JSON.stringify(["看板", "可视化"]) } }),
    prisma.idea.create({ data: { content: `${TAG}对话资产支持飞书文档自动抓取`, source: "lightning", status: "board", userId, tags: JSON.stringify(["对话资产", "飞书"]) } }),
    prisma.idea.create({ data: { content: `${TAG}认知库增加关联推荐，自动发现相关认知`, source: "lightning", status: "board", userId, tags: JSON.stringify(["认知", "推荐"]) } }),
    prisma.idea.create({ data: { content: `${TAG}做一个独立的待办 App（偏离核心目标）`, source: "lightning", status: "graveyard", userId, tags: JSON.stringify(["废弃"]) } }),
    prisma.idea.create({ data: { content: `${TAG}开发一个 AI 发推特机器人（精力分散）`, source: "lightning", status: "graveyard", userId, tags: JSON.stringify(["废弃"]) } }),
  ]);
  console.log(`  ✓ 灵感 ${ideas.length} 条（inbox 5 + board 3 + graveyard 2）`);

  // graveyard 灵感添加墓地记录
  await prisma.graveyard.create({ data: { originalIdeaId: ideas[8].id, reason: `${TAG}偏离认知操作系统核心目标`, reviveCondition: "当主产品上线并稳定运行后可重新评估" } });
  await prisma.graveyard.create({ data: { originalIdeaId: ideas[9].id, reason: `${TAG}精力不应分散到社交媒体自动化`, reviveCondition: "当团队规模扩大到 5 人以上时可考虑" } });
  console.log(`  ✓ 灵感墓地 2 条`);

  // ===== 3.2 决策看板任务（northstar 2 + campaign 3 + task 5）=====
  const tasks = await Promise.all([
    prisma.task.create({ data: { content: `${TAG}Lynx AI 工作站 MVP 上线并稳定运行`, column: "northstar", position: 0, status: "active", userId } }),
    prisma.task.create({ data: { content: `${TAG}个人认知操作系统成型，三层数据模型跑通`, column: "northstar", position: 1, status: "active", userId } }),
    prisma.task.create({ data: { content: `${TAG}AI 工作流标准化，提示词复用率达 80%`, column: "campaign", position: 0, status: "active", userId } }),
    prisma.task.create({ data: { content: `${TAG}多端协同（Web+桌面+安卓）远程操控打通`, column: "campaign", position: 1, status: "active", userId } }),
    prisma.task.create({ data: { content: `${TAG}货币体系与会员机制上线商业化`, column: "campaign", position: 2, status: "active", userId } }),
    prisma.task.create({ data: { content: `${TAG}修复 Logo 加载问题`, column: "task", position: 0, status: "active", userId } }),
    prisma.task.create({ data: { content: `${TAG}优化登录弹窗未登录状态体验`, column: "task", position: 1, status: "active", userId } }),
    prisma.task.create({ data: { content: `${TAG}AI 模型编辑弹窗 createPortal 修复`, column: "task", position: 2, status: "done", userId } }),
    prisma.task.create({ data: { content: `${TAG}Lynx Agent pip 安装镜像源修复`, column: "task", position: 3, status: "done", userId } }),
    prisma.task.create({ data: { content: `${TAG}性能监控页液态玻璃样式优化`, column: "task", position: 4, status: "done", userId } }),
  ]);
  console.log(`  ✓ 任务 ${tasks.length} 条（northstar 2 + campaign 3 + task 5，含 3 已完成）`);

  // ===== 3.3 对话资产（2 条）=====
  const conversations = await Promise.all([
    prisma.conversation.create({
      data: {
        source: "kimi",
        title: `${TAG}LynnHub 三层架构设计讨论`,
        rawContent: "讨论了 LynnHub 的三层数据模型：捕获层(灵感/对话)→收敛层(看板/认知)→复利层(记忆图谱)。每层有明确的数据流转规则...",
        conclusions: JSON.stringify(["三层数据模型：捕获→收敛→复利", "每层有明确流转规则", "记忆图谱做语义关联"]),
        todos: JSON.stringify(["设计数据模型 ER 图", "实现层间流转逻辑", "搭建记忆图谱可视化"]),
        prompts: JSON.stringify(["把以下对话提取为：1.结论 2.待办 3.数据 4.可复用提示词"]),
        data: JSON.stringify([]),
        userId,
      },
    }),
    prisma.conversation.create({
      data: {
        source: "claude",
        title: `${TAG}AI 工作流标准化方案`,
        rawContent: "讨论了 AI 工作流的标准化设计：节点类型、参数传递、错误处理、执行历史...",
        conclusions: JSON.stringify(["工作流由节点和边组成", "支持条件分支和循环", "执行历史可追溯"]),
        todos: JSON.stringify(["定义节点 JSON Schema", "实现可视化编辑器", "添加执行历史记录"]),
        prompts: JSON.stringify(["将工作流节点提取为可复用技能"]),
        data: JSON.stringify([]),
        userId,
      },
    }),
  ]);
  console.log(`  ✓ 对话资产 ${conversations.length} 条`);

  // ===== 3.4 认知库（3 条：method/experience/prompt）=====
  const cognitions = await Promise.all([
    prisma.cognition.create({
      data: {
        type: "method",
        content: `${TAG}三层数据模型法：捕获层(原始)→收敛层(结构化)→复利层(关联)，适用于所有个人知识管理系统`,
        source: "conversation",
        conversationId: conversations[0].id,
        tags: JSON.stringify(["方法论", "知识管理"]),
        userId,
      },
    }),
    prisma.cognition.create({
      data: {
        type: "experience",
        content: `${TAG}满额阻断比提醒有效 100 倍，物理限制才能对抗注意力分散。看板三列满额后强制处理或归档`,
        source: "idea",
        ideaId: ideas[5].id,
        tags: JSON.stringify(["经验", "注意力管理"]),
        userId,
      },
    }),
    prisma.cognition.create({
      data: {
        type: "prompt",
        content: `${TAG}把以下对话提取为：1.结论 2.待办 3.数据 4.可复用提示词，用 JSON 输出`,
        source: "manual",
        tags: JSON.stringify(["提示词", "对话提取"]),
        userId,
      },
    }),
  ]);
  console.log(`  ✓ 认知库 ${cognitions.length} 条（method/experience/prompt 各 1）`);

  // ===== 3.5 记忆节点（4 条，关联灵感/对话/认知）=====
  const memories = await Promise.all([
    prisma.memory.create({ data: { type: "idea", ideaId: ideas[0].id, content: `${TAG}AI 自动生成每日工作汇报`, userId, strength: 0.9 } }),
    prisma.memory.create({ data: { type: "conversation", conversationId: conversations[0].id, content: `${TAG}三层数据模型设计讨论`, userId, strength: 0.85 } }),
    prisma.memory.create({ data: { type: "cognition", cognitionId: cognitions[0].id, content: `${TAG}三层数据模型方法论`, userId, strength: 0.95 } }),
    prisma.memory.create({ data: { type: "cognition", cognitionId: cognitions[1].id, content: `${TAG}满额阻断机制经验`, userId, strength: 0.8 } }),
  ]);
  // 连接记忆节点
  await prisma.memory.update({ where: { id: memories[2].id }, data: { connections: JSON.stringify([memories[0].id, memories[1].id, memories[3].id]) } });
  await prisma.memory.update({ where: { id: memories[3].id }, data: { connections: JSON.stringify([memories[2].id]) } });
  console.log(`  ✓ 记忆节点 ${memories.length} 条（含自动连边）`);

  // ===== 3.6 AI 对话会话 + 消息（2 个会话）=====
  const session1 = await prisma.chatSession.create({
    data: { title: `${TAG} Lynx 超级助理对话`, provider: "deepseek", model: "deepseek-chat", userId },
  });
  await prisma.chatMessage.createMany({
    data: [
      { sessionId: session1.id, role: "user", content: "你好，帮我总结一下今天的工作", provider: "deepseek", model: "deepseek-chat" },
      { sessionId: session1.id, role: "assistant", content: "你好！根据你的任务记录，今天你完成了 3 项任务：\n1. AI 模型编辑弹窗修复\n2. Lynx Agent pip 安装修复\n3. 性能监控页样式优化\n\n当前进行中的任务有 5 项，建议优先处理 Logo 加载问题。", provider: "deepseek", model: "deepseek-chat", tokens: 120 },
      { sessionId: session1.id, role: "user", content: "帮我创建一个灵感：用 AI 自动生成周报", provider: "deepseek", model: "deepseek-chat" },
      { sessionId: session1.id, role: "assistant", content: "已为你创建灵感「用 AI 自动生成周报」，已放入收件箱。你可以稍后将其移到看板进行跟踪。", provider: "deepseek", model: "deepseek-chat", tokens: 80 },
    ],
  });

  const session2 = await prisma.chatSession.create({
    data: { title: `${TAG} 认知库查询`, provider: "deepseek", model: "deepseek-chat", pinned: true, userId },
  });
  await prisma.chatMessage.createMany({
    data: [
      { sessionId: session2.id, role: "user", content: "我的认知库里有哪些方法论？", provider: "deepseek", model: "deepseek-chat" },
      { sessionId: session2.id, role: "assistant", content: "你的认知库中有 1 条方法论：\n\n**三层数据模型法**\n捕获层(原始)→收敛层(结构化)→复利层(关联)，适用于所有个人知识管理系统。\n\n这条认知关联了 1 条灵感和 1 个对话资产。", provider: "deepseek", model: "deepseek-chat", tokens: 95 },
    ],
  });
  console.log(`  ✓ AI 对话会话 2 个（含 6 条消息）`);

  // ===== 3.7 技能（4 个，不同分类）=====
  const skills = await Promise.all([
    prisma.skill.create({
      data: {
        name: `${TAG}周报自动生成`,
        description: "根据本周任务和对话资产，自动生成工作周报",
        category: "report",
        content: "## 周报自动生成\n\n1. 提取本周完成的任务\n2. 汇总对话资产中的结论\n3. 按项目分类整理\n4. 生成本周总结和下周计划",
        parameters: JSON.stringify([{ key: "week", label: "周次", type: "date", required: true }]),
        promptTemplate: "请根据以下任务和对话数据，生成本周工作周报：\n任务：{{tasks}}\n对话：{{conversations}}",
        source: "manual",
        tags: JSON.stringify(["周报", "自动化"]),
        usageCount: 12,
        userId,
        isPublic: true,
        publicId: "test-weekly-report-001",
        publishedAt: new Date(),
        ratingAvg: 4.5,
      },
    }),
    prisma.skill.create({
      data: {
        name: `${TAG}代码审查助手`,
        description: "AI 辅助代码审查，发现潜在问题",
        category: "review",
        content: "## 代码审查助手\n\n1. 解析代码结构\n2. 检查常见问题\n3. 安全漏洞扫描\n4. 性能优化建议",
        parameters: JSON.stringify([{ key: "code", label: "代码", type: "textarea", required: true }]),
        promptTemplate: "请审查以下代码，指出潜在问题、安全漏洞和优化建议：\n```\n{{code}}\n```",
        source: "manual",
        tags: JSON.stringify(["代码审查", "安全"]),
        usageCount: 8,
        userId,
      },
    }),
    prisma.skill.create({
      data: {
        name: `${TAG}会议纪要生成`,
        description: "从会议录音/文字生成结构化纪要",
        category: "meeting",
        content: "## 会议纪要生成\n\n1. 提取发言要点\n2. 识别决议事项\n3. 整理待办任务\n4. 生成纪要文档",
        parameters: JSON.stringify([{ key: "transcript", label: "会议文字", type: "textarea", required: true }]),
        promptTemplate: "请根据以下会议记录生成结构化纪要：\n{{transcript}}",
        source: "manual",
        tags: JSON.stringify(["会议", "纪要"]),
        usageCount: 5,
        userId,
      },
    }),
    prisma.skill.create({
      data: {
        name: `${TAG}产品需求文档生成`,
        description: "根据需求描述生成 PRD 文档",
        category: "product",
        content: "## PRD 生成\n\n1. 需求背景\n2. 用户故事\n3. 功能列表\n4. 交互流程\n5. 数据指标",
        parameters: JSON.stringify([{ key: "idea", label: "需求描述", type: "textarea", required: true }]),
        promptTemplate: "请根据以下需求描述生成 PRD 文档：\n{{idea}}",
        source: "manual",
        tags: JSON.stringify(["PRD", "产品"]),
        usageCount: 3,
        userId,
      },
    }),
  ]);
  console.log(`  ✓ 技能 ${skills.length} 个（report/review/meeting/product 分类）`);

  // ===== 3.8 AI 工作流（2 个）=====
  const flows = await Promise.all([
    prisma.flow.create({
      data: {
        name: `${TAG}每日工作汇报流程`,
        description: "自动提取当日任务和对话，生成工作日报",
        nodes: JSON.stringify([
          { id: "n1", type: "trigger", data: { label: "每日 18:00 触发" } },
          { id: "n2", type: "action", data: { label: "提取今日任务" } },
          { id: "n3", type: "action", data: { label: "提取对话资产" } },
          { id: "n4", type: "ai", data: { label: "AI 生成日报" } },
          { id: "n5", type: "output", data: { label: "保存到认知库" } },
        ]),
        edges: JSON.stringify([
          { from: "n1", to: "n2" },
          { from: "n2", to: "n3" },
          { from: "n3", to: "n4" },
          { from: "n4", to: "n5" },
        ]),
        enabled: true,
        userId,
      },
    }),
    prisma.flow.create({
      data: {
        name: `${TAG}灵感自动收敛流程`,
        description: "每周扫描 inbox 灵感，AI 分类后移入看板或墓地",
        nodes: JSON.stringify([
          { id: "n1", type: "trigger", data: { label: "每周日 22:00 触发" } },
          { id: "n2", type: "action", data: { label: "扫描 inbox 灵感" } },
          { id: "n3", type: "ai", data: { label: "AI 分类评估" } },
          { id: "n4", type: "condition", data: { label: "有价值?" } },
          { id: "n5", type: "action", data: { label: "移入看板" } },
          { id: "n6", type: "action", data: { label: "移入墓地" } },
        ]),
        edges: JSON.stringify([
          { from: "n1", to: "n2" },
          { from: "n2", to: "n3" },
          { from: "n3", to: "n4" },
          { from: "n4", to: "n5", label: "是" },
          { from: "n4", to: "n6", label: "否" },
        ]),
        enabled: false,
        userId,
      },
    }),
  ]);
  console.log(`  ✓ AI 工作流 ${flows.length} 个`);

  // ===== 3.9 钱包（Credits + S币）=====
  const wallet = await prisma.userWallet.upsert({
    where: { userId },
    update: {
      credits: BigInt(3000000000), // 30 亿 Credits
      sCoins: 300,
      totalCreditsEarned: BigInt(3000000000),
      totalSCoinsEarned: 300,
    },
    create: {
      userId,
      credits: BigInt(3000000000),
      sCoins: 300,
      totalCreditsEarned: BigInt(3000000000),
      totalSCoinsEarned: 300,
    },
  });
  console.log(`  ✓ 钱包：Credits ${wallet.credits.toString()} + S币 ${wallet.sCoins}`);

  // Credits 交易流水
  await prisma.creditTransaction.createMany({
    data: [
      { userId, type: "earn", amount: BigInt(3000000000), balanceAfter: BigInt(3000000000), reason: "membership_gift", description: `${TAG} PRO 会员赠送 Credits` },
      { userId, type: "spend", amount: BigInt(150), balanceAfter: BigInt(2999999850), reason: "ai_chat", description: `${TAG} AI 对话消耗`, metadata: JSON.stringify({ model: "deepseek-chat", inputTokens: 200, outputTokens: 120 }) },
    ],
  });
  // S币交易流水
  await prisma.sCoinTransaction.createMany({
    data: [
      { userId, type: "earn", amount: 300, balanceAfter: 300, reason: "membership_gift", description: `${TAG} PRO 会员赠送 S币` },
      { userId, type: "spend", amount: 50, balanceAfter: 250, reason: "buy_skill", description: `${TAG} 购买技能「高级数据分析」` },
    ],
  });
  console.log(`  ✓ 交易流水：Credits 2 条 + S币 2 条`);

  // ===== 3.10 会员（PRO 档位）=====
  await prisma.membership.upsert({
    where: { userId },
    update: {
      tier: "PRO",
      status: "ACTIVE",
      startedAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 天后到期
      autoRenew: true,
      billingCycle: "monthly",
      pricePaid: 99,
    },
    create: {
      userId,
      tier: "PRO",
      status: "ACTIVE",
      startedAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      autoRenew: true,
      billingCycle: "monthly",
      pricePaid: 99,
    },
  });
  console.log(`  ✓ 会员：PRO 档位（30 天有效）`);

  // 订阅订单
  await prisma.subscriptionOrder.create({
    data: {
      userId,
      tier: "PRO",
      cycle: "monthly",
      amount: 99,
      sCoinOffset: 0,
      sCoinUsed: 0,
      actualAmount: 99,
      status: "paid",
      paymentMethod: "manual",
      tradeNo: `${TAG}-ORDER-001`,
      paidAt: new Date(),
    },
  });
  console.log(`  ✓ 订阅订单 1 条`);

  // ===== 3.11 今日聚焦 =====
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dailyFocus = await prisma.dailyFocus.create({
    data: {
      date: today,
      cardIds: JSON.stringify([tasks[5].id, tasks[6].id, tasks[2].id]),
      status: "pending",
      userId,
    },
  });
  await prisma.dailyFocusItem.createMany({
    data: [
      { dailyFocusId: dailyFocus.id, taskId: tasks[5].id, position: 0, completed: false },
      { dailyFocusId: dailyFocus.id, taskId: tasks[6].id, position: 1, completed: false },
      { dailyFocusId: dailyFocus.id, taskId: tasks[2].id, position: 2, completed: false },
    ],
  });
  console.log(`  ✓ 今日聚焦 1 条（3 张卡片）`);

  // 4. 统计输出
  console.log("\n--- 测试数据统计 ---");
  const stats = {
    灵感: await prisma.idea.count({ where: { userId, content: { startsWith: TAG } } }),
    任务: await prisma.task.count({ where: { userId, content: { startsWith: TAG } } }),
    对话资产: await prisma.conversation.count({ where: { userId, title: { startsWith: TAG } } }),
    认知: await prisma.cognition.count({ where: { userId, content: { startsWith: TAG } } }),
    记忆: await prisma.memory.count({ where: { userId, content: { startsWith: TAG } } }),
    对话会话: await prisma.chatSession.count({ where: { userId, title: { startsWith: TAG } } }),
    技能: await prisma.skill.count({ where: { userId, name: { startsWith: TAG } } }),
    工作流: await prisma.flow.count({ where: { userId, name: { startsWith: TAG } } }),
  };
  console.log(JSON.stringify(stats, null, 2));
  console.log(`\n✅ 测试数据生成完成！所有数据以 "${TAG}" 前缀标记，可通过 cleanup-lynn-test-data.ts 清理。`);

  await prisma.$disconnect();
}

/** 清理旧测试数据（幂等） */
async function cleanOldTestData(userId: string) {
  // 按依赖顺序删除
  await prisma.dailyFocusItem.deleteMany({
    where: { dailyFocus: { userId, date: { gte: new Date(Date.now() - 7 * 86400000) } } },
  });
  await prisma.dailyFocus.deleteMany({ where: { userId, date: { gte: new Date(Date.now() - 7 * 86400000) } } });

  await prisma.creditTransaction.deleteMany({ where: { userId, description: { startsWith: TAG } } });
  await prisma.sCoinTransaction.deleteMany({ where: { userId, description: { startsWith: TAG } } });
  await prisma.subscriptionOrder.deleteMany({ where: { userId, tradeNo: { startsWith: TAG } } });

  await prisma.memory.deleteMany({ where: { userId, content: { startsWith: TAG } } });
  await prisma.cognition.deleteMany({ where: { userId, content: { startsWith: TAG } } });
  await prisma.graveyard.deleteMany({ where: { reason: { startsWith: TAG } } });
  await prisma.conversation.deleteMany({ where: { userId, title: { startsWith: TAG } } });

  // 删除会话消息（先查 session id）
  const oldSessions = await prisma.chatSession.findMany({ where: { userId, title: { startsWith: TAG } }, select: { id: true } });
  if (oldSessions.length > 0) {
    await prisma.chatMessage.deleteMany({ where: { sessionId: { in: oldSessions.map((s) => s.id) } } });
    await prisma.chatSession.deleteMany({ where: { id: { in: oldSessions.map((s) => s.id) } } });
  }

  await prisma.task.deleteMany({ where: { userId, content: { startsWith: TAG } } });
  await prisma.idea.deleteMany({ where: { userId, content: { startsWith: TAG } } });
  await prisma.skill.deleteMany({ where: { userId, name: { startsWith: TAG } } });
  await prisma.flow.deleteMany({ where: { userId, name: { startsWith: TAG } } });
}

main().catch((e) => {
  console.error("❌ 生成失败:", e);
  process.exit(1);
});

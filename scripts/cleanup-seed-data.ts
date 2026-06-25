/**
 * 数据库脏数据清理脚本
 * 删除由旧 prisma/seed.ts 注入的假数据，保留用户真实操作产生的数据。
 *
 * 清理策略：
 * 1. SkillReview — 全部删除（seed 生成的 20 条评论，作者为假名）
 * 2. LarkTask — 删除 seed 生成的 15 条（guid 为 lark-task-001 ~ lark-task-015）
 * 3. Idea/Task/Memory/Conversation/Cognition/Graveyard/Skill — 按 seed 的精确内容匹配删除
 * 4. 保留：User、ChatSession、HermesConfig、AISetting、Flow、DailyFocus、PushSubscription、真实 LarkTask
 *
 * 运行方式：npx tsx scripts/cleanup-seed-data.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

(async () => {
  console.log("🧹 开始清理 seed 假数据...\n");

  const before: Record<string, number> = {};
  const count = async (model: string) => {
    // @ts-expect-error 动态模型访问
    before[model] = await prisma[model].count();
  };

  for (const m of [
    "idea",
    "task",
    "memory",
    "conversation",
    "cognition",
    "graveyard",
    "skill",
    "skillReview",
    "larkTask",
  ]) {
    await count(m);
  }
  console.log("清理前：", JSON.stringify(before), "\n");

  // ============ 1. SkillReview — 全部删除（seed 生成的假评论） ============
  const sr = await prisma.skillReview.deleteMany({});
  console.log(`✓ SkillReview 删除 ${sr.count} 条（全部为 seed 假评论）`);

  // ============ 2. LarkTask — 删除 seed 生成的 15 条 ============
  const seedLarkTaskGuids = Array.from(
    { length: 15 },
    (_, i) => `lark-task-${String(i + 1).padStart(3, "0")}`
  );
  const lt = await prisma.larkTask.deleteMany({
    where: { guid: { in: seedLarkTaskGuids } },
  });
  console.log(`✓ LarkTask 删除 ${lt.count} 条（seed 假任务 guid=lark-task-001~015）`);

  // ============ 3. Memory — 先删（引用 Idea/Conversation/Cognition） ============
  const seedMemoryContents = [
    "用AI自动整理飞书任务优先级",
    "做一个记忆图谱可视化",
    "闪电输入支持语音转文字",
    "对话资产自动提取提示词模板",
    "灵感墓地复活监测机制",
    "今日聚焦卡片拖拽排序",
    "用嵌入向量做记忆图谱自动连边",
    "决策看板三列满额阻断",
    "三层数据模型设计讨论",
    "LynnHub 三层架构讨论",
    "AI 工作流标准化方案",
    "向量检索实现方案对比",
    "灵感收敛交互流程",
    "对话资产提取四要素",
    "提示词模板化设计",
    "三层数据模型方法论",
    "满额阻断机制",
    "向量相似度自动连边",
    "灵感收敛机制替代意志力",
    "对话资产提取提示词",
  ];
  const memDel = await prisma.memory.deleteMany({
    where: { content: { in: seedMemoryContents } },
  });
  console.log(`✓ Memory 删除 ${memDel.count} 条（匹配 seed 内容）`);

  // ============ 4. Graveyard — 删（引用 Idea.originalIdeaId） ============
  const seedGraveyardReasons = [
    "当前 LynnHub 未上线，精力不应分散到新项目",
    "LynnHub 已覆盖笔记功能，重复造轮子",
    "偏离认知操作系统核心目标",
  ];
  const graveDel = await prisma.graveyard.deleteMany({
    where: { reason: { in: seedGraveyardReasons } },
  });
  console.log(`✓ Graveyard 删除 ${graveDel.count} 条（匹配 seed reason）`);

  // ============ 5. Task — 删（引用 Idea.sourceId，被 DailyFocusItem.taskId 引用） ============
  const seedTaskContents = [
    "LynnHub MVP 上线并稳定运行",
    "个人认知操作系统成型，三层数据模型跑通",
    "AI 工作流标准化，提示词复用率达到 80%",
    "闪电输入浮窗开发，支持全局快捷键唤起",
    "对话资产提取器，自动抓取 Kimi/Claude 对话",
    "记忆图谱可视化，D3 力导向图渲染",
    "灵感收敛定时器，每晚 23 点强制处理 inbox",
    "认知库自动提取方法论，越用越聪明",
    "配置 Tailwind 深色主题，HSL 变量定义",
    "Prisma + MySQL schema 设计与迁移",
    "shadcn/ui 组件初始化，Button/Card/Dialog",
    "Zustand store 搭建，闪电输入状态管理",
    "今日聚焦页面，3 张卡片物理隔离",
    "决策看板拖拽，三列满额阻断逻辑",
    "灵感墓地复活监测定时任务",
  ];
  // 先找到 seed task 的 ID，删除引用它们的 DailyFocusItem
  const seedTasks = await prisma.task.findMany({
    where: { content: { in: seedTaskContents } },
    select: { id: true },
  });
  if (seedTasks.length > 0) {
    const seedTaskIds = seedTasks.map((t) => t.id);
    const dfiDel = await prisma.dailyFocusItem.deleteMany({
      where: { taskId: { in: seedTaskIds } },
    });
    if (dfiDel.count > 0) {
      console.log(`✓ DailyFocusItem 删除 ${dfiDel.count} 条（引用 seed task）`);
    }
  }
  const taskDel = await prisma.task.deleteMany({
    where: { content: { in: seedTaskContents } },
  });
  console.log(`✓ Task 删除 ${taskDel.count} 条（匹配 seed 内容）`);

  // ============ 6. Cognition — 删（引用 Idea/Conversation） ============
  const seedCogContents = [
    "三层数据模型法：捕获层(原始)→收敛层(结构化)→复利层(关联)，适用于所有个人知识管理系统",
    "满额阻断比提醒有效100倍，物理限制才能对抗注意力分散",
    "向量相似度>0.8自动连边，低于阈值手动关联，平衡自动化和控制权",
    "灵感收敛用机制替代意志力，固定时间强制处理inbox",
    "个人工具优先选 MySQL 单库，零运维，后续再迁移",
    "Next.js App Router 配合 shadcn/ui 开发效率最高",
    "深色主题用 HSL 变量定义，方便统一调整色阶",
    "把以下对话提取为：1.结论 2.待办 3.数据 4.可复用提示词，用JSON输出",
  ];
  const cogDel = await prisma.cognition.deleteMany({
    where: { content: { in: seedCogContents } },
  });
  console.log(`✓ Cognition 删除 ${cogDel.count} 条（匹配 seed 内容）`);

  // ============ 7. Conversation — 删（已被 Memory/Cognition 释放） ============
  const seedConvTitles = [
    "设计灵感收敛系统的数据模型",
    "LynnHub 三层架构讨论",
    "AI 工作流标准化方案",
    "向量检索实现方案对比",
    "灵感收敛交互流程",
  ];
  const convDel = await prisma.conversation.deleteMany({
    where: { title: { in: seedConvTitles } },
  });
  console.log(`✓ Conversation 删除 ${convDel.count} 条（匹配 seed 标题）`);

  // ============ 8. Idea — 最后删（被 Task/Graveyard/Cognition/Memory 引用） ============
  const seedIdeaContents = [
    "用AI自动整理飞书任务优先级，按截止时间和重要度排序",
    "做一个记忆图谱可视化，用 D3 力导向图展示节点关联",
    "闪电输入支持语音转文字，3秒说完即归档",
    "对话资产自动提取提示词模板，沉淀到认知库",
    "灵感墓地复活监测：每周扫描一次，满足条件自动归档到 inbox",
    "今日聚焦卡片支持拖拽排序，物理隔离其他任务",
    "用嵌入向量做记忆图谱，相似度>0.8自动连边",
    "决策看板三列满额阻断：北极星3/战役5/任务10",
    "做一个独立的笔记 App 覆盖笔记功能",
    "开发一个 AI 代码审查工具",
    // graveyard ideas
    "做一个 AI 自动发推特的项目",
  ];
  const ideaDel = await prisma.idea.deleteMany({
    where: { content: { in: seedIdeaContents } },
  });
  console.log(`✓ Idea 删除 ${ideaDel.count} 条（匹配 seed 内容）`);

  // ============ 9. Skill — 删（SkillVersion 级联，SkillReview 已删） ============
  const seedSkillNames = [
    "财务月报生成",
    "项目周报生成",
    "代码审查助手",
    "知识库问答",
    "会议纪要生成",
    "产品需求文档生成",
    "自定义工作流",
    "季度财务总结",
    "代码重构建议",
    "技术文档生成",
  ];
  const skillDel = await prisma.skill.deleteMany({
    where: { name: { in: seedSkillNames } },
  });
  console.log(`✓ Skill 删除 ${skillDel.count} 条（匹配 seed 名称，SkillVersion 级联删除）`);

  // ============ 清理孤儿 Memory（关联实体已删除的） ============
  const orphanMem = await prisma.memory.deleteMany({
    where: {
      AND: [
        { ideaId: null },
        { conversationId: null },
        { cognitionId: null },
        { content: { in: seedMemoryContents } },
      ],
    },
  });
  if (orphanMem.count > 0) {
    console.log(`✓ Memory 额外清理 ${orphanMem.count} 条孤儿记录`);
  }

  // ============ 输出清理后统计 ============
  console.log("\n--- 清理后统计 ---");
  const after: Record<string, number> = {};
  for (const m of [
    "idea",
    "task",
    "memory",
    "conversation",
    "cognition",
    "graveyard",
    "skill",
    "skillReview",
    "larkTask",
  ]) {
    // @ts-expect-error 动态模型访问
    after[m] = await prisma[m].count();
  }
  console.log("清理后：", JSON.stringify(after, null, 2));

  console.log("\n✅ 脏数据清理完成");
  await prisma.$disconnect();
})().catch((e) => {
  console.error("❌ 清理失败:", e);
  process.exit(1);
});

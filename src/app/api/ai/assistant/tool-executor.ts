// AI 助理工具执行器
// 被 chat API 调用，根据工具名执行对应操作并返回结果
// 覆盖范围：灵感与看板 / 记忆与认知 / 技能与工作流 / 巡检与通知

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { chat } from "@/lib/ai-provider";
import { executeFlowInternal } from "@/lib/flow-engine";
import { getFlowById, updateFlow } from "@/lib/flow-store";
import {
  embedText,
  bufferToFloat32,
  cosineSimilarity,
  float32ToBuffer,
} from "@/lib/embedding";
import { hasAIEmbedding, COGNITION_EXTRACT_PROMPT } from "@/lib/ai";
import {
  sendPushNotification,
  type PushSubscriptionObject,
} from "@/lib/push";
import { fillPromptTemplate } from "@/lib/skill-parser";
import { writeMemoryForCognition } from "@/lib/memory-sync";
import type { AuthUser } from "@/lib/auth-utils";
import { buildUserFilter } from "@/lib/auth-utils";

// 看板列枚举与上限（与 tasks API 保持一致）
const TASK_COLUMNS = ["northstar", "campaign", "task"] as const;
type TaskColumn = (typeof TASK_COLUMNS)[number];
const TASK_LIMITS: Record<TaskColumn, number> = {
  northstar: 3,
  campaign: 5,
  task: 10,
};

/**
 * 工具执行入口
 * @param tool 工具名
 * @param args 参数对象
 * @param user 当前登录用户
 * @returns 工具执行结果（成功返回数据对象，失败返回 { error } ）
 */
export async function executeTool(
  tool: string,
  args: Record<string, any>,
  user: AuthUser
): Promise<any> {
  try {
    switch (tool) {
      // ============ 灵感与看板 ============
      case "searchIdeas":
        return await executeSearchIdeas(args, user);
      case "createIdea":
        return await executeCreateIdea(args, user);
      case "searchTasks":
        return await executeSearchTasks(args, user);
      case "createTask":
        return await executeCreateTask(args, user);
      case "completeTask":
        return await executeCompleteTask(args, user);
      case "getBoardStats":
        return await executeGetBoardStats(user);

      // ============ 飞书任务 ============
      case "createLarkTask":
        return await executeCreateLarkTask(args);

      // ============ 记忆与认知 ============
      case "semanticSearch":
        return await executeSemanticSearch(args, user);
      case "rebuildMemory":
        return await executeRebuildMemory(user);
      case "getCognitions":
        return await executeGetCognitions(args, user);

      // ============ 技能与工作流 ============
      case "listSkills":
        return await executeListSkills(args, user);
      case "executeSkill":
        return await executeExecuteSkill(args, user);
      case "listFlows":
        return await executeListFlows();
      case "executeFlow":
        return await executeExecuteFlow(args);
      case "getFlowHistory":
        return await executeGetFlowHistory(args);

      // ============ 巡检与通知 ============
      case "runPatrol":
        return await executeRunPatrol(args, user);
      case "listPatrolRules":
        return await executeListPatrolRules(user);
      case "getPatrolResults":
        return await executeGetPatrolResults(args, user);
      case "sendNotification":
        return await executeSendNotification(args, user);
      case "exportBackup":
        return await executeExportBackup(args, user);

      // ============ Hermes Agent ============
      case "hermesExecute":
        return await executeHermesExecute(args, user);
      case "hermesListSkills":
        return await executeHermesListSkills(args, user);
      case "hermesStatus":
        return await executeHermesStatus(user);

      default:
        return { error: "未知工具: " + tool };
    }
  } catch (e) {
    const msg = (e as Error).message || "工具执行异常";
    return { error: msg };
  }
}

// ============ 灵感与看板 ============

/** 搜索灵感库（status=inbox，关键词匹配） */
async function executeSearchIdeas(
  args: { query?: string },
  user: AuthUser
) {
  const query = String(args.query || "").trim();
  const where: Prisma.IdeaWhereInput = {
    status: "inbox",
    ...buildUserFilter(user),
  };
  if (query) {
    where.content = { contains: query };
  }
  const ideas = await prisma.idea.findMany({
    where,
    take: 10,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      content: true,
      tags: true,
      createdAt: true,
    },
  });
  return { ideas, total: ideas.length };
}

/** 创建一条新灵感 */
async function executeCreateIdea(
  args: { content?: string },
  user: AuthUser
) {
  const content = String(args.content || "").trim();
  if (!content) {
    return { error: "灵感内容不能为空" };
  }
  const idea = await prisma.idea.create({
    data: {
      content: content.slice(0, 5000),
      source: "lightning",
      status: "inbox",
      tags: [],
      attachments: [],
      userId: user.id,
    },
  });
  return { id: idea.id, success: true };
}

/** 查看看板任务（默认 active） */
async function executeSearchTasks(
  args: { status?: string },
  user: AuthUser
) {
  const status = args.status || "active";
  const where: Prisma.TaskWhereInput = {
    ...buildUserFilter(user),
  };
  if (status !== "all") {
    where.status = status;
  }
  const tasks = await prisma.task.findMany({
    where,
    take: 20,
    orderBy: [{ column: "asc" }, { position: "asc" }],
    select: {
      id: true,
      content: true,
      column: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return { tasks, total: tasks.length };
}

/** 在看板创建任务（带列满额检查） */
async function executeCreateTask(
  args: { content?: string; column?: string },
  user: AuthUser
) {
  const content = String(args.content || "").trim();
  if (!content) {
    return { error: "任务内容不能为空" };
  }
  const col = (args.column as TaskColumn) || "task";
  if (!TASK_COLUMNS.includes(col)) {
    return { error: `无效的列：${col}，应为 northstar/campaign/task` };
  }
  // 检查列满额
  const count = await prisma.task.count({
    where: { column: col, status: "active" },
  });
  if (count >= TASK_LIMITS[col]) {
    return {
      error: `${col} 列已满（上限 ${TASK_LIMITS[col]}），请先完成或降级`,
    };
  }
  const task = await prisma.task.create({
    data: {
      content: content.slice(0, 5000),
      column: col,
      position: count,
      status: "active",
      userId: user.id,
    },
  });
  return { id: task.id, success: true };
}

/** 完成任务（触发 AI 认知提取） */
async function executeCompleteTask(
  args: { taskId?: string },
  user: AuthUser
) {
  const taskId = String(args.taskId || "").trim();
  if (!taskId) {
    return { error: "taskId 不能为空" };
  }
  const existing = await prisma.task.findUnique({
    where: { id: taskId },
    include: { idea: { select: { content: true } } },
  });
  if (!existing) {
    return { error: "任务不存在" };
  }
  if (user.role !== "admin" && existing.userId !== user.id) {
    return { error: "无权访问该任务" };
  }
  if (existing.status === "done") {
    return { success: true, message: "任务已经是完成状态", cognitionExtracted: false };
  }
  // 更新状态为 done
  await prisma.task.update({
    where: { id: taskId },
    data: { status: "done" },
  });

  // AI 认知提取（失败不阻断完成操作）
  let cognitionExtracted = false;
  let cognitionCount = 0;
  try {
    const ideaContent = existing.idea?.content || "";
    const combinedContent = ideaContent
      ? `${existing.content}\n\n[关联灵感]\n${ideaContent}`
      : existing.content;

    // 性能优化：认知提取改为 fire-and-forget，不阻塞"完成任务"的响应
    // 用户点完成 → 立即返回成功，AI 提取在后台异步进行
    (async () => {
      try {
        const aiResp = await chat(
          [{ role: "user", content: combinedContent }],
          {
            system: COGNITION_EXTRACT_PROMPT,
            reasoningMode: "fast",
            temperature: 0.3,
          }
        );

        // 解析 AI 返回的 JSON
        const jsonMatch = aiResp.content.match(/\{[\s\S]*\}/);
        const parsed = jsonMatch
          ? JSON.parse(jsonMatch[0])
          : { method: [], experience: [], prompt: [] };

        const sourceType = existing.sourceId ? "idea" : "task";
        const ideaId = existing.sourceId || null;

        const items: Array<{
          type: "method" | "experience" | "prompt";
          content: string;
        }> = [];
        for (const item of parsed.method || []) {
          if (item?.content) items.push({ type: "method", content: item.content });
        }
        for (const item of parsed.experience || []) {
          if (item?.content) items.push({ type: "experience", content: item.content });
        }
        for (const item of parsed.prompt || []) {
          if (item?.content) items.push({ type: "prompt", content: item.content });
        }

        // 批量 createMany（避免 N+1 串行 create）
        if (items.length > 0) {
          await prisma.cognition.createMany({
            data: items.map((item) => ({
              type: item.type,
              content: item.content,
              source: sourceType,
              ideaId,
              tags: [],
              userId: user.id,
            })),
          });
          // 异步写入 Memory（不阻塞）
          Promise.all(
            items.map((item) => writeMemoryForCognition(`${Date.now()}-${item.type}`, item.content))
          ).catch(() => {});
        }
      } catch (e) {
        console.error("AI 认知提取失败（后台异步）:", e);
      }
    })().catch(() => {});

    cognitionExtracted = true; // 标记已触发提取（异步进行中）
    cognitionCount = 0; // 实际数量在后台更新
  } catch (e) {
    // AI 调用失败不阻断完成操作
    console.error("AI 认知提取失败:", e);
  }

  return {
    success: true,
    taskId,
    cognitionExtracted,
    cognitionCount,
  };
}

/** 获取看板统计 */
async function executeGetBoardStats(user: AuthUser) {
  const filter = buildUserFilter(user);
  const totalCompleted = await prisma.task.count({
    where: { status: "done", ...filter },
  });
  const totalActive = await prisma.task.count({
    where: { status: "active", ...filter },
  });

  // 本周完成数
  const now = new Date();
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() + mondayOffset);

  const thisWeekCompleted = await prisma.task.count({
    where: { status: "done", updatedAt: { gte: monday }, ...filter },
  });

  // 按列统计（仅 active）
  const [northstar, campaign, task] = await Promise.all([
    prisma.task.count({
      where: { column: "northstar", status: "active", ...filter },
    }),
    prisma.task.count({
      where: { column: "campaign", status: "active", ...filter },
    }),
    prisma.task.count({
      where: { column: "task", status: "active", ...filter },
    }),
  ]);

  return {
    totalCompleted,
    totalActive,
    thisWeekCompleted,
    byColumn: { northstar, campaign, task },
  };
}

// ============ 飞书任务 ============

/**
 * 解析自然语言生成飞书任务卡片数据。
 * 不直接创建任务，仅返回卡片数据供前端渲染，用户确认后由前端调用 /api/lark-tasks/create 下发。
 */
async function executeCreateLarkTask(args: {
  summary?: string;
  assignees?: string[];
  due?: string;
  description?: string;
}) {
  const summary = String(args.summary || "").trim();
  if (!summary) {
    return { error: "任务标题 summary 不能为空" };
  }
  const assignees = Array.isArray(args.assignees)
    ? args.assignees.map((a) => String(a).trim()).filter(Boolean)
    : [];
  const due = args.due ? String(args.due).trim() : undefined;
  const description = args.description ? String(args.description).trim() : undefined;

  return {
    type: "larkTaskCard",
    data: {
      summary,
      assignees,
      due,
      description,
    },
  };
}

// ============ 记忆与认知 ============

/** 语义搜索记忆图谱 */
async function executeSemanticSearch(
  args: { query?: string },
  user: AuthUser
) {
  const q = String(args.query || "").trim();
  if (!q) {
    return { error: "query 不能为空", results: [] };
  }
  // 生成查询向量
  const queryVec = await embedText(q);

  // 拉取有 embedding 的 Memory（按用户过滤）
  const memories = await prisma.memory.findMany({
    where: { embedding: { not: null }, ...buildUserFilter(user) },
    include: {
      idea: { select: { content: true, status: true } },
      conversation: { select: { title: true, source: true } },
      cognition: { select: { content: true, type: true } },
    },
    take: 50,
    orderBy: { createdAt: "desc" },
  });

  // 计算相似度并按相似度降序排列
  const scored = memories
    .map((m) => {
      const vec = bufferToFloat32(m.embedding!);
      const score = cosineSimilarity(queryVec, vec);
      let label = m.content.slice(0, 60);
      let source = m.type;
      if (m.idea) {
        label = m.idea.content;
        source = `idea (${m.idea.status})`;
      } else if (m.conversation) {
        label = m.conversation.title;
        source = `conversation (${m.conversation.source})`;
      } else if (m.cognition) {
        label = m.cognition.content;
        source = `cognition (${m.cognition.type})`;
      }
      return { id: m.id, label, source, score, type: m.type };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  return { results: scored, total: scored.length };
}

/** 重建记忆图谱（复用 /api/memory POST 逻辑） */
async function executeRebuildMemory(user: AuthUser) {
  const userFilter = buildUserFilter(user);

  // 1. 收集所有源数据
  const [ideas, conversations, cognitions] = await Promise.all([
    prisma.idea.findMany({
      where: userFilter,
      select: { id: true, content: true, userId: true },
    }),
    prisma.conversation.findMany({
      where: userFilter,
      select: { id: true, title: true, rawContent: true, userId: true },
    }),
    prisma.cognition.findMany({
      where: userFilter,
      select: { id: true, content: true, userId: true },
    }),
  ]);

  type SourceItem = {
    id: string;
    type: "idea" | "conversation" | "cognition";
    content: string;
    ideaId?: string;
    conversationId?: string;
    cognitionId?: string;
    userId?: string | null;
  };

  const sources: SourceItem[] = [
    ...ideas.map((i) => ({
      id: i.id,
      type: "idea" as const,
      content: i.content,
      ideaId: i.id,
      userId: i.userId,
    })),
    ...conversations.map((c) => ({
      id: c.id,
      type: "conversation" as const,
      content: `${c.title}\n${c.rawContent}`.slice(0, 8000),
      conversationId: c.id,
      userId: c.userId,
    })),
    ...cognitions.map((c) => ({
      id: c.id,
      type: "cognition" as const,
      content: c.content,
      cognitionId: c.id,
      userId: c.userId,
    })),
  ];

  // 2. 为每个 source 生成或复用 embedding
  const embeddings = new Map<string, Float32Array>();
  let processed = 0;
  let skipped = 0;

  // 预取所有已存在的 Memory 记录
  const existingMemories = await prisma.memory.findMany({
    where: {
      ...userFilter,
      type: { in: ["idea", "conversation", "cognition"] },
    },
    select: {
      id: true,
      type: true,
      ideaId: true,
      conversationId: true,
      cognitionId: true,
      embedding: true,
    },
  });
  const existingMap = new Map<string, (typeof existingMemories)[number]>();
  for (const m of existingMemories) {
    const key = `${m.type}:${m.ideaId || m.conversationId || m.cognitionId || ""}`;
    existingMap.set(key, m);
  }

  const pendingUpdates: { id: string; embedding: Buffer; content: string }[] = [];
  const pendingCreates: Prisma.MemoryUncheckedCreateInput[] = [];

  // 收集需要重新生成 embedding 的 source（已有 embedding 的复用，无需调用 AI）
  const pendingEmbedSources: SourceItem[] = [];
  for (const src of sources) {
    const lookupKey = `${src.type}:${src.ideaId || src.conversationId || src.cognitionId || ""}`;
    const existing = existingMap.get(lookupKey);

    if (existing && existing.embedding) {
      embeddings.set(src.id, bufferToFloat32(existing.embedding));
      skipped++;
      continue;
    }

    pendingEmbedSources.push(src);
    processed++;
  }

  // 并行批量生成 embedding（限制并发 8，避免一次性发起过多 HTTP 请求）
  const EMBED_CONCURRENCY = 8;
  for (let i = 0; i < pendingEmbedSources.length; i += EMBED_CONCURRENCY) {
    const batch = pendingEmbedSources.slice(i, i + EMBED_CONCURRENCY);
    const vecs = await Promise.all(batch.map((s) => embedText(s.content)));
    for (let k = 0; k < batch.length; k++) {
      const src = batch[k];
      const vec = vecs[k];
      embeddings.set(src.id, vec);

      const embeddingBuffer = float32ToBuffer(vec);
      const lookupKey = `${src.type}:${src.ideaId || src.conversationId || src.cognitionId || ""}`;
      const existing = existingMap.get(lookupKey);
      const data: Prisma.MemoryUncheckedCreateInput = {
        type: src.type,
        content: src.content,
        embedding: embeddingBuffer,
        ideaId: src.ideaId || null,
        conversationId: src.conversationId || null,
        cognitionId: src.cognitionId || null,
        userId: src.userId || user.id,
      };

      if (existing) {
        pendingUpdates.push({ id: existing.id, embedding: embeddingBuffer, content: src.content });
      } else {
        pendingCreates.push(data);
      }
    }
  }

  // 批量提交
  if (pendingCreates.length > 0 || pendingUpdates.length > 0) {
    await prisma.$transaction([
      ...pendingCreates.map((data) => prisma.memory.create({ data })),
      ...pendingUpdates.map((u) =>
        prisma.memory.update({
          where: { id: u.id },
          data: { embedding: u.embedding, content: u.content },
        })
      ),
    ]);
  }

  // 3. 计算相似度连边（利用对称性：sim(i,j) == sim(j,i)，只算上三角并镜像填充，减半计算量）
  const threshold = hasAIEmbedding ? 0.8 : 0.3;
  // 每个节点最多保留 K 条最相似的连接，避免 hub 节点爆炸 + 控制 DB 写入量
  const MAX_CONNECTIONS_PER_NODE = 20;
  const allMemories = await prisma.memory.findMany({
    where: userFilter,
    select: { id: true, embedding: true },
  });

  const decoded = allMemories.map((m) => ({
    id: m.id,
    vec: m.embedding ? bufferToFloat32(m.embedding) : null,
  }));

  // 预分配每个节点的候选连接列表（带相似度分数，便于后续取 Top-K）
  const connectionScores: Map<string, Array<{ id: string; score: number }>> = new Map();
  for (const d of decoded) connectionScores.set(d.id, []);

  for (let i = 0; i < decoded.length; i++) {
    const vecI = decoded[i].vec;
    if (!vecI) continue;
    for (let j = i + 1; j < decoded.length; j++) {
      const vecJ = decoded[j].vec;
      if (!vecJ) continue;
      const sim = cosineSimilarity(vecI, vecJ);
      if (sim >= threshold) {
        connectionScores.get(decoded[i].id)!.push({ id: decoded[j].id, score: sim });
        connectionScores.get(decoded[j].id)!.push({ id: decoded[i].id, score: sim });
      }
    }
  }

  const updates: { id: string; connections: string[]; strength: number }[] = [];
  let edgeCount = 0;
  for (const d of decoded) {
    const cands = connectionScores.get(d.id) || [];
    // 取 Top-K（按相似度降序），避免某些热点节点连边过多
    cands.sort((a, b) => b.score - a.score);
    const connections = cands.slice(0, MAX_CONNECTIONS_PER_NODE).map((c) => c.id);
    edgeCount += connections.length;
    updates.push({
      id: d.id,
      connections,
      strength: connections.length,
    });
  }

  if (updates.length > 0) {
    await prisma.$transaction(
      updates.map((u) =>
        prisma.memory.update({
          where: { id: u.id },
          data: { connections: u.connections, strength: u.strength },
        })
      )
    );
  }

  return {
    success: true,
    total: sources.length,
    processed,
    skipped,
    edges: edgeCount,
    mode: hasAIEmbedding ? "ai-embedding" : "tfidf-fallback",
    threshold,
  };
}

/** 查看认知库 */
async function executeGetCognitions(
  args: { type?: string; limit?: number },
  user: AuthUser
) {
  const type = args.type && args.type !== "all" ? args.type : undefined;
  const limit = Math.min(50, Math.max(1, Number(args.limit) || 10));
  const where: Prisma.CognitionWhereInput = {
    ...buildUserFilter(user),
  };
  if (type) {
    where.type = type;
  }
  const cognitions = await prisma.cognition.findMany({
    where,
    take: limit,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      type: true,
      content: true,
      source: true,
      createdAt: true,
    },
  });
  return { cognitions, total: cognitions.length };
}

// ============ 技能与工作流 ============

/** 列出所有技能 */
async function executeListSkills(
  args: { category?: string },
  user: AuthUser
) {
  const where: Prisma.SkillWhereInput = {
    ...buildUserFilter(user),
  };
  if (args.category && args.category !== "all") {
    where.category = args.category;
  }
  const skills = await prisma.skill.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      description: true,
      category: true,
      source: true,
      usageCount: true,
      updatedAt: true,
    },
  });
  return { skills, total: skills.length };
}

/** 执行一个技能（填充模板后调用 AI） */
async function executeExecuteSkill(
  args: { skillId?: string; parameters?: Record<string, string> },
  user: AuthUser
) {
  const skillId = String(args.skillId || "").trim();
  if (!skillId) {
    return { error: "skillId 不能为空" };
  }
  const skill = await prisma.skill.findUnique({ where: { id: skillId } });
  if (!skill) {
    return { error: "技能不存在" };
  }
  if (user.role !== "admin" && skill.userId !== user.id) {
    return { error: "无权访问该技能" };
  }

  // 填充模板
  const params = args.parameters || {};
  const prompt = skill.promptTemplate
    ? fillPromptTemplate(skill.promptTemplate, params)
    : skill.content;

  if (!prompt) {
    return { error: "技能没有可执行的提示词模板" };
  }

  // 调用 AI
  const result = await chat(
    [{ role: "user", content: prompt }],
    { reasoningMode: "standard" }
  );

  // 增加使用计数
  await prisma.skill.update({
    where: { id: skillId },
    data: { usageCount: { increment: 1 } },
  });

  return {
    success: true,
    skillName: skill.name,
    output: result.content,
    provider: result.provider,
    model: result.model,
    usage: result.usage,
  };
}

/** 列出所有工作流 */
async function executeListFlows() {
  const flows = await prisma.flow.findMany({
    select: {
      id: true,
      name: true,
      description: true,
      enabled: true,
      lastRun: true,
    },
    orderBy: { updatedAt: "desc" },
  });
  return { flows, total: flows.length };
}

/** 执行一个工作流 */
async function executeExecuteFlow(args: { flowId?: string; input?: string }) {
  const flowId = String(args.flowId || "").trim();
  if (!flowId) {
    return { error: "flowId 不能为空" };
  }
  const flow = await getFlowById(flowId);
  if (!flow) {
    return { error: `未找到工作流：${flowId}` };
  }
  if (!flow.enabled) {
    return { error: `工作流「${flow.name}」未启用` };
  }

  const initialInput = typeof args.input === "string" ? args.input : "";
  const result = await executeFlowInternal(flow, initialInput);

  // 保存执行历史
  try {
    const errorNode = result.nodes.find((n) => n.status === "error");
    await prisma.flowExecution.create({
      data: {
        flowId: result.flowId,
        flowName: result.flowName,
        success: result.success,
        startedAt: new Date(result.startedAt),
        finishedAt: new Date(result.finishedAt),
        totalDurationMs: result.totalDurationMs,
        finalOutput: result.finalOutput ?? null,
        nodeResults: result.nodes as unknown as Prisma.InputJsonValue,
        error: errorNode?.error ?? null,
      },
    });
  } catch (e) {
    console.error("保存执行历史失败:", e);
  }

  // 更新 lastRun
  await updateFlow(flowId, { lastRun: "刚刚" });

  return { result, success: result.success };
}

/** 查看工作流执行历史 */
async function executeGetFlowHistory(args: { flowId?: string; limit?: number }) {
  const flowId = String(args.flowId || "").trim();
  if (!flowId) {
    return { error: "flowId 不能为空" };
  }
  const limit = Math.min(20, Math.max(1, Number(args.limit) || 5));
  const executions = await prisma.flowExecution.findMany({
    where: { flowId },
    take: limit,
    orderBy: { startedAt: "desc" },
    select: {
      id: true,
      success: true,
      startedAt: true,
      finishedAt: true,
      totalDurationMs: true,
      finalOutput: true,
      error: true,
    },
  });
  return { executions, total: executions.length };
}

// ============ 巡检与通知 ============

/** 执行巡检（指定规则或所有启用的规则） */
async function executeRunPatrol(
  args: { ruleId?: string },
  user: AuthUser
) {
  // 查询规则
  let rules;
  if (args.ruleId) {
    const rule = await prisma.patrolRule.findUnique({
      where: { id: args.ruleId },
    });
    if (!rule) {
      return { error: "规则不存在" };
    }
    if (user.role !== "admin" && rule.userId !== user.id) {
      return { error: "无权访问该规则" };
    }
    rules = [rule];
  } else {
    rules = await prisma.patrolRule.findMany({
      where: { enabled: true, ...buildUserFilter(user) },
    });
  }

  if (rules.length === 0) {
    return { error: "没有可执行的巡检规则" };
  }

  const userFilter = buildUserFilter(user);
  const allResults: Array<{
    ruleId: string;
    ruleName: string;
    success: boolean;
    hitCount: number;
    logId: string;
    results: any[];
    error?: string;
  }> = [];

  for (const rule of rules) {
    const startedAt = Date.now();
    try {
      // 1. 根据 scope 收集数据
      const items = await collectScopeData(rule.scope, userFilter);

      if (items.length === 0) {
        const log = await prisma.patrolLog.create({
          data: {
            ruleId: rule.id,
            ruleName: rule.name,
            scope: rule.scope,
            success: true,
            results: [] as unknown as Prisma.InputJsonValue,
            hitCount: 0,
            durationMs: Date.now() - startedAt,
            finishedAt: new Date(),
          },
        });
        await prisma.patrolRule.update({
          where: { id: rule.id },
          data: { lastRunAt: new Date() },
        });
        allResults.push({
          ruleId: rule.id,
          ruleName: rule.name,
          success: true,
          hitCount: 0,
          logId: log.id,
          results: [],
        });
        continue;
      }

      // 2. 调用 AI 分析
      let results: Array<{
        itemId: string;
        content: string;
        matched: boolean;
        reason: string;
        suggestion: string;
      }> = [];
      let aiSuccess = true;
      let aiError: string | null = null;

      try {
        const itemsText = items
          .map(
            (item, i) =>
              `[${i + 1}] (id:${item.itemId}, type:${item.type})\n${item.content}`
          )
          .join("\n\n");

        const userMessage = `以下是待巡检的数据项，请根据巡检规则分析每一项是否匹配，并给出建议。

待巡检数据：
${itemsText}

请用 JSON 数组输出每项的巡检结果，格式：
[
  {
    "itemId": "数据项的 id",
    "content": "数据项内容摘要",
    "matched": true | false,
    "reason": "匹配/不匹配的理由",
    "suggestion": "建议动作（如匹配则给出处理建议）"
  }
]

只输出 JSON 数组，不要其他内容。`;

        const aiResp = await chat(
          [{ role: "user", content: userMessage }],
          {
            system: rule.prompt,
            reasoningMode: "standard",
            temperature: 0.3,
          }
        );

        const jsonMatch = aiResp.content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (Array.isArray(parsed)) {
            results = parsed.map((item: Record<string, unknown>) => ({
              itemId: String(item.itemId || ""),
              content: String(item.content || ""),
              matched: Boolean(item.matched),
              reason: String(item.reason || ""),
              suggestion: String(item.suggestion || ""),
            }));
          }
        }
      } catch (e) {
        aiSuccess = false;
        aiError = (e as Error).message;
      }

      const hitCount = results.filter((r) => r.matched).length;
      const durationMs = Date.now() - startedAt;

      // 3. 写入 PatrolLog
      const log = await prisma.patrolLog.create({
        data: {
          ruleId: rule.id,
          ruleName: rule.name,
          scope: rule.scope,
          success: aiSuccess,
          results: results as unknown as Prisma.InputJsonValue,
          hitCount,
          durationMs,
          error: aiError,
          finishedAt: new Date(),
        },
      });

      // 4. 更新规则 lastRunAt
      await prisma.patrolRule.update({
        where: { id: rule.id },
        data: { lastRunAt: new Date() },
      });

      allResults.push({
        ruleId: rule.id,
        ruleName: rule.name,
        success: aiSuccess,
        hitCount,
        logId: log.id,
        results,
        error: aiError || undefined,
      });
    } catch (e) {
      allResults.push({
        ruleId: rule.id,
        ruleName: rule.name,
        success: false,
        hitCount: 0,
        logId: "",
        results: [],
        error: (e as Error).message,
      });
    }
  }

  return {
    success: allResults.every((r) => r.success),
    results: allResults,
    totalRules: allResults.length,
    totalHits: allResults.reduce((sum, r) => sum + r.hitCount, 0),
  };
}

/** 根据 scope 收集巡检数据（与 patrol/run API 一致） */
async function collectScopeData(
  scope: string,
  userFilter: { userId?: string }
): Promise<Array<{ itemId: string; content: string; type: string }>> {
  const items: Array<{ itemId: string; content: string; type: string }> = [];

  if (scope === "inbox" || scope === "all") {
    const ideas = await prisma.idea.findMany({
      where: { status: "inbox", ...userFilter },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    for (const idea of ideas) {
      items.push({ itemId: idea.id, content: idea.content, type: "idea" });
    }
  }

  if (scope === "board" || scope === "all") {
    const tasks = await prisma.task.findMany({
      where: { status: "active", ...userFilter },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    for (const task of tasks) {
      items.push({ itemId: task.id, content: task.content, type: "task" });
    }
  }

  if (scope === "graveyard" || scope === "all") {
    const whereClause = userFilter.userId
      ? { idea: { userId: userFilter.userId } }
      : {};
    const graveyards = await prisma.graveyard.findMany({
      where: whereClause,
      include: { idea: { select: { content: true } } },
      orderBy: { abandonedAt: "desc" },
      take: 100,
    });
    for (const g of graveyards) {
      items.push({
        itemId: g.id,
        content: `灵感：${g.idea?.content || ""}\n放弃原因：${g.reason}\n复活条件：${g.reviveCondition}`,
        type: "graveyard",
      });
    }
  }

  return items;
}

/** 列出所有巡检规则 */
async function executeListPatrolRules(user: AuthUser) {
  const rules = await prisma.patrolRule.findMany({
    where: buildUserFilter(user),
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      description: true,
      scope: true,
      triggerTime: true,
      enabled: true,
      lastRunAt: true,
    },
  });
  return { rules, total: rules.length };
}

/** 查看最近巡检结果 */
async function executeGetPatrolResults(
  args: { limit?: number },
  user: AuthUser
) {
  const limit = Math.min(20, Math.max(1, Number(args.limit) || 5));
  const whereClause: {
    rule?: { userId?: string };
  } = {};
  if (user.role !== "admin") {
    whereClause.rule = { userId: user.id };
  }
  const logs = await prisma.patrolLog.findMany({
    where: whereClause,
    take: limit,
    orderBy: { startedAt: "desc" },
    // ruleName 已冗余存储在 PatrolLog 上，无需 include rule 关联
    select: {
      id: true,
      ruleId: true,
      ruleName: true,
      scope: true,
      success: true,
      hitCount: true,
      durationMs: true,
      error: true,
      startedAt: true,
      finishedAt: true,
    },
  });
  return { logs, total: logs.length };
}

/** 发送通知（浏览器推送） */
async function executeSendNotification(
  args: { title?: string; body?: string },
  user: AuthUser
) {
  const title = String(args.title || "Lynx 通知").trim();
  const body = String(args.body || "").trim();
  if (!body) {
    return { error: "通知内容不能为空" };
  }
  const subs = await prisma.pushSubscription.findMany({
    where: { userId: user.id },
  });
  if (subs.length === 0) {
    return {
      success: false,
      message: "未找到推送订阅，请先在前端订阅通知",
    };
  }
  let sentCount = 0;
  const errors: string[] = [];
  for (const sub of subs) {
    const subscription: PushSubscriptionObject = {
      endpoint: sub.endpoint,
      keys: sub.keys as { p256dh: string; auth: string },
    };
    const result = await sendPushNotification(subscription, { title, body });
    if (result.success) {
      sentCount++;
    } else if (result.error) {
      errors.push(result.error);
    }
  }
  return {
    success: sentCount > 0,
    sentCount,
    totalSubscriptions: subs.length,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/** 导出数据备份（JSON） */
async function executeExportBackup(
  args: { type?: string },
  user: AuthUser
) {
  const type = args.type || "all";
  const filter = buildUserFilter(user);
  const backup: Record<string, any> = {};

  if (type === "all" || type === "ideas") {
    backup.ideas = await prisma.idea.findMany({
      where: filter,
      select: {
        id: true,
        content: true,
        source: true,
        status: true,
        tags: true,
        attachments: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  if (type === "all" || type === "tasks") {
    backup.tasks = await prisma.task.findMany({
      where: filter,
      select: {
        id: true,
        content: true,
        column: true,
        position: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  if (type === "all" || type === "cognitions") {
    backup.cognitions = await prisma.cognition.findMany({
      where: filter,
      select: {
        id: true,
        type: true,
        content: true,
        source: true,
        tags: true,
        createdAt: true,
      },
    });
  }

  if (type === "all" || type === "memories") {
    backup.memories = await prisma.memory.findMany({
      where: filter,
      select: {
        id: true,
        type: true,
        content: true,
        strength: true,
        createdAt: true,
      },
    });
  }

  return {
    success: true,
    type,
    exportedAt: new Date().toISOString(),
    counts: {
      ideas: backup.ideas?.length || 0,
      tasks: backup.tasks?.length || 0,
      cognitions: backup.cognitions?.length || 0,
      memories: backup.memories?.length || 0,
    },
    data: backup,
  };
}

// ============ Hermes Agent ============

/** 获取用户所有在线设备（桌面端 + Web 端） */
async function getOnlineDevices(userId: string) {
  const threshold = new Date(Date.now() - 60_000);
  const sessions = await prisma.pcSession.findMany({
    where: {
      userId,
      status: "online",
      lastHeartbeat: { gte: threshold },
    },
    orderBy: { lastHeartbeat: "desc" },
  });
  return sessions;
}

// dispatchRemoteCommand 已移至 @/lib/hermes-client.ts（共享函数）
// 服务器禁止执行 CLI，所有 HermesAgent 任务通过 WS 网关远程下发到用户本地设备

/** 通过 Hermes Agent 执行任务（桌面控制/Shell/Skills Hub） */
async function executeHermesExecute(
  args: { prompt?: string; mode?: string; workDir?: string; timeout?: number },
  user: AuthUser
) {
  const prompt = String(args.prompt || "").trim();
  if (!prompt) {
    return { error: "prompt 不能为空" };
  }

  // 动态 import 共享的 dispatchRemoteCommand（移至 hermes-client.ts）
  const { dispatchRemoteCommand } = await import("@/lib/hermes-client");

  const timeoutSec = args.timeout || 120;
  let result: { success: boolean; output: string; error?: string; durationMs?: number; steps?: unknown[] };

  // 唯一路径：通过 WS 网关远程下发到用户电脑（桌面端或 Web 端均可接收）
  // 接收端收到后优先调用 HermesAgent Dashboard HTTP API（真正 AI 执行）
  const devices = await getOnlineDevices(user.id);
  if (devices.length === 0) {
    return {
      success: false,
      output: "",
      error: "未检测到在线设备。请在您的电脑上打开 Lynx 桌面端或 Web 端并登录，确保至少一台设备在线。AI 助理通过在线设备执行本地操作（如打开浏览器、操作文件等），无法在服务器上执行。",
    };
  }

  // 多设备策略：优先选桌面端（非 Web- 开头），其次选最近心跳的设备
  const desktopDevice = devices.find((d) => !d.deviceName.startsWith("Web-"));
  const targetDevice = desktopDevice || devices[0];

  const remoteResult = await dispatchRemoteCommand(user.id, prompt, timeoutSec, targetDevice.wsChannelId);
  result = {
    success: remoteResult.success,
    output: remoteResult.output,
    error: remoteResult.error,
    durationMs: remoteResult.durationMs,
    steps: remoteResult.success
      ? [{ action: "remote-dispatch", device: targetDevice.deviceName, route: remoteResult.route || "desktop", timestamp: new Date().toISOString() }]
      : undefined,
  };

  // 记录执行历史
  try {
    await prisma.skillExecution.create({
      data: {
        userId: user.id,
        skillId: "hermes-assistant",
        skillName: `AI 助理调用：${prompt.slice(0, 50)}`,
        source: "hermes",
        trigger: "assistant",
        parameters: { prompt, mode: args.mode } as unknown as Prisma.InputJsonValue,
        result: result.output,
        success: result.success,
        durationMs: result.durationMs || 0,
        error: result.error || null,
      },
    });
  } catch {
    // 记录失败不影响主流程
  }

  return {
    success: result.success,
    output: result.output,
    error: result.error,
    durationMs: result.durationMs,
    steps: result.steps,
  };
}

/** 列出 Hermes Skills Hub 技能 */
async function executeHermesListSkills(
  args: { category?: string },
  user: AuthUser
) {
  const { getHermesConfig, dispatchRemoteCommand } = await import("@/lib/hermes-client");
  const config = await getHermesConfig(user.id);
  if (!config || !config.enabled) {
    return { error: "Hermes Agent 未启用" };
  }

  // 通过 WS 网关远程下发到用户在线设备（桌面端或 Web 端）
  // 接收端调用本地 HermesAgent Dashboard 获取技能列表
  const remoteResult = await dispatchRemoteCommand(user.id, "hermes skills list --json", 30);
  if (remoteResult.success && remoteResult.output) {
    try {
      const parsed = JSON.parse(remoteResult.output);
      const skills = Array.isArray(parsed) ? parsed : (parsed.skills || []);
      return { skills, total: skills.length };
    } catch {
      return {
        skills: [],
        total: 0,
        error: "技能列表解析失败",
        rawOutput: remoteResult.output.slice(0, 500),
      };
    }
  }

  return {
    skills: [],
    total: 0,
    error: remoteResult.error || "无法获取技能列表，请确认用户电脑上 HermesAgent Dashboard 已启动",
  };
}

/** 查询 Hermes Agent 状态 */
async function executeHermesStatus(user: AuthUser) {
  const { getHermesConfig, testHermesConnection, detectHermesInstall } = await import("@/lib/hermes-client");
  const config = await getHermesConfig(user.id);
  const detect = await detectHermesInstall();

  let connected = false;
  let version: string | undefined;
  let capabilities: string[] = [];
  let connectionError: string | undefined;

  if (config && config.status === "running") {
    const testResult = await testHermesConnection(config);
    connected = testResult.connected;
    version = testResult.version;
    capabilities = testResult.capabilities || [];
    connectionError = testResult.error;
  }

  return {
    installed: detect.installed,
    installVersion: detect.version,
    enabled: config?.enabled ?? false,
    status: config?.status || "not_installed",
    endpoint: config?.endpoint || "http://localhost:7432",
    connected,
    version,
    capabilities: capabilities.length > 0 ? capabilities : (config?.capabilities || []),
    connectionError,
  };
}

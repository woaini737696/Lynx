import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hasAIEmbedding } from "@/lib/ai";
import { requireAdmin } from "@/lib/auth-utils";

// 性能监控 / 诊断 API
// 返回：数据库表计数、Embedding 缓存命中率、Flows 调度器状态、系统运行时间
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { error } = await requireAdmin();
    if (error) return error;

    const startTime = Date.now();

    // 1. 数据库表计数（含新增的 ChatSession/ChatMessage/EmbeddingCache）
    const [
      ideas, tasks, conversations, cognitions, memories,
      skills, skillVersions, skillReviews,
      larkTasks, larkTaskComments, larkWebhookEvents,
      chatSessions, chatMessages, embeddingCache,
    ] = await Promise.all([
      prisma.idea.count(),
      prisma.task.count(),
      prisma.conversation.count(),
      prisma.cognition.count(),
      prisma.memory.count(),
      prisma.skill.count(),
      prisma.skillVersion.count(),
      prisma.skillReview.count(),
      prisma.larkTask.count(),
      prisma.larkTaskComment.count(),
      prisma.larkWebhookEvent.count(),
      prisma.chatSession.count(),
      prisma.chatMessage.count(),
      prisma.embeddingCache.count(),
    ]);

    // 2. Embedding 缓存统计
    const cacheByProvider = await prisma.embeddingCache.groupBy({
      by: ["provider"],
      _count: true,
    });

    // 3. 灵感状态分布
    const ideaStatusDist = await prisma.idea.groupBy({
      by: ["status"],
      _count: true,
    });

    // 4. 任务状态分布
    const taskStatusDist = await prisma.task.groupBy({
      by: ["status"],
      _count: true,
    });

    // 5. 任务看板列分布
    const taskColumnDist = await prisma.task.groupBy({
      by: ["column"],
      _count: true,
    });

    // 6. Flows 调度器状态
    let schedulerStatus: any = { running: false, scheduledCount: 0, jobs: [] };
    try {
      const { getSchedulerStatus } = await import("@/lib/flow-scheduler");
      schedulerStatus = getSchedulerStatus();
    } catch {
      // flow-scheduler 未加载
    }

    // 7. 进程内存使用
    const memUsage = process.memoryUsage();
    const memoryStats = {
      rss: Math.round(memUsage.rss / 1024 / 1024), // MB
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      external: Math.round(memUsage.external / 1024 / 1024),
    };

    // 8. 进程运行时间
    const uptimeSeconds = Math.round(process.uptime());

    const apiDurationMs = Date.now() - startTime;

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      apiDurationMs,
      db: {
        status: "connected",
        counts: {
          ideas, tasks, conversations, cognitions, memories,
          skills, skillVersions, skillReviews,
          larkTasks, larkTaskComments, larkWebhookEvents,
          chatSessions, chatMessages, embeddingCache,
        },
        distributions: {
          ideaStatus: ideaStatusDist,
          taskStatus: taskStatusDist,
          taskColumn: taskColumnDist,
        },
      },
      embedding: {
        mode: hasAIEmbedding ? "AI 向量" : "TF-IDF 降级",
        cacheTotal: embeddingCache,
        cacheByProvider: cacheByProvider.reduce((acc, cur) => {
          acc[cur.provider] = cur._count;
          return acc;
        }, {} as Record<string, number>),
      },
      scheduler: schedulerStatus,
      system: {
        uptimeSeconds,
        memory: memoryStats,
        nodeVersion: process.version,
        platform: process.platform,
      },
    });
  } catch (e) {
    console.error("诊断 API 失败:", e);
    return NextResponse.json(
      { error: "服务器错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

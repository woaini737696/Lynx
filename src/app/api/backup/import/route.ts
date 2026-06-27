import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-utils";
import { getLogger } from "@/lib/logger";
import { rateLimit, getClientKey } from "@/lib/rate-limit";

const logger = getLogger("backup-import-api");

// 批量写入的批次大小（每批一个事务提交）
const BATCH_SIZE = 100;

/**
 * 将数组按 size 切分为多批
 */
function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

// POST /api/backup/import
// body: { data: { ideas?, tasks?, conversations?, cognitions?, memories?, skills?, flows? } }
// 仅 admin 可访问；导入时跳过已存在的 ID（createMany + skipDuplicates）
// 返回导入统计：{ ideas: 10, tasks: 15, ... }
// 限流：3 次/分钟
export async function POST(req: NextRequest) {
  try {
    // ============ Rate Limiting ============
    const ip = getClientKey(req);
    const rl = rateLimit(`backup-import:${ip}`, 3, 60 * 1000);
    if (!rl.success) {
      return NextResponse.json(
        { error: "导入请求过于频繁，请稍后再试" },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": "3",
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(Math.floor(rl.resetAt / 1000)),
            "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)),
          },
        }
      );
    }

    // 鉴权：仅 admin
    const auth = await requireAdmin();
    if (auth.user === null) return auth.error;

    const body = await req.json();
    const data = body?.data;

    if (!data || typeof data !== "object") {
      return NextResponse.json(
        { error: "请求体缺少 data 字段" },
        { status: 400 }
      );
    }

    const stats: Record<string, number> = {};

    // ============ Ideas ============
    if (Array.isArray(data.ideas)) {
      const items = (data.ideas as Record<string, unknown>[])
        .filter((item) => item?.id)
        .map((item) => ({
          id: String(item.id),
          content: (item.content as string) ?? "",
          source: (item.source as string) ?? "lightning",
          status: (item.status as string) ?? "inbox",
          tags: (item.tags ?? []) as Prisma.InputJsonValue,
          userId: (item.userId as string) ?? null,
          createdAt: item.createdAt ? new Date(item.createdAt as string) : undefined,
          updatedAt: item.updatedAt ? new Date(item.updatedAt as string) : undefined,
        }));
      let count = 0;
      for (const batch of chunk(items, BATCH_SIZE)) {
        try {
          const result = await prisma.idea.createMany({
            data: batch as any,
            skipDuplicates: true, // INSERT IGNORE，已存在则跳过
          });
          count += result.count;
        } catch (e) {
          logger.error({ err: e }, "批量导入 idea 失败");
        }
      }
      stats.ideas = count;
    }

    // ============ Tasks ============
    if (Array.isArray(data.tasks)) {
      const items = (data.tasks as Record<string, unknown>[])
        .filter((item) => item?.id)
        .map((item) => ({
          id: String(item.id),
          content: (item.content as string) ?? "",
          column: (item.column as string) ?? "task",
          position: (item.position as number) ?? 0,
          status: (item.status as string) ?? "active",
          sourceId: (item.sourceId as string) ?? null,
          userId: (item.userId as string) ?? null,
          createdAt: item.createdAt ? new Date(item.createdAt as string) : undefined,
          updatedAt: item.updatedAt ? new Date(item.updatedAt as string) : undefined,
        }));
      let count = 0;
      for (const batch of chunk(items, BATCH_SIZE)) {
        try {
          const result = await prisma.task.createMany({
            data: batch as any,
            skipDuplicates: true,
          });
          count += result.count;
        } catch (e) {
          logger.error({ err: e }, "批量导入 task 失败");
        }
      }
      stats.tasks = count;
    }

    // ============ Conversations ============
    if (Array.isArray(data.conversations)) {
      const items = (data.conversations as Record<string, unknown>[])
        .filter((item) => item?.id)
        .map((item) => ({
          id: String(item.id),
          source: (item.source as string) ?? "kimi",
          title: (item.title as string) ?? "",
          rawContent: (item.rawContent as string) ?? "",
          conclusions: (item.conclusions ?? []) as Prisma.InputJsonValue,
          todos: (item.todos ?? []) as Prisma.InputJsonValue,
          prompts: (item.prompts ?? []) as Prisma.InputJsonValue,
          data: (item.data ?? []) as Prisma.InputJsonValue,
          capturedAt: item.capturedAt ? new Date(item.capturedAt as string) : undefined,
          userId: (item.userId as string) ?? null,
          createdAt: item.createdAt ? new Date(item.createdAt as string) : undefined,
        }));
      let count = 0;
      for (const batch of chunk(items, BATCH_SIZE)) {
        try {
          const result = await prisma.conversation.createMany({
            data: batch as any,
            skipDuplicates: true,
          });
          count += result.count;
        } catch (e) {
          logger.error({ err: e }, "批量导入 conversation 失败");
        }
      }
      stats.conversations = count;
    }

    // ============ Cognitions ============
    if (Array.isArray(data.cognitions)) {
      const items = (data.cognitions as Record<string, unknown>[])
        .filter((item) => item?.id)
        .map((item) => ({
          id: String(item.id),
          type: (item.type as string) ?? "method",
          content: (item.content as string) ?? "",
          source: (item.source as string) ?? "manual",
          ideaId: (item.ideaId as string) ?? null,
          conversationId: (item.conversationId as string) ?? null,
          tags: (item.tags ?? []) as Prisma.InputJsonValue,
          userId: (item.userId as string) ?? null,
          createdAt: item.createdAt ? new Date(item.createdAt as string) : undefined,
        }));
      let count = 0;
      for (const batch of chunk(items, BATCH_SIZE)) {
        try {
          const result = await prisma.cognition.createMany({
            data: batch as any,
            skipDuplicates: true,
          });
          count += result.count;
        } catch (e) {
          logger.error({ err: e }, "批量导入 cognition 失败");
        }
      }
      stats.cognitions = count;
    }

    // ============ Memories ============
    if (Array.isArray(data.memories)) {
      const items = (data.memories as Record<string, unknown>[])
        .filter((item) => item?.id)
        .map((item) => ({
          id: String(item.id),
          type: (item.type as string) ?? "idea",
          ideaId: (item.ideaId as string) ?? null,
          conversationId: (item.conversationId as string) ?? null,
          cognitionId: (item.cognitionId as string) ?? null,
          content: (item.content as string) ?? "",
          connections: (item.connections ?? []) as Prisma.InputJsonValue,
          strength: (item.strength as number) ?? 1.0,
          userId: (item.userId as string) ?? null,
          createdAt: item.createdAt ? new Date(item.createdAt as string) : undefined,
        }));
      let count = 0;
      for (const batch of chunk(items, BATCH_SIZE)) {
        try {
          const result = await prisma.memory.createMany({
            data: batch as any,
            skipDuplicates: true,
          });
          count += result.count;
        } catch (e) {
          logger.error({ err: e }, "批量导入 memory 失败");
        }
      }
      stats.memories = count;
    }

    // ============ Skills ============
    if (Array.isArray(data.skills)) {
      const items = (data.skills as Record<string, unknown>[])
        .filter((item) => item?.id)
        .map((item) => ({
          id: String(item.id),
          name: (item.name as string) ?? "",
          description: (item.description as string) ?? "",
          category: (item.category as string) ?? "general",
          content: (item.content as string) ?? "",
          parameters: (item.parameters ?? []) as Prisma.InputJsonValue,
          promptTemplate: (item.promptTemplate as string) ?? "",
          source: (item.source as string) ?? "imported",
          tags: (item.tags ?? []) as Prisma.InputJsonValue,
          usageCount: (item.usageCount as number) ?? 0,
          userId: (item.userId as string) ?? null,
          createdAt: item.createdAt ? new Date(item.createdAt as string) : undefined,
          updatedAt: item.updatedAt ? new Date(item.updatedAt as string) : undefined,
        }));
      let count = 0;
      for (const batch of chunk(items, BATCH_SIZE)) {
        try {
          const result = await prisma.skill.createMany({
            data: batch as any,
            skipDuplicates: true,
          });
          count += result.count;
        } catch (e) {
          logger.error({ err: e }, "批量导入 skill 失败");
        }
      }
      stats.skills = count;
    }

    // ============ Flows ============
    if (Array.isArray(data.flows)) {
      const items = (data.flows as Record<string, unknown>[])
        .filter((item) => item?.id)
        .map((item) => ({
          id: String(item.id),
          name: (item.name as string) ?? "",
          description: (item.description as string) ?? "",
          nodes: (item.nodes ?? []) as Prisma.InputJsonValue,
          edges: (item.edges ?? []) as Prisma.InputJsonValue,
          enabled: (item.enabled as boolean) ?? true,
          lastRun: item.lastRun ? new Date(item.lastRun as string) : null,
          userId: (item.userId as string) ?? null,
          createdAt: item.createdAt ? new Date(item.createdAt as string) : undefined,
          updatedAt: item.updatedAt ? new Date(item.updatedAt as string) : undefined,
        }));
      let count = 0;
      for (const batch of chunk(items, BATCH_SIZE)) {
        try {
          const result = await prisma.flow.createMany({
            data: batch as any,
            skipDuplicates: true,
          });
          count += result.count;
        } catch (e) {
          logger.error({ err: e }, "批量导入 flow 失败");
        }
      }
      stats.flows = count;
    }

    return NextResponse.json({
      success: true,
      stats,
      importedAt: new Date().toISOString(),
    });
  } catch (e) {
    logger.error({ err: e }, "数据导入失败");
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

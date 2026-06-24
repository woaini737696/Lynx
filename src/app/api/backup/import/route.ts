import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-utils";
import { getLogger } from "@/lib/logger";
import { rateLimit, getClientKey } from "@/lib/rate-limit";

const logger = getLogger("backup-import-api");

// POST /api/backup/import
// body: { data: { ideas?, tasks?, conversations?, cognitions?, memories?, skills?, flows? } }
// 仅 admin 可访问；导入时跳过已存在的 ID（upsert）
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
      let count = 0;
      for (const item of data.ideas) {
        try {
          if (!item?.id) continue;
          await prisma.idea.upsert({
            where: { id: item.id },
            create: {
              id: item.id,
              content: item.content ?? "",
              source: item.source ?? "lightning",
              status: item.status ?? "inbox",
              tags: (item.tags ?? []) as Prisma.InputJsonValue,
              userId: item.userId ?? null,
              createdAt: item.createdAt ? new Date(item.createdAt) : undefined,
              updatedAt: item.updatedAt ? new Date(item.updatedAt) : undefined,
            },
            update: {}, // 已存在则跳过（不更新）
          });
          count++;
        } catch (e) {
          logger.error({ err: e }, "导入 idea 失败");
        }
      }
      stats.ideas = count;
    }

    // ============ Tasks ============
    if (Array.isArray(data.tasks)) {
      let count = 0;
      for (const item of data.tasks) {
        try {
          if (!item?.id) continue;
          await prisma.task.upsert({
            where: { id: item.id },
            create: {
              id: item.id,
              content: item.content ?? "",
              column: item.column ?? "task",
              position: item.position ?? 0,
              status: item.status ?? "active",
              sourceId: item.sourceId ?? null,
              userId: item.userId ?? null,
              createdAt: item.createdAt ? new Date(item.createdAt) : undefined,
              updatedAt: item.updatedAt ? new Date(item.updatedAt) : undefined,
            },
            update: {},
          });
          count++;
        } catch (e) {
          logger.error({ err: e }, "导入 task 失败");
        }
      }
      stats.tasks = count;
    }

    // ============ Conversations ============
    if (Array.isArray(data.conversations)) {
      let count = 0;
      for (const item of data.conversations) {
        try {
          if (!item?.id) continue;
          await prisma.conversation.upsert({
            where: { id: item.id },
            create: {
              id: item.id,
              source: item.source ?? "kimi",
              title: item.title ?? "",
              rawContent: item.rawContent ?? "",
              conclusions: (item.conclusions ?? []) as Prisma.InputJsonValue,
              todos: (item.todos ?? []) as Prisma.InputJsonValue,
              prompts: (item.prompts ?? []) as Prisma.InputJsonValue,
              data: (item.data ?? []) as Prisma.InputJsonValue,
              capturedAt: item.capturedAt ? new Date(item.capturedAt) : undefined,
              userId: item.userId ?? null,
              createdAt: item.createdAt ? new Date(item.createdAt) : undefined,
            },
            update: {},
          });
          count++;
        } catch (e) {
          logger.error({ err: e }, "导入 conversation 失败");
        }
      }
      stats.conversations = count;
    }

    // ============ Cognitions ============
    if (Array.isArray(data.cognitions)) {
      let count = 0;
      for (const item of data.cognitions) {
        try {
          if (!item?.id) continue;
          await prisma.cognition.upsert({
            where: { id: item.id },
            create: {
              id: item.id,
              type: item.type ?? "method",
              content: item.content ?? "",
              source: item.source ?? "manual",
              ideaId: item.ideaId ?? null,
              conversationId: item.conversationId ?? null,
              tags: (item.tags ?? []) as Prisma.InputJsonValue,
              userId: item.userId ?? null,
              createdAt: item.createdAt ? new Date(item.createdAt) : undefined,
            },
            update: {},
          });
          count++;
        } catch (e) {
          logger.error({ err: e }, "导入 cognition 失败");
        }
      }
      stats.cognitions = count;
    }

    // ============ Memories ============
    if (Array.isArray(data.memories)) {
      let count = 0;
      for (const item of data.memories) {
        try {
          if (!item?.id) continue;
          await prisma.memory.upsert({
            where: { id: item.id },
            create: {
              id: item.id,
              type: item.type ?? "idea",
              ideaId: item.ideaId ?? null,
              conversationId: item.conversationId ?? null,
              cognitionId: item.cognitionId ?? null,
              content: item.content ?? "",
              connections: (item.connections ?? []) as Prisma.InputJsonValue,
              strength: item.strength ?? 1.0,
              userId: item.userId ?? null,
              createdAt: item.createdAt ? new Date(item.createdAt) : undefined,
            },
            update: {},
          });
          count++;
        } catch (e) {
          logger.error({ err: e }, "导入 memory 失败");
        }
      }
      stats.memories = count;
    }

    // ============ Skills ============
    if (Array.isArray(data.skills)) {
      let count = 0;
      for (const item of data.skills) {
        try {
          if (!item?.id) continue;
          await prisma.skill.upsert({
            where: { id: item.id },
            create: {
              id: item.id,
              name: item.name ?? "",
              description: item.description ?? "",
              category: item.category ?? "general",
              content: item.content ?? "",
              parameters: (item.parameters ?? []) as Prisma.InputJsonValue,
              promptTemplate: item.promptTemplate ?? "",
              source: item.source ?? "imported",
              tags: (item.tags ?? []) as Prisma.InputJsonValue,
              usageCount: item.usageCount ?? 0,
              userId: item.userId ?? null,
              createdAt: item.createdAt ? new Date(item.createdAt) : undefined,
              updatedAt: item.updatedAt ? new Date(item.updatedAt) : undefined,
            },
            update: {},
          });
          count++;
        } catch (e) {
          logger.error({ err: e }, "导入 skill 失败");
        }
      }
      stats.skills = count;
    }

    // ============ Flows ============
    if (Array.isArray(data.flows)) {
      let count = 0;
      for (const item of data.flows) {
        try {
          if (!item?.id) continue;
          await prisma.flow.upsert({
            where: { id: item.id },
            create: {
              id: item.id,
              name: item.name ?? "",
              description: item.description ?? "",
              nodes: (item.nodes ?? []) as Prisma.InputJsonValue,
              edges: (item.edges ?? []) as Prisma.InputJsonValue,
              enabled: item.enabled ?? true,
              lastRun: item.lastRun ? new Date(item.lastRun) : null,
              userId: item.userId ?? null,
              createdAt: item.createdAt ? new Date(item.createdAt) : undefined,
              updatedAt: item.updatedAt ? new Date(item.updatedAt) : undefined,
            },
            update: {},
          });
          count++;
        } catch (e) {
          logger.error({ err: e }, "导入 flow 失败");
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

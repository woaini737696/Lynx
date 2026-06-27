import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, requirePermission, buildUserFilter } from "@/lib/auth-utils";
import { getLogger } from "@/lib/logger";
import { rateLimit, getClientKey } from "@/lib/rate-limit";

const logger = getLogger("backup-export-api");

// 使用 request.url 读取查询参数，必须动态渲染
export const dynamic = "force-dynamic";

// 支持的导出类型
const SINGLE_TYPES = [
  "ideas",
  "tasks",
  "conversations",
  "cognitions",
  "memories",
  "skills",
  "flows",
] as const;
type ExportType = (typeof SINGLE_TYPES)[number];

// GET /api/backup/export?type=all|ideas|tasks|conversations|cognitions|memories|skills|flows
// 限流：5 次/分钟
export async function GET(req: NextRequest) {
  try {
    // ============ Rate Limiting ============
    const ip = getClientKey(req);
    const rl = rateLimit(`backup-export:${ip}`, 5, 60 * 1000);
    if (!rl.success) {
      return NextResponse.json(
        { error: "导出请求过于频繁，请稍后再试" },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": "5",
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(Math.floor(rl.resetAt / 1000)),
            "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)),
          },
        }
      );
    }

    // 鉴权：admin 可导出全部，普通用户只能导出自己的（需具备 backup:export 权限）
    const auth = await requirePermission("backup:export");
    if (auth.user === null) return auth.error;

    const { searchParams } = new URL(req.url);
    const typeParam = (searchParams.get("type") || "all").toLowerCase();

    const userFilter = buildUserFilter(auth.user);

    // 决定要导出哪些类型
    const typesToExport: ExportType[] =
      typeParam === "all" ? [...SINGLE_TYPES] : (SINGLE_TYPES.includes(typeParam as ExportType) ? [typeParam as ExportType] : [...SINGLE_TYPES]);

    const data: Record<string, unknown> = {};

    // 并行查询各类型数据
    const tasks: Promise<void>[] = [];

    if (typesToExport.includes("ideas")) {
      tasks.push(
        (async () => {
          data.ideas = await prisma.idea.findMany({
            where: userFilter,
            orderBy: { createdAt: "desc" },
          });
        })()
      );
    }

    if (typesToExport.includes("tasks")) {
      tasks.push(
        (async () => {
          data.tasks = await prisma.task.findMany({
            where: userFilter,
            orderBy: { createdAt: "desc" },
          });
        })()
      );
    }

    if (typesToExport.includes("conversations")) {
      tasks.push(
        (async () => {
          data.conversations = await prisma.conversation.findMany({
            where: userFilter,
            orderBy: { capturedAt: "desc" },
          });
        })()
      );
    }

    if (typesToExport.includes("cognitions")) {
      tasks.push(
        (async () => {
          data.cognitions = await prisma.cognition.findMany({
            where: userFilter,
            orderBy: { createdAt: "desc" },
          });
        })()
      );
    }

    if (typesToExport.includes("memories")) {
      tasks.push(
        (async () => {
          // Memory 含 embedding 二进制字段，导出时排除
          data.memories = await prisma.memory.findMany({
            where: userFilter,
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              type: true,
              ideaId: true,
              conversationId: true,
              cognitionId: true,
              content: true,
              connections: true,
              strength: true,
              userId: true,
              createdAt: true,
            },
          });
        })()
      );
    }

    if (typesToExport.includes("skills")) {
      tasks.push(
        (async () => {
          data.skills = await prisma.skill.findMany({
            where: userFilter,
            orderBy: { createdAt: "desc" },
          });
        })()
      );
    }

    if (typesToExport.includes("flows")) {
      tasks.push(
        (async () => {
          data.flows = await prisma.flow.findMany({
            where: userFilter,
            orderBy: { createdAt: "desc" },
          });
        })()
      );
    }

    // 单类型导出：直接返回 JSON（数据量小，无需流式）
    if (typesToExport.length === 1) {
      await Promise.all(tasks);
      return NextResponse.json({
        exportedAt: new Date().toISOString(),
        version: "1.0",
        data,
      });
    }

    // 全量导出（type=all）：流式 JSON 响应，避免大数据量内存溢出
    // 格式：{"exportedAt":"...","version":"1.0","data":{<逐块写入>}}
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        // 写入 JSON 头部
        controller.enqueue(
          encoder.encode(
            `{"exportedAt":"${new Date().toISOString()}","version":"1.0","data":{`
          )
        );

        const typeKeys: string[] = typesToExport;
        for (let i = 0; i < typeKeys.length; i++) {
          const key = typeKeys[i];
          // 等待该类型查询完成
          await tasks[i];
          // 写入 "key":<json>
          const prefix = i > 0 ? "," : "";
          const chunk = `${prefix}${JSON.stringify(key)}:${JSON.stringify(data[key] ?? null)}`;
          controller.enqueue(encoder.encode(chunk));
          // 释放内存：导出后删除引用
          delete data[key];
        }

        // 写入 JSON 尾部
        controller.enqueue(encoder.encode("}}"));
        controller.close();
      },
    });

    return new NextResponse(stream, {
      headers: {
        "Content-Type": "application/json",
        "Transfer-Encoding": "chunked",
        "Content-Disposition": `attachment; filename="lynnhub-export-${Date.now()}.json"`,
      },
    });
  } catch (e) {
    logger.error({ err: e }, "数据备份导出失败");
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

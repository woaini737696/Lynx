import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, buildUserFilter } from "@/lib/auth-utils";
import { getLogger } from "@/lib/logger";
import { rateLimit, getClientKey } from "@/lib/rate-limit";

const logger = getLogger("backup-export-api");

// 单表导出上限：防止全量查询导致 OOM（达到上限时在响应中标记 truncated）
const EXPORT_TAKE_LIMIT = 10000;

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
    // 记录达到上限的表，在响应中标记 truncated 以提示数据不完整
    const truncated: Record<string, boolean> = {};

    // 并行查询各类型数据
    const tasks: Promise<void>[] = [];

    if (typesToExport.includes("ideas")) {
      tasks.push(
        (async () => {
          const rows = await prisma.idea.findMany({
            where: userFilter,
            orderBy: { createdAt: "desc" },
            take: EXPORT_TAKE_LIMIT,
          });
          data.ideas = rows;
          if (rows.length >= EXPORT_TAKE_LIMIT) truncated.ideas = true;
        })()
      );
    }

    if (typesToExport.includes("tasks")) {
      tasks.push(
        (async () => {
          const rows = await prisma.task.findMany({
            where: userFilter,
            orderBy: { createdAt: "desc" },
            take: EXPORT_TAKE_LIMIT,
          });
          data.tasks = rows;
          if (rows.length >= EXPORT_TAKE_LIMIT) truncated.tasks = true;
        })()
      );
    }

    if (typesToExport.includes("conversations")) {
      tasks.push(
        (async () => {
          const rows = await prisma.conversation.findMany({
            where: userFilter,
            orderBy: { capturedAt: "desc" },
            take: EXPORT_TAKE_LIMIT,
          });
          data.conversations = rows;
          if (rows.length >= EXPORT_TAKE_LIMIT) truncated.conversations = true;
        })()
      );
    }

    if (typesToExport.includes("cognitions")) {
      tasks.push(
        (async () => {
          const rows = await prisma.cognition.findMany({
            where: userFilter,
            orderBy: { createdAt: "desc" },
            take: EXPORT_TAKE_LIMIT,
          });
          data.cognitions = rows;
          if (rows.length >= EXPORT_TAKE_LIMIT) truncated.cognitions = true;
        })()
      );
    }

    if (typesToExport.includes("memories")) {
      tasks.push(
        (async () => {
          // Memory 含 embedding 二进制字段（LongBlob），导出时用 select 裁剪排除
          const rows = await prisma.memory.findMany({
            where: userFilter,
            orderBy: { createdAt: "desc" },
            take: EXPORT_TAKE_LIMIT,
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
          data.memories = rows;
          if (rows.length >= EXPORT_TAKE_LIMIT) truncated.memories = true;
        })()
      );
    }

    if (typesToExport.includes("skills")) {
      tasks.push(
        (async () => {
          const rows = await prisma.skill.findMany({
            where: userFilter,
            orderBy: { createdAt: "desc" },
            take: EXPORT_TAKE_LIMIT,
          });
          data.skills = rows;
          if (rows.length >= EXPORT_TAKE_LIMIT) truncated.skills = true;
        })()
      );
    }

    if (typesToExport.includes("flows")) {
      tasks.push(
        (async () => {
          const rows = await prisma.flow.findMany({
            where: userFilter,
            orderBy: { createdAt: "desc" },
            take: EXPORT_TAKE_LIMIT,
          });
          data.flows = rows;
          if (rows.length >= EXPORT_TAKE_LIMIT) truncated.flows = true;
        })()
      );
    }

    // 单类型导出：直接返回 JSON（数据量小，无需流式）
    if (typesToExport.length === 1) {
      await Promise.all(tasks);
      const hasTruncation = Object.keys(truncated).length > 0;
      return NextResponse.json({
        exportedAt: new Date().toISOString(),
        version: "1.0",
        data,
        ...(hasTruncation ? { truncated } : {}),
      });
    }

    // 全量导出（type=all）：流式 JSON 响应，避免大数据量内存溢出
    // 格式：{"exportedAt":"...","version":"1.0","data":{<逐块写入>},"truncated":{...}}
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
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

          // 写入 JSON 尾部（附加 truncated 标记，提示哪些表达到上限）
          const hasTruncation = Object.keys(truncated).length > 0;
          const tail = hasTruncation
            ? `},"truncated":${JSON.stringify(truncated)}}`
            : "}}";
          controller.enqueue(encoder.encode(tail));
          controller.close();
        } catch (e) {
          logger.error({ err: e }, "流式导出写入失败");
          controller.error(e);
        }
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

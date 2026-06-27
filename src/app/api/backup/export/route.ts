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

// 支持的导出类型（含原有 7 类 + 扩展的 16 类）
const SINGLE_TYPES = [
  // 原有类型
  "ideas",
  "tasks",
  "conversations",
  "cognitions",
  "memories",
  "skills",
  "flows",
  // 扩展类型：对话与消息
  "chatsessions",
  "chatmessages",
  // 扩展类型：巡检
  "patrolrules",
  "patrollogs",
  // 扩展类型：今日聚焦
  "dailyfocuses",
  "dailyfocusitems",
  // 扩展类型：灵感墓地
  "graveyard",
  // 扩展类型：工作流执行
  "flowexecutions",
  // 扩展类型：技能执行
  "skillexecutions",
  // 扩展类型：Hermes 汇报
  "hermesreports",
  // 扩展类型：AI 设置（排除敏感字段）
  "aisettings",
  // 扩展类型：职业工作空间
  "professionworkspaces",
  // 扩展类型：用户（排除 passwordHash）
  "users",
  // 扩展类型：角色
  "roles",
  // 扩展类型：任务模式
  "taskpatterns",
  // 扩展类型：飞书任务
  "larktasks",
  "larktaskcomments",
  "larkwebhookevents",
] as const;
type ExportType = (typeof SINGLE_TYPES)[number];

// GET /api/backup/export?type=all|ideas|tasks|...
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
    const isAdmin = auth.user.role === "admin";

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

    // ===== 扩展类型：对话会话与消息 =====
    if (typesToExport.includes("chatsessions")) {
      tasks.push(
        (async () => {
          const rows = await prisma.chatSession.findMany({
            where: userFilter,
            orderBy: { updatedAt: "desc" },
            take: EXPORT_TAKE_LIMIT,
          });
          data.chatsessions = rows;
          if (rows.length >= EXPORT_TAKE_LIMIT) truncated.chatsessions = true;
        })()
      );
    }

    if (typesToExport.includes("chatmessages")) {
      tasks.push(
        (async () => {
          // ChatMessage 无 userId，通过 session 关联过滤
          const rows = await prisma.chatMessage.findMany({
            where: isAdmin ? {} : { session: { userId: auth.user.id } },
            orderBy: { createdAt: "desc" },
            take: EXPORT_TAKE_LIMIT,
          });
          data.chatmessages = rows;
          if (rows.length >= EXPORT_TAKE_LIMIT) truncated.chatmessages = true;
        })()
      );
    }

    // ===== 扩展类型：巡检规则与日志 =====
    if (typesToExport.includes("patrolrules")) {
      tasks.push(
        (async () => {
          const rows = await prisma.patrolRule.findMany({
            where: userFilter,
            orderBy: { createdAt: "desc" },
            take: EXPORT_TAKE_LIMIT,
          });
          data.patrolrules = rows;
          if (rows.length >= EXPORT_TAKE_LIMIT) truncated.patrolrules = true;
        })()
      );
    }

    if (typesToExport.includes("patrollogs")) {
      tasks.push(
        (async () => {
          // PatrolLog 无 userId，通过 rule 关联过滤
          const rows = await prisma.patrolLog.findMany({
            where: isAdmin ? {} : { rule: { userId: auth.user.id } },
            orderBy: { startedAt: "desc" },
            take: EXPORT_TAKE_LIMIT,
          });
          data.patrollogs = rows;
          if (rows.length >= EXPORT_TAKE_LIMIT) truncated.patrollogs = true;
        })()
      );
    }

    // ===== 扩展类型：今日聚焦 =====
    if (typesToExport.includes("dailyfocuses")) {
      tasks.push(
        (async () => {
          const rows = await prisma.dailyFocus.findMany({
            where: userFilter,
            orderBy: { date: "desc" },
            take: EXPORT_TAKE_LIMIT,
          });
          data.dailyfocuses = rows;
          if (rows.length >= EXPORT_TAKE_LIMIT) truncated.dailyfocuses = true;
        })()
      );
    }

    if (typesToExport.includes("dailyfocusitems")) {
      tasks.push(
        (async () => {
          // DailyFocusItem 无 userId，通过 dailyFocus 关联过滤
          const rows = await prisma.dailyFocusItem.findMany({
            where: isAdmin ? {} : { dailyFocus: { userId: auth.user.id } },
            take: EXPORT_TAKE_LIMIT,
          });
          data.dailyfocusitems = rows;
          if (rows.length >= EXPORT_TAKE_LIMIT) truncated.dailyfocusitems = true;
        })()
      );
    }

    // ===== 扩展类型：灵感墓地 =====
    if (typesToExport.includes("graveyard")) {
      tasks.push(
        (async () => {
          // Graveyard 无 userId，通过 idea 关联过滤
          const rows = await prisma.graveyard.findMany({
            where: isAdmin ? {} : { idea: { userId: auth.user.id } },
            orderBy: { abandonedAt: "desc" },
            take: EXPORT_TAKE_LIMIT,
          });
          data.graveyard = rows;
          if (rows.length >= EXPORT_TAKE_LIMIT) truncated.graveyard = true;
        })()
      );
    }

    // ===== 扩展类型：工作流执行历史 =====
    if (typesToExport.includes("flowexecutions")) {
      tasks.push(
        (async () => {
          const rows = await prisma.flowExecution.findMany({
            where: userFilter,
            orderBy: { startedAt: "desc" },
            take: EXPORT_TAKE_LIMIT,
          });
          data.flowexecutions = rows;
          if (rows.length >= EXPORT_TAKE_LIMIT) truncated.flowexecutions = true;
        })()
      );
    }

    // ===== 扩展类型：技能执行历史 =====
    if (typesToExport.includes("skillexecutions")) {
      tasks.push(
        (async () => {
          const rows = await prisma.skillExecution.findMany({
            where: userFilter,
            orderBy: { createdAt: "desc" },
            take: EXPORT_TAKE_LIMIT,
          });
          data.skillexecutions = rows;
          if (rows.length >= EXPORT_TAKE_LIMIT) truncated.skillexecutions = true;
        })()
      );
    }

    // ===== 扩展类型：Hermes 汇报 =====
    if (typesToExport.includes("hermesreports")) {
      tasks.push(
        (async () => {
          const rows = await prisma.hermesReport.findMany({
            where: userFilter,
            orderBy: { createdAt: "desc" },
            take: EXPORT_TAKE_LIMIT,
          });
          data.hermesreports = rows;
          if (rows.length >= EXPORT_TAKE_LIMIT) truncated.hermesreports = true;
        })()
      );
    }

    // ===== 扩展类型：AI 设置（排除敏感 API Key 字段）=====
    if (typesToExport.includes("aisettings")) {
      tasks.push(
        (async () => {
          // AISetting 为全局单例，无 userId，所有有权限的用户均可导出
          const rows = await prisma.aISetting.findMany({
            take: EXPORT_TAKE_LIMIT,
            select: {
              id: true,
              assistantName: true,
              avatarUrl: true,
              assistantAvatar: true,
              personaStyle: true,
              distilledStyle: true,
              styleStrength: true,
              clonedVoiceId: true,
              clonedVoiceName: true,
              clonedAt: true,
              defaultVoice: true,
              autoSpeak: true,
              voiceMode: true,
              feishuNotify: true,
              hermesTakeover: true,
              hermesAutoReport: true,
              hermesReportCron: true,
              updatedAt: true,
              defaultProvider: true,
              // 排除敏感字段：deepseekApiKey / mimoApiKey / embeddingApiKey / larkWebhookToken
              deepseekBaseUrl: true,
              deepseekModel: true,
              mimoBaseUrl: true,
              mimoModel: true,
              embeddingBaseUrl: true,
              embeddingModel: true,
              larkWebhookUrl: true,
            },
          });
          data.aisettings = rows;
          if (rows.length >= EXPORT_TAKE_LIMIT) truncated.aisettings = true;
        })()
      );
    }

    // ===== 扩展类型：职业工作空间 =====
    if (typesToExport.includes("professionworkspaces")) {
      tasks.push(
        (async () => {
          // ProfessionWorkspace 为全局配置，无 userId
          const rows = await prisma.professionWorkspace.findMany({
            take: EXPORT_TAKE_LIMIT,
            orderBy: { createdAt: "desc" },
          });
          data.professionworkspaces = rows;
          if (rows.length >= EXPORT_TAKE_LIMIT) truncated.professionworkspaces = true;
        })()
      );
    }

    // ===== 扩展类型：用户（排除 passwordHash）=====
    if (typesToExport.includes("users")) {
      tasks.push(
        (async () => {
          // 非 admin 仅导出自己的用户记录；admin 导出全部
          const rows = await prisma.user.findMany({
            where: isAdmin ? {} : { id: auth.user.id },
            take: EXPORT_TAKE_LIMIT,
            select: {
              id: true,
              username: true,
              email: true,
              displayName: true,
              role: true,
              profession: true,
              avatarUrl: true,
              active: true,
              createdAt: true,
              updatedAt: true,
              userDeepseekApiKey: true,
              userMimoApiKey: true,
              userAiProvider: true,
              // 排除 passwordHash（安全）
            },
          });
          data.users = rows;
          if (rows.length >= EXPORT_TAKE_LIMIT) truncated.users = true;
        })()
      );
    }

    // ===== 扩展类型：角色 =====
    if (typesToExport.includes("roles")) {
      tasks.push(
        (async () => {
          // Role 为全局配置，无 userId
          const rows = await prisma.role.findMany({
            take: EXPORT_TAKE_LIMIT,
            orderBy: { createdAt: "desc" },
          });
          data.roles = rows;
          if (rows.length >= EXPORT_TAKE_LIMIT) truncated.roles = true;
        })()
      );
    }

    // ===== 扩展类型：任务模式 =====
    if (typesToExport.includes("taskpatterns")) {
      tasks.push(
        (async () => {
          const rows = await prisma.taskPattern.findMany({
            where: userFilter,
            orderBy: { createdAt: "desc" },
            take: EXPORT_TAKE_LIMIT,
          });
          data.taskpatterns = rows;
          if (rows.length >= EXPORT_TAKE_LIMIT) truncated.taskpatterns = true;
        })()
      );
    }

    // ===== 扩展类型：飞书任务（全局缓存）=====
    if (typesToExport.includes("larktasks")) {
      tasks.push(
        (async () => {
          // LarkTask 为全局缓存，无 userId
          const rows = await prisma.larkTask.findMany({
            take: EXPORT_TAKE_LIMIT,
            orderBy: { syncedAt: "desc" },
          });
          data.larktasks = rows;
          if (rows.length >= EXPORT_TAKE_LIMIT) truncated.larktasks = true;
        })()
      );
    }

    if (typesToExport.includes("larktaskcomments")) {
      tasks.push(
        (async () => {
          // LarkTaskComment 无 userId，全局导出
          const rows = await prisma.larkTaskComment.findMany({
            take: EXPORT_TAKE_LIMIT,
            orderBy: { createdAt: "desc" },
          });
          data.larktaskcomments = rows;
          if (rows.length >= EXPORT_TAKE_LIMIT) truncated.larktaskcomments = true;
        })()
      );
    }

    if (typesToExport.includes("larkwebhookevents")) {
      tasks.push(
        (async () => {
          // LarkWebhookEvent 无 userId，全局导出
          const rows = await prisma.larkWebhookEvent.findMany({
            take: EXPORT_TAKE_LIMIT,
            orderBy: { createdAt: "desc" },
          });
          data.larkwebhookevents = rows;
          if (rows.length >= EXPORT_TAKE_LIMIT) truncated.larkwebhookevents = true;
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

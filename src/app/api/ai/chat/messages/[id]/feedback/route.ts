import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-utils";
import { getLogger } from "@/lib/logger";

const logger = getLogger("message-feedback");

// PATCH /api/ai/chat/messages/[id]/feedback - 标注 AI 助理消息
// body: { feedback: "good" | "bad" | null, reason?: string }
// 当 feedback="bad" 且有 reason 时，异步触发 HermesAgent 学习纠正
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { user, error } = await requireAuth();
  if (error) return error;
  try {
    const { id } = params;
    const body = await req.json().catch(() => ({}));
    const feedback = body.feedback === "good" || body.feedback === "bad" ? body.feedback : null;
    const reason = typeof body.reason === "string" ? body.reason.slice(0, 2000) : null;

    // 查找消息，验证归属权
    const msg = await prisma.chatMessage.findUnique({
      where: { id },
      include: { session: { select: { userId: true, title: true } } },
    });
    if (!msg) {
      return NextResponse.json({ error: "消息不存在" }, { status: 404 });
    }
    if (user.role !== "admin" && msg.session.userId !== user.id) {
      return NextResponse.json({ error: "无权操作" }, { status: 403 });
    }

    // 仅允许标注 assistant 消息
    if (msg.role !== "assistant") {
      return NextResponse.json({ error: "仅可标注 AI 回复消息" }, { status: 400 });
    }

    await prisma.chatMessage.update({
      where: { id },
      data: { feedback, feedbackReason: reason },
    });

    // 当标注为 bad 时，异步记录到 HermesReports 用于 HermesAgent 自主学习纠正
    // 不阻塞响应，失败仅记日志
    if (feedback === "bad") {
      try {
        // 查找该消息之前的 user 消息（作为上下文）
        const sessionMsgs = await prisma.chatMessage.findMany({
          where: { sessionId: msg.sessionId, createdAt: { lte: msg.createdAt } },
          orderBy: { createdAt: "asc" },
          take: 10,
          select: { role: true, content: true },
        });
        const contextStr = sessionMsgs
          .map((m) => `${m.role}: ${m.content.slice(0, 500)}`)
          .join("\n");

        await prisma.hermesReport.create({
          data: {
            userId: user.id,
            type: "custom",
            title: `消息标注纠正: ${msg.session.title}`,
            content: JSON.stringify({
              messageId: id,
              sessionId: msg.sessionId,
              badReply: msg.content.slice(0, 1000),
              reason: reason || "(未提供原因)",
              context: contextStr.slice(0, 3000),
              createdAt: new Date().toISOString(),
            }),
            trigger: "manual",
          },
        });
        logger.info({ messageId: id, userId: user.id }, "已记录 bad 标注到 HermesReport，待 HermesAgent 学习");
      } catch (e) {
        logger.error({ err: e, messageId: id }, "记录 bad 标注到 HermesReport 失败（不阻塞）");
      }
    }

    return NextResponse.json({ success: true, id, feedback, feedbackReason: reason });
  } catch (e) {
    logger.error({ err: e }, "标注消息失败");
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

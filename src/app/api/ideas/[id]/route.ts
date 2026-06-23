import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// 处理 Inbox 灵感：拖入看板 / 延后 / 放弃
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { action, column, reason, reviveCondition } = await req.json();
    const { id } = params;

    if (action === "board") {
      // 拖入看板 - 检查满额阻断
      const col = column as "northstar" | "campaign" | "task";
      const limits = { northstar: 3, campaign: 5, task: 10 };
      const count = await prisma.task.count({
        where: { column: col, status: "active" },
      });
      if (count >= limits[col]) {
        return NextResponse.json(
          { error: `${col} 列已满（${limits[col]}个），请先完成或降级` },
          { status: 409 }
        );
      }

      const idea = await prisma.idea.update({
        where: { id },
        data: { status: "board" },
      });
      const task = await prisma.task.create({
        data: {
          content: idea.content,
          column: col,
          position: count,
          status: "active",
          sourceId: id,
        },
      });
      return NextResponse.json({ task, success: true });
    }

    if (action === "postpone") {
      // 延后 - 保持 inbox 状态，但标记延后（简化：直接保留）
      return NextResponse.json({ success: true });
    }

    if (action === "abandon") {
      // 放弃入墓地 - 必须填原因和复活条件
      if (!reason || !reviveCondition) {
        return NextResponse.json(
          { error: "放弃必须填写原因和复活条件" },
          { status: 400 }
        );
      }
      await prisma.idea.update({
        where: { id },
        data: { status: "graveyard" },
      });
      const graveyard = await prisma.graveyard.create({
        data: {
          originalIdeaId: id,
          reason,
          reviveCondition,
        },
      });
      return NextResponse.json({ graveyard, success: true });
    }

    return NextResponse.json({ error: "未知操作" }, { status: 400 });
  } catch (e) {
    console.error("处理灵感失败:", e);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

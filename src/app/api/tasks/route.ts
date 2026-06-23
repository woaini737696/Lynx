import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// 获取看板任务
export async function GET() {
  try {
    const tasks = await prisma.task.findMany({
      where: { status: { in: ["active", "done"] } },
      orderBy: [{ column: "asc" }, { position: "asc" }],
    });
    return NextResponse.json({ tasks });
  } catch (e) {
    console.error("获取看板失败:", e);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

// 新增看板任务（带满额阻断）
export async function POST(req: NextRequest) {
  try {
    const { content, column } = await req.json();
    const col = column as "northstar" | "campaign" | "task";
    const limits = { northstar: 3, campaign: 5, task: 10 };

    const count = await prisma.task.count({
      where: { column: col, status: "active" },
    });
    if (count >= limits[col]) {
      return NextResponse.json(
        { error: `${col} 列已满（上限 ${limits[col]}），请先完成或降级` },
        { status: 409 }
      );
    }

    const task = await prisma.task.create({
      data: { content, column: col, position: count, status: "active" },
    });
    return NextResponse.json({ task, success: true });
  } catch (e) {
    console.error("新增任务失败:", e);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

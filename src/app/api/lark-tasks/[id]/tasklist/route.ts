import { NextRequest, NextResponse } from "next/server";
import { updateTasklist } from "@/lib/lark-sync";

// PATCH /api/lark-tasks/[id]/tasklist - 更新任务所属清单
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: taskId } = params;
    if (!taskId) {
      return NextResponse.json({ error: "缺少任务 ID" }, { status: 400 });
    }
    const { tasklistId } = (await req.json()) as { tasklistId?: string };
    if (!tasklistId) {
      return NextResponse.json({ error: "缺少 tasklistId" }, { status: 400 });
    }
    const res = updateTasklist(taskId, tasklistId);
    if (!res.ok) {
      return NextResponse.json(
        { error: "更新任务清单失败：" + res.error },
        { status: 502 }
      );
    }
    return NextResponse.json({ success: true, ignored: res.ignored });
  } catch (e) {
    console.error("更新任务清单失败:", e);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

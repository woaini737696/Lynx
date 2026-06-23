import { NextRequest, NextResponse } from "next/server";
import { updateAssignees } from "@/lib/lark-sync";

// PATCH /api/lark-tasks/[id]/assignees - 更新任务负责人（多选）
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: taskId } = params;
    if (!taskId) {
      return NextResponse.json({ error: "缺少任务 ID" }, { status: 400 });
    }
    const { assignees } = (await req.json()) as { assignees?: string[] };
    if (!Array.isArray(assignees)) {
      return NextResponse.json({ error: "assignees 必须是数组" }, { status: 400 });
    }
    const res = updateAssignees(taskId, assignees);
    if (!res.ok) {
      return NextResponse.json(
        { error: "更新负责人失败：" + res.error },
        { status: 502 }
      );
    }
    return NextResponse.json({ success: true, ignored: res.ignored });
  } catch (e) {
    console.error("更新负责人失败:", e);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

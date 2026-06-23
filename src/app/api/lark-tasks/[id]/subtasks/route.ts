import { NextRequest, NextResponse } from "next/server";
import { createSubtask, getSubtasks, completeTask } from "@/lib/lark-sync";

// GET /api/lark-tasks/[id]/subtasks - 获取子任务列表
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: taskId } = params;
    if (!taskId) {
      return NextResponse.json({ error: "缺少任务 ID" }, { status: 400 });
    }
    const res = getSubtasks(taskId);
    if (!res.ok) {
      return NextResponse.json(
        { error: "获取子任务失败：" + res.error },
        { status: 502 }
      );
    }
    return NextResponse.json({ subtasks: res.subtasks });
  } catch (e) {
    console.error("获取子任务失败:", e);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

// POST /api/lark-tasks/[id]/subtasks
// { summary } - 创建子任务
// { action: "complete", subtaskId } - 完成子任务
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: taskId } = params;
    if (!taskId) {
      return NextResponse.json({ error: "缺少任务 ID" }, { status: 400 });
    }
    const body = await req.json();

    // 完成子任务（子任务也是独立 task，用其 guid 调用 complete）
    if (body.action === "complete") {
      const { subtaskId } = body as { subtaskId: string };
      if (!subtaskId) {
        return NextResponse.json({ error: "缺少 subtaskId" }, { status: 400 });
      }
      const res = completeTask(subtaskId);
      if (!res.ok) {
        return NextResponse.json(
          { error: "完成子任务失败：" + res.error },
          { status: 502 }
        );
      }
      return NextResponse.json({ success: true });
    }

    // 创建子任务
    const { summary } = body as { summary: string };
    if (!summary || !summary.trim()) {
      return NextResponse.json({ error: "缺少子任务标题" }, { status: 400 });
    }
    const res = createSubtask(taskId, summary.trim());
    if (!res.ok) {
      return NextResponse.json(
        { error: "创建子任务失败：" + res.error },
        { status: 502 }
      );
    }
    return NextResponse.json({ success: true, subtask: res.subtask });
  } catch (e) {
    console.error("子任务操作失败:", e);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

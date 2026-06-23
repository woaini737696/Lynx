import { NextRequest, NextResponse } from "next/server";
import { updateFollowers } from "@/lib/lark-sync";

// PATCH /api/lark-tasks/[id]/followers - 更新任务关注人（多选）
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: taskId } = params;
    if (!taskId) {
      return NextResponse.json({ error: "缺少任务 ID" }, { status: 400 });
    }
    const { followers } = (await req.json()) as { followers?: string[] };
    if (!Array.isArray(followers)) {
      return NextResponse.json({ error: "followers 必须是数组" }, { status: 400 });
    }
    const res = updateFollowers(taskId, followers);
    if (!res.ok) {
      return NextResponse.json(
        { error: "更新关注人失败：" + res.error },
        { status: 502 }
      );
    }
    return NextResponse.json({ success: true, ignored: res.ignored });
  } catch (e) {
    console.error("更新关注人失败:", e);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { addComment, getComments } from "@/lib/lark-sync";

// GET /api/lark-tasks/[id]/comments - 获取评论列表
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: taskId } = params;
    if (!taskId) {
      return NextResponse.json({ error: "缺少任务 ID" }, { status: 400 });
    }
    const res = getComments(taskId);
    return NextResponse.json({
      comments: res.comments,
      supported: res.supported,
    });
  } catch (e) {
    console.error("获取评论失败:", e);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

// POST /api/lark-tasks/[id]/comments { content } - 添加评论
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: taskId } = params;
    if (!taskId) {
      return NextResponse.json({ error: "缺少任务 ID" }, { status: 400 });
    }
    const { content } = await req.json();
    if (!content || !content.trim()) {
      return NextResponse.json({ error: "缺少评论内容" }, { status: 400 });
    }
    const res = addComment(taskId, content.trim());
    if (!res.ok) {
      return NextResponse.json(
        { error: "评论失败：" + res.error },
        { status: 502 }
      );
    }
    return NextResponse.json({
      success: true,
      comment: res.comment,
      local: res.local,
    });
  } catch (e) {
    console.error("添加评论失败:", e);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { createLarkTask } from "@/lib/lark-sync";

// POST /api/lark-tasks/create
// 由 AI 助理任务卡片"下发到飞书"按钮调用。
// body: { summary, assignees?, due?, description?, tasklistGuid? }
// 返回: { guid, url, summary } 或 { error }
export async function POST(req: NextRequest) {
  try {
    // 需要登录
    const auth = await requireAuth();
    if (auth.error) return auth.error;

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "请求体格式错误，需为 JSON" },
        { status: 400 }
      );
    }

    const { summary, assignees, due, description, tasklistGuid } = body as {
      summary?: string;
      assignees?: string[];
      due?: string;
      description?: string;
      tasklistGuid?: string;
    };

    if (!summary || !summary.trim()) {
      return NextResponse.json(
        { error: "缺少任务标题 summary" },
        { status: 400 }
      );
    }

    const result = await createLarkTask({
      summary: summary.trim(),
      assignees: Array.isArray(assignees) ? assignees : undefined,
      due: due || undefined,
      description: description?.trim() || undefined,
      tasklistGuid: tasklistGuid || undefined,
    });

    return NextResponse.json({
      guid: result.guid,
      url: result.url,
      summary: result.summary,
    });
  } catch (e) {
    const msg = (e as Error).message || "创建飞书任务失败";
    // lark-cli 不可用或姓名解析失败时返回 500，前端卡片会展示友好提示
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

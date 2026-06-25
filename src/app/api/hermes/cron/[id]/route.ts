import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { deleteHermesCronJob } from "@/lib/hermes-client";
import { getLogger } from "@/lib/logger";

const logger = getLogger("hermes-api");

// DELETE /api/hermes/cron/[id] - 删除指定 Hermes cron job
// 路由参数 id 为 jobId
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuth();
  if (auth.user === null) return auth.error;

  try {
    const { id } = params;

    if (!id || !id.trim()) {
      return NextResponse.json(
        { error: "jobId 不能为空" },
        { status: 400 }
      );
    }

    const result = await deleteHermesCronJob(auth.user.id, id.trim());
    return NextResponse.json(result);
  } catch (e) {
    logger.error({ err: e }, "删除 Hermes cron job 失败");
    return NextResponse.json(
      { error: "服务器错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

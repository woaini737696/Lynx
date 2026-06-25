import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { getUserProfileStatus } from "@/lib/hermes-client";
import { getLogger } from "@/lib/logger";

const logger = getLogger("hermes-api");

// GET /api/hermes/profile - 获取用户 Hermes profile 状态（记忆数、技能数、会话数等）
export async function GET() {
  const auth = await requireAuth();
  if (auth.user === null) return auth.error;

  try {
    const result = await getUserProfileStatus(auth.user.id);
    return NextResponse.json(result);
  } catch (e) {
    logger.error({ err: e }, "获取 Hermes profile 状态失败");
    return NextResponse.json(
      { error: "服务器错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

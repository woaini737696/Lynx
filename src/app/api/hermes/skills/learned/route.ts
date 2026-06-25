import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { listLearnedSkills } from "@/lib/hermes-client";
import { getLogger } from "@/lib/logger";

const logger = getLogger("hermes-api");

// GET /api/hermes/skills/learned - 列出用户 profile 下文件系统级别的 learned skills
export async function GET() {
  const auth = await requireAuth();
  if (auth.user === null) return auth.error;

  try {
    const result = await listLearnedSkills(auth.user.id);
    return NextResponse.json(result);
  } catch (e) {
    logger.error({ err: e }, "列出 Hermes learned skills 失败");
    return NextResponse.json(
      { error: "服务器错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { syncLearnedSkills } from "@/lib/hermes-client";
import { getLogger } from "@/lib/logger";

const logger = getLogger("hermes-api");

// POST /api/hermes/skills/sync - 手动触发同步 Hermes /learn 生成的 skills 到 LynnHub
export async function POST() {
  const auth = await requireAuth();
  if (auth.user === null) return auth.error;

  try {
    const result = await syncLearnedSkills(auth.user.id);
    return NextResponse.json(result);
  } catch (e) {
    logger.error({ err: e }, "同步 Hermes learned skills 失败");
    return NextResponse.json(
      { error: "服务器错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

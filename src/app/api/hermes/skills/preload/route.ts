import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { preloadDefaultSkills } from "@/lib/hermes-client";
import { getLogger } from "@/lib/logger";

const logger = getLogger("hermes-api");

// POST /api/hermes/skills/preload - 预置默认技能到用户 Hermes profile skills 目录
// 将 Lynx 核心能力（任务管理、灵感捕获、记忆搜索等）写入
// ~/.lynnhub/hermes-profiles/<userId>/hermes/skills/
export async function POST() {
  const auth = await requireAuth();
  if (auth.user === null) return auth.error;

  try {
    const result = await preloadDefaultSkills(auth.user.id);
    if (result.success) {
      logger.info({ userId: auth.user.id, count: result.count }, "预置默认技能成功");
      return NextResponse.json({
        success: true,
        count: result.count,
        files: result.files,
        message: `已预置 ${result.count} 个默认技能`,
      });
    }
    return NextResponse.json(
      { success: false, error: result.error || "预置失败" },
      { status: 400 }
    );
  } catch (e) {
    logger.error({ err: e }, "预置默认技能失败");
    return NextResponse.json(
      { success: false, error: "服务器错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

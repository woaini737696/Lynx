import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { takeoverPatrolWithHermes } from "@/lib/hermes-client";
import { getLogger } from "@/lib/logger";

const logger = getLogger("hermes-patrol-takeover");

// POST /api/hermes/patrol-takeover - Hermes Cron 接管 AI 巡检
// 将 Lynx 的 PatrolRule 转换为 Hermes Cron 任务
// Hermes 会按照 cron 表达式自动执行巡检，并主动汇报结果
export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.user === null) return auth.error;

  try {
    const result = await takeoverPatrolWithHermes(auth.user.id);

    if (!result.success && result.errors.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: "巡检规则迁移失败",
          details: result.errors,
          migratedCount: result.migratedCount,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      migratedCount: result.migratedCount,
      message: `已将 ${result.migratedCount} 条巡检规则迁移到 Hermes Cron`,
      errors: result.errors,
    });
  } catch (e) {
    logger.error({ err: e }, "Hermes 接管巡检失败");
    return NextResponse.json(
      { error: "服务器错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

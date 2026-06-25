import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { getHermesConfig, listHermesSkills } from "@/lib/hermes-client";
import { getLogger } from "@/lib/logger";

const logger = getLogger("hermes-api");

// GET /api/hermes/skills?category=xxx - 获取 Hermes Skills Hub 技能列表
export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.user === null) return auth.error;

  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category") || undefined;

    const config = await getHermesConfig(auth.user.id);
    if (!config || !config.enabled) {
      return NextResponse.json(
        { error: "Hermes Agent 未启用" },
        { status: 400 }
      );
    }

    if (config.status !== "running") {
      return NextResponse.json(
        { error: `Hermes Agent 当前状态为 ${config.status}，请先启动服务` },
        { status: 400 }
      );
    }

    const result = await listHermesSkills(config, category);
    return NextResponse.json({
      skills: result.skills,
      error: result.error,
    });
  } catch (e) {
    logger.error({ err: e }, "获取 Hermes 技能列表失败");
    return NextResponse.json(
      { error: "服务器错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

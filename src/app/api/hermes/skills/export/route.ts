import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { exportSkillToHermes } from "@/lib/hermes-client";
import { getLogger } from "@/lib/logger";

const logger = getLogger("hermes-api");

// POST /api/hermes/skills/export - 导出 LynnHub Skill 到 Hermes skills 目录
// body: { skillId: string }
export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.user === null) return auth.error;

  try {
    const body = await req.json();
    const { skillId } = body as { skillId?: string };

    if (!skillId || !skillId.trim()) {
      return NextResponse.json(
        { error: "skillId 不能为空" },
        { status: 400 }
      );
    }

    const result = await exportSkillToHermes(skillId.trim(), auth.user.id);
    return NextResponse.json(result);
  } catch (e) {
    logger.error({ err: e }, "导出 Skill 到 Hermes 失败");
    return NextResponse.json(
      { error: "服务器错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

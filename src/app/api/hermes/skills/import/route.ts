import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { importSkillFromHermes } from "@/lib/hermes-client";
import { getLogger } from "@/lib/logger";

const logger = getLogger("hermes-api");

// POST /api/hermes/skills/import - 从 Hermes skills 目录导入 skill 到奇思
// body: { fileName: string }
export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.user === null) return auth.error;

  try {
    const body = await req.json();
    const { fileName } = body as { fileName?: string };

    if (!fileName || !fileName.trim()) {
      return NextResponse.json(
        { error: "fileName 不能为空" },
        { status: 400 }
      );
    }

    const result = await importSkillFromHermes(fileName.trim(), auth.user.id);
    return NextResponse.json(result);
  } catch (e) {
    logger.error({ err: e }, "从 Hermes 导入 Skill 失败");
    return NextResponse.json(
      { error: "服务器错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { generateProactiveReport } from "@/lib/hermes-client";
import { getLogger } from "@/lib/logger";

const logger = getLogger("hermes-proactive-report");

// POST /api/hermes/proactive-report - 生成主动汇报（模式 C：持续工作/主动汇报/跨平台响应）
// body: { type?: "daily" | "weekly" | "patrol" }
// Hermes 分析用户数据生成汇报，存入 HermesReport 表，通过 Web Push 跨平台推送
export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.user === null) return auth.error;

  try {
    const body = await req.json().catch(() => ({}));
    const type = (body.type as "daily" | "weekly" | "patrol") || "daily";

    if (!["daily", "weekly", "patrol"].includes(type)) {
      return NextResponse.json(
        { error: "type 必须为 daily | weekly | patrol" },
        { status: 400 }
      );
    }

    const result = await generateProactiveReport(auth.user.id, type);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "生成汇报失败" },
        { status: 400 }
      );
    }

    return NextResponse.json(result);
  } catch (e) {
    logger.error({ err: e }, "生成主动汇报失败");
    return NextResponse.json(
      { error: "服务器错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

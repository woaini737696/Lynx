import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { getLogger } from "@/lib/logger";
import {
  findMatchingPattern,
  executePatternAutomatically,
} from "@/lib/hermes-client";

const logger = getLogger("hermes-patterns-api");

// POST /api/hermes/patterns/auto-check
// 检查任务描述是否匹配任何 auto-execute 模式，若匹配则自动执行
// Body: { taskDescription: string, execute?: boolean }
// 返回: { matched, score, executed, result }
export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.user === null) return auth.error;

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "请求体格式错误，需为 JSON" },
        { status: 400 }
      );
    }

    const { taskDescription, execute } = body as {
      taskDescription?: string;
      execute?: boolean;
    };

    if (!taskDescription || typeof taskDescription !== "string" || taskDescription.trim().length < 2) {
      return NextResponse.json(
        { error: "taskDescription 不能为空且至少 2 个字符" },
        { status: 400 }
      );
    }

    // 1. 查找匹配模式
    const { pattern, score } = await findMatchingPattern(auth.user.id, taskDescription);

    if (!pattern) {
      return NextResponse.json({
        matched: false,
        score,
        executed: false,
      });
    }

    // 2. 若 execute 为 false（默认），仅返回匹配结果不执行
    if (execute === false) {
      return NextResponse.json({
        matched: true,
        score,
        patternId: pattern.id,
        patternKey: pattern.patternKey,
        executed: false,
      });
    }

    // 3. 自动执行模式
    logger.info(
      { userId: auth.user.id, patternId: pattern.id, patternKey: pattern.patternKey, score },
      "自动执行任务模式"
    );

    const result = await executePatternAutomatically(auth.user.id, pattern);

    return NextResponse.json({
      matched: true,
      score,
      patternId: pattern.id,
      patternKey: pattern.patternKey,
      executed: true,
      result: {
        success: result.success,
        output: result.output,
        error: result.error,
        durationMs: result.durationMs,
      },
    });
  } catch (e) {
    logger.error({ err: e }, "任务模式自动检查失败");
    return NextResponse.json(
      { error: "服务器错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { executeCronJobViaAssistant } from "@/lib/hermes-client";
import { getLogger } from "@/lib/logger";

const logger = getLogger("hermes-cron-execute");

// POST /api/hermes/cron/execute - 手动触发 Cron 任务执行（用于测试）
// body: { prompt: string }
// 调用 executeCronJobViaAssistant，通过 AI 助理路径执行 prompt，
// 并在启用 feishuNotify 时通过飞书推送执行报告。
// 让用户在正式调度前先验证 cron 任务能否按预期工作。
export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.user === null) return auth.error;

  try {
    const body = await req.json();
    const { prompt } = body as { prompt?: string };

    if (!prompt || !prompt.trim()) {
      return NextResponse.json(
        { error: "prompt 不能为空" },
        { status: 400 }
      );
    }

    const result = await executeCronJobViaAssistant(
      auth.user.id,
      prompt.trim()
    );

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || "任务执行失败",
          output: result.output,
          durationMs: result.durationMs,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      output: result.output,
      reported: result.reported,
      durationMs: result.durationMs,
      message: result.reported
        ? "任务已执行完成，并通过飞书推送了报告"
        : "任务已执行完成",
    });
  } catch (e) {
    logger.error({ err: e }, "手动执行 Cron 任务失败");
    return NextResponse.json(
      { error: "服务器错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

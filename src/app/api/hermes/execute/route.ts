import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { getHermesConfig, executeHermesTask } from "@/lib/hermes-client";
import { prisma } from "@/lib/db";
import { getLogger } from "@/lib/logger";

const logger = getLogger("hermes-api");

// POST /api/hermes/execute - 通过 Hermes Agent 执行任务
// body: { prompt, mode?, timeout?, workDir?, options? }
export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.user === null) return auth.error;

  try {
    const body = await req.json();
    const { prompt, mode, timeout, workDir, options } = body as {
      prompt?: string;
      mode?: "computer_use" | "shell" | "auto";
      timeout?: number;
      workDir?: string;
      options?: Record<string, unknown>;
    };

    if (!prompt || !prompt.trim()) {
      return NextResponse.json(
        { error: "prompt 不能为空" },
        { status: 400 }
      );
    }

    const config = await getHermesConfig(auth.user.id);
    if (!config || !config.enabled) {
      return NextResponse.json(
        { error: "Hermes Agent 未启用，请先在设置中启用" },
        { status: 400 }
      );
    }

    if (config.status !== "running") {
      return NextResponse.json(
        { error: `Hermes Agent 当前状态为 ${config.status}，请先启动服务` },
        { status: 400 }
      );
    }

    const result = await executeHermesTask(config, {
      prompt: prompt.trim(),
      mode: mode || "auto",
      timeout,
      workDir,
      options,
    });

    // 记录执行历史到 SkillExecution 表
    await prisma.skillExecution.create({
      data: {
        userId: auth.user.id,
        skillId: "hermes-task",
        skillName: `Hermes 任务：${prompt.slice(0, 50)}`,
        source: "hermes",
        trigger: "assistant",
        parameters: { prompt, mode, workDir } as unknown as never,
        result: result.output,
        success: result.success,
        durationMs: result.durationMs || 0,
        error: result.error || null,
      },
    });

    return NextResponse.json(result);
  } catch (e) {
    logger.error({ err: e }, "执行 Hermes 任务失败");
    return NextResponse.json(
      { error: "服务器错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

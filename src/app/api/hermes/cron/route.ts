import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { listHermesCronJobs, createHermesCronJob } from "@/lib/hermes-client";
import { getLogger } from "@/lib/logger";

const logger = getLogger("hermes-api");

// GET /api/hermes/cron - 列出用户的 Hermes cron jobs
export async function GET() {
  const auth = await requireAuth();
  if (auth.user === null) return auth.error;

  try {
    const result = await listHermesCronJobs(auth.user.id);
    return NextResponse.json(result);
  } catch (e) {
    logger.error({ err: e }, "列出 Hermes cron jobs 失败");
    return NextResponse.json(
      { error: "服务器错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

// POST /api/hermes/cron - 创建 Hermes cron job
// body: { schedule: string, prompt: string }
// schedule 为标准 cron 表达式（如 "0 9 * * *"）
export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.user === null) return auth.error;

  try {
    const body = await req.json();
    const { schedule, prompt } = body as { schedule?: string; prompt?: string };

    if (!schedule || !schedule.trim()) {
      return NextResponse.json(
        { error: "schedule 不能为空" },
        { status: 400 }
      );
    }

    if (!prompt || !prompt.trim()) {
      return NextResponse.json(
        { error: "prompt 不能为空" },
        { status: 400 }
      );
    }

    const result = await createHermesCronJob(
      auth.user.id,
      schedule.trim(),
      prompt.trim()
    );
    return NextResponse.json(result);
  } catch (e) {
    logger.error({ err: e }, "创建 Hermes cron job 失败");
    return NextResponse.json(
      { error: "服务器错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

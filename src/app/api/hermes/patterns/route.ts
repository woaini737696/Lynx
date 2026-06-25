import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/db";
import { getLogger } from "@/lib/logger";
import { learnTaskPattern } from "@/lib/hermes-client";

const logger = getLogger("hermes-patterns-api");

// GET /api/hermes/patterns?page=1&pageSize=20&autoExecuteOnly=false
// 列出当前用户的任务模式（带分页）
export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.user === null) return auth.error;

  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.max(1, Math.min(100, parseInt(searchParams.get("pageSize") || "20", 10)));
    const autoExecuteOnly = searchParams.get("autoExecuteOnly") === "true";

    const where = {
      userId: auth.user.id,
      ...(autoExecuteOnly ? { autoExecute: true } : {}),
    };

    const [total, patterns] = await Promise.all([
      prisma.taskPattern.count({ where }),
      prisma.taskPattern.findMany({
        where,
        orderBy: [{ lastExecutedAt: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return NextResponse.json({
      patterns,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (e) {
    logger.error({ err: e }, "获取任务模式列表失败");
    return NextResponse.json(
      { error: "服务器错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

// POST /api/hermes/patterns
// 手动创建/学习一个任务模式
// Body: { taskDescription: string, taskResult?: string }
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

    const { taskDescription, taskResult } = body as {
      taskDescription?: string;
      taskResult?: string;
    };

    if (!taskDescription || typeof taskDescription !== "string" || taskDescription.trim().length < 2) {
      return NextResponse.json(
        { error: "taskDescription 不能为空且至少 2 个字符" },
        { status: 400 }
      );
    }

    const result = await learnTaskPattern(
      auth.user.id,
      taskDescription,
      typeof taskResult === "string" ? taskResult : ""
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "学习任务模式失败" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      patternId: result.patternId,
      autoExecute: result.autoExecute,
    });
  } catch (e) {
    logger.error({ err: e }, "创建任务模式失败");
    return NextResponse.json(
      { error: "服务器错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

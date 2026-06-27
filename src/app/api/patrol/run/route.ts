import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth-utils";
import { runPatrolRule } from "@/lib/patrol-runner";
import { getLogger } from "@/lib/logger";

const logger = getLogger("patrol-run");

// 执行巡检
// 核心逻辑提取至 src/lib/patrol-runner.ts，供 API 和 scheduler 共用
export async function POST(req: NextRequest) {
  try {
    const { user, error } = await requirePermission("patrol:execute");
    if (error) return error;

    const body = await req.json().catch(() => ({}));
    const { ruleId } = body as { ruleId?: string };

    if (!ruleId) {
      return NextResponse.json({ error: "ruleId 不能为空" }, { status: 400 });
    }

    // 读取规则（用于归属权校验）
    const rule = await prisma.patrolRule.findUnique({ where: { id: ruleId } });
    if (!rule) {
      return NextResponse.json({ error: "规则不存在" }, { status: 404 });
    }
    if (user.role !== "admin" && rule.userId !== user.id) {
      return NextResponse.json({ error: "无权访问" }, { status: 403 });
    }

    // 调用核心巡检逻辑
    const result = await runPatrolRule(ruleId);

    if (!result.success && result.error && !result.results.length) {
      // 规则不存在等致命错误
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      results: result.results,
      hitCount: result.hitCount,
      logId: result.logId,
      success: result.success,
      ...(result.message ? { message: result.message } : {}),
      ...(result.error ? { error: result.error } : {}),
    });
  } catch (e) {
    logger.error({ err: e }, "执行巡检失败");
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

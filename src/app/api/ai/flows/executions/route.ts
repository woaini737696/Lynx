import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/ai/flows/executions - 获取所有工作流的执行历史列表
// 查询参数：page（默认 1）、pageSize（默认 20，最大 100）、flowId（可选筛选）
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "20", 10)));
    const flowId = searchParams.get("flowId");
    const skip = (page - 1) * pageSize;

    const where = flowId ? { flowId } : {};

    // 并行查询数据和总数
    const [executions, total] = await Promise.all([
      prisma.flowExecution.findMany({
        where,
        orderBy: { startedAt: "desc" },
        skip,
        take: pageSize,
      }),
      prisma.flowExecution.count({ where }),
    ]);

    return NextResponse.json({
      executions,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (e) {
    console.error("获取执行历史列表失败:", e);
    return NextResponse.json(
      { error: "服务器错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

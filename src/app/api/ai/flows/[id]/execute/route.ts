import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getFlowById, updateFlow } from "@/lib/flow-store";
import { executeFlowInternal } from "@/lib/flow-engine";
import { requireAuth } from "@/lib/auth-utils";

// ============ API 路由 ============

// POST /api/ai/flows/[id]/execute - 执行指定工作流
// body: { input?: string }（可选的初始输入，作为首个 action 节点的 upstream）
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  try {
    const flow = await getFlowById(params.id);
    if (!flow) {
      return NextResponse.json(
        { error: `未找到工作流：${params.id}` },
        { status: 404 }
      );
    }

    if (!flow.enabled) {
      return NextResponse.json(
        { error: `工作流「${flow.name}」未启用，请先启用后再执行` },
        { status: 400 }
      );
    }

    // 读取可选的初始输入
    let initialInput = "";
    try {
      const body = await req.json();
      initialInput = typeof body?.input === "string" ? body.input : "";
    } catch {
      // body 可为空
    }

    // 执行工作流
    const result = await executeFlowInternal(flow, initialInput);

    // 提取错误信息（首个出错的节点）
    const errorNode = result.nodes.find((n) => n.status === "error");

    // 将执行结果保存到 FlowExecution 表
    try {
      await prisma.flowExecution.create({
        data: {
          flowId: result.flowId,
          flowName: result.flowName,
          success: result.success,
          startedAt: new Date(result.startedAt),
          finishedAt: new Date(result.finishedAt),
          totalDurationMs: result.totalDurationMs,
          finalOutput: result.finalOutput ?? null,
          nodeResults: result.nodes as unknown as Prisma.InputJsonValue,
          error: errorNode?.error ?? null,
        },
      });
    } catch (e) {
      // 执行历史保存失败不影响主流程
      console.error("保存执行历史失败:", e);
    }

    // 更新 lastRun 时间
    await updateFlow(params.id, { lastRun: "刚刚" });

    return NextResponse.json({ result });
  } catch (e) {
    console.error("执行工作流失败:", e);
    return NextResponse.json(
      { error: "服务器错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

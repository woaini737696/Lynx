import { NextRequest, NextResponse } from "next/server";
import { readFlows, writeFlows, type Flow } from "@/lib/flow-store";
import { executeFlowInternal } from "@/lib/flow-engine";

// ============ API 路由 ============

// POST /api/ai/flows/[id]/execute - 执行指定工作流
// body: { input?: string }（可选的初始输入，作为首个 action 节点的 upstream）
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const flows = await readFlows();
    const flow = flows.find((f) => f.id === params.id);
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

    // 更新 lastRun 时间
    const idx = flows.findIndex((f) => f.id === params.id);
    if (idx !== -1) {
      flows[idx] = { ...flows[idx], lastRun: "刚刚" };
      await writeFlows(flows);
    }

    return NextResponse.json({ result });
  } catch (e) {
    console.error("执行工作流失败:", e);
    return NextResponse.json(
      { error: "服务器错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import {
  readFlows,
  writeFlows,
  generateFlowId,
  type Flow,
  type FlowNode,
  type FlowEdge,
} from "@/lib/flow-store";

// ============ API 路由 ============

// GET /api/ai/flows - 返回工作流列表
export async function GET() {
  try {
    const flows = await readFlows();
    return NextResponse.json({ flows });
  } catch (e) {
    console.error("获取工作流列表失败:", e);
    return NextResponse.json(
      { error: "服务器错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

// POST /api/ai/flows - 创建新工作流
// body: { name, description, nodes?, edges?, enabled? }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, description, nodes, edges, enabled } = body as {
      name?: string;
      description?: string;
      nodes?: FlowNode[];
      edges?: FlowEdge[];
      enabled?: boolean;
    };

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "name 不能为空" },
        { status: 400 }
      );
    }

    const flows = await readFlows();
    const newFlow: Flow = {
      id: generateFlowId(),
      name: name.trim(),
      description: description || "",
      nodes: Array.isArray(nodes) ? nodes : [],
      edges: Array.isArray(edges) ? edges : [],
      lastRun: "未运行",
      enabled: enabled !== undefined ? Boolean(enabled) : true,
    };

    flows.push(newFlow);
    await writeFlows(flows);

    return NextResponse.json({ flow: newFlow }, { status: 201 });
  } catch (e) {
    console.error("创建工作流失败:", e);
    return NextResponse.json(
      { error: "服务器错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

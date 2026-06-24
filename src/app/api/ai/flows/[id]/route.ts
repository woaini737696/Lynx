import { NextRequest, NextResponse } from "next/server";
import {
  getFlowById,
  updateFlow,
  deleteFlow,
  type FlowNode,
  type FlowEdge,
} from "@/lib/flow-store";

// GET /api/ai/flows/[id] - 获取单个工作流
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const flow = await getFlowById(params.id);
    if (!flow) {
      return NextResponse.json(
        { error: `未找到工作流：${params.id}` },
        { status: 404 }
      );
    }
    return NextResponse.json({ flow });
  } catch (e) {
    return NextResponse.json(
      { error: "服务器错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

// PUT /api/ai/flows/[id] - 更新工作流
// body: { name?, description?, nodes?, edges?, enabled?, lastRun? }
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const { name, description, nodes, edges, enabled, lastRun } = body as {
      name?: string;
      description?: string;
      nodes?: FlowNode[];
      edges?: FlowEdge[];
      enabled?: boolean;
      lastRun?: string;
    };

    // 先检查工作流是否存在
    const existing = await getFlowById(params.id);
    if (!existing) {
      return NextResponse.json(
        { error: `未找到工作流：${params.id}` },
        { status: 404 }
      );
    }

    // 构建局部更新数据
    const updateData: Record<string, unknown> = {};
    if (typeof name === "string") updateData.name = name;
    if (typeof description === "string") updateData.description = description;
    if (Array.isArray(nodes)) updateData.nodes = nodes;
    if (Array.isArray(edges)) updateData.edges = edges;
    if (typeof enabled === "boolean") updateData.enabled = enabled;
    if (typeof lastRun === "string") updateData.lastRun = lastRun;

    const updated = await updateFlow(params.id, updateData);
    return NextResponse.json({ flow: updated });
  } catch (e) {
    console.error("更新工作流失败:", e);
    return NextResponse.json(
      { error: "服务器错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

// DELETE /api/ai/flows/[id] - 删除工作流
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const existing = await getFlowById(params.id);
    if (!existing) {
      return NextResponse.json(
        { error: `未找到工作流：${params.id}` },
        { status: 404 }
      );
    }

    await deleteFlow(params.id);
    return NextResponse.json({ flow: existing });
  } catch (e) {
    console.error("删除工作流失败:", e);
    return NextResponse.json(
      { error: "服务器错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

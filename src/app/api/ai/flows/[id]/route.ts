import { NextRequest, NextResponse } from "next/server";
import { readFlows, writeFlows, type Flow, type FlowNode, type FlowEdge } from "@/lib/flow-store";

// GET /api/ai/flows/[id] - 获取单个工作流
export async function GET(
  _req: NextRequest,
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

    const flows = await readFlows();
    const idx = flows.findIndex((f) => f.id === params.id);
    if (idx === -1) {
      return NextResponse.json(
        { error: `未找到工作流：${params.id}` },
        { status: 404 }
      );
    }

    // 局部更新
    const updated: Flow = {
      ...flows[idx],
      ...(typeof name === "string" ? { name } : {}),
      ...(typeof description === "string" ? { description } : {}),
      ...(Array.isArray(nodes) ? { nodes } : {}),
      ...(Array.isArray(edges) ? { edges } : {}),
      ...(typeof enabled === "boolean" ? { enabled } : {}),
      ...(typeof lastRun === "string" ? { lastRun } : {}),
    };
    flows[idx] = updated;
    await writeFlows(flows);

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
    const flows = await readFlows();
    const idx = flows.findIndex((f) => f.id === params.id);
    if (idx === -1) {
      return NextResponse.json(
        { error: `未找到工作流：${params.id}` },
        { status: 404 }
      );
    }

    const removed = flows[idx];
    flows.splice(idx, 1);
    await writeFlows(flows);

    return NextResponse.json({ flow: removed });
  } catch (e) {
    console.error("删除工作流失败:", e);
    return NextResponse.json(
      { error: "服务器错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

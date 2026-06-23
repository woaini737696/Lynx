import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import type { Flow, FlowNode } from "../route";

// JSON 文件路径（与 route.ts 一致）
const FLOWS_FILE = path.join(process.cwd(), ".ai-flows.json");

// 读取工作流列表
async function readFlows(): Promise<Flow[]> {
  try {
    const raw = await fs.readFile(FLOWS_FILE, "utf-8");
    const data = JSON.parse(raw);
    if (Array.isArray(data)) return data as Flow[];
    return [];
  } catch {
    return [];
  }
}

// 写入工作流列表
async function writeFlows(flows: Flow[]): Promise<void> {
  await fs.writeFile(FLOWS_FILE, JSON.stringify(flows, null, 2), "utf-8");
}

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
// body: { name?, description?, nodes?, enabled?, lastRun? }
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const { name, description, nodes, enabled, lastRun } = body as {
      name?: string;
      description?: string;
      nodes?: FlowNode[];
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

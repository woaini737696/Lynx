import { NextRequest, NextResponse } from "next/server";
import {
  readFlows,
  createFlow,
  initializeDefaultFlows,
  type FlowNode,
  type FlowEdge,
} from "@/lib/flow-store";
import { getLogger } from "@/lib/logger";

const logger = getLogger("flows-api");

// ============ API 路由 ============

// GET /api/ai/flows - 返回工作流列表
export async function GET() {
  try {
    // 确保数据库已初始化（幂等，数据库非空时直接返回）
    await initializeDefaultFlows();
    const flows = await readFlows();
    return NextResponse.json({ flows });
  } catch (e) {
    logger.error({ err: e }, "获取工作流列表失败");
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

    const flow = await createFlow({
      name: name.trim(),
      description: description || "",
      nodes: Array.isArray(nodes) ? nodes : [],
      edges: Array.isArray(edges) ? edges : [],
      enabled: enabled !== undefined ? Boolean(enabled) : true,
    });

    return NextResponse.json({ flow }, { status: 201 });
  } catch (e) {
    logger.error({ err: e }, "创建工作流失败");
    return NextResponse.json(
      { error: "服务器错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

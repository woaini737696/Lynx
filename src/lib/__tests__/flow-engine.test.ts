import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Flow, FlowNode, FlowEdge } from "@/lib/flow-store";

// Mock chat 以避免真实 AI 调用
const chatMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/ai-provider", () => ({
  chat: chatMock,
}));

import { executeFlowInternal } from "@/lib/flow-engine";

// ============ 辅助函数 ============

function makeNode(
  id: string,
  type: FlowNode["type"],
  label: string,
  config?: FlowNode["config"]
): FlowNode {
  return { id, type, label, status: "idle", config };
}

function makeFlow(
  nodes: FlowNode[],
  edges: FlowEdge[] = []
): Flow {
  return {
    id: "test-flow",
    name: "test",
    description: "",
    nodes,
    edges,
    enabled: true,
    lastRun: "未运行",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  chatMock.mockResolvedValue({
    content: "AI output",
    provider: "deepseek",
    model: "deepseek-chat",
    usage: { total_tokens: 10 },
  });
});

// ============ BFS 图遍历测试 ============

describe("executeFlowInternal - BFS 图遍历", () => {
  it("线性图：trigger → action → output 按顺序执行", async () => {
    const flow = makeFlow(
      [
        makeNode("t1", "trigger", "Trigger"),
        makeNode("a1", "action", "Action", { prompt: "process {{upstream}}" }),
        makeNode("o1", "output", "Output", { outputTarget: "notification" }),
      ],
      [
        { id: "e1", from: "t1", to: "a1" },
        { id: "e2", from: "a1", to: "o1" },
      ]
    );

    const result = await executeFlowInternal(flow, "");
    expect(result.success).toBe(true);
    expect(result.nodes).toHaveLength(3);
    expect(result.nodes.map((n) => n.nodeId)).toEqual(["t1", "a1", "o1"]);
    expect(result.nodes.every((n) => n.status === "done")).toBe(true);
    expect(result.finalOutput).toBe("AI output");
    expect(chatMock).toHaveBeenCalledTimes(1);
  });

  it("条件 true 分支：只执行 true 分支节点，false 分支跳过", async () => {
    const flow = makeFlow(
      [
        makeNode("t1", "trigger", "Trigger"),
        makeNode("c1", "condition", "Cond", { expression: "1 == 1" }),
        makeNode("a_true", "action", "TrueAction", { prompt: "true branch" }),
        makeNode("a_false", "action", "FalseAction", {
          prompt: "false branch",
        }),
      ],
      [
        { id: "e1", from: "t1", to: "c1" },
        { id: "e2", from: "c1", to: "a_true", condition: "true" },
        { id: "e3", from: "c1", to: "a_false", condition: "false" },
      ]
    );

    const result = await executeFlowInternal(flow, "");
    expect(result.success).toBe(true);

    const byId = new Map(result.nodes.map((n) => [n.nodeId, n]));
    expect(byId.get("t1")?.status).toBe("done");
    expect(byId.get("c1")?.status).toBe("done");
    expect(byId.get("a_true")?.status).toBe("done");
    expect(byId.get("a_false")?.status).toBe("skipped");
    // 只有 true 分支的 action 调用了 chat
    expect(chatMock).toHaveBeenCalledTimes(1);
  });

  it("条件 false 分支：只执行 false 分支节点，true 分支跳过", async () => {
    const flow = makeFlow(
      [
        makeNode("t1", "trigger", "Trigger"),
        makeNode("c1", "condition", "Cond", { expression: "1 == 2" }),
        makeNode("a_true", "action", "TrueAction", { prompt: "true branch" }),
        makeNode("a_false", "action", "FalseAction", {
          prompt: "false branch",
        }),
      ],
      [
        { id: "e1", from: "t1", to: "c1" },
        { id: "e2", from: "c1", to: "a_true", condition: "true" },
        { id: "e3", from: "c1", to: "a_false", condition: "false" },
      ]
    );

    const result = await executeFlowInternal(flow, "");
    expect(result.success).toBe(true);

    const byId = new Map(result.nodes.map((n) => [n.nodeId, n]));
    expect(byId.get("a_false")?.status).toBe("done");
    expect(byId.get("a_true")?.status).toBe("skipped");
    expect(chatMock).toHaveBeenCalledTimes(1);
  });

  it("菱形汇聚：merge 节点只执行一次（不重复执行）", async () => {
    const flow = makeFlow(
      [
        makeNode("t1", "trigger", "Trigger"),
        makeNode("c1", "condition", "Cond", { expression: "1 == 1" }),
        makeNode("a1", "action", "Action1", { prompt: "branch 1" }),
        makeNode("a2", "action", "Action2", { prompt: "branch 2" }),
        makeNode("merge", "output", "Merge", { outputTarget: "notification" }),
      ],
      [
        { id: "e1", from: "t1", to: "c1" },
        { id: "e2", from: "c1", to: "a1", condition: "true" },
        { id: "e3", from: "c1", to: "a2", condition: "false" },
        { id: "e4", from: "a1", to: "merge" },
        { id: "e5", from: "a2", to: "merge" },
      ]
    );

    const result = await executeFlowInternal(flow, "");
    expect(result.success).toBe(true);

    // merge 只出现一次
    const mergeNodes = result.nodes.filter((n) => n.nodeId === "merge");
    expect(mergeNodes).toHaveLength(1);
    expect(mergeNodes[0].status).toBe("done");
    // a2 走 false 分支被跳过
    const a2 = result.nodes.find((n) => n.nodeId === "a2");
    expect(a2?.status).toBe("skipped");
  });

  it("无 edges 时降级为顺序执行模式", async () => {
    const flow = makeFlow(
      [
        makeNode("t1", "trigger", "Trigger"),
        makeNode("a1", "action", "Action", { prompt: "go" }),
        makeNode("o1", "output", "Output", { outputTarget: "notification" }),
      ],
      []
    );

    const result = await executeFlowInternal(flow, "");
    expect(result.success).toBe(true);
    expect(result.nodes).toHaveLength(3);
    expect(result.nodes.map((n) => n.nodeId)).toEqual(["t1", "a1", "o1"]);
    expect(result.finalOutput).toBe("AI output");
  });

  it("action 节点失败时中断执行并标记 success=false", async () => {
    chatMock.mockRejectedValue(new Error("AI 服务不可用"));
    const flow = makeFlow(
      [
        makeNode("t1", "trigger", "Trigger"),
        makeNode("a1", "action", "Action", { prompt: "go" }),
        makeNode("o1", "output", "Output", { outputTarget: "notification" }),
      ],
      [
        { id: "e1", from: "t1", to: "a1" },
        { id: "e2", from: "a1", to: "o1" },
      ]
    );

    const result = await executeFlowInternal(flow, "");
    expect(result.success).toBe(false);
    const a1 = result.nodes.find((n) => n.nodeId === "a1");
    expect(a1?.status).toBe("error");
    expect(a1?.error).toContain("AI 服务不可用");
    // o1 未在执行路径上，标记为 skipped
    const o1 = result.nodes.find((n) => n.nodeId === "o1");
    expect(o1?.status).toBe("skipped");
  });
});

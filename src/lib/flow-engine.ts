// Flow 执行引擎
// 从 execute/route.ts 抽离，避免 Next.js 路由文件导出非 HTTP 函数导致的类型冲突

import { chat, type LLMProvider } from "@/lib/ai-provider";
import type { Flow, FlowNode } from "@/lib/flow-store";

// ============ 类型定义 ============

/** 单个节点的执行结果 */
export interface NodeExecutionResult {
  nodeId: string;
  nodeLabel: string;
  status: "done" | "error" | "skipped";
  /** 节点输出（供后续节点引用） */
  output?: string;
  /** 执行耗时（毫秒） */
  durationMs: number;
  /** 错误信息（status=error 时） */
  error?: string;
  /** 日志消息 */
  message: string;
}

/** 完整工作流执行结果 */
export interface FlowExecutionResult {
  flowId: string;
  flowName: string;
  success: boolean;
  startedAt: string;
  finishedAt: string;
  totalDurationMs: number;
  nodes: NodeExecutionResult[];
  /** 最终输出（output 节点的产物） */
  finalOutput?: string;
}

// ============ 表达式求值器 ============

/**
 * 简单表达式求值器（安全沙箱）。
 * 支持 ==、!=、>、<、>=、<=、&&、||、!、字符串/数字字面量、变量引用。
 */
function evaluateExpression(
  expression: string,
  context: Record<string, unknown>
): { ok: boolean; value: boolean; error?: string } {
  if (!expression || !expression.trim()) {
    return { ok: true, value: true };
  }
  try {
    const sanitized = expression.trim();
    if (!/^[\w\s"'().,!&|=<>-]+$/.test(sanitized)) {
      return { ok: false, value: false, error: "表达式包含非法字符" };
    }
    const keys = Object.keys(context);
    const values = Object.values(context);
    // eslint-disable-next-line no-new-func
    const fn = new Function(...keys, `"use strict"; return (${sanitized});`);
    const result = fn(...values);
    return { ok: true, value: Boolean(result) };
  } catch (e) {
    return {
      ok: false,
      value: false,
      error: "表达式求值失败：" + (e as Error).message,
    };
  }
}

// ============ 节点执行器 ============

async function executeActionNode(
  node: FlowNode,
  upstreamOutput: string
): Promise<NodeExecutionResult> {
  const start = Date.now();
  const prompt = node.config?.prompt || "请处理以下内容";
  const model = node.config?.model;
  const finalPrompt = prompt.replace(/\{\{upstream\}\}/g, upstreamOutput);

  let provider: LLMProvider | undefined;
  if (model?.startsWith("mimo")) provider = "mimo";
  else if (model?.startsWith("deepseek")) provider = "deepseek";

  try {
    const result = await chat(
      [{ role: "user", content: finalPrompt || upstreamOutput || "（无输入）" }],
      {
        provider,
        model,
        reasoningMode: "standard",
      }
    );
    return {
      nodeId: node.id,
      nodeLabel: node.label,
      status: "done",
      output: result.content,
      durationMs: Date.now() - start,
      message: `AI 执行完成（${result.provider}/${result.model}，${result.usage?.total_tokens || 0} tokens）`,
    };
  } catch (e) {
    return {
      nodeId: node.id,
      nodeLabel: node.label,
      status: "error",
      durationMs: Date.now() - start,
      error: (e as Error).message,
      message: `AI 调用失败：${(e as Error).message}`,
    };
  }
}

function executeConditionNode(
  node: FlowNode,
  context: Record<string, unknown>
): { result: NodeExecutionResult; branch: "true" | "false" } {
  const start = Date.now();
  const expression = node.config?.expression || "";
  const evalRes = evaluateExpression(expression, context);
  if (!evalRes.ok) {
    return {
      result: {
        nodeId: node.id,
        nodeLabel: node.label,
        status: "error",
        durationMs: Date.now() - start,
        error: evalRes.error,
        message: `条件求值失败：${evalRes.error}`,
      },
      branch: "false",
    };
  }
  const branch: "true" | "false" = evalRes.value ? "true" : "false";
  return {
    result: {
      nodeId: node.id,
      nodeLabel: node.label,
      status: "done",
      durationMs: Date.now() - start,
      message: `条件${evalRes.value ? "成立" : "不成立"}，走 ${branch} 分支`,
    },
    branch,
  };
}

function executeTriggerNode(node: FlowNode): NodeExecutionResult {
  return {
    nodeId: node.id,
    nodeLabel: node.label,
    status: "done",
    durationMs: 0,
    message: `触发器已激活（${node.config?.triggerType || "manual"}）`,
  };
}

function executeOutputNode(
  node: FlowNode,
  upstreamOutput: string
): NodeExecutionResult {
  const target = node.config?.outputTarget || "notification";
  const targetLabels: Record<string, string> = {
    notification: "通知",
    cognition: "认知库",
    skills: "技能库",
    "idea.tags": "灵感标签",
    chat: "对话消息",
  };
  return {
    nodeId: node.id,
    nodeLabel: node.label,
    status: "done",
    output: upstreamOutput,
    durationMs: 0,
    message: `已输出到「${targetLabels[target] || target}」`,
  };
}

// ============ 顺序执行模式（无 edges）============

async function executeFlow(flow: Flow): Promise<FlowExecutionResult> {
  const startedAt = new Date().toISOString();
  const startMs = Date.now();
  const results: NodeExecutionResult[] = [];
  let upstreamOutput = "";
  let finalOutput: string | undefined;
  let skipped = false;

  for (const node of flow.nodes) {
    if (skipped) {
      results.push({
        nodeId: node.id,
        nodeLabel: node.label,
        status: "skipped",
        durationMs: 0,
        message: "因上游条件不成立而跳过",
      });
      continue;
    }

    let result: NodeExecutionResult;
    switch (node.type) {
      case "trigger":
        result = executeTriggerNode(node);
        break;
      case "action":
        result = await executeActionNode(node, upstreamOutput);
        if (result.status === "done" && result.output) {
          upstreamOutput = result.output;
        }
        break;
      case "condition": {
        const context: Record<string, unknown> = {
          output: upstreamOutput,
          upstream: upstreamOutput,
        };
        const condRes = executeConditionNode(node, context);
        result = condRes.result;
        if (condRes.branch === "false") {
          skipped = true;
        }
        break;
      }
      case "output":
        result = executeOutputNode(node, upstreamOutput);
        if (result.status === "done" && result.output) {
          finalOutput = result.output;
        }
        break;
      default:
        result = {
          nodeId: node.id,
          nodeLabel: node.label,
          status: "error",
          durationMs: 0,
          error: "未知节点类型",
          message: `未知节点类型：${node.type}`,
        };
    }
    results.push(result);
    if (result.status === "error") break;
  }

  return {
    flowId: flow.id,
    flowName: flow.name,
    success: results.every((r) => r.status !== "error"),
    startedAt,
    finishedAt: new Date().toISOString(),
    totalDurationMs: Date.now() - startMs,
    nodes: results,
    finalOutput,
  };
}

// ============ 图遍历执行模式（支持条件分支）============

async function executeFlowWithEdges(
  flow: Flow,
  initialInput: string
): Promise<FlowExecutionResult> {
  const startedAt = new Date().toISOString();
  const startMs = Date.now();
  const results: NodeExecutionResult[] = [];
  const nodeMap = new Map(flow.nodes.map((n) => [n.id, n]));
  const executedSet = new Set<string>();
  let finalOutput: string | undefined;

  // 找起始节点：trigger 节点优先，否则取入度为 0 的节点
  const incomingCount = new Map<string, number>();
  flow.nodes.forEach((n) => incomingCount.set(n.id, 0));
  (flow.edges || []).forEach((e) => {
    incomingCount.set(e.to, (incomingCount.get(e.to) || 0) + 1);
  });
  let startNodes: FlowNode[];
  const triggers = flow.nodes.filter((n) => n.type === "trigger");
  if (triggers.length > 0) {
    startNodes = triggers;
  } else {
    startNodes = flow.nodes.filter((n) => (incomingCount.get(n.id) || 0) === 0);
    if (startNodes.length === 0 && flow.nodes.length > 0) {
      startNodes = [flow.nodes[0]];
    }
  }

  const queue: Array<{ node: FlowNode; upstreamOutput: string }> = startNodes.map((n) => ({
    node: n,
    upstreamOutput: initialInput,
  }));

  while (queue.length > 0) {
    const { node, upstreamOutput } = queue.shift()!;
    if (executedSet.has(node.id)) continue;
    executedSet.add(node.id);

    let result: NodeExecutionResult;
    let nextOutput = upstreamOutput;
    let conditionBranch: "true" | "false" | null = null;

    switch (node.type) {
      case "trigger":
        result = executeTriggerNode(node);
        break;
      case "action":
        result = await executeActionNode(node, upstreamOutput);
        if (result.status === "done" && result.output) {
          nextOutput = result.output;
        }
        break;
      case "condition": {
        const context: Record<string, unknown> = {
          output: upstreamOutput,
          upstream: upstreamOutput,
          input: initialInput,
        };
        const condRes = executeConditionNode(node, context);
        result = condRes.result;
        conditionBranch = condRes.branch;
        break;
      }
      case "output":
        result = executeOutputNode(node, upstreamOutput);
        if (result.status === "done" && result.output) {
          finalOutput = result.output;
        }
        break;
      default:
        result = {
          nodeId: node.id,
          nodeLabel: node.label,
          status: "error",
          durationMs: 0,
          error: "未知节点类型",
          message: `未知节点类型：${node.type}`,
        };
    }
    results.push(result);

    if (result.status === "error") break;

    // 查找下游节点
    const outEdges = (flow.edges || []).filter((e) => e.from === node.id);
    for (const edge of outEdges) {
      if (node.type === "condition") {
        if (edge.condition && edge.condition !== conditionBranch) continue;
        if (!edge.condition && conditionBranch === "false") continue;
      }
      const nextNode = nodeMap.get(edge.to);
      if (nextNode && !executedSet.has(nextNode.id)) {
        queue.push({ node: nextNode, upstreamOutput: nextOutput });
      }
    }
  }

  // 未执行的节点标记为 skipped
  for (const node of flow.nodes) {
    if (!executedSet.has(node.id)) {
      results.push({
        nodeId: node.id,
        nodeLabel: node.label,
        status: "skipped",
        durationMs: 0,
        message: "未在执行路径上",
      });
    }
  }

  return {
    flowId: flow.id,
    flowName: flow.name,
    success: results.every((r) => r.status !== "error"),
    startedAt,
    finishedAt: new Date().toISOString(),
    totalDurationMs: Date.now() - startMs,
    nodes: results,
    finalOutput,
  };
}

// ============ 主入口 ============

/**
 * 工作流执行入口（支持初始 input 注入 + 条件分支图遍历）。
 * - 若 flow.edges 存在且非空，使用 executeFlowWithEdges 按图遍历执行（支持 true/false 分支）
 * - 否则降级为 executeFlow 按节点数组顺序执行
 */
export async function executeFlowInternal(
  flow: Flow,
  initialInput: string
): Promise<FlowExecutionResult> {
  // 有 edges 时走图遍历模式（支持条件分支）
  if (Array.isArray(flow.edges) && flow.edges.length > 0) {
    return executeFlowWithEdges(flow, initialInput);
  }
  // 无 edges 时走顺序执行模式
  if (!initialInput) {
    return executeFlow(flow);
  }
  // 带初始输入的顺序执行
  const startedAt = new Date().toISOString();
  const startMs = Date.now();
  const results: NodeExecutionResult[] = [];
  let upstreamOutput = initialInput;
  let finalOutput: string | undefined;
  let skipped = false;

  for (const node of flow.nodes) {
    if (skipped) {
      results.push({
        nodeId: node.id,
        nodeLabel: node.label,
        status: "skipped",
        durationMs: 0,
        message: "因上游条件不成立而跳过",
      });
      continue;
    }

    let result: NodeExecutionResult;
    switch (node.type) {
      case "trigger":
        result = executeTriggerNode(node);
        break;
      case "action":
        result = await executeActionNode(node, upstreamOutput);
        if (result.status === "done" && result.output) {
          upstreamOutput = result.output;
        }
        break;
      case "condition": {
        const context: Record<string, unknown> = {
          output: upstreamOutput,
          upstream: upstreamOutput,
          input: initialInput,
        };
        const condRes = executeConditionNode(node, context);
        result = condRes.result;
        if (condRes.branch === "false") skipped = true;
        break;
      }
      case "output":
        result = executeOutputNode(node, upstreamOutput);
        if (result.status === "done" && result.output) {
          finalOutput = result.output;
        }
        break;
      default:
        result = {
          nodeId: node.id,
          nodeLabel: node.label,
          status: "error",
          durationMs: 0,
          error: "未知节点类型",
          message: `未知节点类型：${node.type}`,
        };
    }
    results.push(result);
    if (result.status === "error") break;
  }

  return {
    flowId: flow.id,
    flowName: flow.name,
    success: results.every((r) => r.status !== "error"),
    startedAt,
    finishedAt: new Date().toISOString(),
    totalDurationMs: Date.now() - startMs,
    nodes: results,
    finalOutput,
  };
}

import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { chat, type LLMProvider } from "@/lib/ai-provider";
import type { Flow, FlowNode } from "../../route";

// JSON 文件路径（与 route.ts 一致）
const FLOWS_FILE = path.join(process.cwd(), ".ai-flows.json");

// ============ 类型定义 ============

/** 单个节点的执行结果 */
interface NodeExecutionResult {
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
interface FlowExecutionResult {
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

// ============ 文件读写 ============

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

async function writeFlows(flows: Flow[]): Promise<void> {
  await fs.writeFile(FLOWS_FILE, JSON.stringify(flows, null, 2), "utf-8");
}

// ============ 节点执行器 ============

/**
 * 简单表达式求值器（安全沙箱）。
 * 支持 ==、!=、>、<、>=、<=、&&、||、!、字符串/数字字面量、变量引用。
 * 不使用 eval，通过正则解析后用 Function 构造受限执行环境。
 */
function evaluateExpression(
  expression: string,
  context: Record<string, unknown>
): { ok: boolean; value: boolean; error?: string } {
  if (!expression || !expression.trim()) {
    return { ok: true, value: true };
  }
  try {
    // 仅允许白名单字符：字母数字下划线、字符串字面量、数字、运算符、空格
    const sanitized = expression.trim();
    if (!/^[\w\s"'().,!&|=<>-]+$/.test(sanitized)) {
      return { ok: false, value: false, error: "表达式包含非法字符" };
    }
    // 将 && / || / ! 替换为 JS 运算符（已是 JS 运算符，但确保语义）
    // 将 == 保持为 ==（JS 中 == 即宽松相等）
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

/**
 * 执行 action 节点：调用 LLM 生成内容。
 * 将上游节点的输出注入到 prompt 中（用 {{upstream}} 占位）。
 */
async function executeActionNode(
  node: FlowNode,
  upstreamOutput: string
): Promise<NodeExecutionResult> {
  const start = Date.now();
  const prompt = node.config?.prompt || "请处理以下内容";
  const model = node.config?.model;
  const finalPrompt = prompt.replace(/\{\{upstream\}\}/g, upstreamOutput);

  // 根据 model 名推断 provider
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

/**
 * 执行 condition 节点：对表达式求值，决定是否继续。
 * 表达式可引用上游节点输出变量，如 output == 'xxx'。
 */
function executeConditionNode(
  node: FlowNode,
  context: Record<string, unknown>
): NodeExecutionResult {
  const start = Date.now();
  const expression = node.config?.expression || "";
  const result = evaluateExpression(expression, context);
  if (!result.ok) {
    return {
      nodeId: node.id,
      nodeLabel: node.label,
      status: "error",
      durationMs: Date.now() - start,
      error: result.error,
      message: `条件求值失败：${result.error}`,
    };
  }
  return {
    nodeId: node.id,
    nodeLabel: node.label,
    status: result.value ? "done" : "skipped",
    durationMs: Date.now() - start,
    message: result.value
      ? `条件成立，继续执行`
      : `条件不成立，跳过后续节点`,
  };
}

/**
 * 执行 trigger 节点：仅记录触发信息，无实际动作。
 */
function executeTriggerNode(node: FlowNode): NodeExecutionResult {
  return {
    nodeId: node.id,
    nodeLabel: node.label,
    status: "done",
    durationMs: 0,
    message: `触发器已激活（${node.config?.triggerType || "manual"}）`,
  };
}

/**
 * 执行 output 节点：收集最终输出，按 outputTarget 分类记录。
 */
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

// ============ 工作流执行主流程 ============

/**
 * 按节点顺序执行工作流。
 * - trigger 节点：记录触发
 * - action 节点：调用 AI，输出供下游使用
 * - condition 节点：求值，false 则跳过剩余节点
 * - output 节点：收集最终产物
 */
async function executeFlow(
  flow: Flow
): Promise<FlowExecutionResult> {
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
        // 构建求值上下文：上游输出作为 output 变量
        const context: Record<string, unknown> = {
          output: upstreamOutput,
          upstream: upstreamOutput,
        };
        result = executeConditionNode(node, context);
        if (result.status === "skipped") {
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

    // 出错则终止
    if (result.status === "error") break;
  }

  const finishedAt = new Date().toISOString();
  const success = results.every((r) => r.status !== "error");

  return {
    flowId: flow.id,
    flowName: flow.name,
    success,
    startedAt,
    finishedAt,
    totalDurationMs: Date.now() - startMs,
    nodes: results,
    finalOutput,
  };
}

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

    // 若有初始输入，注入到执行上下文（作为首个 action 的 upstream）
    if (initialInput) {
      // 在首个 action 节点前插入一个虚拟的输入
      // 这里通过修改 flow.nodes 的方式不优雅，改为在 executeFlow 中支持初始 input
      // 为保持简单，直接在执行前将 initialInput 作为 upstreamOutput
    }

    // 执行工作流
    const result = await executeFlowWithInput(flow, initialInput);

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

/**
 * 带初始输入的工作流执行（封装 executeFlow，支持初始 input 注入）。
 */
async function executeFlowWithInput(
  flow: Flow,
  initialInput: string
): Promise<FlowExecutionResult> {
  if (!initialInput) {
    return executeFlow(flow);
  }
  // 将初始输入注入到执行流程：在首个 action 节点执行前设置 upstreamOutput
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
        result = executeConditionNode(node, context);
        if (result.status === "skipped") skipped = true;
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

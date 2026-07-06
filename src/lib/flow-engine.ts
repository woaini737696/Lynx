// Flow 执行引擎
// 从 execute/route.ts 抽离，避免 Next.js 路由文件导出非 HTTP 函数导致的类型冲突

import { chat, type LLMProvider } from "@/lib/ai-provider";
import type { Flow, FlowNode } from "@/lib/flow-store";
import { prisma } from "@/lib/db";
import { sendPushNotification } from "@/lib/push";
import { evaluateBool, evaluateStr } from "@/lib/safe-expr";
import { getLogger } from "@/lib/logger";

const logger = getLogger("flow-engine");

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
 * 安全表达式求值（委托给 safe-expr 模块，替代 new Function）。
 * 支持 ==、!=、>、<、>=、<=、&&、||、!、?:、字符串/数字字面量、变量引用、成员访问。
 */
function evaluateExpression(
  expression: string,
  context: Record<string, unknown>
): { ok: boolean; value: boolean; error?: string } {
  return evaluateBool(expression, context);
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

async function executeOutputNode(
  node: FlowNode,
  upstreamOutput: string,
  userId?: string
): Promise<NodeExecutionResult> {
  const start = Date.now();
  const target = node.config?.outputTarget || "notification";
  const targetLabels: Record<string, string> = {
    notification: "通知",
    cognition: "认知库",
    skills: "技能库",
    "idea.tags": "灵感标签",
    chat: "对话消息",
  };
  const label = targetLabels[target] || target;

  // 执行真实副作用（失败不阻断工作流执行，仅记录错误日志）
  let sideEffectMsg = "";
  try {
    switch (target) {
      case "cognition": {
        // 写入认知库：type=experience, source=flow
        await prisma.cognition.create({
          data: {
            type: "experience",
            content: upstreamOutput,
            source: "flow",
            userId: userId ?? null,
          },
        });
        sideEffectMsg = "已写入认知库";
        break;
      }
      case "skills": {
        // 创建新技能：name=前20字, content=完整输出, category=general, source=ai-generated
        const name = upstreamOutput.slice(0, 20) || "未命名技能";
        await prisma.skill.create({
          data: {
            name,
            description: upstreamOutput.slice(0, 200),
            content: upstreamOutput,
            promptTemplate: upstreamOutput,
            category: "general",
            source: "ai-generated",
            userId: userId ?? null,
          },
        });
        sideEffectMsg = `已创建技能「${name}」`;
        break;
      }
      case "idea.tags": {
        // 无具体 ideaId，仅记录日志
        sideEffectMsg = "无具体 ideaId，仅记录";
        break;
      }
      case "notification": {
        // 推送通知：查询当前用户的 PushSubscription 发送
        if (!userId) {
          sideEffectMsg = "无用户信息，跳过推送";
          break;
        }
        const subs = await prisma.pushSubscription.findMany({
          where: { userId },
        });
        if (subs.length === 0) {
          sideEffectMsg = "无推送订阅，跳过";
          break;
        }
        const payload = {
          title: `工作流输出：${node.label}`,
          body: upstreamOutput.slice(0, 200),
        };
        let sentCount = 0;
        for (const sub of subs) {
          const result = await sendPushNotification(
            {
              endpoint: sub.endpoint,
              keys: sub.keys as { p256dh: string; auth: string },
            },
            payload
          );
          if (result.success) sentCount++;
        }
        sideEffectMsg = `已推送（${sentCount}/${subs.length}）`;
        break;
      }
      case "chat": {
        // 仅记录日志，结果在执行结果中返回给前端显示
        sideEffectMsg = "结果在执行结果中返回";
        break;
      }
      default:
        sideEffectMsg = `未知输出目标：${target}`;
    }
  } catch (e) {
    // 副作用失败不阻断工作流执行，仅记录错误日志
    logger.error({ err: e, nodeLabel: node.label, target }, "输出节点副作用失败");
    return {
      nodeId: node.id,
      nodeLabel: node.label,
      status: "done",
      output: upstreamOutput,
      durationMs: Date.now() - start,
      message: `已输出到「${label}」（副作用失败：${(e as Error).message}）`,
    };
  }

  return {
    nodeId: node.id,
    nodeLabel: node.label,
    status: "done",
    output: upstreamOutput,
    durationMs: Date.now() - start,
    message: `已输出到「${label}」${sideEffectMsg ? "· " + sideEffectMsg : ""}`,
  };
}

// ============ 新增节点执行器 ============

/** Hermes 节点：调用本地 Hermes Agent 执行任务（桌面控制/Shell/Skills Hub） */
async function executeHermesNode(
  node: FlowNode,
  upstreamOutput: string,
  userId?: string
): Promise<NodeExecutionResult> {
  const start = Date.now();
  const prompt = (node.config?.hermesPrompt || "请处理以下内容").replace(/\{\{upstream\}\}/g, upstreamOutput);

  try {
    // 动态导入避免循环依赖
    const { getHermesConfig, executeHermesTask } = await import("@/lib/hermes-client");
    if (!userId) {
      return {
        nodeId: node.id,
        nodeLabel: node.label,
        status: "error",
        durationMs: Date.now() - start,
        error: "无用户上下文",
        message: "Hermes 节点需要用户上下文",
      };
    }
    const config = await getHermesConfig(userId);
    if (!config || !config.enabled) {
      return {
        nodeId: node.id,
        nodeLabel: node.label,
        status: "error",
        durationMs: Date.now() - start,
        error: "Hermes Agent 未启用",
        message: "请在设置中启用 Hermes Agent",
      };
    }

    const result = await executeHermesTask(config, {
      prompt,
      mode: node.config?.hermesMode || "auto",
      timeout: node.config?.timeout || 120,
      workDir: node.config?.workDir,
    });

    // 记录执行历史
    try {
      await prisma.skillExecution.create({
        data: {
          userId,
          skillId: "hermes-flow",
          skillName: `工作流：${node.label}`,
          source: "hermes",
          trigger: "flow",
          parameters: { prompt, mode: node.config?.hermesMode } as unknown as never,
          result: result.output,
          success: result.success,
          durationMs: result.durationMs || 0,
          error: result.error || null,
        },
      });
    } catch {
      // 记录失败不影响主流程
    }

    return {
      nodeId: node.id,
      nodeLabel: node.label,
      status: result.success ? "done" : "error",
      output: result.output,
      durationMs: Date.now() - start,
      error: result.error,
      message: result.success
        ? `Hermes 执行完成（${result.durationMs || 0}ms）`
        : `Hermes 执行失败：${result.error}`,
    };
  } catch (e) {
    return {
      nodeId: node.id,
      nodeLabel: node.label,
      status: "error",
      durationMs: Date.now() - start,
      error: (e as Error).message,
      message: `Hermes 调用异常：${(e as Error).message}`,
    };
  }
}

/** HTTP 节点：发起 HTTP 请求 */
async function executeHttpNode(
  node: FlowNode,
  upstreamOutput: string
): Promise<NodeExecutionResult> {
  const start = Date.now();
  const method = node.config?.httpMethod || "GET";
  const url = (node.config?.httpUrl || "").replace(/\{\{upstream\}\}/g, encodeURIComponent(upstreamOutput));
  const headers = node.config?.httpHeaders || {};
  let body = node.config?.httpBody || "";
  body = body.replace(/\{\{upstream\}\}/g, upstreamOutput);

  if (!url) {
    return {
      nodeId: node.id,
      nodeLabel: node.label,
      status: "error",
      durationMs: 0,
      error: "URL 为空",
      message: "HTTP 节点未配置 URL",
    };
  }

  // SSRF 防护：禁止访问内网地址
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname;
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0" ||
      hostname.startsWith("10.") ||
      hostname.startsWith("172.16.") ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("169.254.") ||  // 云元数据服务
      hostname === "::1" ||
      hostname === "[::1]"
    ) {
      return {
        nodeId: node.id,
        nodeLabel: node.label,
        status: "error",
        durationMs: Date.now() - start,
        error: "SSRF 防护：不允许访问内网地址",
        message: `HTTP 节点拒绝访问内网地址: ${hostname}`,
      };
    }
  } catch {
    return {
      nodeId: node.id,
      nodeLabel: node.label,
      status: "error",
      durationMs: 0,
      error: "URL 格式无效",
      message: "HTTP 节点 URL 解析失败",
    };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), (node.config?.timeout || 30) * 1000);
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json", ...headers },
      body: ["POST", "PUT", "PATCH"].includes(method) ? body : undefined,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const text = await res.text();
    const ok = res.ok;
    return {
      nodeId: node.id,
      nodeLabel: node.label,
      status: ok ? "done" : "error",
      output: text.slice(0, 10000), // 截断防止过大
      durationMs: Date.now() - start,
      error: ok ? undefined : `HTTP ${res.status}`,
      message: `HTTP ${method} ${res.status}（${Date.now() - start}ms）`,
    };
  } catch (e) {
    return {
      nodeId: node.id,
      nodeLabel: node.label,
      status: "error",
      durationMs: Date.now() - start,
      error: (e as Error).message,
      message: `HTTP 请求失败：${(e as Error).message}`,
    };
  }
}

/** Database 节点允许操作的模型白名单（防止任意模型访问） */
const ALLOWED_DB_MODELS = new Set([
  "idea", "task", "skill", "cognition", "memory",
  "chatMessage", "inspiration", "dailyFocus",
]);

/** Database 节点：数据库操作 */
async function executeDatabaseNode(
  node: FlowNode,
  upstreamOutput: string,
  userId?: string
): Promise<NodeExecutionResult> {
  const start = Date.now();
  const operation = node.config?.dbOperation || "query";
  const model = node.config?.dbModel || "idea";

  // 模型白名单校验
  if (!ALLOWED_DB_MODELS.has(model)) {
    return {
      nodeId: node.id,
      nodeLabel: node.label,
      status: "error",
      durationMs: Date.now() - start,
      error: `不允许的模型: ${model}`,
      message: `数据库操作被拒绝：模型 ${model} 不在白名单中`,
    };
  }

  try {
    let result: unknown;
    const data = node.config?.dbData
      ? JSON.parse(JSON.stringify(node.config.dbData).replace(/\{\{upstream\}\}/g, upstreamOutput))
      : {};

    switch (operation) {
      case "query": {
        const take = Math.min(parseInt(node.config?.dbQuery || "10", 10) || 10, 100);
        result = await (prisma as unknown as Record<string, { findMany: (args: unknown) => Promise<unknown[]> }>)[model]?.findMany({ take, orderBy: { createdAt: "desc" } });
        break;
      }
      case "create": {
        if (userId) data.userId = userId;
        result = await (prisma as unknown as Record<string, { create: (args: unknown) => Promise<unknown> }>)[model]?.create({ data });
        break;
      }
      default:
        result = { message: `${operation} 操作暂未实现` };
    }

    return {
      nodeId: node.id,
      nodeLabel: node.label,
      status: "done",
      output: JSON.stringify(result, null, 2),
      durationMs: Date.now() - start,
      message: `数据库 ${operation} ${model} 完成（${Date.now() - start}ms）`,
    };
  } catch (e) {
    return {
      nodeId: node.id,
      nodeLabel: node.label,
      status: "error",
      durationMs: Date.now() - start,
      error: (e as Error).message,
      message: `数据库操作失败：${(e as Error).message}`,
    };
  }
}

/** Transform 节点：数据转换/格式化 */
function executeTransformNode(
  node: FlowNode,
  upstreamOutput: string
): NodeExecutionResult {
  const start = Date.now();
  const type = node.config?.transformType || "template";
  const expr = node.config?.transformExpression || "";
  const template = node.config?.transformTemplate || "";

  try {
    let output = upstreamOutput;
    switch (type) {
      case "template": {
        output = (template || "{{upstream}}").replace(/\{\{upstream\}\}/g, upstreamOutput);
        break;
      }
      case "jsonpath": {
        try {
          const obj = JSON.parse(upstreamOutput);
          // 简单点路径：a.b.c
          const keys = expr.split(".").filter(Boolean);
          let cur: unknown = obj;
          for (const k of keys) {
            if (cur && typeof cur === "object") {
              cur = (cur as Record<string, unknown>)[k];
            }
          }
          output = typeof cur === "string" ? cur : JSON.stringify(cur, null, 2);
        } catch {
          output = upstreamOutput; // 非 JSON 则原样返回
        }
        break;
      }
      case "regex": {
        const match = upstreamOutput.match(new RegExp(expr));
        output = match ? (match[1] || match[0]) : "";
        break;
      }
      case "javascript": {
        // 安全求值（使用 safe-expr，替代 new Function）
        const result = evaluateStr(expr, { upstream: upstreamOutput });
        if (!result.ok) throw new Error(result.error);
        output = result.value as string;
        break;
      }
    }
    return {
      nodeId: node.id,
      nodeLabel: node.label,
      status: "done",
      output,
      durationMs: Date.now() - start,
      message: `数据转换完成（${type}）`,
    };
  } catch (e) {
    return {
      nodeId: node.id,
      nodeLabel: node.label,
      status: "error",
      durationMs: Date.now() - start,
      error: (e as Error).message,
      message: `数据转换失败：${(e as Error).message}`,
    };
  }
}

/** Delay 节点：延时 */
async function executeDelayNode(node: FlowNode): Promise<NodeExecutionResult> {
  const start = Date.now();
  const ms = Math.min(node.config?.delayMs || 1000, 60000); // 最大 60 秒
  await new Promise((resolve) => setTimeout(resolve, ms));
  return {
    nodeId: node.id,
    nodeLabel: node.label,
    status: "done",
    durationMs: Date.now() - start,
    message: `延时 ${ms}ms`,
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
        result = await executeOutputNode(node, upstreamOutput, flow.userId);
        if (result.status === "done" && result.output) {
          finalOutput = result.output;
        }
        break;
      case "hermes":
        result = await executeHermesNode(node, upstreamOutput, flow.userId);
        if (result.status === "done" && result.output) {
          upstreamOutput = result.output;
        }
        break;
      case "http":
        result = await executeHttpNode(node, upstreamOutput);
        if (result.status === "done" && result.output) {
          upstreamOutput = result.output;
        }
        break;
      case "database":
        result = await executeDatabaseNode(node, upstreamOutput, flow.userId);
        if (result.status === "done" && result.output) {
          upstreamOutput = result.output;
        }
        break;
      case "transform":
        result = executeTransformNode(node, upstreamOutput);
        if (result.status === "done" && result.output) {
          upstreamOutput = result.output;
        }
        break;
      case "delay":
        result = await executeDelayNode(node);
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
        result = await executeOutputNode(node, upstreamOutput, flow.userId);
        if (result.status === "done" && result.output) {
          finalOutput = result.output;
        }
        break;
      case "hermes":
        result = await executeHermesNode(node, upstreamOutput, flow.userId);
        if (result.status === "done" && result.output) {
          nextOutput = result.output;
        }
        break;
      case "http":
        result = await executeHttpNode(node, upstreamOutput);
        if (result.status === "done" && result.output) {
          nextOutput = result.output;
        }
        break;
      case "database":
        result = await executeDatabaseNode(node, upstreamOutput, flow.userId);
        if (result.status === "done" && result.output) {
          nextOutput = result.output;
        }
        break;
      case "transform":
        result = executeTransformNode(node, upstreamOutput);
        if (result.status === "done" && result.output) {
          nextOutput = result.output;
        }
        break;
      case "delay":
        result = await executeDelayNode(node);
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
        result = await executeOutputNode(node, upstreamOutput, flow.userId);
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

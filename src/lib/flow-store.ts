// Flow 数据存储层（MySQL/Prisma）
// 从文件存储迁移到数据库存储，支持执行历史持久化

import { promises as fs } from "fs";
import path from "path";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

// ============ 类型定义 ============

/** 节点配置（按节点类型使用不同字段） */
export interface NodeConfig {
  // trigger 节点
  triggerType?: "manual" | "schedule" | "event";
  schedule?: string;
  eventType?: string;
  // action 节点
  prompt?: string;
  model?: string;
  // condition 节点
  expression?: string;
  // output 节点
  outputTarget?: string;
  // hermes 节点：调用本地 Hermes Agent 执行任务
  hermesMode?: "computer_use" | "shell" | "auto";
  hermesPrompt?: string;
  workDir?: string;
  timeout?: number;
  // http 节点：发起 HTTP 请求
  httpMethod?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  httpUrl?: string;
  httpHeaders?: Record<string, string>;
  httpBody?: string;
  // database 节点：数据库查询/写入
  dbOperation?: "query" | "create" | "update" | "delete";
  dbModel?: string; // idea | task | memory | cognition | skill
  dbQuery?: string; // query 操作的 SQL/条件
  dbData?: Record<string, unknown>; // create/update 的数据
  // transform 节点：数据转换/格式化
  transformType?: "jsonpath" | "template" | "regex" | "javascript";
  transformExpression?: string;
  transformTemplate?: string;
  // delay 节点：延时
  delayMs?: number;
}

export interface FlowNode {
  id: string;
  type: "trigger" | "action" | "condition" | "output" | "hermes" | "http" | "database" | "transform" | "delay";
  label: string;
  status: "idle" | "running" | "done" | "error";
  /** 节点配置参数 */
  config?: NodeConfig;
}

export interface FlowEdge {
  id: string;
  from: string;
  to: string;
  /** 条件分支标记：condition 节点求值为 true 时走 "true" 分支，false 时走 "false" 分支；未标记则为普通顺序连线 */
  condition?: "true" | "false";
}

/** Flow 接口（适配 Prisma model，lastRun 保留为 string 供前端展示） */
export interface Flow {
  id: string;
  name: string;
  description: string;
  nodes: FlowNode[];
  edges?: FlowEdge[];
  enabled: boolean;
  /** 最后运行时间（相对描述，如 "刚刚"、"10分钟前"、"未运行"） */
  lastRun: string;
  userId?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ============ 默认工作流（首次初始化时使用）============

const FLOWS_FILE = path.join(process.cwd(), ".ai-flows.json");

const DEFAULT_FLOWS: Array<{
  name: string;
  description: string;
  enabled: boolean;
  lastRun: string;
  nodes: FlowNode[];
}> = [
  {
    name: "灵感自动分类",
    description: "新灵感入库后，AI 自动判断归属并打标签",
    lastRun: "10分钟前",
    enabled: true,
    nodes: [
      { id: "n1", type: "trigger", label: "Inbox 新增灵感", status: "done" },
      { id: "n2", type: "action", label: "AI 分析内容", status: "done" },
      { id: "n3", type: "condition", label: "判断归属", status: "done" },
      { id: "n4", type: "output", label: "打标签 + 推荐看板列", status: "done" },
    ],
  },
  {
    name: "对话资产自动提取",
    description: "粘贴对话后，AI 提取结论、待办、提示词",
    lastRun: "1小时前",
    enabled: true,
    nodes: [
      { id: "n1", type: "trigger", label: "对话捕获", status: "done" },
      { id: "n2", type: "action", label: "AI 提取结构", status: "done" },
      { id: "n3", type: "output", label: "写入认知库", status: "done" },
    ],
  },
  {
    name: "每日复盘生成",
    description: "每天 23:00 汇总当日任务、灵感、对话，生成日报",
    lastRun: "未运行",
    enabled: false,
    nodes: [
      { id: "n1", type: "trigger", label: "定时 23:00", status: "idle" },
      { id: "n2", type: "action", label: "汇总当日数据", status: "idle" },
      { id: "n3", type: "action", label: "AI 生成复盘", status: "idle" },
      { id: "n4", type: "output", label: "推送通知", status: "idle" },
    ],
  },
];

// ============ 内部工具函数 ============

/** 将 Date 转换为相对时间描述字符串 */
export function formatLastRun(date: Date | null): string {
  if (!date) return "未运行";
  const diff = Date.now() - date.getTime();
  if (diff < 60_000) return "刚刚";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}小时前`;
  return `${Math.floor(diff / 86_400_000)}天前`;
}

/** 将 Prisma Flow 记录转换为 Flow 接口 */
function toFlow(p: {
  id: string;
  name: string;
  description: string;
  nodes: Prisma.JsonValue;
  edges: Prisma.JsonValue;
  enabled: boolean;
  lastRun: Date | null;
  userId: string | null;
  createdAt: Date;
  updatedAt: Date;
}): Flow {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    nodes: p.nodes as unknown as FlowNode[],
    edges: (p.edges as unknown as FlowEdge[]) ?? [],
    enabled: p.enabled,
    lastRun: formatLastRun(p.lastRun),
    userId: p.userId ?? undefined,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

// ============ 数据库操作函数 ============

/** 读取所有工作流（按 updatedAt 降序） */
export async function readFlows(): Promise<Flow[]> {
  const flows = await prisma.flow.findMany({
    orderBy: { updatedAt: "desc" },
  });
  return flows.map(toFlow);
}

/** 根据 ID 获取单个工作流 */
export async function getFlowById(id: string): Promise<Flow | null> {
  const flow = await prisma.flow.findUnique({ where: { id } });
  return flow ? toFlow(flow) : null;
}

/** 创建新工作流 */
export async function createFlow(data: {
  name: string;
  description: string;
  nodes: FlowNode[];
  edges?: FlowEdge[];
  enabled?: boolean;
  userId?: string;
}): Promise<Flow> {
  const created = await prisma.flow.create({
    data: {
      name: data.name,
      description: data.description,
      nodes: data.nodes as unknown as Prisma.InputJsonValue,
      edges: (data.edges ?? []) as unknown as Prisma.InputJsonValue,
      enabled: data.enabled ?? true,
      userId: data.userId ?? null,
    },
  });
  return toFlow(created);
}

/** 更新工作流（局部更新） */
export async function updateFlow(id: string, data: Partial<Flow>): Promise<Flow> {
  // 构建更新数据，处理类型转换
  // 使用 UncheckedUpdateInput 以直接操作 userId 外键字段
  const updateData: Prisma.FlowUncheckedUpdateInput = {};

  if (typeof data.name === "string") updateData.name = data.name;
  if (typeof data.description === "string") updateData.description = data.description;
  if (typeof data.enabled === "boolean") updateData.enabled = data.enabled;
  if (Array.isArray(data.nodes)) {
    updateData.nodes = data.nodes as unknown as Prisma.InputJsonValue;
  }
  if (Array.isArray(data.edges)) {
    updateData.edges = data.edges as unknown as Prisma.InputJsonValue;
  }
  // lastRun：任何更新都视为"刚刚运行"，写入当前时间
  if (typeof data.lastRun === "string") {
    updateData.lastRun = data.lastRun === "未运行" ? null : new Date();
  }
  if (typeof data.userId === "string") updateData.userId = data.userId;

  const updated = await prisma.flow.update({
    where: { id },
    data: updateData,
  });
  return toFlow(updated);
}

/** 删除工作流（关联的 FlowExecution 会通过 onDelete: Cascade 自动删除） */
export async function deleteFlow(id: string): Promise<void> {
  await prisma.flow.delete({ where: { id } });
}

// ============ 数据迁移与初始化 ============

/**
 * 初始化默认工作流。
 * 如果数据库为空：
 *   1. 尝试读取 .ai-flows.json 文件并迁移数据到数据库
 *   2. 文件不存在时创建 DEFAULT_FLOWS
 * 迁移后保留原文件作为备份。
 */
export async function initializeDefaultFlows(): Promise<void> {
  const count = await prisma.flow.count();
  if (count > 0) return;

  // 尝试从 .ai-flows.json 迁移数据
  let migrated = false;
  try {
    const raw = await fs.readFile(FLOWS_FILE, "utf-8");
    const data = JSON.parse(raw);
    if (Array.isArray(data) && data.length > 0) {
      console.log(`[flow-store] 从 .ai-flows.json 迁移 ${data.length} 个工作流到数据库...`);
      for (const f of data) {
        const lastRunStr = typeof f.lastRun === "string" ? f.lastRun : "未运行";
        await prisma.flow.create({
          data: {
            name: f.name || "未命名工作流",
            description: f.description || "",
            nodes: (f.nodes || []) as unknown as Prisma.InputJsonValue,
            edges: (f.edges || []) as unknown as Prisma.InputJsonValue,
            enabled: f.enabled !== false,
            lastRun: lastRunStr === "未运行" ? null : new Date(),
          },
        });
      }
      migrated = true;
      console.log("[flow-store] 迁移完成，原文件已保留作为备份");
    }
  } catch {
    // 文件不存在或解析失败，使用默认数据
  }

  if (migrated) return;

  // 数据库为空且无文件可迁移，创建默认工作流
  console.log("[flow-store] 数据库为空，创建默认工作流...");
  for (const f of DEFAULT_FLOWS) {
    await prisma.flow.create({
      data: {
        name: f.name,
        description: f.description,
        nodes: f.nodes as unknown as Prisma.InputJsonValue,
        edges: [] as unknown as Prisma.InputJsonValue,
        enabled: f.enabled,
        lastRun: f.lastRun === "未运行" ? null : new Date(),
      },
    });
  }
  console.log(`[flow-store] 已创建 ${DEFAULT_FLOWS.length} 个默认工作流`);
}

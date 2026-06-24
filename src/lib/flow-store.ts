// Flow 数据存储层
// 从 route.ts 抽离，避免 Next.js 路由文件导出非 HTTP 函数导致的类型冲突

import { promises as fs } from "fs";
import path from "path";

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
}

export interface FlowNode {
  id: string;
  type: "trigger" | "action" | "condition" | "output";
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

export interface Flow {
  id: string;
  name: string;
  description: string;
  nodes: FlowNode[];
  edges?: FlowEdge[];
  lastRun: string;
  enabled: boolean;
}

// ============ JSON 文件存储 ============

const FLOWS_FILE = path.join(process.cwd(), ".ai-flows.json");

// 默认工作流（首次访问时初始化）
const DEFAULT_FLOWS: Flow[] = [
  {
    id: "flow-1",
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
    id: "flow-2",
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
    id: "flow-3",
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

// 读取工作流列表（文件不存在时初始化默认数据）
export async function readFlows(): Promise<Flow[]> {
  try {
    const raw = await fs.readFile(FLOWS_FILE, "utf-8");
    const data = JSON.parse(raw);
    if (Array.isArray(data)) return data as Flow[];
    return [];
  } catch {
    // 文件不存在或解析失败，初始化默认数据并写入
    await fs.writeFile(FLOWS_FILE, JSON.stringify(DEFAULT_FLOWS, null, 2), "utf-8");
    return DEFAULT_FLOWS;
  }
}

// 写入工作流列表
export async function writeFlows(flows: Flow[]): Promise<void> {
  await fs.writeFile(FLOWS_FILE, JSON.stringify(flows, null, 2), "utf-8");
}

// 生成唯一 ID
export function generateFlowId(): string {
  return `flow-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

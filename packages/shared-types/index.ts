/**
 * LynnHub 共享类型定义包
 * Web 端 (Next.js) 与桌面端 (Vite+React) 共用，消除双端类型重复维护。
 */

// ============ 焦点 / 看板 ============

export interface FocusItem {
  id: string;
  taskId: string;
  title: string;
  column: "northstar" | "campaign" | "task";
  completed: boolean;
  /** 后端可能返回关联的任务对象（含 content/column） */
  task?: { content: string; column: string };
}

export interface DailyFocus {
  id: string;
  date: string;
  status: string;
  items: FocusItem[];
}

export interface BoardTask {
  id: string;
  content: string;
  column: "northstar" | "campaign" | "task";
  status: "active" | "done" | "dropped";
  position: number;
  sourceId?: string | null;
  createdAt?: string;
  completedAt?: string | null;
}

export interface ColumnData {
  id: "northstar" | "campaign" | "task";
  title: string;
  color: string;
  bg: string;
  border: string;
  icon: string;
}

// ============ Agent 状态 ============

export interface AgentStatus {
  version: string;
  wsConnected: boolean;
  cloudEndpoint: string;
  authMode: string;
  authorizedDirs: string[];
  capabilities: string[];
  hasToken: boolean;
}

// ============ 灵感 / 收件箱 ============

export interface Attachment {
  type: "image" | "file";
  name: string;
  url: string;
  size?: number;
}

export interface Idea {
  id: string;
  content: string;
  source: string;
  status?: "inbox" | "board" | "graveyard";
  tags: string[];
  attachments?: Attachment[];
  createdAt: string;
}

export interface ReviveSuggestion {
  graveyardId: string;
  originalContent: string;
  reviveCondition: string;
  reason: string;
  matchedContent?: string;
  matchedIdeaId?: string;
}

export interface FinalizeResult {
  idea: Idea;
  cognition?: { id: string; type: string; content: string } | null;
  summary: string;
  tags: string[];
  suggestedColumn: string;
  reason: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// ============ 认知库 ============

export interface Cognition {
  id: string;
  type: "method" | "experience" | "prompt";
  content: string;
  source: string;
  tags: string[];
  createdAt: string;
}

// ============ 墓地 ============

export interface GraveyardItem {
  id: string;
  ideaId: string;
  content: string;
  reason: string;
  reviveCondition: string;
  revivedAt?: string | null;
  createdAt: string;
  abandonedAt: string;
}

// ============ 技能 ============

export interface SkillParameter {
  name: string;
  type: string;
  description?: string;
  required?: boolean;
  default?: unknown;
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  category: string;
  content: string;
  parameters: SkillParameter[];
  promptTemplate: string;
  source: string;
  tags: string[];
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

// ============ AI 工作流 ============

export type NodeType =
  | "trigger"
  | "action"
  | "condition"
  | "output"
  | "hermes"
  | "http"
  | "database"
  | "transform"
  | "delay";

export interface NodeConfig {
  triggerType?: "manual" | "schedule" | "event";
  schedule?: string;
  eventType?: string;
  prompt?: string;
  model?: string;
  expression?: string;
  outputTarget?: string;
  hermesMode?: "computer_use" | "shell" | "auto";
  hermesPrompt?: string;
  workDir?: string;
  timeout?: number;
  httpMethod?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  httpUrl?: string;
  httpHeaders?: Record<string, string>;
  httpBody?: string;
  dbOperation?: "query" | "create" | "update" | "delete";
  dbModel?: string;
  dbQuery?: string;
  dbData?: Record<string, unknown>;
  transformType?: "jsonpath" | "template" | "regex" | "javascript";
  transformExpression?: string;
  transformTemplate?: string;
  delayMs?: number;
}

export interface FlowNode {
  id: string;
  type: NodeType;
  label: string;
  status?: "idle" | "running" | "done" | "error";
  config?: NodeConfig;
  x?: number;
  y?: number;
}

export interface CanvasNode extends FlowNode {
  x: number;
  y: number;
}

export interface CanvasEdge {
  id: string;
  from: string;
  to: string;
  condition?: "true" | "false";
}

export interface Flow {
  id: string;
  name: string;
  description: string;
  nodes: FlowNode[];
  edges?: CanvasEdge[];
  lastRun: string;
  enabled: boolean;
}

export interface ExecutionResult {
  flowId: string;
  flowName: string;
  success: boolean;
  startedAt: string;
  finishedAt: string;
  totalDurationMs: number;
  finalOutput: string | null;
  nodes: Array<{
    nodeId: string;
    nodeLabel: string;
    status: "done" | "error" | "skipped";
    output?: string;
    durationMs: number;
    error?: string;
    message: string;
  }>;
  error: string | null;
}

export interface ExecutionHistoryItem {
  id: string;
  success: boolean;
  startedAt: string;
  finishedAt: string | null;
  totalDurationMs: number | null;
  finalOutput: string | null;
  nodeResults: Array<{
    nodeId: string;
    nodeName: string;
    success: boolean;
    output: string;
    durationMs: number;
  }> | null;
  error: string | null;
}

// ============ 飞书任务 ============

export interface LarkTask {
  id: string;
  guid?: string;
  title: string;
  summary?: string;
  description?: string;
  status?: string;
  priority?: string;
  dueDate?: string;
  due?: string;
  createdAt?: string;
  created?: string;
  completed?: boolean;
  isCompleted?: boolean;
  origin?: string;
  tasklistGuid?: string;
}

// ============ 会员 / 钱包 ============

export interface MembershipPlan {
  id: string;
  name: string;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
  credits: number;
  features: string[];
  highlight?: boolean;
}

export interface BillingCycle {
  plan: MembershipPlan;
  cycle: "monthly" | "yearly";
  price: number;
}

export interface PlansData {
  plans: MembershipPlan[];
  currentLevel?: string;
  currentCycle?: string;
}

export interface CurrentMembership {
  level: string;
  cycle: string;
  expiresAt: string | null;
  credits: number;
}

export interface WalletData {
  balance: number;
  totalEarned: number;
  totalSpent: number;
}

export interface CreditTx {
  id: string;
  amount: number;
  type: string;
  description: string;
  createdAt: string;
}

export interface SCoinTx {
  id: string;
  amount: number;
  type: string;
  description: string;
  createdAt: string;
}

export interface TxPage<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

// ============ 记忆图谱 ============

export interface MemoryNode {
  id: string;
  label: string;
  type: string;
  weight: number;
}

export interface MemoryEdge {
  source: string;
  target: string;
  weight: number;
}

export interface MemoryGraphData {
  nodes: MemoryNode[];
  edges: MemoryEdge[];
}

// ============ 搜索 ============

export interface KeywordResult {
  id: string;
  title: string;
  snippet: string;
  source: string;
  url?: string;
  score: number;
}

export interface SemanticResult {
  id: string;
  title: string;
  content: string;
  source: string;
  score: number;
}

// ============ 对话资产 ============

export interface Conversation {
  id: string;
  title: string;
  source: string;
  createdAt: string;
  messageCount: number;
}

export interface UploadItem {
  id: string;
  filename: string;
  status: "pending" | "uploading" | "done" | "error";
  progress: number;
  error?: string;
}

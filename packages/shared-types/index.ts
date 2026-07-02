/**
 * LynnHub 共享类型定义包
 * Web 端 (Next.js) 与桌面端 (Vite+React) 共用，消除双端类型重复维护。
 */

// ============ 焦点 / 看板 ============

export type BoardColumn = "northstar" | "campaign" | "task";

export interface FocusItem {
  id: string;
  taskId: string;
  title: string;
  column: BoardColumn;
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
  column: BoardColumn;
  status: "active" | "done" | "dropped";
  position: number;
  sourceId?: string | null;
  createdAt?: string;
  completedAt?: string | null;
}

export interface ColumnData {
  id: BoardColumn;
  title: string;
  color: string;
  bg: string;
  border: string;
  icon: string;
}

// ============ Agent 状态 ============

export type AgentAuthMode = "approve" | "once" | "free";

export interface AgentStatus {
  version: string;
  wsConnected: boolean;
  cloudEndpoint: string;
  authMode: AgentAuthMode;
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
  tags?: string[];
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
  ideaId?: string;
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

export type CognitionType = "method" | "experience" | "prompt";

export interface Cognition {
  id: string;
  type: CognitionType;
  content: string;
  source: string;
  tags?: string[];
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
  /** 公共技能市场字段 */
  isPublic?: boolean;
  publicId?: string;
  /** Hermes 技能的原始 ID（source=hermes 时使用） */
  originalId?: string;
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

/** FlowEdge 是 CanvasEdge 的别名，统一两端命名 */
export type FlowEdge = CanvasEdge;

export interface Flow {
  id: string;
  name: string;
  description: string;
  nodes: FlowNode[];
  edges?: CanvasEdge[];
  lastRun: string;
  enabled: boolean;
  /** 服务端字段（DB 层） */
  userId?: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
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
  /** 钱包扩展字段（后端权威 schema） */
  balanceAfter?: number;
  reason?: string;
  metadata?: Record<string, unknown>;
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

// ============ WebSocket 协议（跨端共享） ============

/** 设备类型 */
export type DeviceType = "web" | "desktop" | "mobile";

/** 授权模式 */
export type WSAuthMode = "approve" | "once" | "free";

/** 设备注册消息（客户端 → 服务端） */
export interface WSRegisterMessage {
  type: "register";
  token: string;
  agentVersion: string;
  deviceName: string;
  capabilities: string[];
  authMode: WSAuthMode;
  deviceType: DeviceType;
}

/** 心跳消息（客户端 → 服务端） */
export interface WSHeartbeatMessage {
  type: "heartbeat";
}

/** 指令状态更新（执行端 → 网关 → 发起方） */
export interface WSCommandUpdateMessage {
  type: "command-update";
  commandId: string;
  status: "executing" | "completed" | "failed";
  percent?: number;
  error?: string;
  result?: {
    success: boolean;
    output: string;
    error?: string;
    route?: string;
    durationMs?: number;
  };
}

/** 注册成功响应（服务端 → 客户端） */
export interface WSRegisteredMessage {
  type: "registered";
  deviceId: string;
  devices?: WSDeviceInfo[];
}

/** 远程指令下发（服务端 → 客户端） */
export interface WSRemoteCommandMessage {
  type: "remote-command";
  commandId: string;
  command: string;
  timestamp: number;
}

/** 设备列表变更（服务端 → 客户端） */
export interface WSDevicesChangedMessage {
  type: "devices-changed";
  devices: WSDeviceInfo[];
}

/** 在线设备信息 */
export interface WSDeviceInfo {
  deviceId: string;
  userId: string;
  deviceName: string;
  deviceType: DeviceType;
  capabilities: string[];
  authMode: WSAuthMode;
  agentVersion: string;
  lastSeen: string;
}

// ============ SSE 流式事件（跨端共享） ============

/** SSE 元信息事件 */
export interface SSEMetaEvent {
  type: "meta";
  model: string;
  provider: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

/** SSE 思考过程事件 */
export interface SSEThinkingEvent {
  type: "thinking";
  content: string;
}

/** SSE 工具调用开始事件 */
export interface SSEToolStartEvent {
  type: "tool_start";
  tool: string;
  args: Record<string, unknown>;
}

/** SSE 工具调用完成事件 */
export interface SSEToolDoneEvent {
  type: "tool_done";
  tool: string;
  result: unknown;
  durationMs?: number;
}

/** SSE 增量内容事件 */
export interface SSEDeltaEvent {
  type: "delta";
  content: string;
}

/** SSE 流结束事件 */
export interface SSEDoneEvent {
  type: "done";
  fullContent?: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  finishReason?: string;
  provider?: string;
  model?: string;
}

/** SSE 错误事件 */
export interface SSEErrorEvent {
  type: "error";
  message: string;
  code?: string;
}

/** 所有 SSE 事件联合类型 */
export type SSEEvent =
  | SSEMetaEvent
  | SSEThinkingEvent
  | SSEToolStartEvent
  | SSEToolDoneEvent
  | SSEDeltaEvent
  | SSEDoneEvent
  | SSEErrorEvent;

// ============ 平台音频接口（跨端共享协议） ============

/** 可播放的音频资源（各端不同） */
export type AudioPlayable =
  | { type: "url"; url: string }
  | { type: "base64"; data: string; format: string }
  | { type: "blob"; blob: Blob }
  | { type: "arraybuffer"; buffer: ArrayBuffer };

/** 音频采集配置 */
export interface AudioCaptureConfig {
  sampleRate: number;
  channelCount: number;
  bitsPerSample: number;
}

/** VAD 状态 */
export type VADState = "idle" | "listening" | "speaking" | "silence";

/** ASR 识别结果 */
export interface ASRResult {
  text: string;
  isFinal: boolean;
  confidence?: number;
}

/** TTS 合成请求 */
export interface TTSRequest {
  text: string;
  model?: string;
  voiceId?: string;
  speed?: number;
  pitch?: number;
}

/** 可见性状态 */
export type VisibilityState = "visible" | "hidden" | "background";

// ============ 用户 / 认证（跨端共享） ============

/** 登录用户信息（与后端 /api/auth/token 返回一致） */
export interface AuthUser {
  id: string;
  username: string;
  role: string;
  displayName: string;
  phone?: string;
  avatarUrl?: string;
}

/** /api/auth/token 成功响应 */
export interface TokenResponse {
  token: string;
  user: AuthUser;
}

/** /api/auth/sms-code 成功响应 */
export interface SmsCodeResponse {
  ok: boolean;
  message: string;
  masterCodeEnabled: boolean;
}

// ============ 统一 API 响应格式（跨端共享） ============

/** 标准成功响应 */
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

/** 标准失败响应 */
export interface ApiErrorResponse {
  success: false;
  error: {
    code: number;
    message: string;
  };
}

/** 标准响应联合类型 */
export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

// ============ 设备 / HermesAgent（跨端共享） ============

/** HermesAgent Dashboard 状态 */
export interface HermesStatus {
  installed: boolean;
  running: boolean;
  version?: string;
  lastError?: string;
  /** Dashboard HTTP API 端口（默认 9119） */
  port?: number;
}

/** HermesAgent 更新信息 */
export interface HermesUpdateInfo {
  currentVersion: string;
  latestVersion: string;
  hasUpdate: boolean;
  wheelFile: string;
  releaseNotes?: string;
}

// ============ 语音通话状态机（跨端共享） ============

/** 语音通话状态 */
export type VoiceCallState = "idle" | "listening" | "thinking" | "speaking";

// ============ 协议常量（跨端共享） ============

/** WS 心跳间隔（毫秒） */
export const WS_HEARTBEAT_INTERVAL_MS = 30_000;

/** WS 断线重连延迟（毫秒） */
export const WS_RECONNECT_DELAY_MS = 10_000;

/** WS 系统命令前缀（只有桌面端可执行） */
export const SYSTEM_COMMAND_PREFIX = "__LYNN_CMD__:";

/** 判断命令是否为系统命令 */
export function isSystemCommand(command: string): boolean {
  return command.startsWith(SYSTEM_COMMAND_PREFIX);
}


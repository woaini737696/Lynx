"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Workflow,
  Plus,
  Play,
  GitBranch,
  Zap,
  Clock,
  CheckCircle2,
  Trash2,
  Save,
  Eraser,
  Network,
  List,
  Search,
  Copy,
  Download,
  Edit3,
  Settings,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
  Maximize,
  LayoutGrid,
  FileText,
  Brain,
  MessageSquare,
  Sparkles,
  BookOpen,
  AlertCircle,
  ChevronDown,
  Loader2,
  History,
  ChevronRight,
  Cpu,
  Globe,
  Database,
  Shuffle,
  Timer,
} from "lucide-react";
import { PageHeader, Card, Button, Badge } from "@/components/layout/PageHeader";
import { HelpButton } from "@/components/layout/HelpButton";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/toast";

// ============ 类型定义 ============

/** 节点配置（按节点类型使用不同字段） */
interface NodeConfig {
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
  // hermes 节点
  hermesMode?: "computer_use" | "shell" | "auto";
  hermesPrompt?: string;
  workDir?: string;
  timeout?: number;
  // http 节点
  httpMethod?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  httpUrl?: string;
  httpHeaders?: Record<string, string>;
  httpBody?: string;
  // database 节点
  dbOperation?: "query" | "create" | "update" | "delete";
  dbModel?: string;
  dbQuery?: string;
  dbData?: Record<string, unknown>;
  // transform 节点
  transformType?: "jsonpath" | "template" | "regex" | "javascript";
  transformExpression?: string;
  transformTemplate?: string;
  // delay 节点
  delayMs?: number;
}

interface FlowNode {
  id: string;
  type: "trigger" | "action" | "condition" | "output" | "hermes" | "http" | "database" | "transform" | "delay";
  label: string;
  status: "idle" | "running" | "done" | "error";
  config?: NodeConfig;
}

interface Flow {
  id: string;
  name: string;
  description: string;
  nodes: FlowNode[];
  edges?: CanvasEdge[];
  lastRun: string;
  enabled: boolean;
}

// 画布节点（在 FlowNode 基础上增加坐标）
interface CanvasNode extends FlowNode {
  x: number;
  y: number;
}

interface CanvasEdge {
  id: string;
  from: string;
  to: string;
  /** 条件分支标记：condition 节点求值为 true 时走 "true" 分支，false 时走 "false" 分支；未标记则为普通顺序连线 */
  condition?: "true" | "false";
}

// 运行日志条目
interface RunLog {
  nodeId: string;
  nodeLabel: string;
  status: FlowNode["status"];
  message: string;
  time: string;
}

// 执行历史条目
interface ExecutionHistoryItem {
  id: string;
  flowId: string;
  flowName: string;
  success: boolean;
  startedAt: string;
  finishedAt: string | null;
  totalDurationMs: number;
  finalOutput: string | null;
  nodeResults: Array<{
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

// ============ 常量 ============

const NODE_STYLES: Record<FlowNode["type"], { color: string; bg: string; icon: React.ElementType }> = {
  trigger: { color: "text-northstar", bg: "bg-northstar/10", icon: Zap },
  action: { color: "text-cognition", bg: "bg-cognition/10", icon: Workflow },
  condition: { color: "text-campaign", bg: "bg-campaign/10", icon: GitBranch },
  output: { color: "text-task", bg: "bg-task/10", icon: CheckCircle2 },
  hermes: { color: "text-purple-600", bg: "bg-purple-500/10", icon: Cpu },
  http: { color: "text-blue-600", bg: "bg-blue-500/10", icon: Globe },
  database: { color: "text-emerald-600", bg: "bg-emerald-500/10", icon: Database },
  transform: { color: "text-orange-600", bg: "bg-orange-500/10", icon: Shuffle },
  delay: { color: "text-gray-600", bg: "bg-gray-500/10", icon: Timer },
};

const STATUS_STYLES: Record<FlowNode["status"], string> = {
  idle: "border-border bg-muted/30",
  running: "border-cognition/40 bg-cognition/5 animate-pulse",
  done: "border-task/30 bg-task/5",
  error: "border-graveyard/40 bg-graveyard/5",
};

// 节点与画布尺寸常量
const NODE_WIDTH = 190;
const NODE_HEIGHT = 60;
const CANVAS_WIDTH = 1800;
const CANVAS_HEIGHT = 1200;

const NODE_TYPE_LABELS: Record<FlowNode["type"], string> = {
  trigger: "触发器",
  action: "动作",
  condition: "条件",
  output: "输出",
  hermes: "Hermes",
  http: "HTTP",
  database: "数据库",
  transform: "转换",
  delay: "延时",
};

const NODE_PANEL_ITEMS: { type: FlowNode["type"]; label: string; desc: string }[] = [
  { type: "trigger", label: "触发器", desc: "启动工作流" },
  { type: "action", label: "动作", desc: "执行 AI 任务" },
  { type: "condition", label: "条件", desc: "分支判断" },
  { type: "output", label: "输出", desc: "结果产出" },
  { type: "hermes", label: "Hermes", desc: "本地 AI 代理" },
  { type: "http", label: "HTTP", desc: "发起网络请求" },
  { type: "database", label: "数据库", desc: "查询/写入数据" },
  { type: "transform", label: "转换", desc: "数据格式化" },
  { type: "delay", label: "延时", desc: "等待一段时间" },
];

// 工作流模板
interface FlowTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  color: string;
  nodes: FlowNode[];
}
const FLOW_TEMPLATES: FlowTemplate[] = [
  {
    id: "tpl-classify",
    name: "灵感分类",
    description: "新灵感自动判断归属并打标签",
    icon: Brain,
    color: "text-cognition",
    nodes: [
      { id: "t1", type: "trigger", label: "Inbox 新增灵感", status: "idle", config: { triggerType: "event", eventType: "idea.created" } },
      { id: "a1", type: "action", label: "AI 分析内容", status: "idle", config: { prompt: "分析这条灵感的内容和主题", model: "deepseek-chat" } },
      { id: "c1", type: "condition", label: "判断归属", status: "idle", config: { expression: "category == 'product'" } },
      { id: "o1", type: "output", label: "打标签 + 推荐看板列", status: "idle", config: { outputTarget: "idea.tags" } },
    ],
  },
  {
    id: "tpl-distill",
    name: "对话蒸馏",
    description: "从对话中提取结论、待办、提示词",
    icon: MessageSquare,
    color: "text-task",
    nodes: [
      { id: "t1", type: "trigger", label: "对话捕获", status: "idle", config: { triggerType: "manual" } },
      { id: "a1", type: "action", label: "AI 提取结构", status: "idle", config: { prompt: "从对话中提取关键结论、待办事项和可复用提示词", model: "deepseek-chat" } },
      { id: "o1", type: "output", label: "写入认知库", status: "idle", config: { outputTarget: "cognition" } },
    ],
  },
  {
    id: "tpl-review",
    name: "每日复盘",
    description: "每天 23:00 汇总当日数据生成日报",
    icon: FileText,
    color: "text-northstar",
    nodes: [
      { id: "t1", type: "trigger", label: "定时 23:00", status: "idle", config: { triggerType: "schedule", schedule: "0 23 * * *" } },
      { id: "a1", type: "action", label: "汇总当日数据", status: "idle", config: { prompt: "汇总今天的任务、灵感和对话", model: "deepseek-chat" } },
      { id: "a2", type: "action", label: "AI 生成复盘", status: "idle", config: { prompt: "基于汇总数据生成结构化复盘报告", model: "deepseek-reasoner" } },
      { id: "o1", type: "output", label: "推送通知", status: "idle", config: { outputTarget: "notification" } },
    ],
  },
  {
    id: "tpl-skill",
    name: "技能生成",
    description: "从经验中提炼可复用的技能卡片",
    icon: Sparkles,
    color: "text-campaign",
    nodes: [
      { id: "t1", type: "trigger", label: "手动触发", status: "idle", config: { triggerType: "manual" } },
      { id: "a1", type: "action", label: "AI 提炼技能", status: "idle", config: { prompt: "从给定经验中提炼出可复用的技能卡片，包含步骤、要点、注意事项", model: "deepseek-chat" } },
      { id: "c1", type: "condition", label: "质量检查", status: "idle", config: { expression: "quality_score >= 0.8" } },
      { id: "o1", type: "output", label: "写入技能库", status: "idle", config: { outputTarget: "skills" } },
    ],
  },
  {
    id: "tpl-qa",
    name: "知识问答",
    description: "基于认知库回答用户提问",
    icon: BookOpen,
    color: "text-cognition",
    nodes: [
      { id: "t1", type: "trigger", label: "用户提问", status: "idle", config: { triggerType: "event", eventType: "user.question" } },
      { id: "a1", type: "action", label: "检索认知库", status: "idle", config: { prompt: "在认知库中检索与问题相关的内容", model: "deepseek-chat" } },
      { id: "a2", type: "action", label: "AI 生成回答", status: "idle", config: { prompt: "基于检索结果生成结构化回答", model: "deepseek-chat" } },
      { id: "o1", type: "output", label: "返回回答", status: "idle", config: { outputTarget: "chat" } },
    ],
  },
];

// ============ 主组件 ============

export default function AIFlowsPage() {
  const [flows, setFlows] = useState<Flow[]>([]);
  const [selectedFlow, setSelectedFlow] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // 视图模式：list 列表 / visual 可视化编排
  const [mode, setMode] = useState<"list" | "visual">("list");

  // 列表视图：搜索 + 筛选
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "enabled" | "disabled">("all");

  // 模板面板显示
  const [showTemplates, setShowTemplates] = useState(false);

  // 从 /api/ai/flows 获取工作流列表
  const fetchFlows = useCallback(() => {
    setLoading(true);
    fetch("/api/ai/flows")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.flows)) {
          setFlows(data.flows);
          if (data.flows.length > 0 && !selectedFlow) {
            setSelectedFlow(data.flows[0].id);
          }
        }
      })
      .catch((e) => {
        console.error("获取工作流列表失败:", e);
        toast("获取工作流列表失败", "error");
      })
      .finally(() => setLoading(false));
  }, [selectedFlow]);

  useEffect(() => {
    fetchFlows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 可视化编排状态
  const [nodes, setNodes] = useState<CanvasNode[]>([]);
  const [edges, setEdges] = useState<CanvasEdge[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState("");
  // 拖拽连线时的临时终点
  const [tempConnect, setTempConnect] = useState<{ x: number; y: number } | null>(null);

  // 节点配置面板
  const [configNodeId, setConfigNodeId] = useState<string | null>(null);

  // 运行日志
  const [runLogs, setRunLogs] = useState<RunLog[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [running, setRunning] = useState(false);
  // 当前可视化编排的工作流 ID（用于保存和执行）
  const [visualFlowId, setVisualFlowId] = useState<string | null>(null);

  // 执行历史
  const [showHistory, setShowHistory] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyList, setHistoryList] = useState<ExecutionHistoryItem[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const historyPageSize = 10;

  // 缩放控制
  const [zoom, setZoom] = useState(1);

  // 节点右键菜单
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null);

  // 画布平移
  const [isPanning, setIsPanning] = useState(false);

  const canvasRef = useRef<HTMLDivElement>(null);
  // 节点拖动状态（ref 避免频繁重渲染）
  const dragNodeRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);
  // 连线拖拽状态
  const connectRef = useRef<{ from: string } | null>(null);
  // edges 的 ref，供 document 级事件读取最新值
  const edgesRef = useRef<CanvasEdge[]>([]);
  edgesRef.current = edges;
  // nodes 的 ref，供 addEdge 读取最新节点类型
  const nodesRef = useRef<CanvasNode[]>([]);
  nodesRef.current = nodes;

  // 选中状态 ref，供 document 级键盘事件读取
  const selectedNodeIdRef = useRef<string | null>(null);
  selectedNodeIdRef.current = selectedNodeId;
  const selectedEdgeIdRef = useRef<string | null>(null);
  selectedEdgeIdRef.current = selectedEdgeId;
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  // 画布平移相关 ref
  const panStartRef = useRef<{ x: number; y: number; scrollLeft: number; scrollTop: number } | null>(null);
  const spacePressedRef = useRef(false);

  const current = flows.find((f) => f.id === selectedFlow);

  // ============ 列表视图操作 ============

  // 筛选后的工作流
  const filteredFlows = flows.filter((f) => {
    const matchSearch =
      !searchQuery ||
      f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus =
      filterStatus === "all" ||
      (filterStatus === "enabled" && f.enabled) ||
      (filterStatus === "disabled" && !f.enabled);
    return matchSearch && matchStatus;
  });

  // 切换启用状态
  const toggleFlowEnabled = async (flow: Flow) => {
    const updated = { ...flow, enabled: !flow.enabled };
    setFlows((prev) => prev.map((f) => (f.id === flow.id ? updated : f)));
    try {
      await fetch(`/api/ai/flows/${flow.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !flow.enabled }),
      });
      toast(`已${!flow.enabled ? "启用" : "停用"}工作流`, "success");
    } catch {
      toast("更新失败，已回滚", "error");
      setFlows((prev) => prev.map((f) => (f.id === flow.id ? flow : f)));
    }
  };

  // 复制工作流
  const duplicateFlow = async (flow: Flow) => {
    try {
      const res = await fetch("/api/ai/flows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${flow.name} (副本)`,
          description: flow.description,
          nodes: flow.nodes.map((n) => ({ ...n, status: "idle" as const })),
          enabled: false,
        }),
      });
      if (!res.ok) throw new Error("复制失败");
      const data = await res.json();
      setFlows((prev) => [...prev, data.flow]);
      toast("已复制工作流", "success");
    } catch (e) {
      toast("复制失败：" + (e as Error).message, "error");
    }
  };

  // 删除工作流
  const deleteFlow = async (flow: Flow) => {
    if (!confirm(`确定删除工作流「${flow.name}」？此操作不可撤销。`)) return;
    setFlows((prev) => prev.filter((f) => f.id !== flow.id));
    if (selectedFlow === flow.id) {
      setSelectedFlow(flows.find((f) => f.id !== flow.id)?.id || null);
    }
    try {
      await fetch(`/api/ai/flows/${flow.id}`, { method: "DELETE" });
      toast("已删除工作流", "success");
    } catch {
      toast("删除失败，已回滚", "error");
      fetchFlows();
    }
  };

  // 运行工作流（列表视图）—— 调用真实执行引擎
  const runFlow = async (flow: Flow) => {
    toast(`开始运行「${flow.name}」...`, "info");
    try {
      const res = await fetch(`/api/ai/flows/${flow.id}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: "" }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `执行失败（${res.status}）`);
      }
      const data = await res.json();
      const result = data.result as {
        success: boolean;
        nodes: Array<{ nodeLabel: string; status: string; message: string; durationMs: number }>;
        totalDurationMs: number;
        finalOutput?: string;
      };

      // 逐条展示节点执行结果
      for (const node of result.nodes) {
        const icon = node.status === "done" ? "✓" : node.status === "skipped" ? "→" : "✗";
        toast(`${icon} ${node.nodeLabel}（${node.durationMs}ms）`, node.status === "error" ? "error" : "success");
      }

      // 更新最后运行时间
      const updated = { ...flow, lastRun: "刚刚" };
      setFlows((prev) => prev.map((f) => (f.id === flow.id ? updated : f)));

      if (result.success) {
        toast(`「${flow.name}」运行完成（${result.totalDurationMs}ms）`, "success");
      } else {
        toast(`「${flow.name}」运行出错`, "error");
      }
    } catch (e) {
      toast("运行失败：" + (e as Error).message, "error");
    }
  };

  // 从模板创建工作流
  const createFromTemplate = async (tpl: FlowTemplate) => {
    try {
      const res = await fetch("/api/ai/flows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: tpl.name,
          description: tpl.description,
          nodes: tpl.nodes,
          enabled: true,
        }),
      });
      if (!res.ok) throw new Error("创建失败");
      const data = await res.json();
      setFlows((prev) => [...prev, data.flow]);
      setSelectedFlow(data.flow.id);
      setShowTemplates(false);
      toast(`已从模板创建「${tpl.name}」`, "success");
    } catch (e) {
      toast("创建失败：" + (e as Error).message, "error");
    }
  };

  // ============ 可视化编排：坐标转换 ============

  // 客户端坐标 → 画布内坐标（考虑缩放）
  const getCanvasPoint = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left + canvas.scrollLeft) / zoomRef.current,
      y: (clientY - rect.top + canvas.scrollTop) / zoomRef.current,
    };
  };

  // 计算节点输出端口（右侧）坐标
  const getOutputPort = (node: CanvasNode) => ({
    x: node.x + NODE_WIDTH,
    y: node.y + NODE_HEIGHT / 2,
  });

  // 计算节点输入端口（左侧）坐标
  const getInputPort = (node: CanvasNode) => ({
    x: node.x,
    y: node.y + NODE_HEIGHT / 2,
  });

  // 贝塞尔曲线路径
  const bezierPath = (x1: number, y1: number, x2: number, y2: number) => {
    const dx = Math.abs(x2 - x1);
    const offset = Math.max(40, dx * 0.5);
    return `M ${x1} ${y1} C ${x1 + offset} ${y1}, ${x2 - offset} ${y2}, ${x2} ${y2}`;
  };

  // ============ 可视化编排：节点操作 ============

  // 创建节点
  const createNode = (type: FlowNode["type"], x: number, y: number) => {
    const id = `node-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const defaultLabels: Record<FlowNode["type"], string> = {
      trigger: "新触发器",
      action: "新动作",
      condition: "新条件",
      output: "新输出",
      hermes: "Hermes 任务",
      http: "HTTP 请求",
      database: "数据库操作",
      transform: "数据转换",
      delay: "延时",
    };
    setNodes((prev) => [
      ...prev,
      {
        id,
        type,
        label: defaultLabels[type],
        status: "idle",
        x: Math.max(0, Math.min(x, CANVAS_WIDTH - NODE_WIDTH)),
        y: Math.max(0, Math.min(y, CANVAS_HEIGHT - NODE_HEIGHT)),
      },
    ]);
    setSelectedNodeId(id);
    setSelectedEdgeId(null);
  };

  // 添加连线（防重复 / 防自连）
  // 若源节点是 condition 类型，自动分配 condition 标记：
  //   - 第一条从 condition 出发的连线默认标记为 "true"
  //   - 第二条标记为 "false"
  //   - 后续连线不标记（用户可在选中连线后通过工具栏切换）
  const addEdge = useCallback((from: string, to: string) => {
    if (from === to) {
      toast("不能连接到自身", "info");
      return;
    }

    const fromNode = nodesRef.current.find((n) => n.id === from);
    const toNode = nodesRef.current.find((n) => n.id === to);

    if (!fromNode || !toNode) return;

    // output 节点不能有出边
    if (fromNode.type === "output") {
      toast("输出节点不能有出边", "info");
      return;
    }

    // trigger 节点只能有 1 条出边（新连线替换旧连线）
    if (fromNode.type === "trigger") {
      setEdges((prev) => prev.filter((e) => e.from !== from));
    }

    // 简单环检测：目标节点的后续不能包含源节点
    const visited = new Set<string>();
    const checkCycle = (nodeId: string): boolean => {
      if (nodeId === from) return true;
      if (visited.has(nodeId)) return false;
      visited.add(nodeId);
      return edgesRef.current.some((e) => e.from === nodeId && checkCycle(e.to));
    };
    if (checkCycle(to)) {
      toast("不能形成环路", "info");
      return;
    }

    // 防重复
    if (edgesRef.current.some((e) => e.from === from && e.to === to)) {
      toast("该连线已存在", "info");
      return;
    }

    const id = `edge-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    let condition: "true" | "false" | undefined;
    if (fromNode.type === "condition") {
      const existingFromThis = edgesRef.current.filter((e) => e.from === from);
      const hasTrue = existingFromThis.some((e) => e.condition === "true");
      const hasFalse = existingFromThis.some((e) => e.condition === "false");
      if (!hasTrue) condition = "true";
      else if (!hasFalse) condition = "false";
    }
    setEdges((prev) => [...prev, { id, from, to, condition }]);
    toast(condition ? `已建立连接（${condition === "true" ? "成立" : "不成立"}分支）` : "已建立连接", "success");
  }, []);


  // 删除节点（同时清理关联连线）
  const deleteNode = useCallback((id: string) => {
    setNodes((prev) => prev.filter((n) => n.id !== id));
    setEdges((prev) => prev.filter((e) => e.from !== id && e.to !== id));
    setSelectedNodeId(null);
  }, []);

  // 复制节点（创建副本，偏移 40px）
  const duplicateNode = useCallback((id: string) => {
    const node = nodesRef.current.find((n) => n.id === id);
    if (!node) return;
    const newId = `node-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setNodes((prev) => [
      ...prev,
      {
        ...node,
        id: newId,
        x: node.x + 40,
        y: node.y + 40,
        status: "idle",
        label: `${node.label} (副本)`,
      },
    ]);
    setSelectedNodeId(newId);
    toast("已复制节点", "success");
  }, []);

  // 删除连线
  const deleteEdge = useCallback((id: string) => {
    setEdges((prev) => prev.filter((e) => e.id !== id));
    setSelectedEdgeId(null);
  }, []);

  // 切换连线的条件标记（仅在源节点为 condition 时可用）
  // 循环：undefined → "true" → "false" → undefined
  const toggleEdgeCondition = useCallback((id: string) => {
    setEdges((prev) =>
      prev.map((e) => {
        if (e.id !== id) return e;
        const next: "true" | "false" | undefined =
          e.condition === undefined ? "true" :
          e.condition === "true" ? "false" : undefined;
        return { ...e, condition: next };
      })
    );
  }, []);

  // 面板拖拽起始（HTML5 拖拽）
  const handlePanelDragStart = (e: React.DragEvent, type: FlowNode["type"]) => {
    e.dataTransfer.setData("application/node-type", type);
    e.dataTransfer.effectAllowed = "copy";
  };

  // 画布放置：创建节点
  const handleCanvasDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const type = e.dataTransfer.getData("application/node-type") as FlowNode["type"];
    if (!type) return;
    const point = getCanvasPoint(e.clientX, e.clientY);
    createNode(type, point.x - NODE_WIDTH / 2, point.y - NODE_HEIGHT / 2);
  };

  const handleCanvasDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  // 节点拖动（画布内移动）
  const handleNodeMouseDown = (e: React.MouseEvent, node: CanvasNode) => {
    if ((e.target as HTMLElement).closest("[data-port]")) return;
    e.stopPropagation();
    setSelectedNodeId(node.id);
    setSelectedEdgeId(null);
    const point = getCanvasPoint(e.clientX, e.clientY);
    dragNodeRef.current = { id: node.id, offsetX: point.x - node.x, offsetY: point.y - node.y };
  };

  // 连线起始（从输出端口拖出）
  const handleOutputPortMouseDown = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    e.preventDefault();
    connectRef.current = { from: nodeId };
    setTempConnect(getCanvasPoint(e.clientX, e.clientY));
  };

  // 双击节点：打开配置面板
  const handleNodeDoubleClick = (node: CanvasNode) => {
    setConfigNodeId(node.id);
  };

  // 节点右键菜单
  const handleNodeContextMenu = (e: React.MouseEvent, node: CanvasNode) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedNodeId(node.id);
    setContextMenu({ x: e.clientX, y: e.clientY, nodeId: node.id });
  };

  // 单击节点标签进入编辑
  const handleLabelEdit = (node: CanvasNode) => {
    setEditingNodeId(node.id);
    setEditingLabel(node.label);
  };

  // 提交标签编辑
  const commitEdit = () => {
    setNodes((prev) =>
      prev.map((n) =>
        n.id === editingNodeId ? { ...n, label: editingLabel.trim() || n.label } : n
      )
    );
    setEditingNodeId(null);
    setEditingLabel("");
  };

  // ============ 自动布局 ============

  // 简单分层布局：按拓扑排序分层，同层节点垂直排列
  const autoLayout = () => {
    if (nodes.length === 0) {
      toast("画布为空", "info");
      return;
    }
    // 计算每个节点的层级（基于入边）
    const inDegree: Record<string, number> = {};
    const adj: Record<string, string[]> = {};
    nodes.forEach((n) => {
      inDegree[n.id] = 0;
      adj[n.id] = [];
    });
    edges.forEach((e) => {
      if (adj[e.from]) adj[e.from].push(e.to);
      if (inDegree[e.to] !== undefined) inDegree[e.to]++;
    });
    // BFS 分层
    const layers: string[][] = [];
    const visited = new Set<string>();
    let queue = nodes.filter((n) => inDegree[n.id] === 0).map((n) => n.id);
    if (queue.length === 0) queue = [nodes[0].id]; // 防止环
    while (queue.length > 0) {
      layers.push(queue);
      const next: string[] = [];
      queue.forEach((id) => {
        visited.add(id);
        (adj[id] || []).forEach((to) => {
          if (!visited.has(to) && !next.includes(to)) {
            next.push(to);
          }
        });
      });
      queue = next;
    }
    // 未访问的节点放入最后一层
    const unvisited = nodes.filter((n) => !visited.has(n.id)).map((n) => n.id);
    if (unvisited.length > 0) layers.push(unvisited);

    // 应用坐标
    const layerGapX = 260;
    const nodeGapY = 100;
    const startX = 60;
    const startY = 60;
    setNodes((prev) =>
      prev.map((n) => {
        let layerIdx = -1;
        let posInLayer = 0;
        for (let i = 0; i < layers.length; i++) {
          const idx = layers[i].indexOf(n.id);
          if (idx !== -1) {
            layerIdx = i;
            posInLayer = idx;
            break;
          }
        }
        if (layerIdx === -1) return n;
        return {
          ...n,
          x: startX + layerIdx * layerGapX,
          y: startY + posInLayer * nodeGapY,
        };
      })
    );
    toast("已自动排列节点", "success");
  };

  // ============ 缩放控制 ============

  const zoomIn = () => setZoom((z) => Math.min(2, +(z + 0.1).toFixed(2)));
  const zoomOut = () => setZoom((z) => Math.max(0.4, +(z - 0.1).toFixed(2)));
  const zoomReset = () => setZoom(1);

  // 鼠标滚轮缩放（Ctrl + 滚轮）
  const handleCanvasWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      if (e.deltaY < 0) zoomIn();
      else zoomOut();
    }
  };

  // ============ 画布平移 ============

  // 中键拖拽 或 空格+左键拖拽 平移画布
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && spacePressedRef.current)) {
      e.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas) return;
      panStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        scrollLeft: canvas.scrollLeft,
        scrollTop: canvas.scrollTop,
      };
      setIsPanning(true);
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (!isPanning || !panStartRef.current || !canvasRef.current) return;
    const dx = e.clientX - panStartRef.current.x;
    const dy = e.clientY - panStartRef.current.y;
    canvasRef.current.scrollLeft = panStartRef.current.scrollLeft - dx;
    canvasRef.current.scrollTop = panStartRef.current.scrollTop - dy;
  };

  const handleCanvasMouseUp = () => {
    setIsPanning(false);
    panStartRef.current = null;
  };

  // ============ 运行日志 ============

  // 进入可视化编排模式：加载指定工作流的节点和连线到画布
  const enterVisualMode = (flowId: string) => {
    const flow = flows.find((f) => f.id === flowId);
    if (!flow) {
      toast("未找到工作流", "error");
      return;
    }
    setVisualFlowId(flowId);
    // 加载节点：若已有坐标则保留，否则自动布局（从左到右排列）
    const loadedNodes: CanvasNode[] = flow.nodes.map((n, i) => {
      // 兼容已保存坐标的节点（CanvasNode 序列化后含 x/y）
      const saved = n as CanvasNode;
      if (typeof saved.x === "number" && typeof saved.y === "number") {
        return { ...n, x: saved.x, y: saved.y, status: "idle" as const };
      }
      // 自动布局：每列间距 260px，每行间距 100px，最多 4 行一列
      const col = Math.floor(i / 4);
      const row = i % 4;
      return { ...n, x: 80 + col * 260, y: 80 + row * 100, status: "idle" as const };
    });
    setNodes(loadedNodes);
    // 加载连线
    setEdges(Array.isArray(flow.edges) ? flow.edges : []);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setRunLogs([]);
    setMode("visual");
  };

  // 工具栏：运行测试（调用真实执行引擎 + 节点状态可视化）
  const handleRunTest = async () => {
    if (nodes.length === 0) {
      toast("画布为空，请先添加节点", "info");
      return;
    }
    if (running) return;

    // 若画布有未保存的节点，先保存再执行
    const flowId = visualFlowId;
    if (!flowId) {
      toast("请先保存工作流后再运行", "info");
      return;
    }

    setRunning(true);
    setShowLogs(true);
    setRunLogs([]);
    // 重置所有节点状态为 idle
    setNodes((prev) => prev.map((n) => ({ ...n, status: "idle" as const })));
    toast("开始运行测试...", "info");

    try {
      // 先保存最新画布到后端，确保执行引擎读取到最新节点配置
      const flow = flows.find((f) => f.id === flowId);
      const saveRes = await fetch(`/api/ai/flows/${flowId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodes: nodes.map(({ x, y, ...rest }) => rest),
          edges,
        }),
      });
      if (!saveRes.ok) {
        throw new Error("保存工作流失败，无法执行");
      }

      // 调用执行引擎
      const res = await fetch(`/api/ai/flows/${flowId}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: "" }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `执行失败（${res.status}）`);
      }
      const data = await res.json();
      const result = data.result as {
        success: boolean;
        nodes: Array<{
          nodeId: string;
          nodeLabel: string;
          status: "done" | "error" | "skipped";
          output?: string;
          durationMs: number;
          error?: string;
          message: string;
        }>;
        totalDurationMs: number;
        finalOutput?: string;
      };

      // 逐个更新节点状态 + 追加日志
      for (const nodeResult of result.nodes) {
        const status: FlowNode["status"] =
          nodeResult.status === "done" ? "done" :
          nodeResult.status === "skipped" ? "idle" :
          "error";
        setNodes((prev) =>
          prev.map((n) =>
            n.id === nodeResult.nodeId ? { ...n, status } : n
          )
        );
        setRunLogs((prev) => [
          ...prev,
          {
            nodeId: nodeResult.nodeId,
            nodeLabel: nodeResult.nodeLabel,
            status,
            message: nodeResult.message,
            time: new Date().toLocaleTimeString("zh-CN"),
          },
        ]);
      }

      // 更新最后运行时间
      if (flow) {
        const updated = { ...flow, lastRun: "刚刚" };
        setFlows((prev) => prev.map((f) => (f.id === flowId ? updated : f)));
      }

      if (result.success) {
        toast(`运行完成（${result.totalDurationMs}ms）`, "success");
      } else {
        toast("运行过程中有节点出错", "error");
      }
    } catch (e) {
      toast("运行失败：" + (e as Error).message, "error");
      setRunLogs((prev) => [
        ...prev,
        {
          nodeId: "error",
          nodeLabel: "执行错误",
          status: "error",
          message: (e as Error).message,
          time: new Date().toLocaleTimeString("zh-CN"),
        },
      ]);
    } finally {
      setRunning(false);
    }
  };

  // ============ 执行历史 ============

  // 获取执行历史列表
  const fetchHistory = async (page: number = 1) => {
    if (!visualFlowId) {
      toast("请先选择工作流", "info");
      return;
    }
    setHistoryLoading(true);
    try {
      const res = await fetch(
        `/api/ai/flows/${visualFlowId}/executions?page=${page}&pageSize=${historyPageSize}`
      );
      if (!res.ok) throw new Error("获取历史失败");
      const data = await res.json();
      setHistoryList(data.executions || []);
      setHistoryPage(data.pagination?.page || 1);
      setHistoryTotalPages(data.pagination?.totalPages || 1);
      setHistoryTotal(data.pagination?.total || 0);
    } catch (e) {
      toast("获取执行历史失败：" + (e as Error).message, "error");
    } finally {
      setHistoryLoading(false);
    }
  };

  // 打开历史 modal
  const openHistory = () => {
    if (!visualFlowId) {
      toast("请先选择或创建工作流", "info");
      return;
    }
    setShowHistory(true);
    setExpandedHistoryId(null);
    fetchHistory(1);
  };

  // ============ 工具栏操作 ============

  const handleSave = async () => {
    if (nodes.length === 0) {
      toast("画布为空，无需保存", "info");
      return;
    }
    // 若无关联工作流，创建新工作流
    if (!visualFlowId) {
      const name = `编排_${new Date().toLocaleString("zh-CN")}`;
      try {
        const res = await fetch("/api/ai/flows", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            description: "可视化编排创建",
            nodes: nodes.map(({ x, y, ...rest }) => rest),
            edges,
            enabled: true,
          }),
        });
        if (!res.ok) throw new Error("创建失败");
        const data = await res.json();
        setVisualFlowId(data.flow.id);
        setFlows((prev) => [...prev, data.flow]);
        toast(`已创建并保存工作流「${name}」`, "success");
      } catch (e) {
        toast("保存失败：" + (e as Error).message, "error");
      }
      return;
    }
    // 更新已有工作流
    try {
      const res = await fetch(`/api/ai/flows/${visualFlowId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodes: nodes.map(({ x, y, ...rest }) => rest),
          edges,
        }),
      });
      if (!res.ok) throw new Error("保存失败");
      // 同步本地 flows 状态
      setFlows((prev) =>
        prev.map((f) =>
          f.id === visualFlowId
            ? { ...f, nodes: nodes.map(({ x, y, ...rest }) => rest), edges }
            : f
        )
      );
      toast(`已保存编排（${nodes.length} 节点 / ${edges.length} 连线）`, "success");
    } catch (e) {
      toast("保存失败：" + (e as Error).message, "error");
    }
  };

  const handleClear = () => {
    if (nodes.length === 0 && edges.length === 0) {
      toast("画布已为空", "info");
      return;
    }
    setNodes([]);
    setEdges([]);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setRunLogs([]);
    toast("画布已清空", "info");
  };

  // 导出当前工作流为 JSON
  const exportFlow = () => {
    if (nodes.length === 0) {
      toast("画布为空", "info");
      return;
    }
    const data = {
      name: flows.find((f) => f.id === visualFlowId)?.name || "未命名工作流",
      description: flows.find((f) => f.id === visualFlowId)?.description || "",
      nodes: nodes.map(({ status, ...n }) => n),
      edges,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${data.name}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast("已导出工作流", "success");
  };

  // 导入工作流 JSON
  const importFlow = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!Array.isArray(data.nodes)) {
          toast("无效的工作流文件", "error");
          return;
        }
        setNodes(data.nodes.map((n: any) => ({ ...n, status: "idle" })));
        setEdges(Array.isArray(data.edges) ? data.edges : []);
        setVisualFlowId(null); // 新工作流
        toast("已导入工作流", "success");
      } catch (err) {
        toast("导入失败：" + (err as Error).message, "error");
      }
    };
    input.click();
  };

  // ============ document 级事件 ============

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const drag = dragNodeRef.current;
      if (drag) {
        const point = getCanvasPoint(e.clientX, e.clientY);
        const { id, offsetX, offsetY } = drag;
        setNodes((prev) =>
          prev.map((n) =>
            n.id === id
              ? {
                  ...n,
                  x: Math.max(0, Math.min(point.x - offsetX, CANVAS_WIDTH - NODE_WIDTH)),
                  y: Math.max(0, Math.min(point.y - offsetY, CANVAS_HEIGHT - NODE_HEIGHT)),
                }
              : n
          )
        );
      } else if (connectRef.current) {
        setTempConnect(getCanvasPoint(e.clientX, e.clientY));
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      const conn = connectRef.current;
      if (conn) {
        const target = e.target as HTMLElement | null;
        const portEl = target?.closest("[data-port='input']") as HTMLElement | null;
        if (portEl) {
          const toNodeId = portEl.getAttribute("data-node-id");
          if (toNodeId) addEdge(conn.from, toNodeId);
        }
        connectRef.current = null;
        setTempConnect(null);
      }
      dragNodeRef.current = null;
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [addEdge]);

  // Delete 键删除选中项
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (modeRef.current !== "visual") return;
      const active = document.activeElement;
      if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA")) return;
      if (e.key === "Delete") {
        if (selectedNodeIdRef.current) {
          deleteNode(selectedNodeIdRef.current);
        } else if (selectedEdgeIdRef.current) {
          deleteEdge(selectedEdgeIdRef.current);
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [deleteNode, deleteEdge]);

  // 点击其他地方关闭右键菜单
  useEffect(() => {
    const close = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener("click", close);
      document.addEventListener("contextmenu", close);
      return () => {
        document.removeEventListener("click", close);
        document.removeEventListener("contextmenu", close);
      };
    }
  }, [contextMenu]);

  // 空格键状态（用于画布平移）
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && modeRef.current === "visual") {
        const active = document.activeElement;
        if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA")) return;
        spacePressedRef.current = true;
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") spacePressedRef.current = false;
    };
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  // ============ 节点配置面板 ============

  const configNode = nodes.find((n) => n.id === configNodeId);
  const updateNodeConfig = (nodeId: string, config: Partial<NodeConfig>) => {
    setNodes((prev) =>
      prev.map((n) =>
        n.id === nodeId
          ? { ...n, config: { ...n.config, ...config } }
          : n
      )
    );
  };
  const updateNodeLabel = (nodeId: string, label: string) => {
    setNodes((prev) => prev.map((n) => (n.id === nodeId ? { ...n, label } : n)));
  };

  // ============ 渲染 ============

  return (
    <div className="p-4 sm:p-8">
      <PageHeader
        title="AI 工作流"
        subtitle="编排多步骤 AI 任务链，实现自动化处理"
        action={
          <div className="flex items-center gap-2">
            {/* 模式切换：列表 / 可视化编排 */}
            <div className="flex items-center rounded-xl border border-border bg-card p-0.5">
              <button
                onClick={() => setMode("list")}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
                  mode === "list"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <List className="h-3.5 w-3.5" /> 列表
              </button>
              <button
                onClick={() => {
                  // 切换到可视化模式：若无选中工作流则进入空白画布
                  if (!visualFlowId && flows.length > 0) {
                    enterVisualMode(flows[0].id);
                  } else if (visualFlowId) {
                    setMode("visual");
                  } else {
                    // 无工作流，进入空白画布
                    setNodes([]);
                    setEdges([]);
                    setVisualFlowId(null);
                    setMode("visual");
                  }
                }}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
                  mode === "visual"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Network className="h-3.5 w-3.5" /> 可视化编排
              </button>
            </div>
            {mode === "list" && (
              <Button onClick={() => setShowTemplates(true)}>
                <Plus className="h-3.5 w-3.5" /> 新建工作流
              </Button>
            )}
            <HelpButton contentKey="ai-flows" />
          </div>
        }
      />

      {mode === "list" ? (
        /* ============ 列表视图 ============ */
        loading ? (
          <Card className="flex items-center justify-center py-12">
            <p className="text-sm text-muted-foreground">加载工作流列表...</p>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* 搜索 + 筛选 */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="搜索工作流名称或描述..."
                  className="w-full rounded-xl border border-border bg-card py-2 pl-9 pr-3 text-sm outline-none transition-colors focus:border-cognition"
                />
              </div>
              <div className="flex items-center rounded-xl border border-border bg-card p-0.5">
                {(["all", "enabled", "disabled"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setFilterStatus(s)}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
                      filterStatus === s
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {s === "all" ? "全部" : s === "enabled" ? "已启用" : "已停用"}
                  </button>
                ))}
              </div>
            </div>

            {/* 工作流卡片网格 */}
            {filteredFlows.length === 0 ? (
              <Card className="flex items-center justify-center py-12">
                <p className="text-sm text-muted-foreground">
                  {searchQuery || filterStatus !== "all"
                    ? "没有匹配的工作流"
                    : "暂无工作流，点击右上角「新建工作流」创建"}
                </p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredFlows.map((flow) => {
                  const triggerCount = flow.nodes.filter((n) => n.type === "trigger").length;
                  return (
                    <Card
                      key={flow.id}
                      hover
                      onClick={() => setSelectedFlow(flow.id)}
                      className={cn(
                        "cursor-pointer transition-all",
                        selectedFlow === flow.id && "ring-2 ring-cognition/40"
                      )}
                    >
                      {/* 卡片头部：名称 + 启用状态 */}
                      <div className="mb-2 flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cognition/10">
                            <Workflow className="h-4 w-4 text-cognition" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-medium">{flow.name}</div>
                            <div className="text-[10px] text-muted-foreground">
                              {triggerCount > 0 ? "自动触发" : "手动触发"}
                            </div>
                          </div>
                        </div>
                        {/* 启用/停用开关 */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFlowEnabled(flow);
                          }}
                          className={cn(
                            "relative h-5 w-9 rounded-full transition-colors",
                            flow.enabled ? "bg-task" : "bg-muted-foreground/30"
                          )}
                          title={flow.enabled ? "点击停用" : "点击启用"}
                        >
                          <span
                            className={cn(
                              "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all",
                              flow.enabled ? "left-4" : "left-0.5"
                            )}
                          />
                        </button>
                      </div>

                      {/* 描述 */}
                      <p className="mb-3 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
                        {flow.description || "暂无描述"}
                      </p>

                      {/* 卡片信息：节点数 + 最后运行 */}
                      <div className="mb-3 flex items-center gap-3 text-[10px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Network className="h-3 w-3" />
                          {flow.nodes.length} 节点
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {flow.lastRun}
                        </span>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5",
                            flow.enabled ? "bg-task/10 text-task" : "bg-muted text-muted-foreground"
                          )}
                        >
                          {flow.enabled ? "启用" : "停用"}
                        </span>
                      </div>

                      {/* 卡片操作 */}
                      <div className="flex items-center gap-1 border-t border-border pt-3">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            runFlow(flow);
                          }}
                          className="flex-1"
                        >
                          <Play className="h-3 w-3" /> 运行
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            enterVisualMode(flow.id);
                          }}
                          title="编辑"
                        >
                          <Edit3 className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            duplicateFlow(flow);
                          }}
                          title="复制"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteFlow(flow);
                          }}
                          title="删除"
                          className="text-graveyard hover:bg-graveyard/10"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* 选中工作流的节点详情 */}
            {current && (
              <Card>
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-semibold">{current.name}</h2>
                    <p className="mt-1 text-xs text-muted-foreground">{current.description}</p>
                  </div>
                  <Badge color={current.enabled ? "task" : "default"}>
                    {current.enabled ? "启用" : "停用"}
                  </Badge>
                </div>
                {/* 流程节点 */}
                <div className="space-y-3">
                  {current.nodes.map((node, idx) => {
                    const style = NODE_STYLES[node.type];
                    const NodeIcon = style.icon;
                    return (
                      <div key={node.id}>
                        <div
                          className={cn(
                            "flex items-center gap-3 rounded-xl border p-3 transition-all",
                            STATUS_STYLES[node.status]
                          )}
                        >
                          <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", style.bg)}>
                            <NodeIcon className={cn("h-4 w-4", style.color)} />
                          </div>
                          <div className="flex-1">
                            <div className="text-sm font-medium">{node.label}</div>
                            <div className="text-[10px] text-muted-foreground">
                              {NODE_TYPE_LABELS[node.type]}
                              {node.config?.prompt && (
                                <span className="ml-1 truncate">· {node.config.prompt.slice(0, 30)}...</span>
                              )}
                            </div>
                          </div>
                          {node.status === "done" && <CheckCircle2 className="h-4 w-4 text-task" />}
                          {node.status === "running" && <Clock className="h-4 w-4 animate-spin text-cognition" />}
                        </div>
                        {idx < current.nodes.length - 1 && (
                          <div className="ml-7 h-4 w-px bg-border" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}
          </div>
        )
      ) : (
        /* ============ 可视化编排 ============ */
        <div className="flex flex-col gap-4">
          {/* 工具栏 */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-3 shadow-soft">
            <div className="flex items-center gap-2">
              {visualFlowId && (
                <span className="text-xs font-medium text-foreground">
                  {flows.find((f) => f.id === visualFlowId)?.name || "未命名"}
                </span>
              )}
              <Badge color="cognition">{nodes.length} 节点</Badge>
              <Badge color="default">{edges.length} 连线</Badge>
              {(selectedNodeId || selectedEdgeId) && (
                <span className="text-[11px] text-muted-foreground">
                  已选中{selectedNodeId ? "节点" : "连线"}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {/* 缩放控制 */}
              <div className="flex items-center rounded-xl border border-border bg-background p-0.5">
                <button
                  onClick={zoomOut}
                  disabled={zoom <= 0.4}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
                  title="缩小"
                >
                  <ZoomOut className="h-3.5 w-3.5" />
                </button>
                <span className="px-2 text-[11px] tabular-nums text-muted-foreground">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  onClick={zoomIn}
                  disabled={zoom >= 2}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
                  title="放大"
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={zoomReset}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  title="重置缩放"
                >
                  <Maximize className="h-3.5 w-3.5" />
                </button>
              </div>
              {/* 自动布局 */}
              <Button size="sm" variant="outline" onClick={autoLayout} title="自动排列节点">
                <LayoutGrid className="h-3 w-3" /> 自动布局
              </Button>
              {(selectedNodeId || selectedEdgeId) && (
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => {
                    if (selectedNodeId) deleteNode(selectedNodeId);
                    else if (selectedEdgeId) deleteEdge(selectedEdgeId);
                  }}
                >
                  <Trash2 className="h-3 w-3" /> 删除选中
                </Button>
              )}
              {/* 条件分支切换：仅当选中的连线源节点为 condition 时显示 */}
              {selectedEdgeId && (() => {
                const edge = edges.find((e) => e.id === selectedEdgeId);
                if (!edge) return null;
                const fromNode = nodes.find((n) => n.id === edge.from);
                if (!fromNode || fromNode.type !== "condition") return null;
                return (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toggleEdgeCondition(selectedEdgeId)}
                    title="循环切换：成立 / 不成立 / 默认"
                  >
                    <GitBranch className="h-3 w-3" />
                    {edge.condition === "true" ? "成立分支" :
                     edge.condition === "false" ? "不成立分支" : "默认分支"}
                  </Button>
                );
              })()}
              <Button size="sm" variant="outline" onClick={exportFlow} title="导出为 JSON">
                <Download className="h-3 w-3" /> 导出
              </Button>
              <Button size="sm" variant="outline" onClick={importFlow} title="从 JSON 导入">
                <Upload className="h-3 w-3" /> 导入
              </Button>
              <Button size="sm" variant="outline" onClick={handleClear}>
                <Eraser className="h-3 w-3" /> 清空
              </Button>
              <Button size="sm" variant="outline" onClick={handleSave}>
                <Save className="h-3 w-3" /> 保存
              </Button>
              <Button size="sm" variant="outline" onClick={openHistory} title="查看执行历史">
                <History className="h-3 w-3" /> 历史
              </Button>
              <Button size="sm" onClick={handleRunTest} disabled={running}>
                <Play className="h-3 w-3" /> {running ? "运行中..." : "运行测试"}
              </Button>
            </div>
          </div>

          <div className="flex gap-4">
            {/* 左侧节点面板 */}
            <div className="flex w-44 shrink-0 flex-col gap-2">
              <div className="px-1 text-[11px] font-medium text-muted-foreground">节点类型</div>
              {NODE_PANEL_ITEMS.map(({ type, label, desc }) => {
                const style = NODE_STYLES[type];
                const Icon = style.icon;
                return (
                  <div
                    key={type}
                    draggable
                    onDragStart={(e) => handlePanelDragStart(e, type)}
                    className="flex cursor-grab items-center gap-2.5 rounded-xl border border-border bg-card p-2.5 transition-all hover:-translate-y-0.5 hover:border-cognition/40 hover:shadow-sm active:cursor-grabbing"
                  >
                    <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", style.bg)}>
                      <Icon className={cn("h-4 w-4", style.color)} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-medium">{label}</div>
                      <div className="text-[10px] text-muted-foreground">{desc}</div>
                    </div>
                  </div>
                );
              })}
              <div className="mt-2 rounded-xl border border-dashed border-border bg-muted/20 p-2.5 text-[10px] leading-relaxed text-muted-foreground">
                拖拽节点到画布创建；拖拽右侧圆点连线；双击节点配置参数；Ctrl+滚轮缩放；Delete 删除。
              </div>
            </div>

            {/* 画布区域 + 日志面板 */}
            <div className="min-w-0 flex-1">
              <div
                ref={canvasRef}
                onDrop={handleCanvasDrop}
                onDragOver={handleCanvasDragOver}
                onWheel={handleCanvasWheel}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                onMouseLeave={handleCanvasMouseUp}
                onClick={() => {
                  setSelectedNodeId(null);
                  setSelectedEdgeId(null);
                  setEditingNodeId(null);
                }}
                style={{ cursor: isPanning ? "grabbing" : spacePressedRef.current ? "grab" : "default" }}
                className="relative h-[calc(100vh-280px)] min-h-[480px] overflow-auto rounded-2xl border border-border bg-card/40"
              >
                <div
                  className="relative origin-top-left"
                  style={{
                    width: CANVAS_WIDTH,
                    height: CANVAS_HEIGHT,
                    transform: `scale(${zoom})`,
                    backgroundImage:
                      "radial-gradient(circle, hsl(var(--border)) 1px, transparent 1px)",
                    backgroundSize: "22px 22px",
                  }}
                >
                  {/* SVG 连线层 */}
                  <svg
                    width={CANVAS_WIDTH}
                    height={CANVAS_HEIGHT}
                    className="absolute left-0 top-0 pointer-events-none"
                  >
                    <defs>
                      <marker
                        id="flow-arrow"
                        markerWidth="10"
                        markerHeight="8"
                        refX="8"
                        refY="4"
                        orient="auto"
                        markerUnits="strokeWidth"
                      >
                        <path d="M0,0 L8,4 L0,8 Z" className="fill-muted-foreground/60" />
                      </marker>
                      <marker
                        id="flow-arrow-active"
                        markerWidth="10"
                        markerHeight="8"
                        refX="8"
                        refY="4"
                        orient="auto"
                        markerUnits="strokeWidth"
                      >
                        <path d="M0,0 L8,4 L0,8 Z" className="fill-cognition" />
                      </marker>
                      <marker
                        id="flow-arrow-true"
                        markerWidth="10"
                        markerHeight="8"
                        refX="8"
                        refY="4"
                        orient="auto"
                        markerUnits="strokeWidth"
                      >
                        <path d="M0,0 L8,4 L0,8 Z" className="fill-task" />
                      </marker>
                      <marker
                        id="flow-arrow-false"
                        markerWidth="10"
                        markerHeight="8"
                        refX="8"
                        refY="4"
                        orient="auto"
                        markerUnits="strokeWidth"
                      >
                        <path d="M0,0 L8,4 L0,8 Z" className="fill-graveyard" />
                      </marker>
                    </defs>

                    {edges.map((edge) => {
                      const from = nodes.find((n) => n.id === edge.from);
                      const to = nodes.find((n) => n.id === edge.to);
                      if (!from || !to) return null;
                      const fp = getOutputPort(from);
                      const tp = getInputPort(to);
                      const isActive = selectedEdgeId === edge.id;
                      const d = bezierPath(fp.x, fp.y, tp.x, tp.y);
                      // 条件分支颜色：true=绿色（task），false=红色（graveyard），普通=灰色
                      const edgeColor =
                        edge.condition === "true" ? "stroke-task" :
                        edge.condition === "false" ? "stroke-graveyard" :
                        isActive ? "stroke-cognition" : "stroke-muted-foreground/50";
                      const arrowMarker =
                        edge.condition === "true" ? "url(#flow-arrow-true)" :
                        edge.condition === "false" ? "url(#flow-arrow-false)" :
                        isActive ? "url(#flow-arrow-active)" : "url(#flow-arrow)";
                      // 中点（用于显示条件标签）
                      const midX = (fp.x + tp.x) / 2;
                      const midY = (fp.y + tp.y) / 2;
                      return (
                        <g key={edge.id}>
                          <path
                            d={d}
                            fill="none"
                            stroke="transparent"
                            strokeWidth={16}
                            style={{
                              pointerEvents: tempConnect ? "none" : "stroke",
                              cursor: "pointer",
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedEdgeId(edge.id);
                              setSelectedNodeId(null);
                            }}
                          />
                          <path
                            d={d}
                            fill="none"
                            className={cn(edgeColor)}
                            strokeWidth={isActive ? 2.5 : 2}
                            strokeDasharray={edge.condition ? undefined : undefined}
                            markerEnd={arrowMarker}
                            style={{ pointerEvents: "none" }}
                          />
                          {/* 条件标签 */}
                          {edge.condition && (
                            <g style={{ pointerEvents: "none" }}>
                              <rect
                                x={midX - 14}
                                y={midY - 9}
                                width={28}
                                height={18}
                                rx={9}
                                className={cn(
                                  edge.condition === "true" ? "fill-task/15" : "fill-graveyard/15"
                                )}
                                stroke={edge.condition === "true" ? "currentColor" : "currentColor"}
                                strokeWidth={0.5}
                              />
                              <text
                                x={midX}
                                y={midY + 3}
                                textAnchor="middle"
                                className={cn(
                                  "text-[9px] font-medium",
                                  edge.condition === "true" ? "fill-task" : "fill-graveyard"
                                )}
                              >
                                {edge.condition === "true" ? "TRUE" : "FALSE"}
                              </text>
                            </g>
                          )}
                        </g>
                      );
                    })}

                    {/* 拖拽中的临时连线 */}
                    {tempConnect &&
                      (() => {
                        const conn = connectRef.current;
                        if (!conn) return null;
                        const from = nodes.find((n) => n.id === conn.from);
                        if (!from) return null;
                        const fp = getOutputPort(from);
                        return (
                          <path
                            d={bezierPath(fp.x, fp.y, tempConnect.x, tempConnect.y)}
                            fill="none"
                            className="stroke-cognition/70"
                            strokeWidth={2}
                            strokeDasharray="5 5"
                          />
                        );
                      })()}
                  </svg>

                  {/* 节点列表 */}
                  {nodes.map((node) => {
                    const style = NODE_STYLES[node.type];
                    const NodeIcon = style.icon;
                    const isSelected = selectedNodeId === node.id;
                    const isEditing = editingNodeId === node.id;
                    return (
                      <div
                        key={node.id}
                        onMouseDown={(e) => handleNodeMouseDown(e, node)}
                        onDoubleClick={() => handleNodeDoubleClick(node)}
                        onContextMenu={(e) => handleNodeContextMenu(e, node)}
                        onClick={(e) => e.stopPropagation()}
                        className={cn(
                          "group absolute flex select-none items-center gap-2.5 rounded-xl border bg-card px-3 shadow-soft transition-shadow duration-200 hover:shadow-md",
                          isSelected
                            ? "border-cognition/40 ring-2 ring-cognition/40"
                            : "border-border hover:border-cognition/30"
                        )}
                        style={{
                          left: node.x,
                          top: node.y,
                          width: NODE_WIDTH,
                          height: NODE_HEIGHT,
                          cursor: "move",
                        }}
                      >
                        {/* 输入端口（左侧圆点） */}
                        <div
                          data-port="input"
                          data-node-id={node.id}
                          className={cn(
                            "absolute -left-2 top-1/2 flex h-4 w-4 -translate-y-1/2 items-center justify-center rounded-full border-2 bg-background transition-all hover:scale-125",
                            tempConnect
                              ? "scale-125 border-cognition bg-cognition/10"
                              : "border-border hover:border-cognition"
                          )}
                        >
                          <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60" />
                        </div>

                        {/* 节点图标 */}
                        <div
                          className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                            style.bg
                          )}
                        >
                          <NodeIcon className={cn("h-4 w-4", style.color)} />
                        </div>

                        {/* 标签 + 类型 */}
                        <div className="min-w-0 flex-1">
                          {isEditing ? (
                            <input
                              autoFocus
                              value={editingLabel}
                              onChange={(e) => setEditingLabel(e.target.value)}
                              onBlur={commitEdit}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") commitEdit();
                                if (e.key === "Escape") {
                                  setEditingNodeId(null);
                                  setEditingLabel("");
                                }
                              }}
                              onClick={(e) => e.stopPropagation()}
                              onMouseDown={(e) => e.stopPropagation()}
                              className="w-full rounded border-b border-cognition bg-transparent text-sm font-medium outline-none"
                            />
                          ) : (
                            <div
                              className="truncate text-sm font-medium"
                              onDoubleClick={(e) => {
                                e.stopPropagation();
                                handleLabelEdit(node);
                              }}
                            >
                              {node.label}
                            </div>
                          )}
                          <div className="text-[10px] text-muted-foreground">
                            {NODE_TYPE_LABELS[node.type]}
                            {node.config?.model && <span className="ml-1">· {node.config.model}</span>}
                          </div>
                        </div>

                        {/* 状态指示 */}
                        <div className="shrink-0">
                          {node.status === "done" && (
                            <CheckCircle2 className="h-3.5 w-3.5 text-task" />
                          )}
                          {node.status === "running" && (
                            <Clock className="h-3.5 w-3.5 animate-spin text-cognition" />
                          )}
                          {node.status === "idle" && (
                            <span className="block h-2 w-2 rounded-full bg-muted-foreground/40" />
                          )}
                          {node.status === "error" && (
                            <span className="block h-2 w-2 rounded-full bg-graveyard" />
                          )}
                        </div>

                        {/* 输出端口（右侧圆点） */}
                        <div
                          data-port="output"
                          data-node-id={node.id}
                          onMouseDown={(e) => handleOutputPortMouseDown(e, node.id)}
                          className={cn(
                            "absolute -right-2 top-1/2 flex h-4 w-4 -translate-y-1/2 cursor-crosshair items-center justify-center rounded-full border-2 bg-background transition-all hover:scale-125",
                            isSelected
                              ? "border-cognition"
                              : "border-border group-hover:border-cognition/60"
                          )}
                        >
                          <div className={cn("h-1.5 w-1.5 rounded-full bg-current", style.color)} />
                        </div>
                      </div>
                    );
                  })}

                  {/* 空状态提示 */}
                  {nodes.length === 0 && (
                    <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                      <Network className="mx-auto mb-3 h-12 w-12 text-muted-foreground/25" />
                      <p className="text-sm text-muted-foreground">从左侧拖拽节点到画布开始编排</p>
                      <p className="mt-1 text-[11px] text-muted-foreground/60">
                        支持拖拽连线、双击配置、键盘删除
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* 运行日志面板 */}
              {showLogs && (
                <div className="mt-3 rounded-2xl border border-border bg-card p-3 shadow-soft">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="h-3.5 w-3.5 text-cognition" />
                      <span className="text-xs font-medium">运行日志</span>
                      {running && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-cognition">
                          <Loader2 className="h-3 w-3 animate-spin" /> 执行中
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => setShowLogs(false)}
                      className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="max-h-40 space-y-1 overflow-y-auto">
                    {runLogs.length === 0 ? (
                      <p className="py-4 text-center text-[11px] text-muted-foreground">暂无日志</p>
                    ) : (
                      runLogs.map((log, i) => (
                        <div
                          key={i}
                          className={cn(
                            "flex items-start gap-2 rounded-lg px-2 py-1 text-[11px]",
                            log.status === "running" && "bg-cognition/5",
                            log.status === "done" && "bg-task/5",
                            log.status === "error" && "bg-graveyard/5"
                          )}
                        >
                          <span className="shrink-0 tabular-nums text-muted-foreground/60">{log.time}</span>
                          {log.status === "done" && <CheckCircle2 className="h-3 w-3 shrink-0 text-task" />}
                          {log.status === "running" && <Clock className="h-3 w-3 shrink-0 animate-spin text-cognition" />}
                          {log.status === "error" && <AlertCircle className="h-3 w-3 shrink-0 text-graveyard" />}
                          <span className="flex-1">{log.message}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============ 节点配置面板（弹窗）============ */}
      {configNode && (
        <NodeConfigPanel
          node={configNode}
          onClose={() => setConfigNodeId(null)}
          onUpdateLabel={(label) => updateNodeLabel(configNode.id, label)}
          onUpdateConfig={(config) => updateNodeConfig(configNode.id, config)}
        />
      )}

      {/* ============ 工作流模板面板（弹窗）============ */}
      {showTemplates && (
        <TemplatePanel
          onClose={() => setShowTemplates(false)}
          onSelect={createFromTemplate}
        />
      )}

      {/* ============ 执行历史面板（弹窗）============ */}
      {showHistory && (
        <ExecutionHistoryModal
          loading={historyLoading}
          list={historyList}
          page={historyPage}
          totalPages={historyTotalPages}
          total={historyTotal}
          expandedId={expandedHistoryId}
          onClose={() => setShowHistory(false)}
          onPageChange={(p) => fetchHistory(p)}
          onToggleExpand={(id) =>
            setExpandedHistoryId(expandedHistoryId === id ? null : id)
          }
        />
      )}

      {/* ============ 节点右键菜单 ============ */}
      {contextMenu && (
        <div
          className="fixed z-50 min-w-[140px] rounded-xl border border-border bg-card p-1 shadow-lg"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <button
            onClick={() => {
              setConfigNodeId(contextMenu.nodeId);
              setContextMenu(null);
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-muted"
          >
            <Settings className="h-3 w-3" /> 配置节点
          </button>
          <button
            onClick={() => {
              duplicateNode(contextMenu.nodeId);
              setContextMenu(null);
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-muted"
          >
            <Copy className="h-3 w-3" /> 复制节点
          </button>
          <button
            onClick={() => {
              deleteNode(contextMenu.nodeId);
              setContextMenu(null);
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs text-graveyard transition-colors hover:bg-graveyard/10"
          >
            <Trash2 className="h-3 w-3" /> 删除节点
          </button>
        </div>
      )}
    </div>
  );
}

// ============ 节点配置面板组件（简化版） ============

// 快速预设：每种节点类型的常用配置模板
const NODE_PRESETS: Record<FlowNode["type"], Array<{ label: string; desc: string; config: Partial<NodeConfig> }>> = {
  trigger: [
    { label: "手动触发", desc: "点击按钮启动", config: { triggerType: "manual" } },
    { label: "每日定时", desc: "每天 09:00 执行", config: { triggerType: "schedule", schedule: "0 9 * * *" } },
    { label: "每晚复盘", desc: "每天 23:00 执行", config: { triggerType: "schedule", schedule: "0 23 * * *" } },
    { label: "新灵感触发", desc: "创建灵感时自动执行", config: { triggerType: "event", eventType: "idea.created" } },
  ],
  action: [
    { label: "分析内容", desc: "让 AI 分析并归类", config: { prompt: "分析这条内容的核心主题、关键信息和潜在价值，给出分类建议", model: "deepseek-chat" } },
    { label: "生成摘要", desc: "提炼要点", config: { prompt: "请将以下内容提炼为 3-5 个要点：\n{{upstream}}", model: "deepseek-chat" } },
    { label: "深度推理", desc: "复杂决策分析", config: { prompt: "请对以下内容进行深度分析，给出决策建议：\n{{upstream}}", model: "deepseek-reasoner" } },
  ],
  condition: [
    { label: "非空判断", desc: "上游有内容时继续", config: { expression: "upstream != null && upstream != ''" } },
    { label: "包含关键词", desc: "包含特定词时走 true 分支", config: { expression: "upstream.includes('重要')" } },
    { label: "数值比较", desc: "数值大于阈值", config: { expression: "score > 0.8" } },
  ],
  output: [
    { label: "浏览器通知", desc: "弹窗提示结果", config: { outputTarget: "notification" } },
    { label: "写入认知库", desc: "保存为认知卡片", config: { outputTarget: "cognition" } },
    { label: "写入技能库", desc: "保存为技能模板", config: { outputTarget: "skills" } },
    { label: "回复对话", desc: "在聊天中展示", config: { outputTarget: "chat" } },
  ],
  hermes: [
    { label: "打开网页", desc: "用浏览器打开 URL", config: { hermesMode: "computer_use", hermesPrompt: "打开浏览器访问 {{upstream}}", timeout: 60 } },
    { label: "运行命令", desc: "执行 Shell 命令", config: { hermesMode: "shell", hermesPrompt: "{{upstream}}", timeout: 30 } },
    { label: "截图桌面", desc: "截取当前屏幕", config: { hermesMode: "computer_use", hermesPrompt: "截取当前桌面的截图", timeout: 30 } },
  ],
  http: [
    { label: "GET 请求", desc: "获取数据", config: { httpMethod: "GET", httpUrl: "https://api.example.com/data", timeout: 30 } },
    { label: "POST 提交", desc: "提交数据", config: { httpMethod: "POST", httpUrl: "https://api.example.com/submit", httpBody: '{"key": "{{upstream}}"}', timeout: 30 } },
  ],
  database: [
    { label: "查灵感", desc: "获取最近 10 条灵感", config: { dbOperation: "query", dbModel: "idea", dbQuery: "10" } },
    { label: "查任务", desc: "获取最近 10 条任务", config: { dbOperation: "query", dbModel: "task", dbQuery: "10" } },
    { label: "查记忆", desc: "获取最近 10 条记忆", config: { dbOperation: "query", dbModel: "memory", dbQuery: "10" } },
  ],
  transform: [
    { label: "模板拼接", desc: "用模板格式化输出", config: { transformType: "template", transformTemplate: "结果：{{upstream}}" } },
    { label: "提取字段", desc: "从 JSON 中提取值", config: { transformType: "jsonpath", transformExpression: "data.name" } },
    { label: "正则匹配", desc: "提取匹配内容", config: { transformType: "regex", transformExpression: "(\\d+)" } },
  ],
  delay: [
    { label: "等待 1 秒", desc: "短暂停顿", config: { delayMs: 1000 } },
    { label: "等待 5 秒", desc: "中等停顿", config: { delayMs: 5000 } },
    { label: "等待 30 秒", desc: "长时间等待", config: { delayMs: 30000 } },
  ],
};

function NodeConfigPanel({
  node,
  onClose,
  onUpdateLabel,
  onUpdateConfig,
}: {
  node: CanvasNode;
  onClose: () => void;
  onUpdateLabel: (label: string) => void;
  onUpdateConfig: (config: Partial<NodeConfig>) => void;
}) {
  const [label, setLabel] = useState(node.label);
  const [config, setConfig] = useState<NodeConfig>(node.config || {});
  const [showAdvanced, setShowAdvanced] = useState(false);
  const style = NODE_STYLES[node.type];
  const Icon = style.icon;
  const presets = NODE_PRESETS[node.type] || [];

  const handleSave = () => {
    // 校验必填字段（仅校验核心字段，高级字段有默认值）
    if (!label.trim()) {
      toast("节点名称不能为空", "error");
      return;
    }
    if (node.type === "action" && !config.prompt?.trim()) {
      toast("请输入 AI 提示词", "error");
      return;
    }
    if (node.type === "hermes" && !config.hermesPrompt?.trim()) {
      toast("请输入任务描述", "error");
      return;
    }
    if (node.type === "http" && !config.httpUrl?.trim()) {
      toast("请输入请求 URL", "error");
      return;
    }
    onUpdateLabel(label.trim());
    onUpdateConfig(config);
    toast("节点配置已保存", "success");
    onClose();
  };

  // 应用预设：合并预设配置到当前配置
  const applyPreset = (presetConfig: Partial<NodeConfig>) => {
    setConfig({ ...config, ...presetConfig });
    toast("已应用预设，可按需调整", "info");
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div className="flex items-center gap-2">
            <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", style.bg)}>
              <Icon className={cn("h-4 w-4", style.color)} />
            </div>
            <div>
              <h3 className="text-sm font-semibold">配置{NODE_TYPE_LABELS[node.type]}节点</h3>
              <p className="text-[10px] text-muted-foreground">简单几步即可完成配置</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 可滚动内容区 */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* 节点名称 */}
          <div className="mb-4">
            <label className="mb-1 block text-[11px] font-medium text-muted-foreground">节点名称</label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="给节点起个名字"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-cognition"
            />
          </div>

          {/* 快速预设：一键应用常用配置 */}
          {presets.length > 0 && (
            <div className="mb-4">
              <label className="mb-2 block text-[11px] font-medium text-muted-foreground">
                快速预设 <span className="text-[10px] text-muted-foreground/70">（点击直接应用）</span>
              </label>
              <div className="grid grid-cols-1 gap-1.5">
                {presets.map((preset, i) => (
                  <button
                    key={i}
                    onClick={() => applyPreset(preset.config)}
                    className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-left transition-colors hover:border-cognition/40 hover:bg-cognition/5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium text-foreground">{preset.label}</div>
                      <div className="truncate text-[10px] text-muted-foreground">{preset.desc}</div>
                    </div>
                    <Sparkles className="h-3 w-3 shrink-0 text-cognition/60" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 按节点类型显示核心配置（精简版） */}

          {node.type === "trigger" && (
            <>
              {config.triggerType === "schedule" && (
                <div className="mb-3">
                  <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Cron 表达式</label>
                  <input
                    value={config.schedule || ""}
                    onChange={(e) => setConfig({ ...config, schedule: e.target.value })}
                    placeholder="0 9 * * *"
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 font-mono text-sm outline-none focus:border-cognition"
                  />
                  <p className="mt-1 text-[10px] text-muted-foreground">格式：分 时 日 月 周 · 示例：0 9 * * * = 每天 9:00</p>
                </div>
              )}
              {config.triggerType === "event" && (
                <div className="mb-3">
                  <label className="mb-1 block text-[11px] font-medium text-muted-foreground">事件类型</label>
                  <input
                    value={config.eventType || ""}
                    onChange={(e) => setConfig({ ...config, eventType: e.target.value })}
                    placeholder="idea.created"
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 font-mono text-sm outline-none focus:border-cognition"
                  />
                  <p className="mt-1 text-[10px] text-muted-foreground">常用：idea.created / task.updated / user.question</p>
                </div>
              )}
            </>
          )}

          {node.type === "action" && (
            <div className="mb-3">
              <label className="mb-1 block text-[11px] font-medium text-muted-foreground">AI 提示词</label>
              <textarea
                value={config.prompt || ""}
                onChange={(e) => setConfig({ ...config, prompt: e.target.value })}
                placeholder="描述要让 AI 做什么...&#10;可用 {{upstream}} 引用上一个节点的输出"
                rows={4}
                className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-cognition"
              />
              <div className="mt-2 flex items-center gap-2">
                <label className="text-[10px] text-muted-foreground">模型：</label>
                <select
                  value={config.model || "deepseek-chat"}
                  onChange={(e) => setConfig({ ...config, model: e.target.value })}
                  className="rounded-lg border border-border bg-background px-2 py-1 text-xs outline-none focus:border-cognition"
                >
                  <option value="deepseek-chat">DeepSeek Chat（快速）</option>
                  <option value="deepseek-reasoner">DeepSeek Reasoner（深度推理）</option>
                  <option value="mimo-v2.5">MiMo 2.5（标准）</option>
                  <option value="mimo-v2.5-pro">MiMo 2.5 Pro（增强）</option>
                </select>
              </div>
            </div>
          )}

          {node.type === "condition" && (
            <div className="mb-3">
              <label className="mb-1 block text-[11px] font-medium text-muted-foreground">条件表达式</label>
              <input
                value={config.expression || ""}
                onChange={(e) => setConfig({ ...config, expression: e.target.value })}
                placeholder="upstream.includes('重要')"
                className="w-full rounded-xl border border-border bg-background px-3 py-2 font-mono text-sm outline-none focus:border-cognition"
              />
              <p className="mt-1 text-[10px] text-muted-foreground">
                支持 ==、!=、&gt;、&lt;、&amp;&amp;、|| · 用 <code className="rounded bg-muted px-1">upstream</code> 引用上游输出
              </p>
            </div>
          )}

          {node.type === "output" && (
            <div className="mb-3">
              <label className="mb-1 block text-[11px] font-medium text-muted-foreground">输出目标</label>
              <select
                value={config.outputTarget || "notification"}
                onChange={(e) => setConfig({ ...config, outputTarget: e.target.value })}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-cognition"
              >
                <option value="notification">浏览器通知</option>
                <option value="cognition">认知库</option>
                <option value="skills">技能库</option>
                <option value="idea.tags">灵感标签</option>
                <option value="chat">对话消息</option>
              </select>
            </div>
          )}

          {node.type === "hermes" && (
            <div className="mb-3">
              <div className="mb-2 rounded-md border border-purple-300/30 bg-purple-50/50 p-2 text-[10px] text-purple-700">
                调用本地 Hermes Agent 执行桌面操作（需先在设置中启动 Hermes）
              </div>
              <label className="mb-1 block text-[11px] font-medium text-muted-foreground">任务描述</label>
              <textarea
                value={config.hermesPrompt || ""}
                onChange={(e) => setConfig({ ...config, hermesPrompt: e.target.value })}
                placeholder="描述要让 Agent 做什么...&#10;可用 {{upstream}} 引用上游输出"
                rows={3}
                className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-cognition"
              />
              <div className="mt-2 flex items-center gap-2">
                <label className="text-[10px] text-muted-foreground">模式：</label>
                <select
                  value={config.hermesMode || "auto"}
                  onChange={(e) => setConfig({ ...config, hermesMode: e.target.value as NodeConfig["hermesMode"] })}
                  className="rounded-lg border border-border bg-background px-2 py-1 text-xs outline-none focus:border-cognition"
                >
                  <option value="auto">自动选择</option>
                  <option value="computer_use">桌面控制</option>
                  <option value="shell">Shell 命令</option>
                </select>
              </div>
            </div>
          )}

          {node.type === "http" && (
            <div className="mb-3 space-y-2">
              <div className="flex gap-2">
                <select
                  value={config.httpMethod || "GET"}
                  onChange={(e) => setConfig({ ...config, httpMethod: e.target.value as NodeConfig["httpMethod"] })}
                  className="w-24 rounded-xl border border-border bg-background px-2 py-2 text-sm outline-none focus:border-cognition"
                >
                  <option>GET</option>
                  <option>POST</option>
                  <option>PUT</option>
                  <option>PATCH</option>
                  <option>DELETE</option>
                </select>
                <input
                  value={config.httpUrl || ""}
                  onChange={(e) => setConfig({ ...config, httpUrl: e.target.value })}
                  placeholder="https://api.example.com/data"
                  className="flex-1 rounded-xl border border-border bg-background px-3 py-2 font-mono text-sm outline-none focus:border-cognition"
                />
              </div>
              <p className="text-[10px] text-muted-foreground">URL 中可用 <code className="rounded bg-muted px-1">{"{{upstream}}"}</code> 引用上游输出</p>
            </div>
          )}

          {node.type === "database" && (
            <div className="mb-3 space-y-2">
              <div className="flex gap-2">
                <select
                  value={config.dbOperation || "query"}
                  onChange={(e) => setConfig({ ...config, dbOperation: e.target.value as NodeConfig["dbOperation"] })}
                  className="w-28 rounded-xl border border-border bg-background px-2 py-2 text-sm outline-none focus:border-cognition"
                >
                  <option value="query">查询</option>
                  <option value="create">创建</option>
                  <option value="update">更新</option>
                  <option value="delete">删除</option>
                </select>
                <select
                  value={config.dbModel || "idea"}
                  onChange={(e) => setConfig({ ...config, dbModel: e.target.value })}
                  className="flex-1 rounded-xl border border-border bg-background px-2 py-2 text-sm outline-none focus:border-cognition"
                >
                  <option value="idea">灵感</option>
                  <option value="task">任务</option>
                  <option value="memory">记忆</option>
                  <option value="cognition">认知</option>
                  <option value="skill">技能</option>
                </select>
              </div>
              {config.dbOperation === "query" && (
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-muted-foreground">查询数量</label>
                  <input
                    type="number"
                    value={config.dbQuery || "10"}
                    onChange={(e) => setConfig({ ...config, dbQuery: e.target.value })}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-cognition"
                  />
                </div>
              )}
            </div>
          )}

          {node.type === "transform" && (
            <div className="mb-3 space-y-2">
              <select
                value={config.transformType || "template"}
                onChange={(e) => setConfig({ ...config, transformType: e.target.value as NodeConfig["transformType"] })}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-cognition"
              >
                <option value="template">模板替换</option>
                <option value="jsonpath">JSON 路径提取</option>
                <option value="regex">正则匹配</option>
                <option value="javascript">JavaScript 表达式</option>
              </select>
              {config.transformType === "template" ? (
                <textarea
                  value={config.transformTemplate || ""}
                  onChange={(e) => setConfig({ ...config, transformTemplate: e.target.value })}
                  placeholder="结果：{{upstream}}"
                  rows={2}
                  className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 font-mono text-sm outline-none focus:border-cognition"
                />
              ) : (
                <input
                  value={config.transformExpression || ""}
                  onChange={(e) => setConfig({ ...config, transformExpression: e.target.value })}
                  placeholder={config.transformType === "jsonpath" ? "data.name" : config.transformType === "regex" ? "(\\d+)" : "upstream.toUpperCase()"}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 font-mono text-sm outline-none focus:border-cognition"
                />
              )}
            </div>
          )}

          {node.type === "delay" && (
            <div className="mb-3">
              <label className="mb-1 block text-[11px] font-medium text-muted-foreground">延时时长</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={config.delayMs || 1000}
                  onChange={(e) => setConfig({ ...config, delayMs: Math.min(parseInt(e.target.value, 10) || 1000, 60000) })}
                  className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-cognition"
                />
                <span className="text-xs text-muted-foreground">毫秒</span>
              </div>
              <div className="mt-2 flex gap-1.5">
                {[
                  { label: "1s", val: 1000 },
                  { label: "5s", val: 5000 },
                  { label: "10s", val: 10000 },
                  { label: "30s", val: 30000 },
                ].map((q) => (
                  <button
                    key={q.val}
                    onClick={() => setConfig({ ...config, delayMs: q.val })}
                    className={cn(
                      "rounded-md border px-2 py-1 text-[10px] transition-colors",
                      config.delayMs === q.val
                        ? "border-cognition bg-cognition/10 text-cognition"
                        : "border-border text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {q.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 高级设置（可折叠） */}
          {(node.type === "hermes" || node.type === "http") && (
            <div className="mt-4 border-t border-border pt-3">
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex w-full items-center justify-between text-[11px] font-medium text-muted-foreground hover:text-foreground"
              >
                <span>高级设置</span>
                <ChevronDown className={cn("h-3 w-3 transition-transform", showAdvanced && "rotate-180")} />
              </button>
              {showAdvanced && (
                <div className="mt-2 space-y-2">
                  {node.type === "hermes" && (
                    <>
                      <div>
                        <label className="mb-1 block text-[10px] text-muted-foreground">工作目录（可选）</label>
                        <input
                          value={config.workDir || ""}
                          onChange={(e) => setConfig({ ...config, workDir: e.target.value })}
                          placeholder="C:\Users\..."
                          className="w-full rounded-lg border border-border bg-background px-2 py-1.5 font-mono text-xs outline-none focus:border-cognition"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] text-muted-foreground">超时时间（秒）</label>
                        <input
                          type="number"
                          value={config.timeout || 120}
                          onChange={(e) => setConfig({ ...config, timeout: parseInt(e.target.value, 10) || 120 })}
                          className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-cognition"
                        />
                      </div>
                    </>
                  )}
                  {node.type === "http" && (
                    <>
                      <div>
                        <label className="mb-1 block text-[10px] text-muted-foreground">请求头（JSON，可选）</label>
                        <textarea
                          value={config.httpHeaders ? JSON.stringify(config.httpHeaders, null, 2) : ""}
                          onChange={(e) => {
                            try {
                              const headers = e.target.value.trim() ? JSON.parse(e.target.value) : {};
                              setConfig({ ...config, httpHeaders: headers });
                            } catch {}
                          }}
                          placeholder={'{"Authorization": "Bearer xxx"}'}
                          rows={2}
                          className="w-full resize-none rounded-lg border border-border bg-background px-2 py-1.5 font-mono text-xs outline-none focus:border-cognition"
                        />
                      </div>
                      {["POST", "PUT", "PATCH"].includes(config.httpMethod || "GET") && (
                        <div>
                          <label className="mb-1 block text-[10px] text-muted-foreground">请求体（可选）</label>
                          <textarea
                            value={config.httpBody || ""}
                            onChange={(e) => setConfig({ ...config, httpBody: e.target.value })}
                            placeholder='{"key": "value"}'
                            rows={2}
                            className="w-full resize-none rounded-lg border border-border bg-background px-2 py-1.5 font-mono text-xs outline-none focus:border-cognition"
                          />
                        </div>
                      )}
                      <div>
                        <label className="mb-1 block text-[10px] text-muted-foreground">超时时间（秒）</label>
                        <input
                          type="number"
                          value={config.timeout || 30}
                          onChange={(e) => setConfig({ ...config, timeout: parseInt(e.target.value, 10) || 30 })}
                          className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-cognition"
                        />
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {(node.type === "database" && (config.dbOperation === "create" || config.dbOperation === "update")) && (
            <div className="mt-3">
              <label className="mb-1 block text-[11px] font-medium text-muted-foreground">数据（JSON）</label>
              <textarea
                value={config.dbData ? JSON.stringify(config.dbData, null, 2) : ""}
                onChange={(e) => {
                  try {
                    const data = e.target.value.trim() ? JSON.parse(e.target.value) : {};
                    setConfig({ ...config, dbData: data });
                  } catch {}
                }}
                placeholder={'{"content": "示例内容"}'}
                rows={3}
                className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 font-mono text-xs outline-none focus:border-cognition"
              />
            </div>
          )}
        </div>

        {/* 底部操作（固定） */}
        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button onClick={handleSave}>
            <Save className="h-3 w-3" /> 保存配置
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============ 工作流模板面板组件 ============

function TemplatePanel({
  onClose,
  onSelect,
}: {
  onClose: () => void;
  onSelect: (tpl: FlowTemplate) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-border bg-card p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-cognition" />
            <h3 className="text-sm font-semibold">工作流模板</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mb-4 text-[11px] text-muted-foreground">
          选择一个模板快速创建工作流，创建后可在可视化编排器中进一步调整。
        </p>

        {/* 模板列表 */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {FLOW_TEMPLATES.map((tpl) => {
            const Icon = tpl.icon;
            return (
              <button
                key={tpl.id}
                onClick={() => onSelect(tpl)}
                className="flex items-start gap-3 rounded-xl border border-border bg-background p-3 text-left transition-all hover:-translate-y-0.5 hover:border-cognition/40 hover:shadow-sm"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <Icon className={cn("h-5 w-5", tpl.color)} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{tpl.name}</div>
                  <div className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
                    {tpl.description}
                  </div>
                  <div className="mt-1.5 flex items-center gap-2 text-[10px] text-muted-foreground/70">
                    <span className="inline-flex items-center gap-0.5">
                      <Network className="h-2.5 w-2.5" />
                      {tpl.nodes.length} 节点
                    </span>
                  </div>
                </div>
                <ChevronDown className="h-4 w-4 -rotate-90 shrink-0 text-muted-foreground" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============ 执行历史面板组件 ============

function ExecutionHistoryModal({
  loading,
  list,
  page,
  totalPages,
  total,
  expandedId,
  onClose,
  onPageChange,
  onToggleExpand,
}: {
  loading: boolean;
  list: ExecutionHistoryItem[];
  page: number;
  totalPages: number;
  total: number;
  expandedId: string | null;
  onClose: () => void;
  onPageChange: (page: number) => void;
  onToggleExpand: (id: string) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-2xl border border-border bg-card shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-cognition" />
            <h3 className="text-sm font-semibold">执行历史</h3>
            <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
              共 {total} 条
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 列表区域 */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">加载中...</span>
            </div>
          ) : list.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <History className="mb-3 h-10 w-10 text-muted-foreground/25" />
              <p className="text-sm text-muted-foreground">暂无执行历史</p>
              <p className="mt-1 text-[11px] text-muted-foreground/60">
                运行工作流后会在此处显示执行记录
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {list.map((item) => {
                const isExpanded = expandedId === item.id;
                const nodeCount = Array.isArray(item.nodeResults)
                  ? item.nodeResults.length
                  : 0;
                const truncatedOutput = item.finalOutput
                  ? item.finalOutput.slice(0, 200)
                  : "";
                const hasMore = item.finalOutput && item.finalOutput.length > 200;
                return (
                  <div
                    key={item.id}
                    className="rounded-xl border border-border bg-background overflow-hidden"
                  >
                    {/* 概要行 */}
                    <button
                      onClick={() => onToggleExpand(item.id)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/30"
                    >
                      {/* 成功/失败状态 */}
                      {item.success ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-task" />
                      ) : (
                        <AlertCircle className="h-4 w-4 shrink-0 text-graveyard" />
                      )}

                      {/* 执行时间 */}
                      <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                        {new Date(item.startedAt).toLocaleString("zh-CN")}
                      </span>

                      {/* 耗时 */}
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {item.totalDurationMs}ms
                      </span>

                      {/* 节点数 */}
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {nodeCount} 节点
                      </span>

                      {/* 成功/失败标签 */}
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                          item.success
                            ? "bg-task/10 text-task"
                            : "bg-graveyard/10 text-graveyard"
                        )}
                      >
                        {item.success ? "成功" : "失败"}
                      </span>

                      <div className="flex-1" />

                      {/* 最终输出预览 */}
                      {truncatedOutput && (
                        <span className="hidden max-w-[300px] truncate text-[11px] text-muted-foreground sm:inline">
                          {truncatedOutput}
                          {hasMore ? "..." : ""}
                        </span>
                      )}

                      {/* 展开图标 */}
                      <ChevronRight
                        className={cn(
                          "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                          isExpanded && "rotate-90"
                        )}
                      />
                    </button>

                    {/* 展开详情 */}
                    {isExpanded && (
                      <div className="border-t border-border bg-muted/20 px-4 py-3 space-y-3">
                        {/* 最终输出 */}
                        {item.finalOutput && (
                          <div>
                            <div className="mb-1 text-[11px] font-medium text-foreground">
                              最终输出
                            </div>
                            <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg bg-background p-2.5 text-[11px] leading-relaxed text-muted-foreground">
                              {item.finalOutput}
                            </pre>
                          </div>
                        )}

                        {/* 错误信息 */}
                        {item.error && (
                          <div>
                            <div className="mb-1 text-[11px] font-medium text-graveyard">
                              错误信息
                            </div>
                            <pre className="whitespace-pre-wrap rounded-lg bg-graveyard/5 p-2.5 text-[11px] text-graveyard">
                              {item.error}
                            </pre>
                          </div>
                        )}

                        {/* 节点执行结果 */}
                        {Array.isArray(item.nodeResults) &&
                          item.nodeResults.length > 0 && (
                            <div>
                              <div className="mb-1.5 text-[11px] font-medium text-foreground">
                                节点执行结果（{item.nodeResults.length}）
                              </div>
                              <div className="space-y-1.5">
                                {item.nodeResults.map((nr, i) => (
                                  <div
                                    key={i}
                                    className={cn(
                                      "flex items-start gap-2 rounded-lg px-2.5 py-1.5 text-[11px]",
                                      nr.status === "done" && "bg-task/5",
                                      nr.status === "error" && "bg-graveyard/5",
                                      nr.status === "skipped" && "bg-muted/30"
                                    )}
                                  >
                                    {nr.status === "done" && (
                                      <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-task" />
                                    )}
                                    {nr.status === "error" && (
                                      <AlertCircle className="mt-0.5 h-3 w-3 shrink-0 text-graveyard" />
                                    )}
                                    {nr.status === "skipped" && (
                                      <span className="mt-0.5 h-3 w-3 shrink-0 text-center text-[10px] text-muted-foreground">→</span>
                                    )}
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium text-foreground">
                                          {nr.nodeLabel}
                                        </span>
                                        <span className="text-[10px] text-muted-foreground">
                                          {nr.durationMs}ms
                                        </span>
                                      </div>
                                      <div className="mt-0.5 text-muted-foreground">
                                        {nr.message}
                                      </div>
                                      {nr.output && (
                                        <pre className="mt-1 max-h-24 overflow-y-auto whitespace-pre-wrap rounded bg-background p-1.5 text-[10px] text-muted-foreground/80">
                                          {nr.output}
                                        </pre>
                                      )}
                                      {nr.error && (
                                        <div className="mt-1 text-[10px] text-graveyard">
                                          {nr.error}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 分页 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-5 py-3">
            <span className="text-[11px] text-muted-foreground">
              第 {page} / {totalPages} 页
            </span>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => onPageChange(page - 1)}
              >
                上一页
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= totalPages}
                onClick={() => onPageChange(page + 1)}
              >
                下一页
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

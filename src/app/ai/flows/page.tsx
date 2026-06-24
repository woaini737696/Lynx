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
  Edit3,
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
} from "lucide-react";
import { PageHeader, Card, Button, Badge } from "@/components/layout/PageHeader";
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
}

interface FlowNode {
  id: string;
  type: "trigger" | "action" | "condition" | "output";
  label: string;
  status: "idle" | "running" | "done" | "error";
  config?: NodeConfig;
}

interface Flow {
  id: string;
  name: string;
  description: string;
  nodes: FlowNode[];
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
}

// 运行日志条目
interface RunLog {
  nodeId: string;
  nodeLabel: string;
  status: FlowNode["status"];
  message: string;
  time: string;
}

// ============ 常量 ============

const NODE_STYLES: Record<FlowNode["type"], { color: string; bg: string; icon: React.ElementType }> = {
  trigger: { color: "text-northstar", bg: "bg-northstar/10", icon: Zap },
  action: { color: "text-cognition", bg: "bg-cognition/10", icon: Workflow },
  condition: { color: "text-campaign", bg: "bg-campaign/10", icon: GitBranch },
  output: { color: "text-task", bg: "bg-task/10", icon: CheckCircle2 },
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
};

const NODE_PANEL_ITEMS: { type: FlowNode["type"]; label: string; desc: string }[] = [
  { type: "trigger", label: "触发器", desc: "启动工作流" },
  { type: "action", label: "动作", desc: "执行 AI 任务" },
  { type: "condition", label: "条件", desc: "分支判断" },
  { type: "output", label: "输出", desc: "结果产出" },
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
      .catch((e) => console.error("获取工作流列表失败:", e))
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

  // 缩放控制
  const [zoom, setZoom] = useState(1);

  const canvasRef = useRef<HTMLDivElement>(null);
  // 节点拖动状态（ref 避免频繁重渲染）
  const dragNodeRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);
  // 连线拖拽状态
  const connectRef = useRef<{ from: string } | null>(null);
  // edges 的 ref，供 document 级事件读取最新值
  const edgesRef = useRef<CanvasEdge[]>([]);
  edgesRef.current = edges;

  // 选中状态 ref，供 document 级键盘事件读取
  const selectedNodeIdRef = useRef<string | null>(null);
  selectedNodeIdRef.current = selectedNodeId;
  const selectedEdgeIdRef = useRef<string | null>(null);
  selectedEdgeIdRef.current = selectedEdgeId;
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

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
  const addEdge = useCallback((from: string, to: string) => {
    if (from === to) {
      toast("不能连接到自身", "info");
      return;
    }
    if (edgesRef.current.some((e) => e.from === from && e.to === to)) {
      toast("该连线已存在", "info");
      return;
    }
    const id = `edge-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setEdges((prev) => [...prev, { id, from, to }]);
    toast("已建立连接", "success");
  }, []);

  // 删除节点（同时清理关联连线）
  const deleteNode = useCallback((id: string) => {
    setNodes((prev) => prev.filter((n) => n.id !== id));
    setEdges((prev) => prev.filter((e) => e.from !== id && e.to !== id));
    setSelectedNodeId(null);
  }, []);

  // 删除连线
  const deleteEdge = useCallback((id: string) => {
    setEdges((prev) => prev.filter((e) => e.id !== id));
    setSelectedEdgeId(null);
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

  // ============ 运行日志 ============

  // 工具栏：运行测试（节点依次执行 + 日志）
  const handleRunTest = () => {
    if (nodes.length === 0) {
      toast("画布为空，请先添加节点", "info");
      return;
    }
    if (running) return;
    setRunning(true);
    setShowLogs(true);
    setRunLogs([]);
    toast("开始运行测试...", "info");

    const snapshot = nodes;
    setNodes((prev) => prev.map((n) => ({ ...n, status: "idle" as const })));

    snapshot.forEach((node, idx) => {
      window.setTimeout(() => {
        setNodes((prev) =>
          prev.map((n) => (n.id === node.id ? { ...n, status: "running" as const } : n))
        );
        setRunLogs((prev) => [
          ...prev,
          {
            nodeId: node.id,
            nodeLabel: node.label,
            status: "running",
            message: `开始执行：${node.label}`,
            time: new Date().toLocaleTimeString("zh-CN"),
          },
        ]);
      }, idx * 800);

      window.setTimeout(() => {
        setNodes((prev) =>
          prev.map((n) => (n.id === node.id ? { ...n, status: "done" as const } : n))
        );
        setRunLogs((prev) => [
          ...prev,
          {
            nodeId: node.id,
            nodeLabel: node.label,
            status: "done",
            message: `执行完成：${node.label} ✓`,
            time: new Date().toLocaleTimeString("zh-CN"),
          },
        ]);
        if (idx === snapshot.length - 1) {
          setRunning(false);
          toast("运行测试完成", "success");
        }
      }, idx * 800 + 600);
    });
  };

  // ============ 工具栏操作 ============

  const handleSave = () => {
    if (nodes.length === 0) {
      toast("画布为空，无需保存", "info");
      return;
    }
    toast(`已保存编排（${nodes.length} 节点 / ${edges.length} 连线）`, "success");
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
                onClick={() => setMode("visual")}
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
                            setMode("visual");
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
              <Button size="sm" variant="outline" onClick={handleClear}>
                <Eraser className="h-3 w-3" /> 清空
              </Button>
              <Button size="sm" variant="outline" onClick={handleSave}>
                <Save className="h-3 w-3" /> 保存
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
                onClick={() => {
                  setSelectedNodeId(null);
                  setSelectedEdgeId(null);
                  setEditingNodeId(null);
                }}
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
                    </defs>

                    {edges.map((edge) => {
                      const from = nodes.find((n) => n.id === edge.from);
                      const to = nodes.find((n) => n.id === edge.to);
                      if (!from || !to) return null;
                      const fp = getOutputPort(from);
                      const tp = getInputPort(to);
                      const isActive = selectedEdgeId === edge.id;
                      const d = bezierPath(fp.x, fp.y, tp.x, tp.y);
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
                            className={cn(
                              isActive ? "stroke-cognition" : "stroke-muted-foreground/50"
                            )}
                            strokeWidth={isActive ? 2.5 : 2}
                            markerEnd={
                              isActive ? "url(#flow-arrow-active)" : "url(#flow-arrow)"
                            }
                            style={{ pointerEvents: "none" }}
                          />
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
    </div>
  );
}

// ============ 节点配置面板组件 ============

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
  const style = NODE_STYLES[node.type];
  const Icon = style.icon;

  const handleSave = () => {
    onUpdateLabel(label.trim() || node.label);
    onUpdateConfig(config);
    toast("节点配置已保存", "success");
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", style.bg)}>
              <Icon className={cn("h-4 w-4", style.color)} />
            </div>
            <div>
              <h3 className="text-sm font-semibold">配置节点</h3>
              <p className="text-[10px] text-muted-foreground">{NODE_TYPE_LABELS[node.type]}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 通用：标签 */}
        <div className="mb-4">
          <label className="mb-1 block text-[11px] font-medium text-muted-foreground">节点名称</label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-cognition"
          />
        </div>

        {/* 按节点类型显示不同配置 */}
        {node.type === "trigger" && (
          <>
            <div className="mb-3">
              <label className="mb-1 block text-[11px] font-medium text-muted-foreground">触发类型</label>
              <select
                value={config.triggerType || "manual"}
                onChange={(e) => setConfig({ ...config, triggerType: e.target.value as NodeConfig["triggerType"] })}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-cognition"
              >
                <option value="manual">手动触发</option>
                <option value="schedule">定时触发</option>
                <option value="event">事件触发</option>
              </select>
            </div>
            {config.triggerType === "schedule" && (
              <div className="mb-3">
                <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Cron 表达式</label>
                <input
                  value={config.schedule || ""}
                  onChange={(e) => setConfig({ ...config, schedule: e.target.value })}
                  placeholder="0 23 * * *"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 font-mono text-sm outline-none focus:border-cognition"
                />
                <p className="mt-1 text-[10px] text-muted-foreground">示例：0 23 * * * 表示每天 23:00</p>
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
              </div>
            )}
          </>
        )}

        {node.type === "action" && (
          <>
            <div className="mb-3">
              <label className="mb-1 block text-[11px] font-medium text-muted-foreground">AI 提示词</label>
              <textarea
                value={config.prompt || ""}
                onChange={(e) => setConfig({ ...config, prompt: e.target.value })}
                placeholder="输入 AI 执行的提示词..."
                rows={4}
                className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-cognition"
              />
            </div>
            <div className="mb-3">
              <label className="mb-1 block text-[11px] font-medium text-muted-foreground">模型选择</label>
              <select
                value={config.model || "deepseek-chat"}
                onChange={(e) => setConfig({ ...config, model: e.target.value })}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-cognition"
              >
                <option value="deepseek-chat">DeepSeek Chat（快速）</option>
                <option value="deepseek-reasoner">DeepSeek Reasoner（深度推理）</option>
                <option value="mimo-v2.5">MiMo 2.5（标准）</option>
                <option value="mimo-v2.5-pro">MiMo 2.5 Pro（增强）</option>
              </select>
            </div>
          </>
        )}

        {node.type === "condition" && (
          <div className="mb-3">
            <label className="mb-1 block text-[11px] font-medium text-muted-foreground">条件表达式</label>
            <input
              value={config.expression || ""}
              onChange={(e) => setConfig({ ...config, expression: e.target.value })}
              placeholder="category == 'product'"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 font-mono text-sm outline-none focus:border-cognition"
            />
            <p className="mt-1 text-[10px] text-muted-foreground">支持 ==、!=、&gt;、&lt;、&amp;&amp;、|| 运算符</p>
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
              <option value="notification">通知</option>
              <option value="cognition">认知库</option>
              <option value="skills">技能库</option>
              <option value="idea.tags">灵感标签</option>
              <option value="chat">对话消息</option>
            </select>
          </div>
        )}

        {/* 底部操作 */}
        <div className="mt-5 flex items-center justify-end gap-2">
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

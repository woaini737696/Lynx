// AI 工作流页面（对齐 Web 端 /api/ai/flows）
// 支持工作流 CRUD + 可视化节点编排 + 执行 + 执行历史
import { useState, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Workflow,
  Plus,
  Play,
  Trash2,
  Edit3,
  Save,
  X,
  Loader2,
  Clock,
  CheckCircle2,
  AlertCircle,
  Zap,
  ZoomIn,
  ZoomOut,
  Maximize,
  LayoutGrid,
  Network,
  GitBranch,
  ArrowLeft,
  Cpu,
  Globe,
  Database,
  Shuffle,
  Timer,
  History,
  XCircle,
  RefreshCw,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { HelpButton } from "@/components/ui/HelpButton";
import { Modal } from "@/components/ui/Modal";
import { cloudApi } from "@/lib/cloud-api";

// ============ 类型定义 ============

type NodeType = "trigger" | "action" | "condition" | "output" | "hermes" | "http" | "database" | "transform" | "delay";

/** 节点配置（按节点类型使用不同字段） */
interface NodeConfig {
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

interface FlowNode {
  id: string;
  type: NodeType;
  label: string;
  status?: "idle" | "running" | "done" | "error";
  config?: NodeConfig;
  /** 画布坐标（持久化到后端，加载时复用） */
  x?: number;
  y?: number;
}

/** 画布节点：FlowNode + 必有坐标 */
interface CanvasNode extends FlowNode {
  x: number;
  y: number;
}

interface CanvasEdge {
  id: string;
  from: string;
  to: string;
  /** 条件分支标记：condition 节点求值为 true/false 时走对应分支；未标记为普通顺序连线 */
  condition?: "true" | "false";
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

interface ExecutionResult {
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

/** 执行历史条目（GET /api/ai/flows/{id}/executions 返回的单条记录） */
interface ExecutionHistoryItem {
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

// 节点样式映射（对齐 Web 端配色 + iOS26 液态玻璃质感）
const NODE_STYLES: Record<NodeType, { color: string; bg: string; icon: typeof Zap }> = {
  trigger: { color: "text-northstar", bg: "bg-northstar/10", icon: Zap },
  action: { color: "text-cognition", bg: "bg-cognition/10", icon: Workflow },
  condition: { color: "text-campaign", bg: "bg-campaign/10", icon: GitBranch },
  output: { color: "text-task", bg: "bg-task/10", icon: CheckCircle2 },
  hermes: { color: "text-primary", bg: "bg-primary/10", icon: Cpu },
  http: { color: "text-northstar", bg: "bg-northstar/10", icon: Globe },
  database: { color: "text-campaign", bg: "bg-campaign/10", icon: Database },
  transform: { color: "text-cognition", bg: "bg-cognition/10", icon: Shuffle },
  delay: { color: "text-muted-foreground", bg: "bg-muted", icon: Timer },
};

const NODE_TYPE_LABELS: Record<NodeType, string> = {
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

const NODE_PANEL_ITEMS: Array<{ type: NodeType; label: string; desc: string }> = [
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

// 画布与节点尺寸
const NODE_WIDTH = 190;
const NODE_HEIGHT = 60;
const CANVAS_WIDTH = 1800;
const CANVAS_HEIGHT = 1200;

export function AIFlowsPage() {
  const queryClient = useQueryClient();
  const [editingFlow, setEditingFlow] = useState<Flow | null>(null);
  // 视图模式：false=列表视图，true=可视化编排画布
  const [canvasMode, setCanvasMode] = useState(false);
  const [executing, setExecuting] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<ExecutionResult | null>(null);
  const [showResultModal, setShowResultModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Flow | null>(null);

  // ===== 执行历史 Modal 状态 =====
  const [historyFlowId, setHistoryFlowId] = useState<string | null>(null);
  const [historyFlowName, setHistoryFlowName] = useState<string>("");
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyList, setHistoryList] = useState<ExecutionHistoryItem[]>([]);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);

  // ===== 可视化编排状态 =====
  const [nodes, setNodes] = useState<CanvasNode[]>([]);
  const [edges, setEdges] = useState<CanvasEdge[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState("");
  // 拖拽连线时的临时终点
  const [tempConnect, setTempConnect] = useState<{ x: number; y: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);

  const canvasRef = useRef<HTMLDivElement>(null);
  // 节点拖动状态（ref 避免频繁重渲染）
  const dragNodeRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);
  // 连线拖拽状态
  const connectRef = useRef<{ from: string } | null>(null);
  // edges / nodes 的 ref，供 document 级事件读取最新值
  const edgesRef = useRef<CanvasEdge[]>([]);
  edgesRef.current = edges;
  const nodesRef = useRef<CanvasNode[]>([]);
  nodesRef.current = nodes;
  // 选中状态 ref，供 document 级键盘事件读取
  const selectedNodeIdRef = useRef<string | null>(null);
  selectedNodeIdRef.current = selectedNodeId;
  const selectedEdgeIdRef = useRef<string | null>(null);
  selectedEdgeIdRef.current = selectedEdgeId;
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  // 画布平移相关 ref
  const panStartRef = useRef<{ x: number; y: number; scrollLeft: number; scrollTop: number } | null>(null);

  // 加载工作流列表（防御性处理：确保 nodes/edges 是数组，防止 NULL 历史数据导致 .filter 崩溃）
  const { data: flows = [], isLoading } = useQuery<Flow[]>({
    queryKey: ["ai-flows"],
    queryFn: async () => {
      const resp = await cloudApi.get<{ flows: Flow[] }>("/api/ai/flows");
      const list = Array.isArray(resp?.flows) ? resp.flows : [];
      return list.map((f) => ({
        ...f,
        nodes: Array.isArray(f.nodes) ? f.nodes : [],
        edges: Array.isArray(f.edges) ? f.edges : [],
      }));
    },
  });

  // ===== 进入 / 退出画布 =====
  const enterCanvas = (flow: Flow) => {
    // 加载节点：若已有坐标则保留，否则自动布局（从左到右排列）
    const loadedNodes: CanvasNode[] = flow.nodes.map((n, i) => {
      if (typeof n.x === "number" && typeof n.y === "number") {
        return { ...n, x: n.x, y: n.y, status: "idle" as const };
      }
      const col = Math.floor(i / 4);
      const row = i % 4;
      return { ...n, x: 80 + col * 260, y: 80 + row * 100, status: "idle" as const };
    });
    setNodes(loadedNodes);
    setEdges(Array.isArray(flow.edges) ? flow.edges : []);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setEditingNodeId(null);
    setLastResult(null);
    setEditingFlow({ ...flow, nodes: [...flow.nodes] });
    setCanvasMode(true);
  };

  const exitCanvas = () => {
    setCanvasMode(false);
    setEditingFlow(null);
    setNodes([]);
    setEdges([]);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setLastResult(null);
  };

  const handleCreate = () => {
    const newFlow: Flow = {
      id: "",
      name: "",
      description: "",
      nodes: [
        { id: "node-1", type: "trigger", label: "手动触发", config: { triggerType: "manual" } },
        { id: "node-2", type: "action", label: "AI 处理", config: { prompt: "" } },
        { id: "node-3", type: "output", label: "输出结果", config: { outputTarget: "chat" } },
      ],
      edges: [
        { id: "e1", from: "node-1", to: "node-2" },
        { id: "e2", from: "node-2", to: "node-3" },
      ],
      lastRun: "",
      enabled: true,
    };
    enterCanvas(newFlow);
  };

  const handleEdit = (flow: Flow) => {
    enterCanvas(flow);
  };

  // 把画布节点 / 边同步回 editingFlow（保留 x/y 坐标以便下次加载复用）
  const syncToFlow = (): Flow | null => {
    if (!editingFlow) return null;
    return { ...editingFlow, nodes, edges };
  };

  const handleSave = async () => {
    const flow = syncToFlow();
    if (!flow) return;
    if (!flow.name.trim()) {
      toast.error("请输入工作流名称");
      return;
    }
    setEditingFlow(flow);
    try {
      if (flow.id) {
        await cloudApi.put(`/api/ai/flows/${flow.id}`, {
          name: flow.name,
          description: flow.description,
          nodes: flow.nodes,
          edges: flow.edges,
          enabled: flow.enabled,
        });
        toast.success("工作流已更新");
      } else {
        await cloudApi.post("/api/ai/flows", {
          name: flow.name,
          description: flow.description,
          nodes: flow.nodes,
          edges: flow.edges,
          enabled: flow.enabled,
        });
        toast.success("工作流已创建");
      }
      queryClient.invalidateQueries({ queryKey: ["ai-flows"] });
      exitCanvas();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "保存失败");
    }
  };

  // 画布工具栏：运行测试（先保存最新画布，再调用执行引擎）
  const handleRunFromCanvas = async () => {
    const flow = syncToFlow();
    if (!flow) return;
    if (nodes.length === 0) {
      toast.info("画布为空，请先添加节点");
      return;
    }
    if (!flow.id) {
      toast.error("请先保存工作流后再运行");
      return;
    }
    setEditingFlow(flow);
    setExecuting(flow.id);
    setLastResult(null);
    // 重置节点状态
    setNodes((prev) => prev.map((n) => ({ ...n, status: "idle" as const })));
    try {
      await cloudApi.put(`/api/ai/flows/${flow.id}`, {
        name: flow.name,
        description: flow.description,
        nodes: flow.nodes,
        edges: flow.edges,
        enabled: flow.enabled,
      });
      const resp = await cloudApi.post<{ result: ExecutionResult }>(
        `/api/ai/flows/${flow.id}/execute`,
        { input: "" }
      );
      setLastResult(resp.result);
      // 按执行结果更新节点状态
      if (resp.result && Array.isArray(resp.result.nodes)) {
        setNodes((prev) =>
          prev.map((n) => {
            const r = resp.result.nodes.find((x) => x.nodeId === n.id);
            if (!r) return n;
            const status: CanvasNode["status"] =
              r.status === "done" ? "done" : r.status === "skipped" ? "idle" : "error";
            return { ...n, status };
          })
        );
      }
      if (resp.result.success) {
        toast.success("工作流执行成功");
        setShowResultModal(true);
      } else {
        toast.error("工作流执行失败：" + (resp.result.error || "未知错误"));
        setShowResultModal(true);
      }
      queryClient.invalidateQueries({ queryKey: ["ai-flows"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "执行失败");
    } finally {
      setExecuting(null);
    }
  };

  const updateFlowField = <K extends keyof Flow>(key: K, value: Flow[K]) => {
    setEditingFlow((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const handleDelete = async (flow: Flow) => {
    setDeleteTarget(flow);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await cloudApi.delete(`/api/ai/flows/${deleteTarget.id}`);
      toast.success("已删除");
      queryClient.invalidateQueries({ queryKey: ["ai-flows"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "删除失败");
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleExecute = async (flow: Flow) => {
    if (!flow.enabled) {
      toast.error("工作流未启用，请先启用");
      return;
    }
    setExecuting(flow.id);
    setLastResult(null);
    try {
      const resp = await cloudApi.post<{ result: ExecutionResult }>(
        `/api/ai/flows/${flow.id}/execute`,
        { input: "" }
      );
      setLastResult(resp.result);
      if (resp.result.success) {
        toast.success("工作流执行成功");
        setShowResultModal(true);
      } else {
        toast.error("工作流执行失败：" + (resp.result.error || "未知错误"));
        setShowResultModal(true);
      }
      queryClient.invalidateQueries({ queryKey: ["ai-flows"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "执行失败");
    } finally {
      setExecuting(null);
    }
  };

  const handleToggleEnabled = async (flow: Flow) => {
    try {
      await cloudApi.put(`/api/ai/flows/${flow.id}`, { enabled: !flow.enabled });
      queryClient.invalidateQueries({ queryKey: ["ai-flows"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "操作失败");
    }
  };

  // ===== 执行历史 =====

  // 拉取指定工作流的执行历史（响应防御性解析：可能是 { executions: [...] } 或直接为数组）
  const fetchHistory = async (flowId: string) => {
    setHistoryLoading(true);
    try {
      const resp = await cloudApi.get<
        { executions?: ExecutionHistoryItem[] } | ExecutionHistoryItem[]
      >(`/api/ai/flows/${flowId}/executions?page=1&pageSize=20`);
      const list: ExecutionHistoryItem[] = Array.isArray(resp)
        ? resp
        : Array.isArray((resp as { executions?: ExecutionHistoryItem[] })?.executions)
          ? (resp as { executions: ExecutionHistoryItem[] }).executions
          : [];
      setHistoryList(list);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "获取执行历史失败");
      setHistoryList([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  // 打开历史 Modal
  const openHistory = (flow: Flow) => {
    if (!flow.id) {
      toast.info("请先保存工作流后再查看历史");
      return;
    }
    setHistoryFlowId(flow.id);
    setHistoryFlowName(flow.name);
    setExpandedHistoryId(null);
    fetchHistory(flow.id);
  };

  const closeHistory = () => {
    setHistoryFlowId(null);
    setHistoryFlowName("");
    setHistoryList([]);
    setExpandedHistoryId(null);
  };

  // ===== 画布交互处理 =====

  // 把鼠标事件坐标转换为画布内部坐标（考虑缩放与滚动）
  const getCanvasPoint = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left + canvas.scrollLeft) / zoomRef.current;
    const y = (clientY - rect.top + canvas.scrollTop) / zoomRef.current;
    return { x, y };
  };

  const getOutputPort = (node: CanvasNode) => ({
    x: node.x + NODE_WIDTH,
    y: node.y + NODE_HEIGHT / 2,
  });

  const getInputPort = (node: CanvasNode) => ({
    x: node.x,
    y: node.y + NODE_HEIGHT / 2,
  });

  const bezierPath = (x1: number, y1: number, x2: number, y2: number) => {
    const dx = Math.abs(x2 - x1) * 0.5;
    return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
  };

  // 创建节点
  const createNode = (type: NodeType, x: number, y: number) => {
    const id = `node-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const label = NODE_TYPE_LABELS[type];
    const config: NodeConfig =
      type === "trigger" ? { triggerType: "manual" }
      : type === "action" ? { prompt: "" }
      : type === "condition" ? { expression: "" }
      : type === "output" ? { outputTarget: "chat" }
      : type === "hermes" ? { hermesMode: "auto", hermesPrompt: "" }
      : type === "http" ? { httpMethod: "GET", httpUrl: "" }
      : type === "database" ? { dbOperation: "query", dbModel: "" }
      : type === "transform" ? { transformType: "jsonpath" }
      : { delayMs: 1000 };
    const newNode: CanvasNode = { id, type, label, config, x, y, status: "idle" };
    setNodes((prev) => [...prev, newNode]);
    setSelectedNodeId(id);
    setSelectedEdgeId(null);
  };

  // 新增连线（带环检测）
  const addEdge = (from: string, to: string) => {
    if (from === to) return;
    if (edgesRef.current.some((e) => e.from === from && e.to === to)) return;
    const hasPath = (start: string, target: string): boolean => {
      const stack = [start];
      const visited = new Set<string>();
      while (stack.length) {
        const cur = stack.pop()!;
        if (cur === target) return true;
        if (visited.has(cur)) continue;
        visited.add(cur);
        for (const e of edgesRef.current) {
          if (e.from === cur) stack.push(e.to);
        }
      }
      return false;
    };
    if (hasPath(to, from)) {
      toast.error("不能形成环路");
      return;
    }
    const fromNode = nodesRef.current.find((n) => n.id === from);
    const condition =
      fromNode?.type === "condition"
        ? edgesRef.current.some((e) => e.from === from && e.condition === "true")
          ? "false"
          : "true"
        : undefined;
    setEdges((prev) => [...prev, { id: `e-${Date.now()}`, from, to, condition }]);
  };

  const deleteNode = (id: string) => {
    setNodes((prev) => prev.filter((n) => n.id !== id));
    setEdges((prev) => prev.filter((e) => e.from !== id && e.to !== id));
    if (selectedNodeIdRef.current === id) setSelectedNodeId(null);
  };

  const deleteEdge = (id: string) => {
    setEdges((prev) => prev.filter((e) => e.id !== id));
    if (selectedEdgeIdRef.current === id) setSelectedEdgeId(null);
  };

  const toggleEdgeCondition = (id: string) => {
    setEdges((prev) =>
      prev.map((e) => (e.id === id ? { ...e, condition: e.condition === "true" ? "false" : "true" } : e))
    );
  };

  // 节点面板拖拽
  const handlePanelDragStart = (e: React.DragEvent, type: NodeType) => {
    e.dataTransfer.setData("application/node-type", type);
    e.dataTransfer.effectAllowed = "copy";
  };

  const handleCanvasDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const type = e.dataTransfer.getData("application/node-type") as NodeType;
    if (!type) return;
    const pt = getCanvasPoint(e.clientX, e.clientY);
    createNode(type, Math.max(0, pt.x - NODE_WIDTH / 2), Math.max(0, pt.y - NODE_HEIGHT / 2));
  };

  const handleCanvasDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  // 节点拖动
  const handleNodeMouseDown = (e: React.MouseEvent, node: CanvasNode) => {
    if ((e.target as HTMLElement).dataset.port) return;
    e.stopPropagation();
    setSelectedNodeId(node.id);
    setSelectedEdgeId(null);
    const pt = getCanvasPoint(e.clientX, e.clientY);
    dragNodeRef.current = { id: node.id, offsetX: pt.x - node.x, offsetY: pt.y - node.y };
  };

  // 输出端口：开始连线
  const handleOutputPortMouseDown = (e: React.MouseEvent, node: CanvasNode) => {
    e.stopPropagation();
    e.preventDefault();
    connectRef.current = { from: node.id };
    setTempConnect(getCanvasPoint(e.clientX, e.clientY));
  };

  const handleNodeDoubleClick = (e: React.MouseEvent, node: CanvasNode) => {
    e.stopPropagation();
    setEditingNodeId(node.id);
    setEditingLabel(node.label);
  };

  const commitEdit = () => {
    if (!editingNodeId) return;
    const label = editingLabel.trim();
    setNodes((prev) => prev.map((n) => (n.id === editingNodeId ? { ...n, label: label || n.label } : n)));
    setEditingNodeId(null);
    setEditingLabel("");
  };

  // document 级鼠标事件：节点拖动 / 连线
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (dragNodeRef.current) {
        const pt = getCanvasPoint(e.clientX, e.clientY);
        const { id, offsetX, offsetY } = dragNodeRef.current;
        setNodes((prev) =>
          prev.map((n) =>
            n.id === id ? { ...n, x: Math.max(0, pt.x - offsetX), y: Math.max(0, pt.y - offsetY) } : n
          )
        );
      } else if (connectRef.current) {
        setTempConnect(getCanvasPoint(e.clientX, e.clientY));
      }
    };
    const onUp = (e: MouseEvent) => {
      if (connectRef.current) {
        const target = (e.target as HTMLElement).closest("[data-port='input']") as HTMLElement | null;
        const nodeId = target?.dataset.nodeId;
        if (nodeId && nodeId !== connectRef.current.from) {
          addEdge(connectRef.current.from, nodeId);
        }
        connectRef.current = null;
        setTempConnect(null);
      }
      dragNodeRef.current = null;
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 键盘删除
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!canvasMode) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedEdgeIdRef.current) {
          deleteEdge(selectedEdgeIdRef.current);
        } else if (selectedNodeIdRef.current) {
          deleteNode(selectedNodeIdRef.current);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasMode]);

  const zoomIn = () => setZoom((z) => Math.min(2, +(z + 0.1).toFixed(2)));
  const zoomOut = () => setZoom((z) => Math.max(0.4, +(z - 0.1).toFixed(2)));
  const zoomReset = () => setZoom(1);
  const handleCanvasWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      setZoom((z) =>
        Math.min(2, Math.max(0.4, +(z + (e.deltaY < 0 ? 0.05 : -0.05)).toFixed(2)))
      );
    }
  };

  const fitView = () => {
    if (!canvasRef.current || nodes.length === 0) return;
    const minX = Math.min(...nodes.map((n) => n.x));
    const minY = Math.min(...nodes.map((n) => n.y));
    const maxX = Math.max(...nodes.map((n) => n.x + NODE_WIDTH));
    const maxY = Math.max(...nodes.map((n) => n.y + NODE_HEIGHT));
    const canvas = canvasRef.current;
    const contentW = maxX - minX;
    const contentH = maxY - minY;
    const z = Math.min(
      2,
      Math.max(0.4, Math.min(canvas.clientWidth / (contentW + 80), canvas.clientHeight / (contentH + 80)))
    );
    setZoom(+z.toFixed(2));
    canvas.scrollLeft = Math.max(0, minX * z - 40);
    canvas.scrollTop = Math.max(0, minY * z - 40);
  };

  // 画布平移
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    const el = e.target as HTMLElement;
    if (el !== e.currentTarget && !el.classList.contains("canvas-bg")) return;
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    const canvas = canvasRef.current;
    if (!canvas) return;
    setIsPanning(true);
    panStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      scrollLeft: canvas.scrollLeft,
      scrollTop: canvas.scrollTop,
    };
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (!isPanning || !panStartRef.current || !canvasRef.current) return;
    canvasRef.current.scrollLeft = panStartRef.current.scrollLeft - (e.clientX - panStartRef.current.x);
    canvasRef.current.scrollTop = panStartRef.current.scrollTop - (e.clientY - panStartRef.current.y);
  };

  const handleCanvasMouseUp = () => {
    setIsPanning(false);
    panStartRef.current = null;
  };

  // 自动布局（BFS 分层）
  const autoLayout = () => {
    if (nodes.length === 0) return;
    const inDeg: Record<string, number> = {};
    const adj: Record<string, string[]> = {};
    nodes.forEach((n) => {
      inDeg[n.id] = 0;
      adj[n.id] = [];
    });
    edges.forEach((e) => {
      adj[e.from]?.push(e.to);
      inDeg[e.to] = (inDeg[e.to] || 0) + 1;
    });
    const layer: Record<string, number> = {};
    const queue = nodes.filter((n) => inDeg[n.id] === 0).map((n) => n.id);
    queue.forEach((id) => (layer[id] = 0));
    while (queue.length) {
      const cur = queue.shift()!;
      for (const next of adj[cur] || []) {
        layer[next] = Math.max(layer[next] || 0, (layer[cur] || 0) + 1);
        inDeg[next]--;
        if (inDeg[next] === 0) queue.push(next);
      }
    }
    nodes.forEach((n) => {
      if (layer[n.id] === undefined) layer[n.id] = 0;
    });
    const byLayer: Record<number, string[]> = {};
    nodes.forEach((n) => {
      const l = layer[n.id];
      (byLayer[l] = byLayer[l] || []).push(n.id);
    });
    setNodes((prev) =>
      prev.map((n) => {
        const l = layer[n.id];
        const siblings = byLayer[l] || [];
        const idx = siblings.indexOf(n.id);
        return { ...n, x: 80 + l * 260, y: 80 + idx * 100 };
      })
    );
  };

  const updateNodeLabel = (id: string, label: string) => {
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, label } : n)));
  };

  const updateNodeConfig = (id: string, patch: Partial<NodeConfig>) => {
    setNodes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, config: { ...(n.config || {}), ...patch } } : n))
    );
  };

  // ===== 执行历史 Modal（在列表视图与画布视图中复用） =====
  const historyModal = (
    <Modal
      open={historyFlowId !== null}
      onClose={closeHistory}
      title={`执行历史${historyFlowName ? " · " + historyFlowName : ""}`}
      size="lg"
    >
      <div className="space-y-3">
        {/* 头部操作：记录数 + 刷新 */}
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">
            共 {historyList.length} 条记录
          </span>
          <button
            onClick={() => historyFlowId && fetchHistory(historyFlowId)}
            disabled={historyLoading}
            className="flex h-7 items-center gap-1.5 rounded-lg border border-border/60 px-2.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted/50 disabled:opacity-50"
          >
            <RefreshCw className={cn("h-3 w-3", historyLoading && "animate-spin")} />
            刷新
          </button>
        </div>

        {/* 历史列表 */}
        {historyLoading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            加载中...
          </div>
        ) : historyList.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
            <History className="h-8 w-8 text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground">暂无执行历史</p>
            <p className="text-[10px] text-muted-foreground/60">运行工作流后会在此处显示执行记录</p>
          </div>
        ) : (
          <div className="space-y-2">
            {historyList.map((item) => {
              const isExpanded = expandedHistoryId === item.id;
              const outputSummary = item.finalOutput ? item.finalOutput.slice(0, 100) : "";
              const hasMore = !!item.finalOutput && item.finalOutput.length > 100;
              const durationSec =
                item.totalDurationMs != null ? (item.totalDurationMs / 1000).toFixed(2) + "s" : "-";
              const nodeResults = Array.isArray(item.nodeResults) ? item.nodeResults : [];
              return (
                <div
                  key={item.id}
                  className="overflow-hidden rounded-xl border border-border/40 bg-background/40"
                >
                  {/* 概要行 */}
                  <button
                    onClick={() => setExpandedHistoryId(isExpanded ? null : item.id)}
                    className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-primary/5"
                  >
                    {item.success ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-task" />
                    ) : (
                      <XCircle className="h-4 w-4 shrink-0 text-destructive" />
                    )}
                    <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                      {new Date(item.startedAt).toLocaleString("zh-CN")}
                    </span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {durationSec}
                    </span>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                        item.success
                          ? "bg-task/10 text-task"
                          : "bg-destructive/10 text-destructive"
                      )}
                    >
                      {item.success ? "成功" : "失败"}
                    </span>
                    {outputSummary ? (
                      <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
                        {outputSummary}
                        {hasMore ? "..." : ""}
                      </span>
                    ) : (
                      <span className="flex-1" />
                    )}
                  </button>

                  {/* 展开详情 */}
                  {isExpanded && (
                    <div className="space-y-2.5 border-t border-border/40 bg-muted/20 px-3 py-2.5">
                      {/* 完整输出 */}
                      {item.finalOutput && (
                        <div>
                          <div className="mb-1 text-[10px] font-medium text-muted-foreground">
                            完整输出
                          </div>
                          <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-background/60 p-2 text-[11px] leading-relaxed text-foreground/80">
                            {item.finalOutput}
                          </pre>
                        </div>
                      )}

                      {/* 错误信息 */}
                      {item.error && (
                        <div>
                          <div className="mb-1 text-[10px] font-medium text-destructive">
                            错误信息
                          </div>
                          <pre className="whitespace-pre-wrap rounded-lg bg-destructive/5 p-2 text-[11px] text-destructive">
                            {item.error}
                          </pre>
                        </div>
                      )}

                      {/* 节点执行结果 */}
                      {nodeResults.length > 0 && (
                        <div>
                          <div className="mb-1.5 text-[10px] font-medium text-muted-foreground">
                            节点执行结果（{nodeResults.length}）
                          </div>
                          <div className="space-y-1.5">
                            {nodeResults.map((nr, i) => (
                              <div
                                key={i}
                                className={cn(
                                  "flex items-start gap-2 rounded-lg px-2.5 py-1.5 text-[11px]",
                                  nr.success ? "bg-task/5" : "bg-destructive/5"
                                )}
                              >
                                {nr.success ? (
                                  <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-task" />
                                ) : (
                                  <XCircle className="mt-0.5 h-3 w-3 shrink-0 text-destructive" />
                                )}
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-foreground">
                                      {nr.nodeName || nr.nodeId}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground">
                                      {nr.durationMs}ms
                                    </span>
                                  </div>
                                  {nr.output && (
                                    <pre className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap rounded bg-background/60 p-1.5 text-[10px] text-muted-foreground/80">
                                      {nr.output}
                                    </pre>
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
    </Modal>
  );

  // 可视化编排视图
  if (canvasMode && editingFlow) {
    const selectedNode = nodes.find((n) => n.id === selectedNodeId) || null;
    return (
      <div className="flex h-full flex-col">
        {/* 工具栏 */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 px-3 py-2">
          <div className="flex items-center gap-2">
            <button
              onClick={exitCanvas}
              className="btn-glass flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> 返回
            </button>
            <div className="h-5 w-px bg-border/50" />
            <input
              value={editingFlow.name}
              onChange={(e) => updateFlowField("name", e.target.value)}
              placeholder="工作流名称"
              className="h-8 w-44 rounded-lg border border-border/60 bg-background/40 px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
            />
            <input
              value={editingFlow.description}
              onChange={(e) => updateFlowField("description", e.target.value)}
              placeholder="描述（可选）"
              className="h-8 w-52 rounded-lg border border-border/60 bg-background/40 px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={zoomOut}
              title="缩小"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <span className="w-10 text-center text-[11px] text-muted-foreground">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={zoomIn}
              title="放大"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
            <button
              onClick={zoomReset}
              title="重置缩放"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Maximize className="h-4 w-4" />
            </button>
            <button
              onClick={fitView}
              title="适应视图"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={autoLayout}
              title="自动布局"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Network className="h-4 w-4" />
            </button>
            <div className="h-5 w-px bg-border/50" />
            <button
              onClick={() => editingFlow && openHistory(editingFlow)}
              title="执行历史"
              className="flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <History className="h-3.5 w-3.5" /> 历史
            </button>
            <button
              onClick={handleRunFromCanvas}
              disabled={!!executing}
              className="flex h-8 items-center gap-1.5 rounded-lg bg-primary/10 px-3 text-xs font-medium text-primary hover:bg-primary/20 disabled:opacity-50"
            >
              {executing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
              运行
            </button>
            <button
              onClick={handleSave}
              className="btn-primary-glass flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs"
            >
              <Save className="h-3.5 w-3.5" /> 保存
            </button>
            <HelpButton module="ai-flows" />
          </div>
        </div>

        {/* 主体三栏 */}
        <div className="flex flex-1 overflow-hidden">
          {/* 左侧节点面板 */}
          <div className="w-44 shrink-0 overflow-y-auto border-r border-border/40 p-3">
            <div className="mb-2 text-[11px] font-medium text-muted-foreground">节点类型</div>
            <div className="space-y-1.5">
              {NODE_PANEL_ITEMS.map((item) => {
                const style = NODE_STYLES[item.type];
                const Icon = style.icon;
                return (
                  <div
                    key={item.type}
                    draggable
                    onDragStart={(e) => handlePanelDragStart(e, item.type)}
                    className="group flex cursor-grab items-center gap-2 rounded-lg border border-border/40 bg-background/40 p-2 transition-colors hover:border-primary/40 hover:bg-primary/5 active:cursor-grabbing"
                  >
                    <span className={cn("flex h-7 w-7 items-center justify-center rounded-md", style.bg)}>
                      <Icon className={cn("h-3.5 w-3.5", style.color)} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium text-foreground">{item.label}</div>
                      <div className="truncate text-[10px] text-muted-foreground">{item.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 rounded-lg border border-border/40 bg-muted/20 p-2 text-[10px] leading-relaxed text-muted-foreground">
              拖拽节点到画布；从节点右侧端口拖出连线到目标节点左侧端口；Delete 删除选中。
            </div>
          </div>

          {/* 中央画布 */}
          <div
            ref={canvasRef}
            className="canvas-bg relative flex-1 overflow-auto"
            onDrop={handleCanvasDrop}
            onDragOver={handleCanvasDragOver}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseUp}
            onWheel={handleCanvasWheel}
            style={{ cursor: isPanning ? "grabbing" : "default" }}
          >
            <div
              className="relative"
              style={{
                width: CANVAS_WIDTH,
                height: CANVAS_HEIGHT,
                transform: `scale(${zoom})`,
                transformOrigin: "0 0",
              }}
            >
              {/* 连线 SVG */}
              <svg
                className="pointer-events-none absolute inset-0"
                width={CANVAS_WIDTH}
                height={CANVAS_HEIGHT}
              >
                <defs>
                  <marker id="flow-arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
                    <path d="M0,0 L8,3 L0,6 Z" fill="currentColor" className="text-muted-foreground/60" />
                  </marker>
                  <marker id="flow-arrow-active" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
                    <path d="M0,0 L8,3 L0,6 Z" fill="currentColor" className="text-primary" />
                  </marker>
                  <marker id="flow-arrow-true" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
                    <path d="M0,0 L8,3 L0,6 Z" fill="currentColor" className="text-task" />
                  </marker>
                  <marker id="flow-arrow-false" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
                    <path d="M0,0 L8,3 L0,6 Z" fill="currentColor" className="text-campaign" />
                  </marker>
                </defs>
                {edges.map((edge) => {
                  const fromNode = nodes.find((n) => n.id === edge.from);
                  const toNode = nodes.find((n) => n.id === edge.to);
                  if (!fromNode || !toNode) return null;
                  const op = getOutputPort(fromNode);
                  const ip = getInputPort(toNode);
                  const isActive = selectedEdgeId === edge.id;
                  const markerId =
                    edge.condition === "true"
                      ? "flow-arrow-true"
                      : edge.condition === "false"
                        ? "flow-arrow-false"
                        : isActive
                          ? "flow-arrow-active"
                          : "flow-arrow";
                  const colorClass =
                    edge.condition === "true"
                      ? "text-task"
                      : edge.condition === "false"
                        ? "text-campaign"
                        : isActive
                          ? "text-primary"
                          : "text-muted-foreground/60";
                  return (
                    <path
                      key={edge.id}
                      d={bezierPath(op.x, op.y, ip.x, ip.y)}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={isActive ? 2.5 : 1.8}
                      markerEnd={`url(#${markerId})`}
                      className={cn("pointer-events-auto cursor-pointer", colorClass)}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedEdgeId(edge.id);
                        setSelectedNodeId(null);
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        toggleEdgeCondition(edge.id);
                      }}
                    />
                  );
                })}
                {tempConnect &&
                  connectRef.current &&
                  (() => {
                    const fromNode = nodes.find((n) => n.id === connectRef.current!.from);
                    if (!fromNode) return null;
                    const op = getOutputPort(fromNode);
                    return (
                      <path
                        d={bezierPath(op.x, op.y, tempConnect.x, tempConnect.y)}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        strokeDasharray="5 4"
                        className="text-primary"
                      />
                    );
                  })()}
              </svg>

              {/* 节点 */}
              {nodes.map((node) => {
                const style = NODE_STYLES[node.type];
                const Icon = style.icon;
                const isSelected = selectedNodeId === node.id;
                const statusRing =
                  node.status === "running"
                    ? "ring-primary"
                    : node.status === "done"
                      ? "ring-task"
                      : node.status === "error"
                        ? "ring-destructive"
                        : "";
                return (
                  <div
                    key={node.id}
                    data-node-id={node.id}
                    onMouseDown={(e) => handleNodeMouseDown(e, node)}
                    onDoubleClick={(e) => handleNodeDoubleClick(e, node)}
                    className={cn(
                      "absolute rounded-xl border bg-background/80 shadow-sm backdrop-blur-md transition-shadow",
                      isSelected ? "border-primary ring-2 ring-primary/40" : "border-border/60",
                      statusRing && "ring-2",
                      statusRing
                    )}
                    style={{ left: node.x, top: node.y, width: NODE_WIDTH, height: NODE_HEIGHT, cursor: "grab" }}
                  >
                    <div className="flex h-full items-center gap-2 px-3">
                      <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-md", style.bg)}>
                        <Icon className={cn("h-3.5 w-3.5", style.color)} />
                      </span>
                      {editingNodeId === node.id ? (
                        <input
                          autoFocus
                          value={editingLabel}
                          onChange={(e) => setEditingLabel(e.target.value)}
                          onBlur={commitEdit}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitEdit();
                            if (e.key === "Escape") setEditingNodeId(null);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="h-6 flex-1 rounded border border-primary/40 bg-background px-1 text-xs outline-none"
                        />
                      ) : (
                        <div className="flex-1 truncate text-xs font-medium text-foreground">{node.label}</div>
                      )}
                      {node.status === "running" && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
                      {node.status === "done" && <CheckCircle2 className="h-3 w-3 text-task" />}
                      {node.status === "error" && <AlertCircle className="h-3 w-3 text-destructive" />}
                    </div>
                    {/* 输入端口 */}
                    <div
                      data-port="input"
                      data-node-id={node.id}
                      className="absolute left-0 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-muted-foreground/60 hover:bg-primary"
                    />
                    {/* 输出端口 */}
                    <div
                      data-port="output"
                      data-node-id={node.id}
                      onMouseDown={(e) => handleOutputPortMouseDown(e, node)}
                      className="absolute right-0 top-1/2 h-3 w-3 translate-x-1/2 -translate-y-1/2 cursor-crosshair rounded-full border-2 border-background bg-muted-foreground/60 hover:bg-primary"
                    />
                    {node.type === "condition" && (
                      <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] text-muted-foreground">
                        分支
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 右侧配置面板 */}
          <div className="w-72 shrink-0 overflow-y-auto border-l border-border/40 p-3">
            {selectedNode ? (
              <NodeConfigPanel
                node={selectedNode}
                onUpdateLabel={(label) => updateNodeLabel(selectedNode.id, label)}
                onUpdateConfig={(patch) => updateNodeConfig(selectedNode.id, patch)}
                onDelete={() => deleteNode(selectedNode.id)}
              />
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-xs text-muted-foreground">
                <Network className="h-8 w-8 text-muted-foreground/40" />
                <p>点击节点查看/编辑配置</p>
                <p className="text-[10px]">支持拖拽、连线、双击重命名</p>
              </div>
            )}

            {selectedEdgeId &&
              (() => {
                const edge = edges.find((e) => e.id === selectedEdgeId);
                if (!edge) return null;
                const fromNode = nodes.find((n) => n.id === edge.from);
                return (
                  <div className="mt-4 rounded-lg border border-border/40 bg-muted/20 p-3">
                    <div className="mb-2 text-[11px] font-medium text-foreground">选中连线</div>
                    <div className="text-[10px] text-muted-foreground">来源：{fromNode?.label}</div>
                    {fromNode?.type === "condition" && edge.condition && (
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground">分支：</span>
                        <button
                          onClick={() => toggleEdgeCondition(edge.id)}
                          className={cn(
                            "rounded px-2 py-0.5 text-[10px]",
                            edge.condition === "true" ? "bg-task/15 text-task" : "bg-campaign/15 text-campaign"
                          )}
                        >
                          {edge.condition === "true" ? "真" : "假"}
                        </button>
                      </div>
                    )}
                    <button
                      onClick={() => deleteEdge(edge.id)}
                      className="mt-2 flex items-center gap-1 text-[10px] text-destructive hover:underline"
                    >
                      <Trash2 className="h-3 w-3" /> 删除连线
                    </button>
                  </div>
                );
              })()}
          </div>
        </div>

        {/* 执行结果面板 */}
        <AnimatePresence>
          {lastResult && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="max-h-48 overflow-auto border-t border-border/40 bg-muted/20 p-3"
            >
              <div className="mb-2 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-xs font-semibold text-foreground">
                  {lastResult.success ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-task" />
                  ) : (
                    <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                  )}
                  执行结果 · {lastResult.flowName} · {lastResult.totalDurationMs}ms
                </h3>
                <button
                  onClick={() => setLastResult(null)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="space-y-1">
                {Array.isArray(lastResult.nodes) &&
                  lastResult.nodes.map((n) => (
                    <div
                      key={n.nodeId}
                      className="flex items-start gap-2 rounded border border-border/40 bg-background/40 p-1.5 text-[11px]"
                    >
                      <span
                        className={cn(
                          "mt-1 h-1.5 w-1.5 rounded-full",
                          n.status === "done"
                            ? "bg-task"
                            : n.status === "error"
                              ? "bg-destructive"
                              : "bg-muted-foreground"
                        )}
                      />
                      <div className="flex-1">
                        <span className="font-medium text-foreground">{n.nodeLabel}</span>
                        <span className="ml-2 text-muted-foreground">{n.message}</span>
                        {n.error && <span className="ml-2 text-destructive">{n.error}</span>}
                      </div>
                      <span className="text-muted-foreground">{n.durationMs}ms</span>
                    </div>
                  ))}
              </div>
              {lastResult.finalOutput && (
                <pre className="mt-2 max-h-24 overflow-auto rounded bg-background/40 p-1.5 text-[10px] text-foreground/80">
                  {lastResult.finalOutput}
                </pre>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* 执行历史 Modal */}
        {historyModal}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-4">
      {/* 页头 */}
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
            <Workflow className="h-6 w-6 text-primary" />
            AI 工作流
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            可视化节点编排 · 自动化复杂任务流程
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCreate}
            className="btn-primary-glass flex h-9 items-center gap-1.5 rounded-xl px-4 text-sm"
          >
            <Plus className="h-4 w-4" />
            新建工作流
          </button>
          <HelpButton module="ai-flows" />
        </div>
      </div>

      {/* 工作流列表 */}
      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          加载中...
        </div>
      ) : flows.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/60 py-16">
          <Workflow className="h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">还没有工作流，点击「新建工作流」开始</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {flows.map((flow) => (
            <motion.div
              key={flow.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card flex flex-col gap-3 p-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-foreground">{flow.name}</h3>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-medium",
                        flow.enabled
                          ? "bg-task/10 text-task"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {flow.enabled ? "已启用" : "已禁用"}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {flow.description || "暂无描述"}
                  </p>
                </div>
              </div>

              {/* 节点预览 */}
              <div className="flex flex-wrap items-center gap-1">
                {flow.nodes.slice(0, 6).map((node, idx) => (
                  <div key={node.id} className="flex items-center gap-1">
                    <span className="rounded-md bg-muted/50 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      {node.label}
                    </span>
                    {idx < Math.min(flow.nodes.length, 6) - 1 && (
                      <span className="text-muted-foreground/40">→</span>
                    )}
                  </div>
                ))}
                {flow.nodes.length > 6 && (
                  <span className="text-[10px] text-muted-foreground">+{flow.nodes.length - 6}</span>
                )}
              </div>

              {/* 元信息 */}
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                <span>{flow.nodes.length} 个节点</span>
                {flow.lastRun && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    上次运行：{flow.lastRun}
                  </span>
                )}
              </div>

              {/* 操作按钮 */}
              <div className="flex items-center gap-2 border-t border-border/40 pt-3">
                <button
                  onClick={() => handleExecute(flow)}
                  disabled={executing === flow.id || !flow.enabled}
                  className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary/10 text-xs font-medium text-primary transition-colors hover:bg-primary/20 disabled:opacity-50"
                >
                  {executing === flow.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Play className="h-3.5 w-3.5" />
                  )}
                  执行
                </button>
                <button
                  onClick={() => handleEdit(flow)}
                  title="编辑"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => openHistory(flow)}
                  title="执行历史"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-cognition/10 hover:text-cognition"
                >
                  <History className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => handleToggleEnabled(flow)}
                  title={flow.enabled ? "禁用" : "启用"}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
                    flow.enabled
                      ? "text-task hover:bg-task/10"
                      : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(flow)}
                  title="删除"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* 执行结果 */}
      <AnimatePresence>
        {lastResult && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mt-6 rounded-2xl border border-border/60 bg-muted/20 p-4"
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                {lastResult.success ? (
                  <CheckCircle2 className="h-4 w-4 text-task" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-destructive" />
                )}
                执行结果 · {lastResult.flowName}
              </h3>
              <button
                onClick={() => setLastResult(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mb-3 flex items-center gap-3 text-[11px] text-muted-foreground">
              <span>耗时：{lastResult.totalDurationMs}ms</span>
              <span>·</span>
              <span>{new Date(lastResult.startedAt).toLocaleString("zh-CN")}</span>
            </div>
            <div className="space-y-2">
              {lastResult.nodes.map((n) => (
                <div
                  key={n.nodeId}
                  className={cn(
                    "flex items-start gap-2 rounded-lg border p-2 text-xs",
                    n.status === "done"
                      ? "border-task/30 bg-task/5"
                      : n.status === "error"
                        ? "border-destructive/30 bg-destructive/5"
                        : "border-border/40 bg-muted/20"
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 h-2 w-2 shrink-0 rounded-full",
                      n.status === "done"
                        ? "bg-task"
                        : n.status === "error"
                          ? "bg-destructive"
                          : "bg-muted-foreground"
                    )}
                  />
                  <div className="flex-1">
                    <div className="font-medium text-foreground">{n.nodeLabel}</div>
                    <div className="mt-0.5 text-muted-foreground">{n.message}</div>
                    {n.error && (
                      <div className="mt-1 text-destructive">错误：{n.error}</div>
                    )}
                    {n.output && (
                      <pre className="mt-1 max-h-24 overflow-auto rounded bg-muted/30 p-1.5 text-[10px] text-foreground/70">
                        {n.output}
                      </pre>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground">{n.durationMs}ms</span>
                </div>
              ))}
            </div>
            {lastResult.finalOutput && (
              <div className="mt-3 rounded-lg border border-border/40 bg-background/40 p-3">
                <div className="mb-1 text-[11px] font-medium text-muted-foreground">最终输出：</div>
                <pre className="max-h-40 overflow-auto text-xs text-foreground/80">
                  {lastResult.finalOutput}
                </pre>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 执行历史 Modal */}
      {historyModal}

      {/* 执行结果弹窗 Modal */}
      <Modal
        open={showResultModal && !!lastResult}
        onClose={() => {
          setShowResultModal(false);
          setLastResult(null);
        }}
        title="工作流执行结果"
        size="lg"
      >
        {lastResult && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {lastResult.success ? (
                  <CheckCircle2 className="h-5 w-5 text-task" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-destructive" />
                )}
                <span className={cn("text-sm font-semibold", lastResult.success ? "text-task" : "text-destructive")}>
                  {lastResult.success ? "执行成功" : "执行失败"}
                </span>
              </div>
              <button
                onClick={() => {
                  setShowResultModal(false);
                  setLastResult(null);
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <span>工作流：{lastResult.flowName}</span>
              <span>·</span>
              <span>耗时：{lastResult.totalDurationMs}ms</span>
              <span>·</span>
              <span>{new Date(lastResult.startedAt).toLocaleString("zh-CN")}</span>
            </div>
            {lastResult.error && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                {lastResult.error}
              </div>
            )}
            {Array.isArray(lastResult.nodes) && lastResult.nodes.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">节点执行详情：</div>
                {lastResult.nodes.map((n) => (
                  <div
                    key={n.nodeId}
                    className={cn(
                      "flex items-start gap-2 rounded-lg border p-2 text-xs",
                      n.status === "done"
                        ? "border-task/30 bg-task/5"
                        : n.status === "error"
                          ? "border-destructive/30 bg-destructive/5"
                          : "border-border/40 bg-muted/20"
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 h-2 w-2 shrink-0 rounded-full",
                        n.status === "done"
                          ? "bg-task"
                          : n.status === "error"
                            ? "bg-destructive"
                            : "bg-muted-foreground"
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-foreground">{n.nodeLabel}</div>
                      <div className="mt-0.5 text-muted-foreground">{n.message}</div>
                      {n.error && <div className="mt-1 text-destructive">错误：{n.error}</div>}
                      {n.output && (
                        <pre className="mt-1 max-h-32 overflow-auto rounded bg-muted/30 p-1.5 text-[10px] text-foreground/70">
                          {n.output}
                        </pre>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">{n.durationMs}ms</span>
                  </div>
                ))}
              </div>
            )}
            {lastResult.finalOutput && (
              <div className="rounded-lg border border-border/40 bg-background/40 p-3">
                <div className="mb-1 text-[11px] font-medium text-muted-foreground">最终输出：</div>
                <pre className="max-h-48 overflow-auto whitespace-pre-wrap text-xs text-foreground/80">
                  {lastResult.finalOutput}
                </pre>
              </div>
            )}
            <div className="flex justify-end gap-2 border-t border-border/40 pt-3">
              <button
                onClick={() => {
                  setShowResultModal(false);
                  setLastResult(null);
                }}
                className="btn-primary-glass flex h-8 items-center px-4 text-xs"
              >
                关闭
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* 删除确认弹窗 */}
      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="确认删除"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            确定删除工作流「<span className="font-medium text-foreground">{deleteTarget?.name}</span>」？此操作不可撤销。
          </p>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setDeleteTarget(null)}
              className="px-3 py-1.5 text-xs rounded-lg border border-border hover:bg-muted/50"
            >
              取消
            </button>
            <button
              onClick={confirmDelete}
              className="px-3 py-1.5 text-xs rounded-lg bg-red-500 text-white hover:bg-red-600"
            >
              删除
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ============ 节点配置面板（右侧栏，按节点类型渲染不同配置字段） ============

function NodeConfigPanel({
  node,
  onUpdateLabel,
  onUpdateConfig,
  onDelete,
}: {
  node: CanvasNode;
  onUpdateLabel: (label: string) => void;
  onUpdateConfig: (patch: Partial<NodeConfig>) => void;
  onDelete: () => void;
}) {
  const style = NODE_STYLES[node.type];
  const Icon = style.icon;
  const cfg = node.config || {};
  const inputCls =
    "h-9 w-full rounded-lg border border-border/60 bg-background/40 px-3 text-xs outline-none focus:ring-2 focus:ring-primary/20";
  const areaCls =
    "w-full rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary/20 resize-none";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className={cn("flex h-8 w-8 items-center justify-center rounded-md", style.bg)}>
          <Icon className={cn("h-4 w-4", style.color)} />
        </span>
        <div className="flex-1">
          <div className="text-[10px] text-muted-foreground">{NODE_TYPE_LABELS[node.type]}</div>
          <input
            value={node.label}
            onChange={(e) => onUpdateLabel(e.target.value)}
            className="h-7 w-full rounded-md border border-border/60 bg-background/40 px-2 text-xs outline-none focus:ring-1 focus:ring-primary/20"
          />
        </div>
      </div>

      <div className="h-px bg-border/40" />

      {node.type === "trigger" && (
        <Field label="触发类型">
          <select
            value={cfg.triggerType || "manual"}
            onChange={(e) => onUpdateConfig({ triggerType: e.target.value as NodeConfig["triggerType"] })}
            className={inputCls}
          >
            <option value="manual">手动</option>
            <option value="schedule">定时</option>
            <option value="event">事件</option>
          </select>
          {cfg.triggerType === "schedule" && (
            <input
              value={cfg.schedule || ""}
              onChange={(e) => onUpdateConfig({ schedule: e.target.value })}
              placeholder="cron 表达式，如 0 9 * * *"
              className={`${inputCls} mt-2`}
            />
          )}
          {cfg.triggerType === "event" && (
            <input
              value={cfg.eventType || ""}
              onChange={(e) => onUpdateConfig({ eventType: e.target.value })}
              placeholder="事件类型"
              className={`${inputCls} mt-2`}
            />
          )}
        </Field>
      )}

      {node.type === "action" && (
        <>
          <Field label="Prompt">
            <textarea
              value={cfg.prompt || ""}
              onChange={(e) => onUpdateConfig({ prompt: e.target.value })}
              placeholder="AI 提示词"
              rows={4}
              className={areaCls}
            />
          </Field>
          <Field label="模型">
            <input
              value={cfg.model || ""}
              onChange={(e) => onUpdateConfig({ model: e.target.value })}
              placeholder="留空使用默认模型"
              className={inputCls}
            />
          </Field>
        </>
      )}

      {node.type === "condition" && (
        <Field label="表达式">
          <textarea
            value={cfg.expression || ""}
            onChange={(e) => onUpdateConfig({ expression: e.target.value })}
            placeholder='如 input.includes("yes")'
            rows={3}
            className={areaCls}
          />
          <p className="mt-1 text-[10px] text-muted-foreground">连线可标记为真/假分支，双击连线切换。</p>
        </Field>
      )}

      {node.type === "output" && (
        <Field label="输出目标">
          <select
            value={cfg.outputTarget || "chat"}
            onChange={(e) => onUpdateConfig({ outputTarget: e.target.value })}
            className={inputCls}
          >
            <option value="chat">对话</option>
            <option value="file">文件</option>
            <option value="webhook">Webhook</option>
          </select>
        </Field>
      )}

      {node.type === "hermes" && (
        <>
          <Field label="模式">
            <select
              value={cfg.hermesMode || "auto"}
              onChange={(e) => onUpdateConfig({ hermesMode: e.target.value as NodeConfig["hermesMode"] })}
              className={inputCls}
            >
              <option value="auto">自动</option>
              <option value="computer_use">桌面操控</option>
              <option value="shell">Shell</option>
            </select>
          </Field>
          <Field label="指令">
            <textarea
              value={cfg.hermesPrompt || ""}
              onChange={(e) => onUpdateConfig({ hermesPrompt: e.target.value })}
              placeholder="给 Hermes 的指令"
              rows={3}
              className={areaCls}
            />
          </Field>
          <Field label="工作目录">
            <input
              value={cfg.workDir || ""}
              onChange={(e) => onUpdateConfig({ workDir: e.target.value })}
              placeholder="可选"
              className={inputCls}
            />
          </Field>
          <Field label="超时(ms)">
            <input
              type="number"
              value={cfg.timeout ?? 60000}
              onChange={(e) => onUpdateConfig({ timeout: Number(e.target.value) })}
              className={inputCls}
            />
          </Field>
        </>
      )}

      {node.type === "http" && (
        <>
          <Field label="方法">
            <select
              value={cfg.httpMethod || "GET"}
              onChange={(e) => onUpdateConfig({ httpMethod: e.target.value as NodeConfig["httpMethod"] })}
              className={inputCls}
            >
              <option>GET</option>
              <option>POST</option>
              <option>PUT</option>
              <option>PATCH</option>
              <option>DELETE</option>
            </select>
          </Field>
          <Field label="URL">
            <input
              value={cfg.httpUrl || ""}
              onChange={(e) => onUpdateConfig({ httpUrl: e.target.value })}
              placeholder="https://..."
              className={inputCls}
            />
          </Field>
          <Field label="Body">
            <textarea
              value={cfg.httpBody || ""}
              onChange={(e) => onUpdateConfig({ httpBody: e.target.value })}
              rows={3}
              className={areaCls}
            />
          </Field>
        </>
      )}

      {node.type === "database" && (
        <>
          <Field label="操作">
            <select
              value={cfg.dbOperation || "query"}
              onChange={(e) => onUpdateConfig({ dbOperation: e.target.value as NodeConfig["dbOperation"] })}
              className={inputCls}
            >
              <option value="query">查询</option>
              <option value="create">创建</option>
              <option value="update">更新</option>
              <option value="delete">删除</option>
            </select>
          </Field>
          <Field label="模型">
            <input
              value={cfg.dbModel || ""}
              onChange={(e) => onUpdateConfig({ dbModel: e.target.value })}
              placeholder="模型名"
              className={inputCls}
            />
          </Field>
          <Field label="查询/数据">
            <textarea
              value={cfg.dbQuery || ""}
              onChange={(e) => onUpdateConfig({ dbQuery: e.target.value })}
              rows={3}
              className={areaCls}
            />
          </Field>
        </>
      )}

      {node.type === "transform" && (
        <>
          <Field label="转换类型">
            <select
              value={cfg.transformType || "jsonpath"}
              onChange={(e) =>
                onUpdateConfig({ transformType: e.target.value as NodeConfig["transformType"] })
              }
              className={inputCls}
            >
              <option value="jsonpath">JSONPath</option>
              <option value="template">模板</option>
              <option value="regex">正则</option>
              <option value="javascript">JavaScript</option>
            </select>
          </Field>
          {cfg.transformType === "template" ? (
            <Field label="模板">
              <textarea
                value={cfg.transformTemplate || ""}
                onChange={(e) => onUpdateConfig({ transformTemplate: e.target.value })}
                rows={3}
                className={areaCls}
              />
            </Field>
          ) : (
            <Field label="表达式">
              <textarea
                value={cfg.transformExpression || ""}
                onChange={(e) => onUpdateConfig({ transformExpression: e.target.value })}
                rows={3}
                className={areaCls}
              />
            </Field>
          )}
        </>
      )}

      {node.type === "delay" && (
        <Field label="延时(ms)">
          <input
            type="number"
            value={cfg.delayMs ?? 1000}
            onChange={(e) => onUpdateConfig({ delayMs: Number(e.target.value) })}
            className={inputCls}
          />
        </Field>
      )}

      <div className="h-px bg-border/40" />

      <button
        onClick={onDelete}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/5 py-1.5 text-[11px] text-destructive hover:bg-destructive/10"
      >
        <Trash2 className="h-3 w-3" /> 删除节点
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

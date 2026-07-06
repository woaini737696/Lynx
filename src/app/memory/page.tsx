"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
  Database,
  Target,
  MessageSquare,
  BookOpen,
  Brain,
  HelpCircle,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Pause,
  Play,
  Layers,
  Calendar,
  X,
  Lightbulb,
  Search,
  Trash2,
  Pencil,
  ArrowUpDown,
  ArrowLeft,
  Bot,
  RefreshCw,
  CheckSquare,
  Square,
  AlertTriangle,
} from "lucide-react";
import { toast } from "@/components/ui/toast";
import { useAsyncLoading } from "@/lib/use-async-loading";
import { PageHeader, Card, Button, Skeleton } from "@/components/layout/PageHeader";
import { HelpButton } from "@/components/layout/HelpButton";
import { Pagination, useClientPagination } from "@/components/ui/ListControls";
import { openContextMenu } from "@/components/ui/ContextMenu";
import { cn } from "@/lib/utils";
import { RetryState } from "@/components/ui/RetryState";

type GraphNode = {
  id: string;
  label: string;
  type: "idea" | "conversation" | "cognition" | "hermes";
  color: string;
  strength: number;
  connections: string[];
  fullContent: string;
  createdAt?: string;
};

type GraphEdge = { from: string; to: string };

const TYPE_LABELS: Record<GraphNode["type"], string> = {
  idea: "灵感",
  conversation: "对话",
  cognition: "认知",
  hermes: "Hermes 记忆",
};

// 神经元网络配色（橙黑灰体系）
const TYPE_HSL: Record<GraphNode["type"], { h: number; s: number; l: number }> = {
  idea: { h: 25, s: 95, l: 55 }, // 橙色
  conversation: { h: 0, s: 0, l: 45 }, // 深灰
  cognition: { h: 30, s: 80, l: 40 }, // 深橙棕
  hermes: { h: 160, s: 70, l: 45 }, // 青绿色（Hermes Agent）
};

// 类型图标映射（用于列表展示）
const TYPE_ICON: Record<GraphNode["type"], typeof Lightbulb> = {
  idea: Lightbulb,
  conversation: MessageSquare,
  cognition: Brain,
  hermes: Bot,
};

// 3D 力导向模拟节点
type SimNode = {
  id: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  r: number;
  data: GraphNode;
};

// ---- Web Worker 消息类型 ----
type WorkerInitNode = {
  id: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  fx: number | null;
  fy: number | null;
  fz: number | null;
  r: number;
  data: any;
};

type WorkerMessage =
  | { type: "init"; nodes: WorkerInitNode[]; edges: GraphEdge[] }
  | { type: "tick" }
  | { type: "drag-start"; id: string }
  | { type: "drag-move"; id: string; x: number; y: number; z: number }
  | { type: "drag-end"; id: string }
  | { type: "stop" }
  | { type: "resume" };

type WorkerResponse =
  | { type: "ready" }
  | { type: "tick"; nodes: { id: string; x: number; y: number; z: number }[] }
  | { type: "settled" };

const WIDTH = 820;
const HEIGHT = 540;
const Z_RANGE = 170; // z 轴范围 [-Z_RANGE, Z_RANGE]
const FOCAL = 720; // 透视焦距

// 浅色背景色
const BG_COLOR = "#f8fafc"; // slate-50

const TIME_RANGES = [
  { key: "all", label: "全部" },
  { key: "7", label: "近7天" },
  { key: "30", label: "近30天" },
  { key: "90", label: "近90天" },
] as const;

type TimeRange = (typeof TIME_RANGES)[number]["key"];

// 列表筛选类型
type FilterType = "all" | GraphNode["type"];
type SortBy = "time" | "connections" | "type";

const FILTER_OPTIONS: { key: FilterType; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "idea", label: "灵感" },
  { key: "conversation", label: "对话" },
  { key: "cognition", label: "认知" },
  { key: "hermes", label: "Hermes 记忆" },
];

const SORT_OPTIONS: { key: SortBy; label: string }[] = [
  { key: "time", label: "按时间" },
  { key: "connections", label: "按连接数" },
  { key: "type", label: "按类型" },
];

// ---- 工具函数 ----

// FNV-1a 哈希：当 API 未返回 createdAt 时用作稳定的伪"天数前"兜底
function pseudoDaysAgo(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 90;
}

// 计算节点距今天数（优先使用真实 createdAt，缺失时回退伪天数）
function daysAgoOf(n: GraphNode): number {
  if (n.createdAt) {
    const diff = Date.now() - new Date(n.createdAt).getTime();
    return Math.floor(diff / (24 * 60 * 60 * 1000));
  }
  return pseudoDaysAgo(n.id);
}

// 并查集：基于边计算连通分量（聚类）
function computeClusters(nodes: GraphNode[], edges: GraphEdge[]) {
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    let root = x;
    while (parent.get(root) !== root) root = parent.get(root)!;
    let cur = x;
    while (parent.get(cur) !== root) {
      const next = parent.get(cur)!;
      parent.set(cur, root);
      cur = next;
    }
    return root;
  };
  const union = (a: string, b: string) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };

  nodes.forEach((n) => parent.set(n.id, n.id));
  edges.forEach((e) => union(e.from, e.to));
  nodes.forEach((n) => {
    const conns = Array.isArray(n.connections) ? n.connections : [];
    conns.forEach((c) => parent.has(c) && union(n.id, c));
  });

  const rootIndex = new Map<string, number>();
  const nodeCluster = new Map<string, number>();
  let idx = 0;
  nodes.forEach((n) => {
    const r = find(n.id);
    if (!rootIndex.has(r)) rootIndex.set(r, idx++);
    nodeCluster.set(n.id, rootIndex.get(r)!);
  });
  return { nodeCluster, count: idx };
}

// 按聚类微调色相，返回 HSL 分量
function clusterHSL(
  type: GraphNode["type"],
  clusterIndex: number
): { h: number; s: number; l: number } {
  const base = TYPE_HSL[type];
  const shift = ((clusterIndex * 23) % 41) - 20; // -20..20
  const h = (base.h + shift + 360) % 360;
  return { h, s: base.s, l: base.l };
}

// 格式化时间为简短显示
function formatTime(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const now = Date.now();
  const diff = now - d.getTime();
  if (diff < 60 * 1000) return "刚刚";
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / 60000)}分钟前`;
  if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / 3600000)}小时前`;
  if (diff < 30 * 24 * 60 * 60 * 1000) return `${Math.floor(diff / 86400000)}天前`;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function MemoryPage() {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [stats, setStats] = useState({ total: 0, edges: 0, isolated: 0, mode: "tfidf-fallback" });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rebuilding, setRebuilding] = useState(false);
  const [syncingHermes, setSyncingHermes] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [simulating, setSimulating] = useState(true);
  const [clustering, setClustering] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>("all");
  const [scale, setScale] = useState(1);
  const [rotX, setRotX] = useState(-0.32);
  const [rotY, setRotY] = useState(0.42);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // 聚焦模式：点击节点后进入该节点的子图谱视图
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null);

  // ---- 记忆列表管理状态 ----
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [sortBy, setSortBy] = useState<SortBy>("time");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ---- 批量管理状态 ----
  // 是否处于批量管理模式
  const [batchMode, setBatchMode] = useState(false);
  // 当前选中的节点 id 集合
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // 批量删除进行中
  const [batchDeleting, setBatchDeleting] = useState(false);
  // 是否显示批量删除确认弹窗
  const [showBatchConfirm, setShowBatchConfirm] = useState(false);

  // 全局异步加载反馈：耗时超过 800ms 的操作会显示 overlay
  const { run: runAsync } = useAsyncLoading();

  // 增量渲染：节点逐步显现的计数（用于分批渲染，避免一次性渲染大量节点卡顿）
  const [materializeCount, setMaterializeCount] = useState(0);
  const materializeCountRef = useRef(0);

  // 力导向模拟状态
  const simNodesRef = useRef<SimNode[]>([]);
  const edgeListRef = useRef<GraphEdge[]>([]);
  const workerRef = useRef<Worker | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rotatingRef = useRef<{ x: number; y: number } | null>(null);
  const draggingNodeRef = useRef<SimNode | null>(null);
  // 拖拽时记录上一帧鼠标位置，用于计算增量并做逆旋转变换
  const lastDragMouseRef = useRef<{ x: number; y: number } | null>(null);
  const mouseDownPosRef = useRef<{ x: number; y: number } | null>(null);
  // drawCanvas 的 ref，供 worker 消息回调调用，避免闭包过期
  const drawCanvasRef = useRef<() => void>(() => {});
  // 背景预渲染 canvas（避免每帧重绘 40 个光点）
  const bgCanvasRef = useRef<HTMLCanvasElement | null>(null);
  // worker tick 渲染合并标记（同一帧只渲染一次）
  const rafPendingRef = useRef(false);

  // ---- 数据加载 ----
  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/memory");
      if (!res.ok) throw new Error("加载失败");
      const data = await res.json();
      setNodes(data.nodes || []);
      setEdges(data.edges || []);
      setStats((prev) => data.stats || prev);
    } catch {
      setLoadError("加载记忆图谱失败，请重试");
      toast("加载图谱失败", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/memory");
        if (!mounted) return;
        if (!res.ok) throw new Error("加载失败");
        const data = await res.json();
        setNodes(data.nodes || []);
        setEdges(data.edges || []);
        setStats((prev) => data.stats || prev);
      } catch {
        if (mounted) {
          setLoadError("加载记忆图谱失败，请重试");
          toast("加载图谱失败", "error");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // ---- 创建 Web Worker ----
  useEffect(() => {
    if (typeof window === "undefined") return;
    let worker: Worker;
    try {
      worker = new Worker(
        new URL("../../workers/force-simulation.worker.ts", import.meta.url)
      );
    } catch {
      toast("创建力导向 Worker 失败", "error");
      return;
    }
    workerRef.current = worker;

    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const msg = e.data;
      switch (msg.type) {
        case "ready":
          break;
        case "tick": {
          // 更新主线程的节点位置，仅做 Canvas 渲染
          const positions = new Map(msg.nodes.map((p) => [p.id, p]));
          for (const n of simNodesRef.current) {
            const p = positions.get(n.id);
            if (p) {
              n.x = p.x;
              n.y = p.y;
              n.z = p.z;
            }
          }
          // 用 rAF 合并渲染请求，同一帧只渲染一次
          if (!rafPendingRef.current) {
            rafPendingRef.current = true;
            requestAnimationFrame(() => {
              rafPendingRef.current = false;
              drawCanvasRef.current();
            });
          }
          break;
        }
        case "settled":
          setSimulating(false);
          break;
      }
    };

    worker.onerror = () => {
      // Worker 运行时错误，已降级为静态渲染
    };

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  // ---- 过滤（时间范围，使用真实 createdAt） ----
  const filteredNodes = useMemo(() => {
    if (timeRange === "all") return nodes;
    const days = parseInt(timeRange, 10);
    return nodes.filter((n) => daysAgoOf(n) < days);
  }, [nodes, timeRange]);

  const filteredEdges = useMemo(() => {
    const ids = new Set(filteredNodes.map((n) => n.id));
    return edges.filter((e) => ids.has(e.from) && ids.has(e.to));
  }, [edges, filteredNodes]);

  // ---- 聚类 ----
  const clusters = useMemo(
    () => computeClusters(filteredNodes, filteredEdges),
    [filteredNodes, filteredEdges]
  );

  // ---- 聚焦子图：聚焦节点 + 其直接连接节点 + 它们之间的边 ----
  const focusSubgraph = useMemo(() => {
    if (!focusNodeId) return null;
    const center = nodes.find((n) => n.id === focusNodeId);
    if (!center) return null;
    const connectedIds = new Set<string>([focusNodeId, ...(Array.isArray(center.connections) ? center.connections : [])]);
    const subNodes = nodes.filter((n) => connectedIds.has(n.id));
    const subEdges = edges.filter(
      (e) => connectedIds.has(e.from) && connectedIds.has(e.to)
    );
    return { center, subNodes, subEdges };
  }, [focusNodeId, nodes, edges]);

  // ---- 初始化 3D 力导向模拟 ----
  const initSimulation = useCallback((nodeList: GraphNode[], edgeList: GraphEdge[]) => {
    simNodesRef.current = nodeList.map((n) => {
      // 在球面上均匀分布初始位置，赋予 z 坐标
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const radius = 90 + Math.random() * 130;
      return {
        id: n.id,
        x: WIDTH / 2 + Math.sin(phi) * Math.cos(theta) * radius,
        y: HEIGHT / 2 + Math.sin(phi) * Math.sin(theta) * radius,
        z: Math.cos(phi) * radius,
        vx: 0,
        vy: 0,
        vz: 0,
        // 节点基础半径：由强度决定，clamp 到 [8, 24]
        r: Math.max(8, Math.min(24, 8 + n.strength * 1.5)),
        data: n,
      };
    });
    edgeListRef.current = edgeList;
    setSimulating(true);

    // 发送 init 到 Worker，启动力导向计算
    const worker = workerRef.current;
    if (worker) {
      const initNodes: WorkerInitNode[] = simNodesRef.current.map((n) => ({
        id: n.id,
        x: n.x,
        y: n.y,
        z: n.z,
        vx: n.vx,
        vy: n.vy,
        vz: n.vz,
        fx: null,
        fy: null,
        fz: null,
        r: n.r,
        data: null,
      }));
      worker.postMessage({
        type: "init",
        nodes: initNodes,
        edges: edgeList,
      } satisfies WorkerMessage);
    }
  }, []);

  // 过滤数据/聚焦变化时重建模拟
  useEffect(() => {
    if (focusSubgraph) {
      // 聚焦模式：使用子图节点和边
      initSimulation(focusSubgraph.subNodes, focusSubgraph.subEdges);
      return;
    }
    if (filteredNodes.length === 0) {
      simNodesRef.current = [];
      edgeListRef.current = [];
      return;
    }
    initSimulation(filteredNodes, filteredEdges);
  }, [filteredNodes, filteredEdges, initSimulation, focusSubgraph]);

  // 增量渲染：节点逐步显现（分批渲染，每帧增加若干节点，营造高级感的"物质化"效果）
  useEffect(() => {
    const total = filteredNodes.length;
    if (total === 0) {
      setMaterializeCount(0);
      materializeCountRef.current = 0;
      return;
    }
    setMaterializeCount(0);
    materializeCountRef.current = 0;
    let raf = 0;
    const step = Math.max(3, Math.ceil(total / 20)); // 约 20 帧完成显现
    const tick = () => {
      materializeCountRef.current = Math.min(
        total,
        materializeCountRef.current + step
      );
      setMaterializeCount(materializeCountRef.current);
      if (materializeCountRef.current < total) {
        raf = requestAnimationFrame(tick);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [filteredNodes]);

  // ---- 控制 Worker 模拟的启停 ----
  useEffect(() => {
    const worker = workerRef.current;
    if (!worker) return;
    worker.postMessage({
      type: simulating ? "resume" : "stop",
    } satisfies WorkerMessage);
  }, [simulating]);

  const rebuild = async () => {
    try {
      setRebuilding(true);
      const res = await fetch("/api/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: false }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "重建失败");
      }
      const data = await res.json();
      await load();
      toast(`重建完成：${data.total} 节点，${data.edges} 条边（${data.mode}）`, "success");
    } catch (e: any) {
      toast(e.message || "重建失败", "error");
    } finally {
      setRebuilding(false);
    }
  };

  // 同步 Hermes 记忆：双向同步 Hermes ↔ 奇思，完成后重新加载图谱
  const syncHermes = async () => {
    try {
      setSyncingHermes(true);
      const res = await fetch("/api/hermes/memory/sync", { method: "POST" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "同步失败");
      }
      const data = await res.json();
      await load();
      toast(
        `Hermes 记忆同步完成：导入 ${data.imported} 条，导出 ${data.exported} 条${
          data.skipped ? `，跳过 ${data.skipped} 条` : ""
        }`,
        "success"
      );
    } catch (e: any) {
      toast(e.message || "Hermes 记忆同步失败", "error");
    } finally {
      setSyncingHermes(false);
    }
  };

  // ---- 删除记忆 ----
  const handleDelete = useCallback(
    async (id: string) => {
      setDeletingId(id);
      try {
        const res = await runAsync("删除记忆", fetch(`/api/memory/${id}`, { method: "DELETE" }));
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error || "删除失败");
        }
        toast("记忆已删除", "success");
        if (selectedId === id) {
          setSelectedId(null);
          setExpandedId(null);
        }
        await load();
      } catch (e: any) {
        toast(e.message || "删除失败", "error");
      } finally {
        setDeletingId(null);
      }
    }, [load, selectedId, runAsync]
  );

  // ---- 编辑记忆标签 ----
  const handleEditSave = useCallback(async () => {
    if (!editingId) return;
    try {
      const res = await fetch(`/api/memory/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: editingLabel }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "编辑失败");
      }
      toast("标签已更新", "success");
      setEditingId(null);
      setEditingLabel("");
      await load();
    } catch (e: any) {
      toast(e.message || "编辑失败", "error");
    }
  }, [editingId, editingLabel, load]);

  // ---- 从列表聚焦节点：选中并重置视角使其清晰可见 ----
  const focusNode = useCallback((id: string) => {
    setSelectedId(id);
    setRotX(-0.32);
    setRotY(0.42);
    setScale(1);
  }, []);

  // ---- 派生数据 ----
  const selectedNode = filteredNodes.find((n) => n.id === selectedId) || null;
  const hoveredNode = filteredNodes.find((n) => n.id === hoveredId) || null;
  const activeNode = selectedNode || hoveredNode;
  const activeIds = useMemo(() => {
    return activeNode
      ? new Set<string>([activeNode.id, ...(Array.isArray(activeNode.connections) ? activeNode.connections : [])])
      : null;
  }, [activeNode]);

  // 二级关联（双击展开）
  const expandedNode = expandedId ? filteredNodes.find((n) => n.id === expandedId) : null;
  const secondaryIds = useMemo(() => {
    if (!expandedNode) return new Set<string>();
    const expandedConns = Array.isArray(expandedNode.connections) ? expandedNode.connections : [];
    const direct = new Set(expandedConns);
    const secondary = new Set<string>();
    for (const cid of expandedConns) {
      const c = filteredNodes.find((n) => n.id === cid);
      if (c) {
        const cConns = Array.isArray(c.connections) ? c.connections : [];
        for (const scid of cConns) {
          if (scid !== expandedNode.id && !direct.has(scid)) {
            secondary.add(scid);
          }
        }
      }
    }
    return secondary;
  }, [expandedNode, filteredNodes]);

  const highlightIds = useMemo(() => {
    const s = new Set<string>();
    if (activeIds) activeIds.forEach((x) => s.add(x));
    if (expandedNode) {
      s.add(expandedNode.id);
      (Array.isArray(expandedNode.connections) ? expandedNode.connections : []).forEach((c) => s.add(c));
      secondaryIds.forEach((c) => s.add(c));
    }
    return s;
  }, [activeIds, expandedNode, secondaryIds]);

  // 获取节点的 HSL 分量（考虑聚类）
  const nodeHSL = useCallback(
    (n: GraphNode): { h: number; s: number; l: number } => {
      if (clustering) {
        const idx = clusters.nodeCluster.get(n.id) ?? 0;
        return clusterHSL(n.type, idx);
      }
      return TYPE_HSL[n.type];
    },
    [clustering, clusters]
  );

  // 获取节点的纯色字符串（用于图例、列表图标）
  const nodeColor = useCallback(
    (n: GraphNode): string => {
      const { h, s, l } = nodeHSL(n);
      return `hsl(${h}, ${s}%, ${l}%)`;
    },
    [nodeHSL]
  );

  // ---- 3D 投影计算（供 Canvas 绘制和命中检测共用） ----
  const computeProjection = useCallback(() => {
    const simNodes = simNodesRef.current;
    const cosY = Math.cos(rotY);
    const sinY = Math.sin(rotY);
    const cosX = Math.cos(rotX);
    const sinX = Math.sin(rotX);
    const cx = WIDTH / 2;
    const cy = HEIGHT / 2;

    const projected = simNodes.map((n) => {
      const x = n.x - cx;
      const y = n.y - cy;
      const z = n.z;
      const x1 = x * cosY + z * sinY;
      const z1 = -x * sinY + z * cosY;
      const y1 = y * cosX - z1 * sinX;
      const z2 = y * sinX + z1 * cosX;
      const denom = FOCAL - z2;
      const s = denom > 60 ? FOCAL / denom : FOCAL / 60;
      return { node: n, sx: cx + x1 * s, sy: cy + y1 * s, depth: z2, scale: s };
    });
    // 画家算法：远的先画
    projected.sort((a, b) => a.depth - b.depth);
    return projected;
  }, [rotX, rotY]);

  // ---- 背景预渲染：将 40 个光点一次性绘制到 offscreen canvas，避免每帧重绘 ----
  useEffect(() => {
    if (typeof document === "undefined") return;
    const off = document.createElement("canvas");
    off.width = WIDTH;
    off.height = HEIGHT;
    const octx = off.getContext("2d");
    if (!octx) return;
    octx.fillStyle = BG_COLOR;
    octx.fillRect(0, 0, WIDTH, HEIGHT);
    for (let i = 0; i < 40; i++) {
      // 用确定性伪随机，避免每帧抖动
      const seed = i * 9301 + 49297;
      const px = ((seed % 233280) / 233280) * WIDTH;
      const py = (((seed * 7) % 233280) / 233280) * HEIGHT;
      const pr = 0.5 + (((seed * 13) % 100) / 100) * 1.5;
      octx.beginPath();
      octx.arc(px, py, pr, 0, Math.PI * 2);
      octx.fillStyle = "rgba(148,163,184,0.12)";
      octx.fill();
    }
    bgCanvasRef.current = off;
  }, []);

  // ---- Canvas 绘制（大脑神经元网络风格） ----
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // ---- 高清屏适配（DPR）：解决文字与圆圈模糊/变形的核心 ----
    const dpr = window.devicePixelRatio || 1;
    const cssW = WIDTH;
    const cssH = HEIGHT;
    if (
      canvas.width !== Math.round(cssW * dpr) ||
      canvas.height !== Math.round(cssH * dpr)
    ) {
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
    }
    if (canvas.style.width !== cssW + "px") canvas.style.width = cssW + "px";
    if (canvas.style.height !== cssH + "px") canvas.style.height = cssH + "px";
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    // ---- 浅色背景（从预渲染的 offscreen canvas 一次绘制，避免每帧重绘 40 个光点） ----
    const bg = bgCanvasRef.current;
    if (bg) {
      ctx.drawImage(bg, 0, 0, WIDTH, HEIGHT);
    } else {
      ctx.fillStyle = BG_COLOR;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    }

    const allProjected = computeProjection();
    if (allProjected.length === 0) return;

    // 增量渲染：仅渲染前 materializeCount 个节点（已按深度排序，远的先显现）
    const matCount = materializeCountRef.current;
    const projected =
      matCount > 0 && matCount < allProjected.length
        ? allProjected.slice(0, matCount)
        : allProjected;
    const fadeInStart = Math.max(0, projected.length - 5);

    const projMap = new Map(projected.map((p) => [p.node.id, p]));
    const edgeList = edgeListRef.current;

    // 应用缩放（用户放大/缩小）
    ctx.save();
    ctx.translate(WIDTH / 2, HEIGHT / 2);
    ctx.scale(scale, scale);
    ctx.translate(-WIDTH / 2, -HEIGHT / 2);

    // ---- 绘制边（贝塞尔曲线，像神经元突触） ----
    for (const edge of edgeList) {
      const from = projMap.get(edge.from);
      const to = projMap.get(edge.to);
      if (!from || !to) continue;
      const isActive =
        highlightIds.has(edge.from) && highlightIds.has(edge.to);
      // 控制点：在连线中点做垂直偏移，形成柔和弧线
      const midX = (from.sx + to.sx) / 2;
      const midY = (from.sy + to.sy) / 2;
      const dx = to.sx - from.sx;
      const dy = to.sy - from.sy;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const offset = Math.min(18, dist * 0.12);
      const cpx = midX + (-dy / dist) * offset;
      const cpy = midY + (dx / dist) * offset;

      ctx.beginPath();
      ctx.moveTo(from.sx, from.sy);
      ctx.quadraticCurveTo(cpx, cpy, to.sx, to.sy);
      if (isActive) {
        // 高亮时使用节点颜色
        const { h, s, l } = nodeHSL(from.node.data);
        ctx.strokeStyle = `hsla(${h}, ${s}%, ${l}%, 0.7)`;
        ctx.lineWidth = 1.8;
      } else {
        ctx.strokeStyle = "rgba(100,116,139,0.3)";
        ctx.lineWidth = 1;
      }
      ctx.stroke();
    }

    // ---- 绘制节点（神经元细胞体） ----
    // 性能优化：普通节点用纯色填充，仅选中/悬停/展开/聚焦中心节点使用径向渐变 + 阴影
    for (let nodeIdx = 0; nodeIdx < projected.length; nodeIdx++) {
      const p = projected[nodeIdx];
      const { node } = p;
      const isSelected = node.id === selectedId;
      const isHovered = node.id === hoveredId;
      const isExpanded = node.id === expandedId;
      const isFocusCenter = focusNodeId === node.id;
      const useGradient = isSelected || isHovered || isExpanded || isFocusCenter;
      const { h, s, l } = nodeHSL(node.data);
      const depthNorm = (p.depth + Z_RANGE) / (2 * Z_RANGE);
      let opacity = Math.max(0.6, Math.min(1, 0.7 + depthNorm * 0.3));
      // 增量渲染淡入：最近显现的节点逐渐变清晰
      if (nodeIdx >= fadeInStart) {
        const fadeProgress = (nodeIdx - fadeInStart + 1) / 5;
        opacity *= Math.max(0.3, fadeProgress);
      }

      // 节点半径：基础半径（由强度决定）× 透视缩放（保留 3D 近大远小）
      const baseR = Math.max(8, Math.min(24, 8 + node.data.strength * 1.5));
      const r = baseR * p.scale;
      // 选中/悬停/展开/聚焦中心时放大（神经元呼吸感）
      const nodeR = isSelected
        ? r * 1.2
        : isHovered || isExpanded || isFocusCenter
        ? r * 1.12
        : r;

      ctx.globalAlpha = opacity;

      if (useGradient) {
        // ---- 径向渐变填充：模拟神经元细胞体的立体感（仅高亮节点） ----
        const grad = ctx.createRadialGradient(
          p.sx - nodeR * 0.35,
          p.sy - nodeR * 0.35,
          nodeR * 0.1,
          p.sx,
          p.sy,
          Math.max(0.1, nodeR)
        );
        grad.addColorStop(0, `hsla(${h}, ${s}%, ${Math.min(85, l + 12)}%, 0.95)`);
        grad.addColorStop(0.65, `hsla(${h}, ${s}%, ${l}%, 0.75)`);
        grad.addColorStop(1, `hsla(${h}, ${s}%, ${l}%, 0.4)`);

        // 柔和阴影（光晕）
        ctx.shadowColor = `hsla(${h}, ${s}%, ${l}%, ${
          isSelected ? 0.55 : isHovered || isFocusCenter ? 0.4 : 0.25
        })`;
        ctx.shadowBlur = isSelected ? 18 : isHovered || isExpanded || isFocusCenter ? 13 : 8;

        ctx.beginPath();
        ctx.arc(p.sx, p.sy, Math.max(0.1, nodeR), 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        // 清除阴影，避免影响后续绘制
        ctx.shadowBlur = 0;
      } else {
        // ---- 普通节点：纯色填充 + 半透明描边，无阴影 ----
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, Math.max(0.1, nodeR), 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${h}, ${s}%, ${l}%, 0.85)`;
        ctx.fill();
      }

      // 描边：选中加粗，悬停/展开/聚焦中心轻微
      if (isSelected) {
        ctx.strokeStyle = `hsl(${h}, ${s}%, ${Math.max(35, l - 25)}%)`;
        ctx.lineWidth = 2.5;
        ctx.stroke();
      } else if (isHovered || isExpanded || isFocusCenter) {
        ctx.strokeStyle = `hsla(${h}, ${s}%, ${l}%, 0.7)`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // ---- 文字标签：深色文字 + 白色描边，浅色背景下清晰可读 ----
      // 优先使用独立 label，为空时回退到 fullContent 前 20 字符
      const rawLabel = node.data.label || node.data.fullContent.slice(0, 20);
      const label = rawLabel.length > 14 ? rawLabel.slice(0, 14) + "…" : rawLabel;
      const textY = p.sy + nodeR + 14;
      ctx.font =
        "600 13px -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineJoin = "round";
      // 白色描边提升对比度
      ctx.strokeStyle = "rgba(255,255,255,0.92)";
      ctx.lineWidth = 3.5;
      ctx.strokeText(label, p.sx, textY);
      // 深色填充
      ctx.fillStyle = "#1e293b";
      ctx.fillText(label, p.sx, textY);

      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }, [
    computeProjection,
    scale,
    selectedId,
    hoveredId,
    expandedId,
    focusNodeId,
    highlightIds,
    nodeHSL,
  ]);

  // 同步 drawCanvas 到 ref，供 worker 消息回调调用
  useEffect(() => {
    drawCanvasRef.current = drawCanvas;
  }, [drawCanvas]);

  // 状态变化时重绘（非动画状态下的旋转、选中、悬停等）
  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  // 增量渲染：materializeCount 变化时触发重绘（显现新节点）
  useEffect(() => {
    drawCanvasRef.current();
  }, [materializeCount]);

  // 窗口尺寸/DPR 变化时重新应用高清适配并重绘
  useEffect(() => {
    const onResize = () => drawCanvasRef.current();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // ---- 滚轮缩放（用原生 listener 以便 preventDefault 阻止页面滚动） ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.12 : 0.12;
      setScale((s) => Math.max(0.3, Math.min(3, s + delta * s)));
    };
    canvas.addEventListener("wheel", handler, { passive: false });
    return () => canvas.removeEventListener("wheel", handler);
  }, []);

  // ---- 命中检测：返回鼠标位置下的节点 ----
  const hitTest = useCallback(
    (mx: number, my: number): SimNode | null => {
      const projected = computeProjection();
      // 从前到后检测（深度大的在前）
      for (let i = projected.length - 1; i >= 0; i--) {
        const p = projected[i];
        const r = p.node.r * p.scale;
        const dx = mx - p.sx;
        const dy = my - p.sy;
        if (dx * dx + dy * dy <= r * r) {
          return p.node;
        }
      }
      return null;
    },
    [computeProjection]
  );

  // ---- 鼠标坐标转换（CSS 坐标 → Canvas 内部坐标） ----
  const toCanvasCoords = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * WIDTH;
    const y = ((e.clientY - rect.top) / rect.height) * HEIGHT;
    return { x, y };
  }, []);

  // ---- 鼠标交互（Canvas 版） ----
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      mouseDownPosRef.current = { x: e.clientX, y: e.clientY };
      const { x, y } = toCanvasCoords(e);
      const hit = hitTest(x, y);
      if (hit) {
        // 开始拖拽节点
        draggingNodeRef.current = hit;
        lastDragMouseRef.current = { x: e.clientX, y: e.clientY };
        // 拖拽时暂停模拟
        if (simulating) setSimulating(false);
        // 通知 Worker 固定该节点
        workerRef.current?.postMessage({
          type: "drag-start",
          id: hit.id,
        } satisfies WorkerMessage);
      } else {
        // 开始旋转
        rotatingRef.current = { x: e.clientX, y: e.clientY };
      }
    },
    [hitTest, toCanvasCoords, simulating]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const dragging = draggingNodeRef.current;
      const rotating = rotatingRef.current;
      if (dragging) {
        // ---- 拖拽节点：通过逆旋转变换将屏幕增量映射到世界坐标 ----
        const last = lastDragMouseRef.current;
        if (last) {
          const canvas = canvasRef.current;
          const rect = canvas?.getBoundingClientRect();
          // 屏幕像素增量 → Canvas 逻辑坐标增量
          const rectW = rect?.width || WIDTH;
          const rectH = rect?.height || HEIGHT;
          const dmxScreen = e.clientX - last.x;
          const dmyScreen = e.clientY - last.y;
          const dmx = (dmxScreen / rectW) * WIDTH;
          const dmy = (dmyScreen / rectH) * HEIGHT;
          // 去除用户缩放
          const sDmx = dmx / scale;
          const sDmy = dmy / scale;

          // 计算该节点当前深度的透视缩放 s，用于还原投影前的增量
          const cosY = Math.cos(rotY);
          const sinY = Math.sin(rotY);
          const cosX = Math.cos(rotX);
          const sinX = Math.sin(rotX);
          const cx = WIDTH / 2;
          const cy = HEIGHT / 2;
          const wx = dragging.x - cx;
          const wy = dragging.y - cy;
          const wz = dragging.z;
          const z1 = -wx * sinY + wz * cosY;
          const z2 = wy * sinX + z1 * cosX;
          const denom = FOCAL - z2;
          const persp = denom > 60 ? FOCAL / denom : FOCAL / 60;

          // 去除透视缩放，得到旋转后坐标系的增量
          const projDx = sDmx / persp;
          const projDy = sDmy / persp;

          // 逆旋转：保持 z 不变，仅求解 world dx/dy
          // 正向（dz=0）：projDx = dx*cosY，projDy = dy*cosX + dx*sinY*sinX
          // 逆：dx = projDx / cosY，dy = (projDy - dx*sinY*sinX) / cosX
          const worldDx = Math.abs(cosY) > 1e-4 ? projDx / cosY : 0;
          const worldDy =
            Math.abs(cosX) > 1e-4
              ? (projDy - worldDx * sinY * sinX) / cosX
              : 0;

          dragging.x += worldDx;
          dragging.y += worldDy;
          dragging.vx = 0;
          dragging.vy = 0;
          // z 保持不变

          workerRef.current?.postMessage({
            type: "drag-move",
            id: dragging.id,
            x: dragging.x,
            y: dragging.y,
            z: dragging.z,
          } satisfies WorkerMessage);
        }
        lastDragMouseRef.current = { x: e.clientX, y: e.clientY };
        drawCanvas();
        return;
      }
      if (rotating) {
        // 旋转图谱
        const dx = e.clientX - rotating.x;
        const dy = e.clientY - rotating.y;
        rotating.x = e.clientX;
        rotating.y = e.clientY;
        setRotY((v) => v + dx * 0.006);
        setRotX((v) => Math.max(-1.3, Math.min(1.3, v - dy * 0.006)));
        return;
      }
      // 悬停检测
      const { x, y } = toCanvasCoords(e);
      const hit = hitTest(x, y);
      const hitId = hit?.id ?? null;
      setHoveredId((prev) => (prev !== hitId ? hitId : prev));
    },
    [hitTest, toCanvasCoords, drawCanvas, scale, rotX, rotY]
  );

  const handleMouseUp = useCallback(() => {
    if (draggingNodeRef.current) {
      workerRef.current?.postMessage({
        type: "drag-end",
        id: draggingNodeRef.current.id,
      } satisfies WorkerMessage);
    }
    draggingNodeRef.current = null;
    lastDragMouseRef.current = null;
    rotatingRef.current = null;
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (draggingNodeRef.current) {
      workerRef.current?.postMessage({
        type: "drag-end",
        id: draggingNodeRef.current.id,
      } satisfies WorkerMessage);
    }
    draggingNodeRef.current = null;
    lastDragMouseRef.current = null;
    rotatingRef.current = null;
    setHoveredId(null);
  }, []);

  // 点击节点：进入/退出/切换聚焦模式（同时选中显示详情）
  // 区分拖拽和点击：mousedown 和 mouseup 之间无明显移动才视为点击
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!mouseDownPosRef.current) return;
      const dx = e.clientX - mouseDownPosRef.current.x;
      const dy = e.clientY - mouseDownPosRef.current.y;
      if (dx * dx + dy * dy > 25) return;
      const { x, y } = toCanvasCoords(e);
      const hit = hitTest(x, y);
      if (hit) {
        // 聚焦模式：点击当前聚焦节点 → 退出；点击其他节点 → 进入/切换聚焦
        if (focusNodeId === hit.id) {
          setFocusNodeId(null);
        } else {
          setFocusNodeId(hit.id);
        }
        // 同时选中以显示右侧详情
        setSelectedId(hit.id);
      } else {
        setSelectedId(null);
      }
    },
    [hitTest, toCanvasCoords, focusNodeId]
  );

  // 双击节点：聚焦模式下递归聚焦到该节点；非聚焦模式下展开二级关联
  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      const { x, y } = toCanvasCoords(e);
      const hit = hitTest(x, y);
      if (hit) {
        setSelectedId(hit.id);
        if (focusNodeId) {
          // 聚焦模式下：切换聚焦到新节点（递归进入其子图谱）
          setFocusNodeId(hit.id);
          setExpandedId(null);
        } else {
          // 非聚焦模式下：展开/收起二级关联
          setExpandedId((prev) => (prev === hit.id ? null : hit.id));
        }
      }
    },
    [hitTest, toCanvasCoords, focusNodeId]
  );

  // ---- 记忆列表：搜索 + 类型筛选 + 排序 ----
  const listNodes = useMemo(() => {
    let list = filteredNodes;
    // 类型筛选
    if (filterType !== "all") {
      list = list.filter((n) => n.type === filterType);
    }
    // 关键词搜索
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (n) =>
          n.label.toLowerCase().includes(q) ||
          n.fullContent.toLowerCase().includes(q)
      );
    }
    // 排序
    list = [...list];
    if (sortBy === "time") {
      list.sort((a, b) => {
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return tb - ta;
      });
    } else if (sortBy === "connections") {
      list.sort((a, b) => (Array.isArray(b.connections) ? b.connections.length : 0) - (Array.isArray(a.connections) ? a.connections.length : 0));
    } else if (sortBy === "type") {
      const order: Record<GraphNode["type"], number> = {
        idea: 0,
        conversation: 1,
        cognition: 2,
        hermes: 3,
      };
      list.sort((a, b) => order[a.type] - order[b.type]);
    }
    return list;
  }, [filteredNodes, filterType, searchQuery, sortBy]);

  // ---- 批量管理 ----
  // 孤立节点（无连接），用于"全选孤立"快捷操作
  const orphanNodes = useMemo(
    () => nodes.filter((n) => !Array.isArray(n.connections) || n.connections.length === 0),
    [nodes]
  );

  // 切换某个节点的选中状态
  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // 全选当前列表中可见的节点（受搜索/筛选影响）
  const selectAllVisible = useCallback(() => {
    setSelectedIds(new Set(listNodes.map((n) => n.id)));
  }, [listNodes]);

  // 全选孤立节点（无连接的节点，适合清理测试数据）
  const selectOrphans = useCallback(() => {
    setSelectedIds(new Set(orphanNodes.map((n) => n.id)));
  }, [orphanNodes]);

  // 清空选择
  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // 进入/退出批量管理模式
  const toggleBatchMode = useCallback(() => {
    setBatchMode((b) => !b);
    setSelectedIds(new Set());
  }, []);

  // 批量删除选中的记忆节点
  const handleBatchDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setShowBatchConfirm(false);
    setBatchDeleting(true);
    try {
      const ids = Array.from(selectedIds);
      const res = await runAsync(
        `批量删除 ${ids.length} 个记忆`,
        fetch("/api/memory/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids }),
        })
      );
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "批量删除失败");
      }
      const data = await res.json();
      toast(`已删除 ${data.deleted} 个记忆（请求 ${data.requested}）`, "success");
      setSelectedIds(new Set());
      setBatchMode(false);
      await load();
    } catch (e: any) {
      toast(e.message || "批量删除失败", "error");
    } finally {
      setBatchDeleting(false);
    }
  }, [selectedIds, runAsync, load]);

  // 列表分页（客户端）
  const {
    page,
    pageSize,
    total: listTotal,
    paginated,
    onPageChange,
    onPageSizeChange,
  } = useClientPagination(listNodes, 10);

  const editingNode = editingId
    ? filteredNodes.find((n) => n.id === editingId) || nodes.find((n) => n.id === editingId) || null
    : null;

  return (
    <div className="p-4 sm:p-8">
      <PageHeader
        title="记忆图谱"
        subtitle={`${stats.total} 节点 · ${stats.edges} 关联 · ${stats.mode === "ai-embedding" ? "AI 向量" : "TF-IDF 降级"} · 3D 力导向布局`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {/* 时间范围选择器 */}
            <div className="flex items-center gap-1 rounded-xl border border-border bg-card p-0.5">
              <Calendar className="ml-1.5 h-3.5 w-3.5 text-muted-foreground" />
              {TIME_RANGES.map((r) => (
                <button
                  key={r.key}
                  onClick={() => setTimeRange(r.key)}
                  className={cn(
                    "rounded-lg px-2 py-1 text-[11px] font-medium transition-colors",
                    timeRange === r.key
                      ? "bg-cognition/10 text-cognition"
                      : "text-muted-foreground hover:bg-primary/10 hover:text-foreground"
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <Button
              onClick={toggleBatchMode}
              variant={batchMode ? "primary" : "outline"}
            >
              <CheckSquare className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{batchMode ? "退出批量" : "批量管理"}</span>
            </Button>
            <Button onClick={() => setShowHelp(true)} variant="ghost">
              <HelpCircle className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">说明</span>
            </Button>
            <Button onClick={syncHermes} disabled={syncingHermes || rebuilding}>
              <RefreshCw className={`h-3.5 w-3.5 ${syncingHermes ? "animate-spin" : ""}`} />
              {syncingHermes ? "同步中..." : "同步 Hermes 记忆"}
            </Button>
            <Button onClick={rebuild} disabled={rebuilding || syncingHermes}>
              <Database className={`h-3.5 w-3.5 ${rebuilding ? "animate-pulse" : ""}`} />
              {rebuilding ? "重建中..." : "重建图谱"}
            </Button>
            <HelpButton contentKey="memory" />
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* 左侧 3D 图谱（占 2/3 宽度） */}
        <Card className="col-span-1 overflow-x-auto p-0 lg:col-span-2">
          {loadError && !loading ? (
            <div className="flex h-[540px] items-center justify-center">
              <RetryState
                message={loadError}
                onRetry={() => void load()}
              />
            </div>
          ) : loading ? (
            <div className="flex h-[540px] flex-col items-center justify-center gap-3">
              <Skeleton className="h-64 w-64 rounded-full" />
              <span className="text-xs text-muted-foreground">正在构建 3D 记忆图谱...</span>
            </div>
          ) : filteredNodes.length === 0 ? (
            <div className="flex h-[540px] flex-col items-center justify-center">
              <Brain className="mb-3 h-10 w-10 opacity-40" />
              <p className="text-sm text-muted-foreground">当前范围暂无记忆数据</p>
              <p className="mt-1 text-xs text-muted-foreground/60">切换时间范围或点击「重建图谱」</p>
            </div>
          ) : (
            <div
              className="relative mx-auto"
              style={{ width: WIDTH, height: HEIGHT }}
            >
              <canvas
                ref={canvasRef}
                style={{ width: WIDTH, height: HEIGHT, display: "block" }}
                className="cursor-grab select-none active:cursor-grabbing"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseLeave}
                onClick={handleClick}
                onDoubleClick={handleDoubleClick}
              />

              {/* 图例 */}
              <div className="absolute left-3 top-3 rounded-xl border border-border bg-card/90 p-2.5 text-[10px] backdrop-blur">
                <div className="mb-1 font-semibold text-foreground/80">图例</div>
                <div className="space-y-1 text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-2 w-2 rounded-full" style={{ background: "hsl(25,95%,55%)" }} />灵感
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-2 w-2 rounded-full" style={{ background: "hsl(0,0%,45%)" }} />对话
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-2 w-2 rounded-full" style={{ background: "hsl(30,80%,40%)" }} />认知
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-2 w-2 rounded-full" style={{ background: "hsl(160,70%,45%)" }} />Hermes
                  </span>
                  {clustering && (
                    <div className="mt-1 border-t border-border pt-1 text-[9px] text-cognition">
                      聚类 {clusters.count} 组
                    </div>
                  )}
                  {expandedNode && (
                    <div className="mt-1 border-t border-border pt-1 text-[9px] text-cognition">
                      二级关联 {secondaryIds.size}
                    </div>
                  )}
                </div>
              </div>

              {/* 聚焦模式提示条 */}
              {focusNodeId && focusSubgraph && (
                <div className="absolute left-1/2 top-3 flex -translate-x-1/2 items-center gap-2 rounded-xl border border-cognition/40 glass-card px-3 py-1.5 text-[11px] shadow-lg backdrop-blur">
                  <button
                    onClick={() => setFocusNodeId(null)}
                    className="flex items-center gap-1 font-medium text-cognition transition-colors hover:text-cognition/80"
                    aria-label="返回全图"
                  >
                    <ArrowLeft className="h-3 w-3" />
                    返回全图
                  </button>
                  <span className="text-muted-foreground/60">|</span>
                  <span className="font-medium text-foreground">
                    聚焦：{focusSubgraph.center.label.length > 12
                      ? focusSubgraph.center.label.slice(0, 12) + "…"
                      : focusSubgraph.center.label}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {focusSubgraph.subNodes.length} 节点 · {focusSubgraph.subEdges.length} 边
                  </span>
                </div>
              )}

              {/* 控制按钮 */}
              <div className="absolute right-3 top-3 flex flex-col gap-1">
                <button
                  onClick={() => setScale((s) => Math.min(s + 0.2, 2))}
                  className="flex h-7 w-7 items-center justify-center rounded-lg glass-card text-muted-foreground shadow-sm backdrop-blur hover:bg-primary/10"
                  aria-label="放大"
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setScale((s) => Math.max(s - 0.2, 0.5))}
                  className="flex h-7 w-7 items-center justify-center rounded-lg glass-card text-muted-foreground shadow-sm backdrop-blur hover:bg-primary/10"
                  aria-label="缩小"
                >
                  <ZoomOut className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => {
                    setRotX(-0.32);
                    setRotY(0.42);
                    setScale(1);
                    if (focusNodeId) {
                      // 聚焦模式下：退出聚焦，由 useEffect 重建为全图
                      setFocusNodeId(null);
                    } else {
                      initSimulation(filteredNodes, filteredEdges);
                    }
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded-lg glass-card text-muted-foreground shadow-sm backdrop-blur hover:bg-primary/10"
                  aria-label="重置视角"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setSimulating((s) => !s)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg glass-card text-muted-foreground shadow-sm backdrop-blur hover:bg-primary/10"
                  aria-label={simulating ? "暂停" : "播放"}
                >
                  {simulating ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                </button>
                <button
                  onClick={() => setClustering((c) => !c)}
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-lg border shadow-sm backdrop-blur",
                    clustering
                      ? "border-cognition bg-cognition/15 text-cognition"
                      : "border-border bg-card/90 text-muted-foreground hover:bg-primary/10"
                  )}
                  aria-label="聚类开关"
                >
                  <Layers className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* 操作提示 */}
              <div className="absolute bottom-3 left-3 rounded-lg border border-border bg-card/80 px-2 py-1 text-[10px] text-muted-foreground backdrop-blur">
                拖拽空白旋转 · 拖拽节点移动 · 滚轮缩放 · 点击聚焦子图 · 双击展开二级关联
              </div>
            </div>
          )}
        </Card>

        {/* 右侧记忆列表管理面板（占 1/3 宽度） */}
        <div className="flex flex-col gap-4">
          {/* 选中节点详情 */}
          {selectedNode && (
            <Card className="flex flex-col">
              <div className="mb-2 flex items-center justify-between text-xs font-semibold text-foreground/80">
                <span>节点详情</span>
                <button
                  onClick={() => {
                    setSelectedId(null);
                    setExpandedId(null);
                  }}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="清除"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ background: nodeColor(selectedNode) }}
                  />
                  <span className="text-muted-foreground">
                    {TYPE_LABELS[selectedNode.type]}
                  </span>
                  {clustering && (
                    <span className="text-[10px] text-cognition">
                      聚类 #{(clusters.nodeCluster.get(selectedNode.id) ?? 0) + 1}
                    </span>
                  )}
                  <span className="ml-auto text-[10px] text-muted-foreground">
                    强度 {selectedNode.strength}
                  </span>
                </div>
                <div className="max-h-[100px] overflow-auto rounded-xl bg-muted/30 p-2 text-foreground/80">
                  {selectedNode.fullContent}
                </div>

                <button
                  onClick={() => {
                    setSelectedId(selectedNode.id);
                    setExpandedId((prev) => (prev === selectedNode.id ? null : selectedNode.id));
                  }}
                  className={cn(
                    "w-full rounded-lg border px-2 py-1 text-[11px] transition-colors",
                    expandedId === selectedNode.id
                      ? "border-cognition bg-cognition/10 text-cognition"
                      : "border-border text-muted-foreground hover:border-cognition/40 hover:text-cognition"
                  )}
                >
                  {expandedId === selectedNode.id
                    ? `已展开二级关联（${secondaryIds.size}）`
                    : "展开二级关联（双击图谱节点）"}
                </button>

                {Array.isArray(selectedNode.connections) && selectedNode.connections.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-[10px] text-muted-foreground">
                      直接关联 {selectedNode.connections.length} 个
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {selectedNode.connections.map((id) => {
                        const n = filteredNodes.find((x) => x.id === id);
                        if (!n) return null;
                        const isSec = secondaryIds.has(id);
                        return (
                          <button
                            key={id}
                            onClick={() => setSelectedId(id)}
                            className={cn(
                              "rounded-md border px-1.5 py-0.5 text-[10px] transition-colors",
                              isSec
                                ? "border-cognition/50 bg-cognition/10 text-cognition"
                                : "border-border bg-muted/20 text-foreground/80 hover:border-cognition/40"
                            )}
                          >
                            {n.label.length > 10 ? n.label.slice(0, 10) + "…" : n.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* 记忆列表管理 */}
          <Card className="flex flex-1 flex-col">
            <div className="mb-2 flex items-center justify-between text-xs font-semibold text-foreground/80">
              <span>记忆列表</span>
              <span className="text-[10px] text-muted-foreground">
                {listNodes.length} / {filteredNodes.length} 个
              </span>
            </div>

            {/* 搜索框 */}
            <div className="relative mb-2">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索记忆..."
                className="w-full rounded-lg border border-border bg-background py-1.5 pl-7 pr-7 text-xs text-foreground placeholder:text-muted-foreground focus:border-cognition/40 focus:outline-none focus:ring-1 focus:ring-cognition/20"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
                  aria-label="清除搜索"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* 类型筛选 + 排序 */}
            <div className="mb-2 flex gap-2">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as FilterType)}
                className="flex-1 rounded-lg border border-border bg-background px-2 py-1.5 text-[11px] text-foreground focus:border-cognition/40 focus:outline-none"
              >
                {FILTER_OPTIONS.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </select>
              <div className="relative flex-1">
                <ArrowUpDown className="pointer-events-none absolute left-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortBy)}
                  className="w-full appearance-none rounded-lg border border-border bg-background py-1.5 pl-6 pr-2 text-[11px] text-foreground focus:border-cognition/40 focus:outline-none"
                >
                  {SORT_OPTIONS.map((o) => (
                    <option key={o.key} value={o.key}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 批量管理工具栏 */}
            {batchMode && (
              <div className="mb-2 rounded-xl border border-cognition/30 bg-cognition/5 p-2.5">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[11px] font-medium text-cognition">
                    <CheckSquare className="h-3.5 w-3.5" />
                    批量管理模式
                  </div>
                  <button
                    onClick={toggleBatchMode}
                    className="text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    退出
                  </button>
                </div>
                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                  <button
                    onClick={selectOrphans}
                    className="rounded-md border border-graveyard/30 bg-graveyard/10 px-2 py-1 text-[11px] text-graveyard transition-colors hover:bg-graveyard/20"
                  >
                    全选孤立 ({orphanNodes.length})
                  </button>
                  <button
                    onClick={selectAllVisible}
                    className="rounded-md border border-border bg-background px-2 py-1 text-[11px] text-foreground/80 transition-colors hover:bg-primary/10"
                  >
                    全选 ({listNodes.length})
                  </button>
                  <button
                    onClick={clearSelection}
                    className="rounded-md border border-border bg-background px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-primary/10"
                  >
                    清空
                  </button>
                  <div className="ml-auto flex items-center gap-2 text-[11px] text-muted-foreground">
                    选中 <strong className="text-foreground">{selectedIds.size}</strong>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] text-muted-foreground">
                    总 {stats.total} · 孤立 {stats.isolated} · 选中 {selectedIds.size}
                  </span>
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={selectedIds.size === 0 || batchDeleting}
                    onClick={() => setShowBatchConfirm(true)}
                  >
                    <Trash2 className="h-3 w-3" />
                    删除选中 ({selectedIds.size})
                  </Button>
                </div>
              </div>
            )}

            {/* 列表 */}
            <div className="max-h-[420px] flex-1 overflow-auto pr-1">
              {listNodes.length === 0 ? (
                <div className="py-4 text-center text-[11px] text-muted-foreground">
                  未找到匹配记忆
                </div>
              ) : (
                <div className="space-y-1">
                  {paginated.map((node) => {
                    const Icon = TYPE_ICON[node.type];
                    const isSelected = node.id === selectedId;
                    // 兜底：label 为空时回退到 fullContent 前 20 字符
                    const displayLabel = node.label || node.fullContent.slice(0, 20);
                    return (
                      <div
                        key={node.id}
                        onClick={() => (batchMode ? toggleSelection(node.id) : focusNode(node.id))}
                        onMouseEnter={() => setHoveredId(node.id)}
                        onMouseLeave={() => setHoveredId(null)}
                        onContextMenu={(e) => openContextMenu(e, [
                          { label: "编辑标签", icon: <Pencil className="h-3.5 w-3.5" />, onClick: () => { setEditingId(node.id); setEditingLabel(displayLabel); } },
                          { separator: true },
                          { label: "删除", icon: <Trash2 className="h-3.5 w-3.5" />, danger: true, onClick: () => handleDelete(node.id) },
                        ])}
                        className={cn(
                          "group flex cursor-pointer items-center gap-2 rounded-lg border px-2 py-1.5 text-xs transition-all",
                          batchMode && selectedIds.has(node.id)
                            ? "border-cognition/50 bg-cognition/10"
                            : isSelected
                            ? "border-cognition/50 bg-cognition/10"
                            : "ios-glass-sm hover:bg-primary/10"
                        )}
                      >
                        {/* 批量选择复选框 */}
                        {batchMode && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSelection(node.id);
                            }}
                            className="shrink-0"
                            aria-label={selectedIds.has(node.id) ? "取消选择" : "选择"}
                          >
                            {selectedIds.has(node.id) ? (
                              <CheckSquare className="h-4 w-4 text-cognition" />
                            ) : (
                              <Square className="h-4 w-4 text-muted-foreground" />
                            )}
                          </button>
                        )}
                        {/* 类型图标 */}
                        <span
                          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                          style={{ background: `hsla(${nodeHSL(node).h}, ${nodeHSL(node).s}%, ${nodeHSL(node).l}%, 0.18)` }}
                        >
                          <Icon
                            className="h-3 w-3"
                            style={{ color: nodeColor(node) }}
                          />
                        </span>
                        {/* 标签 */}
                        <span className="flex-1 truncate text-foreground/80">
                          {node.label.length > 18 ? node.label.slice(0, 18) + "…" : node.label}
                        </span>
                        {/* 连接数 */}
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          {Array.isArray(node.connections) ? node.connections.length : 0} 连接
                        </span>
                        {/* 创建时间 */}
                        <span className="shrink-0 text-[10px] text-muted-foreground/70">
                          {formatTime(node.createdAt)}
                        </span>
                        {/* 操作按钮 */}
                        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingId(node.id);
                              setEditingLabel(displayLabel);
                            }}
                            className="rounded p-1 text-muted-foreground hover:bg-primary/10 hover:text-cognition"
                            aria-label="编辑"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(node.id);
                            }}
                            disabled={deletingId === node.id}
                            className="rounded p-1 text-muted-foreground hover:bg-primary/10 hover:text-graveyard disabled:opacity-50"
                            aria-label="删除"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 分页 */}
            {listTotal > 0 && (
              <div className="mt-2">
                <Pagination
                  page={page}
                  pageSize={pageSize}
                  total={listTotal}
                  onPageChange={onPageChange}
                  onPageSizeChange={onPageSizeChange}
                />
              </div>
            )}
          </Card>

          <div className={cn("grid gap-2", batchMode ? "grid-cols-4" : "grid-cols-3")}>
            <StatCard
              value={stats.total}
              label="总节点"
              icon={<Target className="h-3.5 w-3.5" />}
              color="text-northstar"
            />
            <StatCard
              value={stats.edges}
              label="关联边"
              icon={<MessageSquare className="h-3.5 w-3.5" />}
              color="text-cognition"
            />
            <StatCard
              value={stats.isolated}
              label="孤立"
              icon={<BookOpen className="h-3.5 w-3.5" />}
              color="text-graveyard"
            />
            {batchMode && (
              <StatCard
                value={selectedIds.size}
                label="选中"
                icon={<CheckSquare className="h-3.5 w-3.5" />}
                color="text-cognition"
              />
            )}
          </div>
        </div>
      </div>

      {/* 批量删除确认弹窗 */}
      {showBatchConfirm && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm"
          onClick={() => setShowBatchConfirm(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-border glass-modal p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-graveyard">
              <AlertTriangle className="h-4 w-4" />
              确认批量删除
            </div>
            <p className="mb-4 text-xs leading-relaxed text-foreground/80">
              即将删除 <strong className="text-graveyard">{selectedIds.size}</strong> 个记忆节点，此操作不可撤销。
              其他节点中对这些记忆的引用也会被同步清理。
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowBatchConfirm(false)}
              >
                取消
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleBatchDelete}
                disabled={batchDeleting}
              >
                <Trash2 className="h-3 w-3" />
                {batchDeleting ? "删除中..." : `确认删除 ${selectedIds.size} 项`}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 编辑标签弹窗 */}
      {editingId && editingNode && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={() => {
            setEditingId(null);
            setEditingLabel("");
          }}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
              <Pencil className="h-4 w-4 text-cognition" />
              编辑记忆标签
            </div>
            <div className="mb-2 flex items-center gap-2 text-[11px] text-muted-foreground">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: nodeColor(editingNode) }}
              />
              {TYPE_LABELS[editingNode.type]}
            </div>
            <input
              type="text"
              value={editingLabel}
              onChange={(e) => setEditingLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleEditSave();
                if (e.key === "Escape") {
                  setEditingId(null);
                  setEditingLabel("");
                }
              }}
              autoFocus
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-cognition/40 focus:outline-none focus:ring-1 focus:ring-cognition/20"
              placeholder="输入新标签..."
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditingId(null);
                  setEditingLabel("");
                }}
              >
                取消
              </Button>
              <Button size="sm" onClick={handleEditSave} disabled={!editingLabel.trim()}>
                保存
              </Button>
            </div>
          </div>
        </div>
      )}

      {showHelp && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/30 p-4 backdrop-blur-md"
          onClick={() => setShowHelp(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-cognition/30 glass-modal p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center gap-2 text-cognition">
              <HelpCircle className="h-4 w-4" />
              <span className="text-sm font-semibold">3D 记忆图谱使用说明</span>
            </div>
            <div className="space-y-2 text-xs text-foreground/80">
              <p>1. <strong>3D 旋转</strong>：在空白处按住鼠标拖动，可沿 X/Y 轴旋转整个图谱，节点在三维空间中分布，近大远小。</p>
              <p>2. <strong>点击节点</strong>：进入该节点的子图谱（聚焦模式），仅显示该节点及其直接关联；再次点击同一节点退出聚焦，点击其他节点切换聚焦。聚焦模式下双击节点可递归进入其子图谱。</p>
              <p>3. <strong>双击节点</strong>：非聚焦模式下展开该节点的二级关联（关联的关联），以高亮显示。</p>
              <p>4. <strong>拖拽节点</strong>：按住节点拖动可调整其位置，拖拽方向已根据旋转角度自动校正，节点跟随鼠标移动。</p>
              <p>5. <strong>滚轮缩放</strong>：在图谱上滚动鼠标滚轮可放大/缩小视图（0.3x ~ 3x）。</p>
              <p>6. <strong>聚类着色</strong>：按连通分量聚类，每个聚类在类型色基础上微调色相，可用右上角图层按钮开关。</p>
              <p>7. <strong>时间过滤</strong>：顶部选择全部/近7天/近30天/近90天，过滤显示节点。</p>
              <p>8. <strong>记忆列表</strong>：右侧面板支持搜索、类型筛选、排序与分页，点击列表项可在图谱中聚焦该节点，支持编辑标签与删除。</p>
              <p>9. <strong>性能优化</strong>：力导向计算在 Web Worker 中运行，主线程仅负责渲染；背景预渲染、节点按需渐变、rAF 合并 tick，节点超过 100 也能流畅交互。</p>
              <p>10. <strong>批量管理</strong>：点击右上角「批量管理」进入批量模式，列表项显示复选框；支持「全选孤立」（快速选中无连接节点，适合清理 e2e 测试数据）、「全选」、「清空」快捷操作，选中后点击「删除选中(N)」批量删除，删除前有确认弹窗。</p>
            </div>
            <div className="mt-4 flex justify-end">
              <Button size="sm" onClick={() => setShowHelp(false)}>
                知道了
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  value,
  label,
  icon,
  color,
}: {
  value: number;
  label: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <Card className="p-2 text-center">
      <div className={`mb-0.5 flex items-center justify-center gap-1 text-base font-bold ${color}`}>
        {icon}
        {value}
      </div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </Card>
  );
}

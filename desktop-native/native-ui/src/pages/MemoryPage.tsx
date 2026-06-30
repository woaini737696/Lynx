import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Brain,
  HelpCircle,
  RotateCcw,
  Filter,
  X,
  Loader2,
  ZoomIn,
  ZoomOut,
  Target,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { cloudApi } from "@/lib/cloud-api";
import { toast } from "@/lib/toast";

// ============ 类型定义 ============
type MemoryType = "idea" | "conversation" | "cognition" | "hermes";

interface MemoryNode {
  id: string;
  label: string;
  type: MemoryType;
  color?: string;
  strength: number;
  connections: string[];
  fullContent: string;
  createdAt?: string;
}

interface MemoryEdge {
  from: string;
  to: string;
}

interface SimNode {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  data: MemoryNode;
  fixed: boolean;
}

// ============ 常量 ============
const TYPE_LABELS: Record<MemoryType, string> = {
  idea: "灵感",
  conversation: "对话",
  cognition: "认知",
  hermes: "Hermes 记忆",
};

const TYPE_HSL: Record<MemoryType, { h: number; s: number; l: number }> = {
  idea: { h: 25, s: 95, l: 55 },
  conversation: { h: 0, s: 0, l: 45 },
  cognition: { h: 30, s: 80, l: 40 },
  hermes: { h: 160, s: 70, l: 45 },
};

type FilterType = "all" | MemoryType;

const FILTER_OPTIONS: { key: FilterType; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "idea", label: "灵感" },
  { key: "conversation", label: "对话" },
  { key: "cognition", label: "认知" },
  { key: "hermes", label: "Hermes 记忆" },
];

const VALID_TYPES: MemoryType[] = [
  "idea",
  "conversation",
  "cognition",
  "hermes",
];

// ============ 防御性数据解析 ============
function parseNodes(res: unknown): MemoryNode[] {
  if (!res || typeof res !== "object") return [];
  let rawNodes: unknown;
  if (Array.isArray(res)) {
    rawNodes = res;
  } else {
    const obj = res as Record<string, unknown>;
    rawNodes = obj.nodes ?? obj.data ?? obj.items ?? [];
  }
  if (!Array.isArray(rawNodes)) return [];
  return rawNodes
    .filter((n): n is Record<string, unknown> => !!n && typeof n === "object")
    .map((n) => {
      const rawType = n.type as string;
      const type: MemoryType = (VALID_TYPES.includes(rawType as MemoryType)
        ? rawType
        : "idea") as MemoryType;
      return {
        id: String(n.id ?? ""),
        label: String(n.label ?? n.fullContent ?? n.content ?? ""),
        type,
        color: typeof n.color === "string" ? n.color : undefined,
        strength: typeof n.strength === "number" ? n.strength : 1,
        connections: Array.isArray(n.connections)
          ? n.connections.map(String)
          : [],
        fullContent: String(n.fullContent ?? n.content ?? n.label ?? ""),
        createdAt:
          typeof n.createdAt === "string" ? n.createdAt : undefined,
      } as MemoryNode;
    })
    .filter((n) => n.id);
}

function parseEdges(res: unknown): MemoryEdge[] {
  if (!res || typeof res !== "object") return [];
  let rawEdges: unknown;
  if (Array.isArray(res)) {
    rawEdges = res;
  } else {
    const obj = res as Record<string, unknown>;
    rawEdges = obj.edges ?? obj.connections ?? obj.data ?? [];
  }
  if (!Array.isArray(rawEdges)) return [];
  return rawEdges
    .filter((e): e is Record<string, unknown> => !!e && typeof e === "object")
    .map((e) => ({
      from: String(e.from ?? e.source ?? ""),
      to: String(e.to ?? e.target ?? ""),
    }))
    .filter((e) => e.from && e.to);
}

// ============ 工具函数 ============
function nodeColor(type: MemoryType): string {
  const { h, s, l } = TYPE_HSL[type];
  return `hsl(${h}, ${s}%, ${l}%)`;
}

function formatTime(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const diff = Date.now() - d.getTime();
  if (diff < 60 * 1000) return "刚刚";
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / 60000)}分钟前`;
  if (diff < 24 * 60 * 60 * 1000)
    return `${Math.floor(diff / 3600000)}小时前`;
  if (diff < 30 * 24 * 60 * 60 * 1000)
    return `${Math.floor(diff / 86400000)}天前`;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

// ============ 主组件 ============
export function MemoryPage() {
  // ---- 数据加载 ----
  const {
    data: nodes = [],
    isLoading: nodesLoading,
    error: nodesError,
  } = useQuery<MemoryNode[]>({
    queryKey: ["memory-nodes"],
    queryFn: async () =>
      parseNodes(await cloudApi.get<unknown>("/api/memory")),
  });

  const { data: edges = [], isLoading: edgesLoading } = useQuery<MemoryEdge[]>({
    queryKey: ["memory-edges"],
    queryFn: async () =>
      parseEdges(await cloudApi.get<unknown>("/api/memory/connections")),
  });

  const isLoading = nodesLoading || edgesLoading;

  // ---- UI 状态 ----
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [showHelp, setShowHelp] = useState(false);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [simulating, setSimulating] = useState(true);
  const [scaleDisplay, setScaleDisplay] = useState(1);

  // ---- Refs ----
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simNodesRef = useRef<SimNode[]>([]);
  const edgesRef = useRef<MemoryEdge[]>([]);
  const rafRef = useRef<number | null>(null);
  const stableCountRef = useRef(0);
  const viewRef = useRef({ panX: 0, panY: 0, scale: 1 });
  const drawRef = useRef<() => void>(() => {});
  const panningRef = useRef<{
    startX: number;
    startY: number;
    panX: number;
    panY: number;
  } | null>(null);
  const draggingNodeRef = useRef<SimNode | null>(null);
  const mouseDownPosRef = useRef<{ x: number; y: number } | null>(null);
  const canvasSizeRef = useRef<{ w: number; h: number }>({ w: 800, h: 600 });

  // ---- 过滤 ----
  const filteredNodes = useMemo(() => {
    if (filterType === "all") return nodes;
    return nodes.filter((n) => n.type === filterType);
  }, [nodes, filterType]);

  const filteredEdges = useMemo(() => {
    const ids = new Set(filteredNodes.map((n) => n.id));
    return edges.filter((e) => ids.has(e.from) && ids.has(e.to));
  }, [edges, filteredNodes]);

  // ---- 初始化力导向模拟 ----
  const initSimulation = useCallback(
    (nodeList: MemoryNode[], edgeList: MemoryEdge[]) => {
      const { w, h } = canvasSizeRef.current;
      const cx = w / 2;
      const cy = h / 2;
      simNodesRef.current = nodeList.map((n) => {
        const angle = Math.random() * Math.PI * 2;
        const radius = 30 + Math.random() * Math.min(w, h) * 0.3;
        return {
          id: n.id,
          x: cx + Math.cos(angle) * radius,
          y: cy + Math.sin(angle) * radius,
          vx: 0,
          vy: 0,
          r: Math.max(8, Math.min(22, 8 + (n.strength || 1) * 1.5)),
          data: n,
          fixed: false,
        };
      });
      edgesRef.current = edgeList;
      stableCountRef.current = 0;
      setSimulating(true);
    },
    []
  );

  // 数据变化时重建模拟
  useEffect(() => {
    if (isLoading) return;
    if (filteredNodes.length === 0) {
      simNodesRef.current = [];
      edgesRef.current = [];
      return;
    }
    initSimulation(filteredNodes, filteredEdges);
  }, [filteredNodes, filteredEdges, isLoading, initSimulation]);

  // ---- 力导向模拟单步 ----
  const step = useCallback(() => {
    const simNodes = simNodesRef.current;
    const edgeList = edgesRef.current;
    if (simNodes.length === 0) {
      setSimulating(false);
      return;
    }
    const { w, h } = canvasSizeRef.current;
    const cx = w / 2;
    const cy = h / 2;

    const REPULSION = 8000;
    const ATTRACTION = 0.02;
    const REST_LENGTH = 120;
    const CENTERING = 0.005;
    const DAMPING = 0.88;
    const MAX_SPEED = 30;

    // 排斥力（O(n²)）
    for (let i = 0; i < simNodes.length; i++) {
      const a = simNodes[i];
      if (a.fixed) continue;
      for (let j = i + 1; j < simNodes.length; j++) {
        const b = simNodes[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        let dist2 = dx * dx + dy * dy;
        if (dist2 < 1) dist2 = 1;
        const dist = Math.sqrt(dist2);
        const force = REPULSION / dist2;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        a.vx += fx;
        a.vy += fy;
        if (!b.fixed) {
          b.vx -= fx;
          b.vy -= fy;
        }
      }
    }

    // 吸引力（沿边）
    const nodeMap = new Map(simNodes.map((n) => [n.id, n]));
    for (const edge of edgeList) {
      const a = nodeMap.get(edge.from);
      const b = nodeMap.get(edge.to);
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = ATTRACTION * (dist - REST_LENGTH);
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      if (!a.fixed) {
        a.vx += fx;
        a.vy += fy;
      }
      if (!b.fixed) {
        b.vx -= fx;
        b.vy -= fy;
      }
    }

    // 中心引力 + 阻尼 + 限速 + 位置更新
    let totalEnergy = 0;
    for (const n of simNodes) {
      if (n.fixed) continue;
      n.vx += (cx - n.x) * CENTERING;
      n.vy += (cy - n.y) * CENTERING;
      n.vx *= DAMPING;
      n.vy *= DAMPING;
      const speed = Math.sqrt(n.vx * n.vx + n.vy * n.vy);
      if (speed > MAX_SPEED) {
        n.vx = (n.vx / speed) * MAX_SPEED;
        n.vy = (n.vy / speed) * MAX_SPEED;
      }
      n.x += n.vx;
      n.y += n.vy;
      totalEnergy += speed * speed;
    }

    // 稳定性检测：连续 30 帧能量低于阈值则停止
    if (totalEnergy < 0.5) {
      stableCountRef.current++;
      if (stableCountRef.current > 30) {
        setSimulating(false);
        return;
      }
    } else {
      stableCountRef.current = 0;
    }
  }, []);

  // ---- 模拟循环（rAF，稳定后自动停止）----
  useEffect(() => {
    if (!simulating) return;
    let cancelled = false;
    const loop = () => {
      if (cancelled) return;
      step();
      drawRef.current();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      cancelled = true;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [simulating, step]);

  // ---- Canvas 绘制 ----
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const { w, h } = canvasSizeRef.current;
    if (
      canvas.width !== Math.round(w * dpr) ||
      canvas.height !== Math.round(h * dpr)
    ) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    if (canvas.style.width !== w + "px") canvas.style.width = w + "px";
    if (canvas.style.height !== h + "px") canvas.style.height = h + "px";

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    // 浅色背景
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(0, 0, w, h);

    // 背景光点
    ctx.fillStyle = "rgba(148,163,184,0.1)";
    for (let i = 0; i < 30; i++) {
      const seed = i * 9301 + 49297;
      const px = ((seed % 233280) / 233280) * w;
      const py = (((seed * 7) % 233280) / 233280) * h;
      ctx.beginPath();
      ctx.arc(px, py, 0.8, 0, Math.PI * 2);
      ctx.fill();
    }

    const simNodes = simNodesRef.current;
    const edgeList = edgesRef.current;
    if (simNodes.length === 0) return;

    const view = viewRef.current;
    const nodeMap = new Map(simNodes.map((n) => [n.id, n]));

    // 高亮集合：选中或悬停节点的直接关联（IIFE 避免 closure 类型收窄问题）
    const highlightIds: Set<string> | null = (() => {
      const ids = new Set<string>();
      const collect = (id: string | null) => {
        if (!id) return;
        const node = nodeMap.get(id);
        if (!node) return;
        ids.add(id);
        const conns = Array.isArray(node.data.connections)
          ? node.data.connections
          : [];
        conns.forEach((c) => ids.add(c));
      };
      collect(selectedId);
      collect(hoveredId);
      return ids.size > 0 ? ids : null;
    })();

    ctx.save();
    ctx.translate(w / 2 + view.panX, h / 2 + view.panY);
    ctx.scale(view.scale, view.scale);

    // 绘制边
    for (const edge of edgeList) {
      const a = nodeMap.get(edge.from);
      const b = nodeMap.get(edge.to);
      if (!a || !b) continue;
      const isActive =
        highlightIds !== null &&
        highlightIds.has(edge.from) &&
        highlightIds.has(edge.to);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      if (isActive) {
        ctx.strokeStyle = "rgba(100,116,139,0.6)";
        ctx.lineWidth = 1.8;
      } else {
        ctx.strokeStyle = "rgba(148,163,184,0.25)";
        ctx.lineWidth = 1;
      }
      ctx.stroke();
    }

    // 绘制节点
    for (const n of simNodes) {
      const isSelected = n.id === selectedId;
      const isHovered = n.id === hoveredId;
      const { h: hh, s, l } = TYPE_HSL[n.data.type];
      const r = isSelected ? n.r * 1.25 : isHovered ? n.r * 1.12 : n.r;

      if (isSelected || isHovered) {
        ctx.shadowColor = `hsla(${hh}, ${s}%, ${l}%, 0.5)`;
        ctx.shadowBlur = isSelected ? 16 : 10;
      } else {
        ctx.shadowBlur = 0;
      }

      if (isSelected || isHovered) {
        const grad = ctx.createRadialGradient(
          n.x - r * 0.3,
          n.y - r * 0.3,
          r * 0.1,
          n.x,
          n.y,
          Math.max(0.1, r)
        );
        grad.addColorStop(
          0,
          `hsla(${hh}, ${s}%, ${Math.min(80, l + 15)}%, 0.95)`
        );
        grad.addColorStop(1, `hsla(${hh}, ${s}%, ${l}%, 0.7)`);
        ctx.beginPath();
        ctx.arc(n.x, n.y, Math.max(0.1, r), 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(n.x, n.y, Math.max(0.1, r), 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${hh}, ${s}%, ${l}%, 0.85)`;
        ctx.fill();
      }
      ctx.shadowBlur = 0;

      if (isSelected) {
        ctx.strokeStyle = `hsl(${hh}, ${s}%, ${Math.max(30, l - 20)}%)`;
        ctx.lineWidth = 2.5;
        ctx.stroke();
      } else if (isHovered) {
        ctx.strokeStyle = `hsla(${hh}, ${s}%, ${l}%, 0.6)`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // 文字标签
      const rawLabel = n.data.label || n.data.fullContent.slice(0, 20);
      const label =
        rawLabel.length > 12 ? rawLabel.slice(0, 12) + "…" : rawLabel;
      ctx.font =
        "600 12px -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "rgba(255,255,255,0.92)";
      ctx.lineWidth = 3.5;
      ctx.strokeText(label, n.x, n.y + r + 13);
      ctx.fillStyle = "#1e293b";
      ctx.fillText(label, n.x, n.y + r + 13);
    }

    ctx.restore();
  }, [selectedId, hoveredId]);

  // 同步 draw 到 ref
  useEffect(() => {
    drawRef.current = draw;
  }, [draw]);

  // 非模拟状态下重绘
  useEffect(() => {
    drawRef.current();
  }, [draw]);

  // ---- ResizeObserver ----
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          canvasSizeRef.current = { w: width, h: height };
          drawRef.current();
        }
      }
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // ---- 坐标转换 ----
  const screenToWorld = useCallback((sx: number, sy: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const { w, h } = canvasSizeRef.current;
    const view = viewRef.current;
    const cssX = ((sx - rect.left) / rect.width) * w;
    const cssY = ((sy - rect.top) / rect.height) * h;
    return {
      x: (cssX - w / 2 - view.panX) / view.scale,
      y: (cssY - h / 2 - view.panY) / view.scale,
    };
  }, []);

  // ---- 命中检测 ----
  const hitTest = useCallback((wx: number, wy: number): SimNode | null => {
    const simNodes = simNodesRef.current;
    for (let i = simNodes.length - 1; i >= 0; i--) {
      const n = simNodes[i];
      const dx = wx - n.x;
      const dy = wy - n.y;
      if (dx * dx + dy * dy <= n.r * n.r) return n;
    }
    return null;
  }, []);

  // ---- 鼠标交互 ----
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      mouseDownPosRef.current = { x: e.clientX, y: e.clientY };
      const { x, y } = screenToWorld(e.clientX, e.clientY);
      const hit = hitTest(x, y);
      if (hit) {
        draggingNodeRef.current = hit;
        hit.fixed = true;
        if (!simulating) setSimulating(true);
      } else {
        const view = viewRef.current;
        panningRef.current = {
          startX: e.clientX,
          startY: e.clientY,
          panX: view.panX,
          panY: view.panY,
        };
      }
    },
    [screenToWorld, hitTest, simulating]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const dragging = draggingNodeRef.current;
      const panning = panningRef.current;
      if (dragging) {
        const { x, y } = screenToWorld(e.clientX, e.clientY);
        dragging.x = x;
        dragging.y = y;
        dragging.vx = 0;
        dragging.vy = 0;
        drawRef.current();
        return;
      }
      if (panning) {
        const dx = e.clientX - panning.startX;
        const dy = e.clientY - panning.startY;
        const view = viewRef.current;
        view.panX = panning.panX + dx;
        view.panY = panning.panY + dy;
        drawRef.current();
        return;
      }
      const { x, y } = screenToWorld(e.clientX, e.clientY);
      const hit = hitTest(x, y);
      const hitId = hit?.id ?? null;
      setHoveredId((prev) => (prev !== hitId ? hitId : prev));
      if (canvasRef.current) {
        canvasRef.current.style.cursor = hit ? "pointer" : "grab";
      }
    },
    [screenToWorld, hitTest]
  );

  const handleMouseUp = useCallback(() => {
    if (draggingNodeRef.current) {
      draggingNodeRef.current.fixed = false;
      draggingNodeRef.current = null;
    }
    panningRef.current = null;
  }, []);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!mouseDownPosRef.current) return;
      const dx = e.clientX - mouseDownPosRef.current.x;
      const dy = e.clientY - mouseDownPosRef.current.y;
      if (dx * dx + dy * dy > 25) return;
      const { x, y } = screenToWorld(e.clientX, e.clientY);
      const hit = hitTest(x, y);
      setSelectedId(hit ? hit.id : null);
    },
    [screenToWorld, hitTest]
  );

  // ---- 滚轮缩放 ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const view = viewRef.current;
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      view.scale = Math.max(0.3, Math.min(3, view.scale * delta));
      setScaleDisplay(view.scale);
      drawRef.current();
    };
    canvas.addEventListener("wheel", handler, { passive: false });
    return () => canvas.removeEventListener("wheel", handler);
  }, []);

  // ---- 控制操作 ----
  const reLayout = useCallback(() => {
    if (filteredNodes.length === 0) return;
    initSimulation(filteredNodes, filteredEdges);
    viewRef.current = { panX: 0, panY: 0, scale: 1 };
    setScaleDisplay(1);
    toast.info("已重新布局");
  }, [filteredNodes, filteredEdges, initSimulation]);

  const zoomBy = useCallback((factor: number) => {
    const view = viewRef.current;
    view.scale = Math.max(0.3, Math.min(3, view.scale * factor));
    setScaleDisplay(view.scale);
    drawRef.current();
  }, []);

  const resetView = useCallback(() => {
    viewRef.current = { panX: 0, panY: 0, scale: 1 };
    setScaleDisplay(1);
    drawRef.current();
  }, []);

  // 点击筛选菜单外部关闭
  useEffect(() => {
    if (!showFilterMenu) return;
    const handler = () => setShowFilterMenu(false);
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, [showFilterMenu]);

  // ---- 派生数据 ----
  const selectedNode = useMemo(
    () => filteredNodes.find((n) => n.id === selectedId) || null,
    [filteredNodes, selectedId]
  );

  const stats = useMemo(() => {
    const total = filteredNodes.length;
    const edgeCount = filteredEdges.length;
    const isolated = filteredNodes.filter(
      (n) => !Array.isArray(n.connections) || n.connections.length === 0
    ).length;
    return { total, edges: edgeCount, isolated };
  }, [filteredNodes, filteredEdges]);

  // ---- 渲染 ----
  return (
    <div className="mx-auto flex h-full max-w-7xl flex-col px-4 py-4">
      {/* 页头 */}
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            记忆图谱
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {stats.total} 节点 · {stats.edges} 关联 · {stats.isolated} 孤立 ·
            2D 力导向布局
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSimulating((s) => !s)}
            className="btn-glass flex h-8 items-center gap-1.5 px-3 text-xs"
          >
            {simulating ? "暂停模拟" : "继续模拟"}
          </button>
          <button
            onClick={reLayout}
            className="btn-glass flex h-8 items-center gap-1.5 px-3 text-xs"
          >
            <RotateCcw className="h-3.5 w-3.5" /> 重新布局
          </button>
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowFilterMenu((s) => !s);
              }}
              className={cn(
                "btn-glass flex h-8 items-center gap-1.5 px-3 text-xs",
                filterType !== "all" && "ring-2 ring-cognition/30"
              )}
            >
              <Filter className="h-3.5 w-3.5" /> 按类型筛选
            </button>
            {showFilterMenu && (
              <div
                className="ios-glass absolute right-0 top-9 z-20 w-36 overflow-hidden p-1"
                onClick={(e) => e.stopPropagation()}
              >
                {FILTER_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => {
                      setFilterType(opt.key);
                      setShowFilterMenu(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs",
                      filterType === opt.key
                        ? "bg-cognition/10 text-cognition"
                        : "hover:bg-muted"
                    )}
                  >
                    {opt.key !== "all" && (
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{
                          background: nodeColor(opt.key as MemoryType),
                        }}
                      />
                    )}
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => setShowHelp(true)}
            title="使用说明"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground"
          >
            <HelpCircle className="h-[18px] w-[18px]" />
          </button>
        </div>
      </div>

      {/* 主体内容 */}
      {nodesError ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
          <Brain className="h-12 w-12 opacity-40" />
          <p className="text-sm">加载记忆图谱失败</p>
          <p className="text-xs">
            {nodesError instanceof Error ? nodesError.message : "未知错误"}
          </p>
        </div>
      ) : isLoading ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-sm">正在构建记忆图谱...</p>
        </div>
      ) : filteredNodes.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
          <Brain className="h-12 w-12 opacity-40" />
          <p className="text-sm font-medium">暂无记忆数据</p>
          <p className="text-xs">
            在 Inbox 收敛灵感或与 AI 对话后会自动生成记忆
          </p>
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden lg:grid-cols-3">
          {/* 图谱画布 */}
          <div
            ref={containerRef}
            className="ios-glass relative col-span-1 min-h-0 overflow-hidden lg:col-span-2"
          >
            <canvas
              ref={canvasRef}
              className="block h-full w-full cursor-grab select-none"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={() => {
                handleMouseUp();
                setHoveredId(null);
              }}
              onClick={handleClick}
            />

            {/* 图例 */}
            <div className="absolute left-3 top-3 rounded-xl border border-border/60 bg-card/80 p-2.5 text-[10px] backdrop-blur">
              <div className="mb-1 font-semibold text-foreground/80">图例</div>
              <div className="space-y-1 text-muted-foreground">
                {(Object.keys(TYPE_LABELS) as MemoryType[]).map((t) => (
                  <span key={t} className="flex items-center gap-1">
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ background: nodeColor(t) }}
                    />
                    {TYPE_LABELS[t]}
                  </span>
                ))}
              </div>
            </div>

            {/* 缩放控制 */}
            <div className="absolute right-3 top-3 flex flex-col gap-1">
              <button
                onClick={() => zoomBy(1.2)}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-border/60 bg-card/80 text-muted-foreground backdrop-blur transition-colors hover:bg-primary/10"
                aria-label="放大"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => zoomBy(1 / 1.2)}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-border/60 bg-card/80 text-muted-foreground backdrop-blur transition-colors hover:bg-primary/10"
                aria-label="缩小"
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={resetView}
                title="重置视角"
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-border/60 bg-card/80 text-muted-foreground backdrop-blur transition-colors hover:bg-primary/10"
                aria-label="重置视角"
              >
                <Target className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* 状态栏 */}
            <div className="absolute bottom-3 left-3 rounded-lg border border-border/60 bg-card/80 px-2 py-1 text-[10px] text-muted-foreground backdrop-blur">
              缩放 {Math.round(scaleDisplay * 100)}% · 拖拽空白平移 · 滚轮缩放
              · 点击节点查看详情
              {simulating ? " · 模拟中" : " · 已稳定"}
            </div>
          </div>

          {/* 右侧详情面板 */}
          <div className="ios-glass flex min-h-0 flex-col overflow-hidden p-4">
            {selectedNode ? (
              <>
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground/80">
                    节点详情
                  </span>
                  <button
                    onClick={() => setSelectedId(null)}
                    className="text-muted-foreground transition-colors hover:text-foreground"
                    aria-label="清除"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="flex-1 space-y-3 overflow-y-auto">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ background: nodeColor(selectedNode.type) }}
                    />
                    <span className="text-xs text-muted-foreground">
                      {TYPE_LABELS[selectedNode.type]}
                    </span>
                    <span className="ml-auto text-[10px] text-muted-foreground">
                      强度 {selectedNode.strength}
                    </span>
                  </div>
                  <div className="rounded-xl bg-muted/40 p-2.5 text-xs leading-relaxed text-foreground/80">
                    {selectedNode.fullContent ||
                      selectedNode.label ||
                      "（无内容）"}
                  </div>
                  {selectedNode.createdAt && (
                    <div className="text-[10px] text-muted-foreground">
                      创建时间：{formatTime(selectedNode.createdAt)}
                    </div>
                  )}
                  {Array.isArray(selectedNode.connections) &&
                    selectedNode.connections.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="text-[10px] text-muted-foreground">
                          直接关联 {selectedNode.connections.length} 个
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {selectedNode.connections.map((id) => {
                            const n = filteredNodes.find((x) => x.id === id);
                            if (!n) return null;
                            return (
                              <button
                                key={id}
                                onClick={() => setSelectedId(id)}
                                className="rounded-md border border-border bg-muted/20 px-1.5 py-0.5 text-[10px] text-foreground/80 transition-colors hover:border-cognition/40 hover:text-cognition"
                              >
                                {n.label.length > 10
                                  ? n.label.slice(0, 10) + "…"
                                  : n.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                </div>
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground">
                <Brain className="h-8 w-8 opacity-30" />
                <p className="text-xs">点击图谱节点查看详情</p>
                <p className="text-[10px] text-muted-foreground/60">
                  悬停可高亮关联节点
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 帮助弹窗 */}
      {showHelp && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-background/60 p-4 backdrop-blur-sm"
          onClick={() => setShowHelp(false)}
        >
          <div
            className="ios-glass w-full max-w-lg overflow-hidden p-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
              <h3 className="text-lg font-semibold text-foreground">
                记忆图谱使用说明
              </h3>
              <button
                onClick={() => setShowHelp(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="关闭"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[60vh] overflow-auto p-5">
              <div className="space-y-2.5 text-sm leading-relaxed text-foreground/80">
                <p>
                  1. <strong>力导向布局</strong>：节点间的排斥力与边的吸引力自动计算位置，形成自然的网络结构。点击「重新布局」可重新计算。
                </p>
                <p>
                  2. <strong>拖拽平移</strong>：在空白处按住鼠标拖动可平移整个图谱视图。
                </p>
                <p>
                  3. <strong>滚轮缩放</strong>：在画布上滚动鼠标滚轮可放大/缩小视图（0.3x ~ 3x），也可用右上角按钮。
                </p>
                <p>
                  4. <strong>点击节点</strong>：在右侧面板显示该记忆的完整内容和关联节点列表，点击关联节点可跳转。
                </p>
                <p>
                  5. <strong>拖拽节点</strong>：按住节点拖动可调整其位置，力导向模拟会自动重排周围节点。
                </p>
                <p>
                  6. <strong>悬停高亮</strong>：鼠标悬停在节点上会高亮其直接关联的边和节点。
                </p>
                <p>
                  7. <strong>按类型筛选</strong>：顶部按钮可按灵感/对话/认知/Hermes 记忆类型筛选显示。
                </p>
                <p>
                  8. <strong>类型颜色</strong>：灵感（橙）、对话（灰）、认知（深橙棕）、Hermes 记忆（青绿）。
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

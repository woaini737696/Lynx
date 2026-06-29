// AI 工作流页面（对齐 Web 端 /api/ai/flows）
// 支持工作流 CRUD + 节点编辑 + 执行 + 执行历史
import { useState } from "react";
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
  Settings,
  Zap,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { HelpButton } from "@/components/ui/HelpButton";
import { Modal } from "@/components/ui/Modal";
import { cloudApi } from "@/lib/cloud-api";

// ============ 类型定义 ============

type NodeType = "trigger" | "action" | "condition" | "output" | "hermes" | "http" | "database" | "transform" | "delay";

interface FlowNode {
  id: string;
  type: NodeType;
  label: string;
  status?: "idle" | "running" | "done" | "error";
  config?: Record<string, unknown>;
}

interface Flow {
  id: string;
  name: string;
  description: string;
  nodes: FlowNode[];
  edges?: Array<{ id: string; from: string; to: string; condition?: "true" | "false" }>;
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

const NODE_TYPES: Array<{ type: NodeType; label: string; icon: typeof Zap; color: string }> = [
  { type: "trigger", label: "触发器", icon: Zap, color: "text-northstar" },
  { type: "action", label: "AI 动作", icon: Play, color: "text-primary" },
  { type: "condition", label: "条件", icon: AlertCircle, color: "text-cognition" },
  { type: "output", label: "输出", icon: CheckCircle2, color: "text-task" },
  { type: "hermes", label: "Lynx Agent", icon: Settings, color: "text-accent" },
  { type: "http", label: "HTTP 请求", icon: Workflow, color: "text-northstar" },
  { type: "database", label: "数据库", icon: Workflow, color: "text-cognition" },
  { type: "transform", label: "数据转换", icon: Workflow, color: "text-primary" },
  { type: "delay", label: "延时", icon: Clock, color: "text-muted-foreground" },
];

export function AIFlowsPage() {
  const queryClient = useQueryClient();
  const [editingFlow, setEditingFlow] = useState<Flow | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [executing, setExecuting] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<ExecutionResult | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Flow | null>(null);

  // 加载工作流列表
  const { data: flows = [], isLoading } = useQuery<Flow[]>({
    queryKey: ["ai-flows"],
    queryFn: async () => {
      const resp = await cloudApi.get<{ flows: Flow[] }>("/api/ai/flows");
      return resp.flows || [];
    },
  });

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
    setEditingFlow(newFlow);
    setShowEditor(true);
  };

  const handleEdit = (flow: Flow) => {
    setEditingFlow({ ...flow, nodes: [...flow.nodes] });
    setShowEditor(true);
  };

  const handleSave = async () => {
    if (!editingFlow) return;
    if (!editingFlow.name.trim()) {
      toast.error("请输入工作流名称");
      return;
    }
    try {
      if (editingFlow.id) {
        await cloudApi.put(`/api/ai/flows/${editingFlow.id}`, {
          name: editingFlow.name,
          description: editingFlow.description,
          nodes: editingFlow.nodes,
          edges: editingFlow.edges,
          enabled: editingFlow.enabled,
        });
        toast.success("工作流已更新");
      } else {
        await cloudApi.post("/api/ai/flows", {
          name: editingFlow.name,
          description: editingFlow.description,
          nodes: editingFlow.nodes,
          edges: editingFlow.edges,
          enabled: editingFlow.enabled,
        });
        toast.success("工作流已创建");
      }
      queryClient.invalidateQueries({ queryKey: ["ai-flows"] });
      setShowEditor(false);
      setEditingFlow(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "保存失败");
    }
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
      } else {
        toast.error("工作流执行失败：" + (resp.result.error || "未知错误"));
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

      {/* 编辑器弹窗 */}
      <FlowEditor
        flow={editingFlow}
        open={showEditor}
        onClose={() => {
          setShowEditor(false);
          setEditingFlow(null);
        }}
        onChange={setEditingFlow}
        onSave={handleSave}
      />

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

// ============ 工作流编辑器 ============

function FlowEditor({
  flow,
  open,
  onClose,
  onChange,
  onSave,
}: {
  flow: Flow | null;
  open: boolean;
  onClose: () => void;
  onChange: (flow: Flow) => void;
  onSave: () => void;
}) {
  if (!flow) return null;

  const updateField = <K extends keyof Flow>(key: K, value: Flow[K]) => {
    onChange({ ...flow, [key]: value });
  };

  const updateNode = (nodeId: string, updates: Partial<FlowNode>) => {
    onChange({
      ...flow,
      nodes: flow.nodes.map((n) => (n.id === nodeId ? { ...n, ...updates } : n)),
    });
  };

  const addNode = (type: NodeType) => {
    const nodeTypeDef = NODE_TYPES.find((n) => n.type === type);
    const newNode: FlowNode = {
      id: `node-${Date.now()}`,
      type,
      label: nodeTypeDef?.label || type,
      config: {},
    };
    onChange({ ...flow, nodes: [...flow.nodes, newNode] });
  };

  const removeNode = (nodeId: string) => {
    onChange({
      ...flow,
      nodes: flow.nodes.filter((n) => n.id !== nodeId),
      edges: (flow.edges || []).filter((e) => e.from !== nodeId && e.to !== nodeId),
    });
  };

  return (
    <Modal open={open} onClose={onClose} title={flow.id ? "编辑工作流" : "新建工作流"} size="lg">
      <div className="space-y-4">
        {/* 基本信息 */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-foreground">名称</label>
            <input
              type="text"
              value={flow.name}
              onChange={(e) => updateField("name", e.target.value)}
              placeholder="例如：每日灵感巡检"
              className="mt-1 h-9 w-full rounded-lg border border-border/60 bg-background/40 px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-foreground">描述</label>
            <input
              type="text"
              value={flow.description}
              onChange={(e) => updateField("description", e.target.value)}
              placeholder="简要描述工作流用途"
              className="mt-1 h-9 w-full rounded-lg border border-border/60 bg-background/40 px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        {/* 启用开关 */}
        <button
          onClick={() => updateField("enabled", !flow.enabled)}
          className={cn(
            "flex items-center justify-between rounded-xl border px-3 py-2 text-sm transition-colors",
            flow.enabled
              ? "border-primary/30 bg-primary/5 text-foreground"
              : "border-border/40 bg-muted/20 text-muted-foreground"
          )}
        >
          <span className="font-medium">{flow.enabled ? "已启用" : "已禁用"}</span>
          <span
            className={cn(
              "relative h-5 w-9 rounded-full transition-colors",
              flow.enabled ? "bg-primary" : "bg-muted-foreground/30"
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
                flow.enabled ? "translate-x-4" : "translate-x-0.5"
              )}
            />
          </span>
        </button>

        {/* 节点列表 */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-xs font-medium text-foreground">节点（{flow.nodes.length}）</label>
          </div>
          <div className="space-y-2">
            {flow.nodes.map((node, idx) => {
              const typeDef = NODE_TYPES.find((n) => n.type === node.type);
              const Icon = typeDef?.icon || Workflow;
              return (
                <div
                  key={node.id}
                  className="flex items-center gap-2 rounded-xl border border-border/40 bg-muted/20 p-2"
                >
                  <span className="text-[10px] text-muted-foreground">{idx + 1}.</span>
                  <Icon className={cn("h-4 w-4", typeDef?.color)} />
                  <input
                    type="text"
                    value={node.label}
                    onChange={(e) => updateNode(node.id, { label: e.target.value })}
                    className="h-7 flex-1 rounded-md border border-border/60 bg-background/40 px-2 text-xs outline-none focus:ring-1 focus:ring-primary/20"
                  />
                  <span className="text-[10px] text-muted-foreground">{typeDef?.label}</span>
                  <button
                    onClick={() => removeNode(node.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>

          {/* 添加节点 */}
          <div className="mt-2 flex flex-wrap gap-1">
            {NODE_TYPES.map((nt) => {
              const Icon = nt.icon;
              return (
                <button
                  key={nt.type}
                  onClick={() => addNode(nt.type)}
                  className="flex items-center gap-1 rounded-md border border-border/40 bg-background/40 px-2 py-1 text-[10px] text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground"
                >
                  <Icon className={cn("h-3 w-3", nt.color)} />
                  {nt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center justify-end gap-2 border-t border-border/40 pt-4">
          <button onClick={onClose} className="btn-glass flex h-9 items-center px-4 text-sm">
            取消
          </button>
          <button
            onClick={onSave}
            className="btn-primary-glass flex h-9 items-center gap-1.5 rounded-lg px-4 text-sm"
          >
            <Save className="h-4 w-4" />
            保存
          </button>
        </div>
      </div>
    </Modal>
  );
}

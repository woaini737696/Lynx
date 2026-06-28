"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Briefcase,
  Save,
  Trash2,
  RotateCcw,
  Loader2,
  Sparkles,
  Wrench,
  Bot,
  X,
  Check,
} from "lucide-react";
import { PageHeader, Card, Button, LoadingState } from "@/components/layout/PageHeader";
import { HelpButton } from "@/components/layout/HelpButton";
import { Modal } from "@/components/ui/Modal";
import { toast } from "@/components/ui/toast";

type Workspace = {
  id: string | null;
  profession: string;
  displayName: string;
  description: string | null;
  icon: string;
  accentColor: string;
  systemPrompt: string | null;
  defaultProvider: string | null;
  defaultModel: string | null;
  defaultReasoningMode: string | null;
  allowedProviders: string[];
  allowedTools: string[];
  enabled: boolean;
  updatedAt: string | null;
  isDefault?: boolean;
};

type ToolDef = { name: string; description: string };

const ACCENT_COLORS: Array<{ key: string; label: string; cls: string }> = [
  { key: "orange", label: "橙", cls: "bg-orange-500" },
  { key: "cognition", label: "紫", cls: "bg-cognition" },
  { key: "campaign", label: "粉", cls: "bg-campaign" },
  { key: "graveyard", label: "黑", cls: "bg-graveyard" },
  { key: "northstar", label: "蓝", cls: "bg-northstar" },
];

const REASONING_MODES = [
  { key: "fast", label: "快速" },
  { key: "standard", label: "标准" },
  { key: "deep", label: "深度" },
  { key: "thinking", label: "思考" },
];

export default function ProfessionWorkspacesPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [tools, setTools] = useState<ToolDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // 编辑态（深拷贝目标 workspace，独立编辑）
  const [editForm, setEditForm] = useState<Workspace | null>(null);

  const load = useCallback(async () => {
    try {
      const [wsRes, toolsRes, sessionRes] = await Promise.all([
        fetch("/api/admin/profession-workspaces"),
        fetch("/api/ai/tools"),
        fetch("/api/auth/session"),
      ]);
      if (sessionRes.ok) {
        const s = await sessionRes.json();
        setIsAdmin((s?.user as { role?: string } | undefined)?.role === "admin");
      }
      if (wsRes.ok) {
        const data = await wsRes.json();
        setWorkspaces(data.workspaces || []);
      }
      if (toolsRes.ok) {
        const data = await toolsRes.json();
        setTools(data.tools || []);
      }
    } catch (e) {
      console.error("加载失败:", e);
      toast("加载失败", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const startEdit = (ws: Workspace) => {
    setEditingKey(ws.profession);
    setEditForm(JSON.parse(JSON.stringify(ws)));
  };

  const cancelEdit = () => {
    setEditingKey(null);
    setEditForm(null);
  };

  const toggleTool = (name: string) => {
    if (!editForm) return;
    const exists = editForm.allowedTools.includes(name);
    setEditForm({
      ...editForm,
      allowedTools: exists
        ? editForm.allowedTools.filter((t) => t !== name)
        : [...editForm.allowedTools, name],
    });
  };

  const handleSave = async () => {
    if (!editForm) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/profession-workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profession: editForm.profession,
          displayName: editForm.displayName,
          description: editForm.description,
          icon: editForm.icon,
          accentColor: editForm.accentColor,
          systemPrompt: editForm.systemPrompt,
          defaultProvider: editForm.defaultProvider,
          defaultModel: editForm.defaultModel,
          defaultReasoningMode: editForm.defaultReasoningMode,
          allowedProviders: editForm.allowedProviders,
          allowedTools: editForm.allowedTools,
          enabled: editForm.enabled,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "保存失败", "error");
        return;
      }
      toast(`${editForm.displayName} 工作空间已保存`, "success");
      cancelEdit();
      await load();
    } catch {
      toast("保存失败，请重试", "error");
    } finally {
      setSaving(false);
    }
  };

  // 重置工作空间二次确认状态（用自定义 Modal 替代 confirm()）
  const [confirmReset, setConfirmReset] = useState<Workspace | null>(null);

  const handleReset = (ws: Workspace) => {
    setConfirmReset(ws);
  };

  const performReset = async (ws: Workspace) => {
    try {
      const res = await fetch(
        `/api/admin/profession-workspaces/${encodeURIComponent(ws.profession)}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const data = await res.json();
        toast(data.error || "重置失败", "error");
        return;
      }
      toast(`已重置为默认配置`, "success");
      setConfirmReset(null);
      await load();
    } catch {
      toast("重置失败，请重试", "error");
    }
  };

  if (loading) return <LoadingState title="职业工作空间" />;

  if (!isAdmin) {
    return (
      <div className="p-4 sm:p-8">
        <PageHeader title="职业工作空间" subtitle="为不同岗位定制 AI 工作空间" />
        <Card className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl ios-glass-sm">
            <Briefcase className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-base font-semibold text-foreground">权限不足</h3>
          <p className="mt-2 max-w-xs text-sm text-muted-foreground">
            仅管理员可配置职业工作空间
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8">
      <PageHeader
        title="职业工作空间"
        subtitle="为 12 个岗位差异化配置 AI 助理：System Prompt · 默认模型 · 可见工具"
        action={<HelpButton contentKey="profession-workspaces" />}
      />

      {/* 说明卡片 */}
      <Card className="mb-6">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-cognition" />
          <h3 className="text-sm font-semibold text-foreground">工作空间 3 维度</h3>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {[
            { icon: "📝", label: "System Prompt 模板", desc: "AI 助理的职业化角色设定" },
            { icon: "🧠", label: "默认模型/推理模式", desc: "进入 AI 助理页默认使用" },
            { icon: "🔧", label: "可见 AI 工具白名单", desc: "该岗位可调用哪些工具" },
          ].map((d, i) => (
            <div key={i} className="rounded-lg glass-card p-2.5">
              <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                <span>{d.icon}</span>
                {d.label}
              </div>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{d.desc}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* 12 岗位卡片网格 */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {workspaces.map((ws) => (
          <WorkspaceCard
            key={ws.profession}
            ws={ws}
            tools={tools}
            isEditing={editingKey === ws.profession}
            editForm={editingKey === ws.profession ? editForm : null}
            onStartEdit={() => startEdit(ws)}
            onCancelEdit={cancelEdit}
            onChangeForm={setEditForm}
            onSave={handleSave}
            saving={saving}
            onReset={() => handleReset(ws)}
            onToggleTool={toggleTool}
          />
        ))}
      </div>

      {/* 重置工作空间二次确认弹窗（替代 confirm()） */}
      <Modal
        open={!!confirmReset}
        onClose={() => setConfirmReset(null)}
        title="确认重置"
        size="sm"
      >
        {confirmReset && (
          <>
            <p className="text-sm text-muted-foreground">
              确定要重置「{confirmReset.displayName}」工作空间为默认配置吗？
              <br />
              这将删除该岗位的自定义配置。
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setConfirmReset(null)}>
                取消
              </Button>
              <Button
                size="sm"
                variant="danger"
                onClick={() => performReset(confirmReset)}
              >
                确认重置
              </Button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}

function WorkspaceCard({
  ws,
  tools,
  isEditing,
  editForm,
  onStartEdit,
  onCancelEdit,
  onChangeForm,
  onSave,
  saving,
  onReset,
  onToggleTool,
}: {
  ws: Workspace;
  tools: ToolDef[];
  isEditing: boolean;
  editForm: Workspace | null;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onChangeForm: (w: Workspace) => void;
  onSave: () => void;
  saving: boolean;
  onReset: () => void;
  onToggleTool: (name: string) => void;
}) {
  const form = editForm || ws;
  const isCustom = !ws.isDefault;

  if (isEditing && editForm) {
    return (
      <Card className="border-cognition/40">
        <div className="space-y-4">
          {/* 头部：职业 + 颜色 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{editForm.icon}</span>
              <div>
                <input
                  value={editForm.displayName}
                  onChange={(e) => onChangeForm({ ...editForm, displayName: e.target.value })}
                  className="rounded border border-border bg-background/50 px-2 py-1 text-sm font-semibold text-foreground focus:border-cognition/50 focus:outline-none"
                />
                <div className="mt-1 flex items-center gap-1.5">
                  <code className="rounded ios-glass-sm px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                    {editForm.profession}
                  </code>
                  <span className="rounded ios-glass-sm px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    编辑中
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={onCancelEdit}
              className="rounded-lg p-1 text-muted-foreground hover:bg-primary/10 hover:text-primary"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Icon 选择 */}
          <div>
            <label className="text-xs font-medium text-foreground">图标</label>
            <input
              value={editForm.icon}
              onChange={(e) => onChangeForm({ ...editForm, icon: e.target.value })}
              className="mt-1 w-20 rounded border border-border bg-background/50 px-2 py-1 text-center text-lg focus:border-cognition/50 focus:outline-none"
              maxLength={4}
            />
          </div>

          {/* 颜色主题 */}
          <div>
            <label className="text-xs font-medium text-foreground">颜色主题</label>
            <div className="mt-1.5 flex gap-1.5">
              {ACCENT_COLORS.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => onChangeForm({ ...editForm, accentColor: c.key })}
                  className={`flex h-7 w-7 items-center justify-center rounded-full ${c.cls} transition-transform ${
                    editForm.accentColor === c.key ? "scale-110 ring-2 ring-foreground" : "opacity-50"
                  }`}
                  title={c.label}
                />
              ))}
            </div>
          </div>

          {/* 描述 */}
          <div>
            <label className="text-xs font-medium text-foreground">职业描述</label>
            <textarea
              value={editForm.description || ""}
              onChange={(e) => onChangeForm({ ...editForm, description: e.target.value })}
              rows={2}
              className="mt-1 w-full resize-none rounded-lg border border-border bg-background/50 px-2 py-1.5 text-xs text-foreground focus:border-cognition/50 focus:outline-none"
              placeholder="描述该职业的职责与 AI 应关注的重点"
            />
          </div>

          {/* 1) System Prompt */}
          <div>
            <label className="text-xs font-medium text-foreground">
              System Prompt（职业化角色设定）
            </label>
            <textarea
              value={editForm.systemPrompt || ""}
              onChange={(e) => onChangeForm({ ...editForm, systemPrompt: e.target.value })}
              rows={4}
              className="mt-1 w-full resize-none rounded-lg border border-border bg-background/50 px-2 py-1.5 text-xs text-foreground focus:border-cognition/50 focus:outline-none"
              placeholder="例如：你是资深产品经理，擅长把模糊想法拆解为可执行的产品需求..."
            />
          </div>

          {/* 2) 默认模型 */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs font-medium text-foreground">默认 Provider</label>
              <select
                value={editForm.defaultProvider || ""}
                onChange={(e) => onChangeForm({ ...editForm, defaultProvider: e.target.value || null })}
                className="mt-1 w-full appearance-none rounded border border-border bg-background/50 px-2 py-1 text-xs focus:border-cognition/50 focus:outline-none"
              >
                <option value="">（使用全局默认）</option>
                <option value="deepseek">DeepSeek</option>
                <option value="mimo">MiMo</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-foreground">模型</label>
              <input
                value={editForm.defaultModel || ""}
                onChange={(e) => onChangeForm({ ...editForm, defaultModel: e.target.value || null })}
                placeholder="deepseek-chat"
                className="mt-1 w-full rounded border border-border bg-background/50 px-2 py-1 text-xs focus:border-cognition/50 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-foreground">推理模式</label>
              <select
                value={editForm.defaultReasoningMode || ""}
                onChange={(e) => onChangeForm({ ...editForm, defaultReasoningMode: e.target.value || null })}
                className="mt-1 w-full appearance-none rounded border border-border bg-background/50 px-2 py-1 text-xs focus:border-cognition/50 focus:outline-none"
              >
                <option value="">（无）</option>
                {REASONING_MODES.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 2.1) 允许的 AI 大模型（限制该职业用户只能用列表内的 provider） */}
          <div>
            <label className="text-xs font-medium text-foreground">
              允许的 AI 大模型（{editForm.allowedProviders.length} 个选中 · 不选=不限制）
            </label>
            <div className="mt-1.5 flex gap-2">
              {[
                { key: "deepseek", label: "DeepSeek" },
                { key: "mimo", label: "MiMo" },
              ].map((p) => {
                const checked = editForm.allowedProviders.includes(p.key);
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => {
                      const exists = editForm.allowedProviders.includes(p.key);
                      const next = exists
                        ? editForm.allowedProviders.filter((x) => x !== p.key)
                        : [...editForm.allowedProviders, p.key];
                      onChangeForm({ ...editForm, allowedProviders: next });
                    }}
                    className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
                      checked
                        ? "border-cognition bg-cognition/10 text-cognition"
                        : "border-border bg-background text-muted-foreground hover:border-cognition/30"
                    }`}
                  >
                    {checked && "✓ "}
                    {p.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">
              选中后，该职业用户只能使用选中的大模型（即使用户自配了其他模型的 Key）
            </p>
          </div>

          {/* 3) 可见工具白名单 */}
          <div>
            <label className="text-xs font-medium text-foreground">
              可见 AI 工具白名单（{editForm.allowedTools.length} / {tools.length}）
            </label>
            <div className="mt-1.5 max-h-32 space-y-1 overflow-y-auto rounded-lg border border-border bg-background/30 p-2">
              {tools.map((t) => {
                const checked = editForm.allowedTools.includes(t.name);
                return (
                  <button
                    key={t.name}
                    type="button"
                    onClick={() => onToggleTool(t.name)}
                    className={`flex w-full items-start gap-2 rounded border px-2 py-1 text-left text-[11px] transition-all ${
                      checked
                        ? "border-cognition/40 bg-cognition/5"
                        : "ios-glass-sm hover:bg-primary/10 hover:text-primary"
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border transition-colors ${
                        checked
                          ? "border-cognition bg-cognition text-primary-foreground"
                          : "glass-card"
                      }`}
                    >
                      {checked && <Check className="h-2.5 w-2.5" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <code className="text-[10px] font-mono text-foreground">{t.name}</code>
                      <p className="truncate text-[10px] text-muted-foreground">{t.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 启用开关 */}
          <label className="flex cursor-pointer items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={editForm.enabled}
              onChange={(e) => onChangeForm({ ...editForm, enabled: e.target.checked })}
              className="h-4 w-4 rounded border-border text-cognition focus:ring-cognition"
            />
            <span className="font-medium text-foreground">启用此工作空间</span>
            <span className="text-[10px] text-muted-foreground">
              （未启用时该岗位回退到默认配置）
            </span>
          </label>

          {/* 底部按钮 */}
          <div className="flex justify-end gap-2 border-t border-border pt-3">
            <Button variant="outline" onClick={onCancelEdit} type="button">
              取消
            </Button>
            <Button onClick={onSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  保存中...
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5" />
                  保存
                </>
              )}
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  // 只读模式
  const accentCls = ACCENT_COLORS.find((c) => c.key === ws.accentColor)?.cls || "bg-orange-500";

  return (
    <Card>
      <div className="space-y-3">
        {/* 头部 */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl ios-glass-sm text-xl">
              {ws.icon}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-semibold text-foreground">{ws.displayName}</h3>
                <div className={`h-2 w-2 rounded-full ${accentCls}`} />
              </div>
              <code className="text-[10px] font-mono text-muted-foreground">
                {ws.profession}
              </code>
            </div>
          </div>
          {isCustom ? (
            <span className="rounded bg-cognition/10 px-1.5 py-0.5 text-[10px] text-cognition">
              已自定义
            </span>
          ) : (
            <span className="rounded ios-glass-sm px-1.5 py-0.5 text-[10px] text-muted-foreground">
              默认
            </span>
          )}
        </div>

        {/* 3 维度速览 */}
        <div className="space-y-1.5 text-[11px]">
          <div className="flex items-start gap-1.5">
            <Bot className="mt-0.5 h-3 w-3 shrink-0 text-cognition" />
            <div className="min-w-0">
              <span className="text-muted-foreground">System Prompt：</span>
              <span className="text-foreground">
                {ws.systemPrompt ? `${ws.systemPrompt.slice(0, 60)}...` : "未配置"}
              </span>
            </div>
          </div>
          <div className="flex items-start gap-1.5">
            <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-cognition" />
            <div className="min-w-0">
              <span className="text-muted-foreground">默认模型：</span>
              <span className="text-foreground">
                {ws.defaultProvider
                  ? `${ws.defaultProvider} · ${ws.defaultModel || "默认"} · ${ws.defaultReasoningMode || "标准"}`
                  : "使用全局默认"}
              </span>
            </div>
          </div>
          <div className="flex items-start gap-1.5">
            <Wrench className="mt-0.5 h-3 w-3 shrink-0 text-cognition" />
            <div className="min-w-0">
              <span className="text-muted-foreground">可见工具：</span>
              <span className="text-foreground">
                {ws.allowedTools.length > 0
                  ? `${ws.allowedTools.length} 个（${ws.allowedTools.slice(0, 3).join("、")}${
                      ws.allowedTools.length > 3 ? "..." : ""
                    }）`
                  : "全部"}
              </span>
            </div>
          </div>
        </div>

        {/* 状态 */}
        <div className="flex items-center justify-between border-t border-border pt-2">
          <span
            className={`inline-flex items-center gap-1 text-[10px] ${
              ws.enabled ? "text-cognition" : "text-muted-foreground"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                ws.enabled ? "bg-cognition" : "bg-muted-foreground"
              }`}
            />
            {ws.enabled ? "已启用" : "未启用（回退到默认）"}
          </span>
          <div className="flex gap-1">
            {isCustom && (
              <button
                onClick={onReset}
                title="重置为默认配置"
                className="rounded p-1 text-muted-foreground hover:bg-primary/10 hover:text-primary"
              >
                <RotateCcw className="h-3 w-3" />
              </button>
            )}
            <Button variant="outline" size="sm" onClick={onStartEdit}>
              <Wrench className="h-3 w-3" />
              配置
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  Bot,
  Plus,
  Trash2,
  Play,
  Power,
  Loader2,
  Send,
  Sparkles,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Pencil,
} from "lucide-react";
import { PageHeader, Card, Button, Badge } from "@/components/layout/PageHeader";
import { HelpButton } from "@/components/layout/HelpButton";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import {
  PATROL_TEMPLATES,
  type PatrolTemplate,
} from "@/lib/patrol-templates";

// 巡检规则类型
interface PatrolRule {
  id: string;
  name: string;
  description: string;
  scope: "inbox" | "board" | "graveyard" | "all";
  triggerTime: string;
  prompt: string;
  threshold: number;
  notifyChannels: string[];
  enabled: boolean;
  lastRunAt: string | null;
  createdAt: string;
}

// 巡检日志类型
interface PatrolLog {
  id: string;
  ruleId: string;
  ruleName: string;
  scope: string;
  success: boolean;
  results: Array<{
    itemId: string;
    itemType?: "idea" | "task" | "graveyard";
    content: string;
    matched: boolean;
    reason: string;
    suggestion: string;
  }>;
  hitCount: number;
  durationMs: number;
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
}

// 聊天消息类型
interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  suggestedRule?: PatrolRuleDraft | null;
}

// 规则草案类型（编辑模式下可携带 id）
interface PatrolRuleDraft {
  id?: string;
  name: string;
  description: string;
  scope: string;
  triggerTime: string;
  prompt: string;
  threshold: number;
  notifyChannels: string[];
  enabled: boolean;
}

const SCOPE_LABELS: Record<string, string> = {
  inbox: "Inbox 灵感",
  board: "决策看板",
  graveyard: "灵感墓地",
  all: "全部范围",
};

const CHANNEL_LABELS: Record<string, string> = {
  toast: "Toast",
  notification: "浏览器通知",
  push: "Web Push",
  feishu: "飞书",
};

export default function PatrolSettingsPage() {
  const [rules, setRules] = useState<PatrolRule[]>([]);
  const [logs, setLogs] = useState<PatrolLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<string | null>(null);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  // 编辑弹窗状态：editingRule 不为 null 时显示编辑弹窗
  const [editingRule, setEditingRule] = useState<PatrolRule | null>(null);

  // 模板预填状态：使用模板时携带的初始数据
  const [templateInitial, setTemplateInitial] = useState<PatrolTemplate | null>(null);

  // 巡检结果操作中：记录正在处理的 itemId，避免重复点击
  const [actingItemId, setActingItemId] = useState<string | null>(null);

  // 聊天状态
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [pendingRule, setPendingRule] = useState<PatrolRuleDraft | null>(null);
  const [savingRule, setSavingRule] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // AI 对话模式：create=创建新规则，edit=编辑现有规则
  const [chatMode, setChatMode] = useState<"create" | "edit">("create");
  // 编辑模式下选中的规则 ID
  const [editTargetRuleId, setEditTargetRuleId] = useState<string>("");

  // 加载规则列表
  const loadRules = useCallback(async () => {
    try {
      const res = await fetch("/api/patrol/rules");
      if (res.ok) {
        const data = await res.json();
        setRules(data.rules || []);
      }
    } catch (e) {
      console.error(e);
      toast("加载规则失败", "error");
    }
  }, []);

  // 加载日志
  const loadLogs = useCallback(async () => {
    try {
      const res = await fetch("/api/patrol/logs?limit=10");
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([loadRules(), loadLogs()]);
      setLoading(false);
    };
    load();
  }, [loadRules, loadLogs]);

  // 滚动到聊天底部
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // 切换规则启用状态
  const toggleRule = async (rule: PatrolRule) => {
    try {
      const res = await fetch(`/api/patrol/rules/${rule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !rule.enabled }),
      });
      if (res.ok) {
        toast(rule.enabled ? "规则已禁用" : "规则已启用", "success");
        loadRules();
      } else {
        toast("操作失败", "error");
      }
    } catch {
      toast("网络错误", "error");
    }
  };

  // 删除规则
  const deleteRule = async (rule: PatrolRule) => {
    if (!confirm(`确定删除规则「${rule.name}」？关联的日志也会一并删除。`)) return;
    try {
      const res = await fetch(`/api/patrol/rules/${rule.id}`, { method: "DELETE" });
      if (res.ok) {
        toast("规则已删除", "success");
        loadRules();
        loadLogs();
      } else {
        toast("删除失败", "error");
      }
    } catch {
      toast("网络错误", "error");
    }
  };

  // 手动执行巡检
  const runPatrol = async (rule: PatrolRule) => {
    setRunning(rule.id);
    try {
      const res = await fetch("/api/patrol/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ruleId: rule.id }),
      });
      const data = await res.json();
      if (res.ok) {
        toast(`巡检完成 · 命中 ${data.hitCount} 项`, "success");
        loadRules();
        loadLogs();
      } else {
        toast(data.error || "巡检失败", "error");
      }
    } catch {
      toast("网络错误", "error");
    } finally {
      setRunning(null);
    }
  };

  // 检查模板是否已被添加为规则（按 name 匹配）
  const isTemplateAdded = (template: PatrolTemplate): boolean => {
    return rules.some((r) => r.name === template.name);
  };

  // 使用模板：用模板数据预填创建表单
  const useTemplate = (template: PatrolTemplate) => {
    if (isTemplateAdded(template)) {
      toast("该模板已添加为规则", "info");
      return;
    }
    setEditingRule(null);
    setTemplateInitial(template);
    setShowAddForm(true);
  };

  // 处理巡检结果项的操作（拖入看板 / 送入墓地 / 完成 / 复活）
  const handleResultAction = async (
    item: {
      itemId: string;
      itemType?: "idea" | "task" | "graveyard";
      suggestion: string;
      reason: string;
    },
    action: "board" | "abandon" | "done" | "revive"
  ) => {
    setActingItemId(item.itemId);
    try {
      let res: Response;
      if (action === "board") {
        // inbox 灵感拖入看板
        res = await fetch(`/api/ideas/${item.itemId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "board", column: "task" }),
        });
      } else if (action === "abandon") {
        // inbox 灵感送入墓地（reason/reviveCondition 用巡检建议或默认值）
        const reason = item.reason || item.suggestion || "巡检建议送入墓地";
        res = await fetch(`/api/ideas/${item.itemId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "abandon",
            reason,
            reviveCondition: "待补充复活条件",
          }),
        });
      } else if (action === "done") {
        // 看板任务标记完成
        res = await fetch(`/api/tasks/${item.itemId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "done" }),
        });
      } else {
        // 墓地灵感复活
        res = await fetch(`/api/graveyard`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ graveyardId: item.itemId }),
        });
      }

      if (res.ok) {
        const actionLabels: Record<string, string> = {
          board: "已拖入看板",
          abandon: "已送入墓地",
          done: "任务已完成",
          revive: "已复活",
        };
        toast(actionLabels[action], "success");
        loadLogs();
      } else {
        const err = await res.json().catch(() => ({}));
        toast(err.error || "操作失败", "error");
      }
    } catch {
      toast("网络错误", "error");
    } finally {
      setActingItemId(null);
    }
  };

  // 根据巡检结果项的类型和建议推断可执行的操作
  const inferResultAction = (
    item: {
      itemType?: "idea" | "task" | "graveyard";
      suggestion: string;
    }
  ): "board" | "abandon" | "done" | "revive" | null => {
    const sug = item.suggestion || "";
    if (item.itemType === "idea") {
      if (sug.includes("看板") || sug.includes("拖入")) return "board";
      if (sug.includes("墓地") || sug.includes("放弃")) return "abandon";
    }
    if (item.itemType === "task") {
      if (sug.includes("完成") || sug.includes("推进")) return "done";
    }
    if (item.itemType === "graveyard") {
      if (sug.includes("复活") || sug.includes("恢复")) return "revive";
    }
    return null;
  };

  // 发送聊天消息
  const sendChat = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg = chatInput.trim();
    const newMessages: ChatMessage[] = [
      ...chatMessages,
      { role: "user", content: userMsg },
    ];
    setChatMessages(newMessages);
    setChatInput("");
    setChatLoading(true);
    setPendingRule(null);

    // 编辑模式下需要选中规则
    const editRuleId =
      chatMode === "edit" && editTargetRuleId ? editTargetRuleId : undefined;

    try {
      const res = await fetch("/api/patrol/config-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMsg,
          history: newMessages.slice(-10).map((m) => ({
            role: m.role,
            content: m.content,
          })),
          editRuleId,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setChatMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.reply || "（无回复）",
            suggestedRule: data.suggestedRule || null,
          },
        ]);
        if (data.suggestedRule) {
          setPendingRule(data.suggestedRule);
        }
      } else {
        toast(data.error || "AI 对话失败", "error");
      }
    } catch {
      toast("网络错误", "error");
    } finally {
      setChatLoading(false);
    }
  };

  // 保存 AI 生成的规则草案（有 id 走 PATCH 编辑，无 id 走 POST 创建）
  const savePendingRule = async () => {
    if (!pendingRule) return;
    setSavingRule(true);
    try {
      const isEdit = !!pendingRule.id;
      const url = isEdit
        ? `/api/patrol/rules/${pendingRule.id}`
        : "/api/patrol/rules";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pendingRule),
      });
      if (res.ok) {
        toast(isEdit ? "规则已更新" : "规则已保存", "success");
        setPendingRule(null);
        loadRules();
      } else {
        const err = await res.json();
        toast(err.error || "保存失败", "error");
      }
    } catch {
      toast("网络错误", "error");
    } finally {
      setSavingRule(false);
    }
  };

  return (
    <div className="p-4 sm:p-8">
      <PageHeader
        title="AI 巡检"
        subtitle="可配置的智能巡检：对象 + 时间 + 规则 + 通知"
        action={
          <HelpButton contentKey="settings-patrol" />
        }
      />

      {/* 模板库：预置常用巡检规则模板 */}
      <Card className="mb-4 p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-cognition" />
            <h2 className="text-sm font-semibold">模板库</h2>
            <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
              {PATROL_TEMPLATES.length} 个预置模板
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground">一键应用并自定义</span>
        </div>
        <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2">
          {PATROL_TEMPLATES.map((tpl) => {
            const added = isTemplateAdded(tpl);
            return (
              <div
                key={tpl.id}
                className="flex flex-col rounded-xl border border-border bg-background p-3 transition-all hover:border-primary/30"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-xs font-semibold text-foreground">{tpl.name}</h3>
                      <Badge color="cognition">{SCOPE_LABELS[tpl.scope] || tpl.scope}</Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {tpl.triggerTime === "manual" ? "手动" : tpl.triggerTime}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground line-clamp-2">
                      {tpl.description}
                    </p>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-end gap-1.5">
                  {added && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-task/10 px-2 py-0.5 text-[10px] font-medium text-task">
                      <CheckCircle2 className="h-3 w-3" />
                      已添加
                    </span>
                  )}
                  <Button
                    size="sm"
                    variant={added ? "outline" : "primary"}
                    onClick={() => useTemplate(tpl)}
                    disabled={added}
                  >
                    <Plus className="h-3 w-3" />
                    使用此模板
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* 左侧：巡检规则列表 */}
        <Card className="p-0">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-cognition" />
              <h2 className="text-sm font-semibold">巡检规则</h2>
              <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                {rules.length}
              </span>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setShowAddForm((v) => !v)}>
              <Plus className="h-3.5 w-3.5" /> 新增
            </Button>
          </div>

          <div className="max-h-[600px] space-y-2 overflow-y-auto p-3">
            {loading ? (
              <div className="flex h-32 items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : rules.length === 0 ? (
              <div className="flex h-32 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 text-center">
                <span className="text-xs text-muted-foreground">
                  暂无巡检规则
                  <br />
                  可在右侧通过 AI 对话快速创建
                </span>
              </div>
            ) : (
              rules.map((rule) => (
                <div
                  key={rule.id}
                  className={cn(
                    "rounded-xl border border-border bg-background p-3 transition-all",
                    !rule.enabled && "opacity-60"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-xs font-semibold text-foreground">{rule.name}</h3>
                        <Badge color="cognition">{SCOPE_LABELS[rule.scope] || rule.scope}</Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {rule.triggerTime === "manual" ? "手动" : rule.triggerTime}
                        </span>
                      </div>
                      {rule.description && (
                        <p className="mt-1 text-[11px] text-muted-foreground line-clamp-2">
                          {rule.description}
                        </p>
                      )}
                      <div className="mt-1.5 flex flex-wrap items-center gap-1">
                        {rule.notifyChannels.map((ch) => (
                          <span
                            key={ch}
                            className="rounded bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground"
                          >
                            {CHANNEL_LABELS[ch] || ch}
                          </span>
                        ))}
                        {rule.lastRunAt && (
                          <span className="ml-auto text-[9px] text-muted-foreground/70">
                            上次：{new Date(rule.lastRunAt).toLocaleString("zh-CN")}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => runPatrol(rule)}
                      disabled={running === rule.id}
                    >
                      {running === rule.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Play className="h-3 w-3" />
                      )}
                      执行
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingRule(rule)}
                      title="编辑"
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => toggleRule(rule)}
                      title={rule.enabled ? "禁用" : "启用"}
                    >
                      <Power
                        className={cn(
                          "h-3 w-3",
                          rule.enabled ? "text-task" : "text-muted-foreground"
                        )}
                      />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteRule(rule)}
                      className="text-graveyard hover:bg-graveyard/10"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* 右侧：AI 对话配置区 */}
        <Card className="p-0">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-cognition" />
              <h2 className="text-sm font-semibold">AI 对话配置</h2>
            </div>
            <span className="text-[10px] text-muted-foreground">自然语言描述需求</span>
          </div>

          {/* 模式切换：创建新规则 / 编辑现有规则 */}
          <div className="flex items-center gap-2 border-b border-border bg-muted/20 px-4 py-2">
            <button
              onClick={() => {
                setChatMode("create");
                setEditTargetRuleId("");
                setPendingRule(null);
                setChatMessages([]);
              }}
              className={cn(
                "rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors",
                chatMode === "create"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              创建新规则
            </button>
            <button
              onClick={() => {
                setChatMode("edit");
                setPendingRule(null);
                setChatMessages([]);
              }}
              className={cn(
                "rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors",
                chatMode === "edit"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              编辑现有规则
            </button>
          </div>

          {/* 编辑模式：选择要编辑的规则 */}
          {chatMode === "edit" && (
            <div className="flex items-center gap-2 border-b border-border bg-cognition/5 px-4 py-2">
              <span className="text-[11px] text-muted-foreground">选择规则：</span>
              <select
                value={editTargetRuleId}
                onChange={(e) => {
                  setEditTargetRuleId(e.target.value);
                  setPendingRule(null);
                  setChatMessages([]);
                }}
                className="flex-1 rounded-lg border border-border bg-background px-2 py-1 text-[11px] outline-none focus:border-primary"
              >
                <option value="">请选择要编辑的规则</option>
                {rules.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}（{SCOPE_LABELS[r.scope] || r.scope}）
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex h-[600px] flex-col">
            {/* 消息列表 */}
            <div className="flex-1 space-y-3 overflow-y-auto p-3">
              {chatMessages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <Bot className="mb-3 h-10 w-10 text-cognition/40" />
                  {chatMode === "create" ? (
                    <>
                      <p className="text-xs text-muted-foreground">
                        描述你的巡检需求，AI 会帮你生成规则
                      </p>
                      <p className="mt-1 text-[10px] text-muted-foreground/70">
                        例如：每天 10 点检查灵感墓地，看是否有新灵感命中复活条件
                      </p>
                    </>
                  ) : editTargetRuleId ? (
                    <>
                      <p className="text-xs text-muted-foreground">
                        描述你想如何修改这条规则，AI 会给出修改建议
                      </p>
                      <p className="mt-1 text-[10px] text-muted-foreground/70">
                        例如：把触发时间改成每天 14:00，并增加飞书通知
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      请先在上方选择要编辑的规则
                    </p>
                  )}
                </div>
              ) : (
                chatMessages.map((msg, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex",
                      msg.role === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[85%] rounded-xl px-3 py-2 text-xs",
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-foreground"
                      )}
                    >
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                ))
              )}
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="rounded-xl bg-muted px-3 py-2">
                    <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* 规则草案确认区 */}
            {pendingRule && (
              <div className="border-t border-border bg-cognition/5 p-3">
                <div className="mb-2 flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-cognition" />
                  <span className="text-[11px] font-medium text-cognition">
                    {pendingRule.id ? "AI 建议的修改方案" : "AI 生成的规则草案"}
                  </span>
                </div>
                <div className="mb-2 space-y-1 text-[11px] text-foreground/80">
                  <div>
                    <strong>名称：</strong>
                    {pendingRule.name}
                  </div>
                  <div>
                    <strong>对象：</strong>
                    {SCOPE_LABELS[pendingRule.scope] || pendingRule.scope}
                  </div>
                  <div>
                    <strong>时间：</strong>
                    {pendingRule.triggerTime === "manual" ? "手动" : pendingRule.triggerTime}
                  </div>
                  <div>
                    <strong>通知：</strong>
                    {pendingRule.notifyChannels.map((ch) => CHANNEL_LABELS[ch] || ch).join("、")}
                  </div>
                  <div className="line-clamp-3">
                    <strong>提示词：</strong>
                    {pendingRule.prompt}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={savePendingRule} disabled={savingRule}>
                    {savingRule ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-3 w-3" />
                    )}
                    {pendingRule.id ? "应用修改" : "保存为规则"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setPendingRule(null)}>
                    丢弃
                  </Button>
                </div>
              </div>
            )}

            {/* 输入区 */}
            <div className="border-t border-border p-3">
              <div className="flex items-end gap-2">
                <textarea
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendChat();
                    }
                  }}
                  placeholder={
                    chatMode === "edit" && !editTargetRuleId
                      ? "请先选择要编辑的规则..."
                      : chatMode === "edit"
                      ? "描述你想如何修改这条规则..."
                      : "描述你的巡检需求..."
                  }
                  rows={2}
                  className="flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2 text-xs outline-none transition-colors focus:border-primary"
                />
                <Button
                  size="sm"
                  onClick={sendChat}
                  disabled={
                    chatLoading ||
                    !chatInput.trim() ||
                    (chatMode === "edit" && !editTargetRuleId)
                  }
                >
                  {chatLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* 底部：巡检日志 */}
      <Card className="mt-4 p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">巡检日志</h2>
            <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
              最近 {logs.length} 条
            </span>
          </div>
        </div>

        <div className="space-y-2 p-3">
          {logs.length === 0 ? (
            <div className="flex h-20 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 text-center">
              <span className="text-xs text-muted-foreground">暂无巡检日志</span>
            </div>
          ) : (
            logs.map((log) => {
              const isExpanded = expandedLog === log.id;
              return (
                <div
                  key={log.id}
                  className="rounded-xl border border-border bg-background p-3"
                >
                  <button
                    onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                    className="flex w-full items-center justify-between text-left"
                  >
                    <div className="flex items-center gap-2">
                      {isExpanded ? (
                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                      {log.success ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-task" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5 text-graveyard" />
                      )}
                      <span className="text-xs font-medium text-foreground">
                        {log.ruleName}
                      </span>
                      <Badge color="cognition">{SCOPE_LABELS[log.scope] || log.scope}</Badge>
                      {log.hitCount > 0 && (
                        <span className="rounded-full bg-campaign/10 px-2 py-0.5 text-[10px] font-medium text-campaign">
                          命中 {log.hitCount}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(log.startedAt).toLocaleString("zh-CN")} · {log.durationMs}ms
                    </span>
                  </button>

                  {isExpanded && (
                    <div className="mt-2 space-y-2 border-t border-border pt-2">
                      {log.error && (
                        <div className="flex items-start gap-1.5 rounded-lg bg-graveyard/5 p-2 text-[11px] text-graveyard">
                          <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
                          <span>{log.error}</span>
                        </div>
                      )}
                      {Array.isArray(log.results) && log.results.length > 0 ? (
                        log.results.map((r, i) => {
                          // 推断可执行的操作（仅命中的项才显示操作按钮）
                          const action = r.matched ? inferResultAction(r) : null;
                          const actionLabels: Record<string, string> = {
                            board: "拖入看板",
                            abandon: "送入墓地",
                            done: "完成",
                            revive: "复活",
                          };
                          return (
                            <div
                              key={i}
                              className={cn(
                                "rounded-lg border p-2 text-[11px]",
                                r.matched
                                  ? "border-campaign/30 bg-campaign/5"
                                  : "border-border bg-muted/20"
                              )}
                            >
                              <div className="flex items-center gap-1.5">
                                {r.matched ? (
                                  <CheckCircle2 className="h-3 w-3 text-campaign" />
                                ) : (
                                  <XCircle className="h-3 w-3 text-muted-foreground" />
                                )}
                                <span className="font-medium text-foreground">
                                  {r.content || r.itemId}
                                </span>
                                {r.itemType && (
                                  <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground">
                                    {r.itemType === "idea"
                                      ? "灵感"
                                      : r.itemType === "task"
                                      ? "任务"
                                      : "墓地"}
                                  </span>
                                )}
                              </div>
                              {r.reason && (
                                <p className="mt-1 text-muted-foreground">理由：{r.reason}</p>
                              )}
                              {r.suggestion && (
                                <p className="mt-0.5 text-cognition">建议：{r.suggestion}</p>
                              )}
                              {action && (
                                <div className="mt-1.5 flex justify-end">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleResultAction(r, action)}
                                    disabled={actingItemId === r.itemId}
                                  >
                                    {actingItemId === r.itemId ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <Play className="h-3 w-3" />
                                    )}
                                    {actionLabels[action]}
                                  </Button>
                                </div>
                              )}
                            </div>
                          );
                        })
                      ) : (
                        !log.error && (
                          <p className="text-[11px] text-muted-foreground">无巡检结果</p>
                        )
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </Card>

      {/* 新增规则表单（折叠） */}
      {showAddForm && (
        <AddRuleForm
          initialTemplate={templateInitial}
          onClose={() => {
            setShowAddForm(false);
            setTemplateInitial(null);
          }}
          onSaved={() => {
            setShowAddForm(false);
            setTemplateInitial(null);
            loadRules();
          }}
        />
      )}

      {/* 编辑规则弹窗 */}
      {editingRule && (
        <AddRuleForm
          initialRule={editingRule}
          onClose={() => setEditingRule(null)}
          onSaved={() => {
            setEditingRule(null);
            loadRules();
          }}
        />
      )}
    </div>
  );
}

// 规则表单组件（同时支持新增与编辑：传入 initialRule 即为编辑模式，传入 initialTemplate 用模板预填）
function AddRuleForm({
  onClose,
  onSaved,
  initialRule,
  initialTemplate,
}: {
  onClose: () => void;
  onSaved: () => void;
  initialRule?: PatrolRule | null;
  initialTemplate?: PatrolTemplate | null;
}) {
  const isEdit = !!initialRule;
  const [form, setForm] = useState<PatrolRuleDraft>(
    initialRule
      ? {
          id: initialRule.id,
          name: initialRule.name,
          description: initialRule.description,
          scope: initialRule.scope,
          triggerTime: initialRule.triggerTime,
          prompt: initialRule.prompt,
          threshold: initialRule.threshold,
          notifyChannels: initialRule.notifyChannels,
          enabled: initialRule.enabled,
        }
      : initialTemplate
      ? {
          // 用模板预填表单，用户可修改后保存
          name: initialTemplate.name,
          description: initialTemplate.description,
          scope: initialTemplate.scope,
          triggerTime: initialTemplate.triggerTime,
          prompt: initialTemplate.prompt,
          threshold: initialTemplate.threshold,
          notifyChannels: initialTemplate.notifyChannels,
          enabled: true,
        }
      : {
          name: "",
          description: "",
          scope: "graveyard",
          triggerTime: "manual",
          prompt: "",
          threshold: 0.75,
          notifyChannels: ["toast", "notification"],
          enabled: true,
        }
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast("规则名称不能为空", "error");
      return;
    }
    if (!form.prompt.trim()) {
      toast("巡检提示词不能为空", "error");
      return;
    }
    setSaving(true);
    try {
      // 编辑模式走 PATCH，创建模式走 POST
      const url = isEdit ? `/api/patrol/rules/${form.id}` : "/api/patrol/rules";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        toast(isEdit ? "规则已更新" : "规则已创建", "success");
        onSaved();
      } else {
        const err = await res.json();
        toast(err.error || (isEdit ? "更新失败" : "创建失败"), "error");
      }
    } catch {
      toast("网络错误", "error");
    } finally {
      setSaving(false);
    }
  };

  const toggleChannel = (ch: string) => {
    setForm((prev) => ({
      ...prev,
      notifyChannels: prev.notifyChannels.includes(ch)
        ? prev.notifyChannels.filter((c) => c !== ch)
        : [...prev.notifyChannels, ch],
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <Card className="w-full max-w-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold">
            {isEdit
              ? "编辑巡检规则"
              : initialTemplate
              ? "从模板创建巡检规则"
              : "新增巡检规则"}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <XCircle className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-[11px] text-muted-foreground">规则名称 *</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="如：灵感墓地复活检查"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px] text-muted-foreground">描述</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              placeholder="规则详细说明"
              className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-xs outline-none focus:border-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[11px] text-muted-foreground">巡检对象 *</label>
              <select
                value={form.scope}
                onChange={(e) => setForm({ ...form, scope: e.target.value })}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs outline-none focus:border-primary"
              >
                <option value="inbox">Inbox 灵感</option>
                <option value="board">决策看板</option>
                <option value="graveyard">灵感墓地</option>
                <option value="all">全部范围</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-muted-foreground">触发时间</label>
              <input
                value={form.triggerTime}
                onChange={(e) => setForm({ ...form, triggerTime: e.target.value })}
                placeholder="HH:mm 或 manual"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs outline-none focus:border-primary"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[11px] text-muted-foreground">巡检提示词 *</label>
            <textarea
              value={form.prompt}
              onChange={(e) => setForm({ ...form, prompt: e.target.value })}
              rows={4}
              placeholder="AI 用于分析数据的系统提示词，描述判断逻辑和关注点"
              className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-xs outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px] text-muted-foreground">通知渠道</label>
            <div className="flex flex-wrap gap-2">
              {["toast", "notification", "push", "feishu"].map((ch) => (
                <button
                  key={ch}
                  onClick={() => toggleChannel(ch)}
                  className={cn(
                    "rounded-lg border px-2.5 py-1 text-[11px] transition-colors",
                    form.notifyChannels.includes(ch)
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-transparent text-muted-foreground hover:bg-muted"
                  )}
                >
                  {CHANNEL_LABELS[ch] || ch}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {isEdit ? "保存修改" : "保存"}
          </Button>
        </div>
      </Card>
    </div>
  );
}

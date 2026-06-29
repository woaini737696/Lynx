"use client";

// 认证配置区块（仅管理员可见）
// 包含：万能验证码开关+配置、邀请码批量生成+列表管理
// 对应 API：/api/settings/auth-config、/api/admin/invite-codes

import { useEffect, useState, useCallback } from "react";
import {
  ShieldCheck,
  KeyRound,
  Plus,
  Copy,
  Check,
  Loader2,
  Save,
  Ban,
  Search,
  RefreshCw,
  AlertCircle,
  Ticket,
  X,
} from "lucide-react";
import { Card, Button } from "@/components/layout/PageHeader";
import { Modal } from "@/components/ui/Modal";
import { toast } from "@/components/ui/toast";

type InviteItem = {
  id: string;
  code: string;
  status: "unused" | "used" | "disabled";
  createdBy: string;
  usedBy?: string | null;
  usedAt?: string | null;
  expiresAt?: string | null;
  remark?: string | null;
  createdAt: string;
};

type InviteListResp = {
  items: InviteItem[];
  total: number;
  page: number;
  pageSize: number;
  stats: { unused: number; used: number; disabled: number };
};

type AuthConfig = {
  masterCode: string;
  enabled: boolean;
  configured: boolean;
};

export function AuthConfigSection() {
  return (
    <>
      <MasterCodeCard />
      <InviteCodesCard />
    </>
  );
}

// ============ 万能验证码配置 ============

function MasterCodeCard() {
  const [config, setConfig] = useState<AuthConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [code, setCode] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [showCode, setShowCode] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/auth-config");
      if (res.status === 403 || res.status === 401) {
        setConfig(null);
        return;
      }
      if (!res.ok) throw new Error("加载失败");
      const data = (await res.json()) as AuthConfig;
      setConfig(data);
      setCode(data.masterCode || "");
      setEnabled(data.enabled);
    } catch {
      toast("加载万能验证码配置失败", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const body: Record<string, unknown> = { enabled };
      if (code.trim()) {
        body.masterCode = code.trim();
      }
      const res = await fetch("/api/settings/auth-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast(data.error || "保存失败", "error");
        return;
      }
      toast("万能验证码配置已保存", "success");
      await load();
    } catch {
      toast("网络错误", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card className="mb-5">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> 加载中...
        </div>
      </Card>
    );
  }

  // 非管理员
  if (!config) {
    return (
      <Card className="mb-5">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <AlertCircle className="h-3.5 w-3.5" />
          <span>仅管理员可配置万能验证码</span>
        </div>
      </Card>
    );
  }

  return (
    <Card className="mb-5">
      <div className="mb-4 flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-cognition" />
        <h2 className="text-sm font-semibold text-foreground">万能验证码配置</h2>
        <span
          className={`ml-auto inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-medium ${
            config.enabled
              ? "bg-task/10 text-task"
              : "bg-muted-foreground/10 text-muted-foreground"
          }`}
        >
          {config.enabled ? "已启用" : "未启用"}
        </span>
      </div>

      <div className="space-y-4">
        {/* 启用开关 */}
        <div className="ios-glass-sm flex items-center justify-between rounded-xl p-3">
          <div>
            <div className="text-sm font-medium text-foreground">启用万能验证码</div>
            <div className="text-xs text-muted-foreground">
              开启后用户可用该验证码登录/注册（开发测试用，正式上线请关闭）
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={() => setEnabled(!enabled)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              enabled ? "bg-cognition" : "bg-muted-foreground/30"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                enabled ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {/* 验证码输入 */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            万能验证码
          </label>
          <div className="relative">
            <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type={showCode ? "text" : "password"}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={config.configured ? "已配置（输入新值可覆盖）" : "请输入验证码（至少 4 位）"}
              className="w-full rounded-lg border border-border bg-background py-2 pl-10 pr-10 text-sm text-foreground outline-none focus:border-cognition"
            />
            <button
              type="button"
              onClick={() => setShowCode((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              tabIndex={-1}
            >
              {showCode ? "隐藏" : "显示"}
            </button>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            留空保存时不会修改已配置的验证码。当前状态：
            {config.configured ? (
              <span className="text-task">已配置</span>
            ) : (
              <span className="text-graveyard">未配置</span>
            )}
          </p>
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            保存配置
          </Button>
          <Button size="sm" variant="outline" onClick={load} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            刷新
          </Button>
        </div>
      </div>
    </Card>
  );
}

// ============ 邀请码管理 ============

function InviteCodesCard() {
  const [data, setData] = useState<InviteListResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [statusFilter, setStatusFilter] = useState<"all" | "unused" | "used" | "disabled">("all");
  const [q, setQ] = useState("");
  const [showGenerate, setShowGenerate] = useState(false);
  // 生成表单
  const [genCount, setGenCount] = useState(1);
  const [genRemark, setGenRemark] = useState("");
  const [genExpiresAt, setGenExpiresAt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generatedCodes, setGeneratedCodes] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        status: statusFilter,
      });
      if (q.trim()) params.set("q", q.trim());
      const res = await fetch(`/api/admin/invite-codes?${params.toString()}`);
      if (res.status === 403 || res.status === 401) {
        setForbidden(true);
        setData(null);
        return;
      }
      if (!res.ok) throw new Error("加载失败");
      const json = (await res.json()) as InviteListResp;
      setData(json);
    } catch {
      toast("加载邀请码失败", "error");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, statusFilter, q]);

  useEffect(() => {
    load();
  }, [load]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const body: Record<string, unknown> = { count: genCount };
      if (genRemark.trim()) body.remark = genRemark.trim();
      if (genExpiresAt) body.expiresAt = new Date(genExpiresAt).toISOString();
      const res = await fetch("/api/admin/invite-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        toast(json.error || "生成失败", "error");
        return;
      }
      toast(`成功生成 ${json.codes.length} 个邀请码`, "success");
      setGeneratedCodes(json.codes as string[]);
      setShowGenerate(false);
      setGenCount(1);
      setGenRemark("");
      setGenExpiresAt("");
      await load();
    } catch {
      toast("网络错误", "error");
    } finally {
      setGenerating(false);
    }
  };

  const handleToggleStatus = async (item: InviteItem, action: "disable" | "enable") => {
    try {
      const res = await fetch("/api/admin/invite-codes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, action }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast(json.error || "操作失败", "error");
        return;
      }
      toast(action === "disable" ? "邀请码已禁用" : "邀请码已启用", "success");
      await load();
    } catch {
      toast("网络错误", "error");
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast("已复制到剪贴板", "success");
    });
  };

  const handleCopyAll = () => {
    if (!generatedCodes.length) return;
    navigator.clipboard.writeText(generatedCodes.join("\n")).then(() => {
      toast("全部邀请码已复制", "success");
    });
  };

  if (loading) {
    return (
      <Card className="mb-5">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> 加载中...
        </div>
      </Card>
    );
  }

  if (forbidden) {
    return (
      <Card className="mb-5">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <AlertCircle className="h-3.5 w-3.5" />
          <span>仅管理员可管理邀请码</span>
        </div>
      </Card>
    );
  }

  const stats = data?.stats || { unused: 0, used: 0, disabled: 0 };
  const total = data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <Card className="mb-5">
      <div className="mb-4 flex items-center gap-2">
        <Ticket className="h-4 w-4 text-northstar" />
        <h2 className="text-sm font-semibold text-foreground">邀请码管理</h2>
        <Button
          size="sm"
          onClick={() => setShowGenerate(true)}
          className="ml-auto gap-1.5"
        >
          <Plus className="h-3 w-3" />
          批量生成
        </Button>
      </div>

      {/* 统计概览 */}
      <div className="mb-4 grid grid-cols-3 gap-2">
        <div className="ios-glass-sm rounded-lg p-2.5 text-center">
          <div className="text-lg font-semibold text-task">{stats.unused}</div>
          <div className="text-[10px] text-muted-foreground">未使用</div>
        </div>
        <div className="ios-glass-sm rounded-lg p-2.5 text-center">
          <div className="text-lg font-semibold text-cognition">{stats.used}</div>
          <div className="text-[10px] text-muted-foreground">已使用</div>
        </div>
        <div className="ios-glass-sm rounded-lg p-2.5 text-center">
          <div className="text-lg font-semibold text-graveyard">{stats.disabled}</div>
          <div className="text-[10px] text-muted-foreground">已禁用</div>
        </div>
      </div>

      {/* 筛选器 */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-lg bg-foreground/[0.04] p-1">
          {(["all", "unused", "used", "disabled"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setStatusFilter(s);
                setPage(1);
              }}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                statusFilter === s
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {s === "all" ? "全部" : s === "unused" ? "未使用" : s === "used" ? "已使用" : "已禁用"}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[150px]">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="搜索邀请码或备注"
            className="w-full rounded-lg border border-border bg-background py-1.5 pl-8 pr-3 text-xs text-foreground outline-none focus:border-northstar"
          />
        </div>
        <Button size="sm" variant="ghost" onClick={load} className="gap-1.5">
          <RefreshCw className="h-3 w-3" />
          刷新
        </Button>
      </div>

      {/* 列表 */}
      {data && data.items.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-xs">
            <thead className="bg-muted/30 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">邀请码</th>
                <th className="px-3 py-2 text-left font-medium">状态</th>
                <th className="px-3 py-2 text-left font-medium">备注</th>
                <th className="px-3 py-2 text-left font-medium">过期时间</th>
                <th className="px-3 py-2 text-left font-medium">使用时间</th>
                <th className="px-3 py-2 text-left font-medium">创建时间</th>
                <th className="px-3 py-2 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item) => (
                <tr key={item.id} className="border-t border-border/50">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <code className="rounded bg-muted/40 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-foreground">
                        {item.code}
                      </code>
                      <button
                        type="button"
                        onClick={() => handleCopy(item.code)}
                        className="text-muted-foreground hover:text-foreground"
                        title="复制"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge status={item.status} />
                  </td>
                  <td className="max-w-[120px] truncate px-3 py-2 text-muted-foreground">
                    {item.remark || "-"}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {item.expiresAt ? new Date(item.expiresAt).toLocaleString("zh-CN") : "永久"}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {item.usedAt ? new Date(item.usedAt).toLocaleString("zh-CN") : "-"}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {new Date(item.createdAt).toLocaleString("zh-CN")}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {item.status === "unused" && (
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(item, "disable")}
                        className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] text-graveyard transition-colors hover:bg-graveyard/10"
                      >
                        <Ban className="h-3 w-3" />
                        禁用
                      </button>
                    )}
                    {item.status === "disabled" && (
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(item, "enable")}
                        className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] text-task transition-colors hover:bg-task/10"
                      >
                        <Check className="h-3 w-3" />
                        启用
                      </button>
                    )}
                    {item.status === "used" && (
                      <span className="text-[11px] text-muted-foreground">不可变更</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <Ticket className="h-8 w-8 text-muted-foreground/40" />
          <div className="text-sm text-muted-foreground">暂无邀请码</div>
          <Button size="sm" variant="outline" onClick={() => setShowGenerate(true)} className="gap-1.5">
            <Plus className="h-3 w-3" /> 立即生成
          </Button>
        </div>
      )}

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            第 {page} / {totalPages} 页 · 共 {total} 条
          </span>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              上一页
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              下一页
            </Button>
          </div>
        </div>
      )}

      {/* 生成弹窗 */}
      {showGenerate && (
        <Modal
          open={true}
          onClose={() => setShowGenerate(false)}
          title="批量生成邀请码"
          className="z-[200]"
        >
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                生成数量（1-100）
              </label>
              <input
                type="number"
                min={1}
                max={100}
                value={genCount}
                onChange={(e) => setGenCount(Math.min(100, Math.max(1, Number(e.target.value) || 1)))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-northstar"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">备注（可选）</label>
              <input
                type="text"
                value={genRemark}
                onChange={(e) => setGenRemark(e.target.value)}
                placeholder="如：市场部批量"
                maxLength={200}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-northstar"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                过期时间（可选，留空表示永久）
              </label>
              <input
                type="datetime-local"
                value={genExpiresAt}
                onChange={(e) => setGenExpiresAt(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-northstar"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowGenerate(false)}>
                取消
              </Button>
              <Button onClick={handleGenerate} disabled={generating}>
                {generating ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" /> 生成中...</>
                ) : (
                  <><Plus className="h-3.5 w-3.5" /> 生成</>
                )}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* 生成结果弹窗 */}
      {generatedCodes.length > 0 && (
        <Modal
          open={true}
          onClose={() => setGeneratedCodes([])}
          title={`生成成功 · ${generatedCodes.length} 个邀请码`}
          className="z-[200]"
        >
          <div className="space-y-3">
            <div className="ios-glass-sm max-h-64 overflow-y-auto rounded-lg p-3">
              {generatedCodes.map((c) => (
                <div
                  key={c}
                  className="flex items-center justify-between border-b border-border/30 py-1.5 last:border-0"
                >
                  <code className="font-mono text-sm font-semibold text-foreground">{c}</code>
                  <button
                    type="button"
                    onClick={() => handleCopy(c)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" onClick={handleCopyAll} className="gap-1.5">
                <Copy className="h-3.5 w-3.5" /> 复制全部
              </Button>
              <Button onClick={() => setGeneratedCodes([])}>
                <X className="h-3.5 w-3.5" /> 关闭
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </Card>
  );
}

function StatusBadge({ status }: { status: InviteItem["status"] }) {
  const config = {
    unused: { label: "未使用", className: "bg-task/10 text-task" },
    used: { label: "已使用", className: "bg-cognition/10 text-cognition" },
    disabled: { label: "已禁用", className: "bg-graveyard/10 text-graveyard" },
  } as const;
  const c = config[status];
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${c.className}`}
    >
      {c.label}
    </span>
  );
}

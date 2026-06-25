"use client";

import { useState, useRef, useEffect } from "react";
import {
  Database,
  Download,
  Upload,
  CheckCircle2,
  XCircle,
  Loader2,
  FileJson,
  ShieldCheck,
} from "lucide-react";
import { PageHeader, Card, Button } from "@/components/layout/PageHeader";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

// 可导出的数据类型
const TYPE_OPTIONS: Array<{ key: string; label: string }> = [
  { key: "ideas", label: "灵感" },
  { key: "tasks", label: "任务" },
  { key: "conversations", label: "对话资产" },
  { key: "cognitions", label: "认知库" },
  { key: "memories", label: "记忆节点" },
  { key: "skills", label: "技能" },
  { key: "flows", label: "工作流" },
];

type ImportStats = Record<string, number>;

export default function BackupPage() {
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(
    new Set(TYPE_OPTIONS.map((t) => t.key))
  );
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importStats, setImportStats] = useState<ImportStats | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 数据验证相关状态
  const [dbCounts, setDbCounts] = useState<Record<string, number> | null>(null);
  const [exportCounts, setExportCounts] = useState<Record<string, number> | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  // 拉取数据库计数用于验证
  const fetchDbCounts = async () => {
    setVerifying(true);
    setVerifyError(null);
    try {
      const res = await fetch("/api/backup/verify");
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `校验失败（${res.status}）`);
      }
      setDbCounts(data.counts || {});
      return data.counts as Record<string, number>;
    } catch (e: any) {
      setVerifyError(e.message || "校验失败");
      toast(e.message || "校验失败", "error");
      return null;
    } finally {
      setVerifying(false);
    }
  };

  // 初次加载自动拉取一次计数
  useEffect(() => {
    fetchDbCounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 切换类型选择
  const toggleType = (key: string) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedTypes.size === TYPE_OPTIONS.length) {
      setSelectedTypes(new Set());
    } else {
      setSelectedTypes(new Set(TYPE_OPTIONS.map((t) => t.key)));
    }
  };

  // 导出数据
  const handleExport = async () => {
    if (selectedTypes.size === 0) {
      toast("请至少选择一种数据类型", "error");
      return;
    }

    // 全选时使用 type=all，否则按类型逐个请求后合并
    const isAll = selectedTypes.size === TYPE_OPTIONS.length;

    setExporting(true);
    try {
      let payload: Record<string, unknown>;

      if (isAll) {
        const res = await fetch("/api/backup/export?type=all");
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `导出失败（${res.status}）`);
        }
        payload = await res.json();
      } else {
        // 按选中类型逐个请求并合并
        const data: Record<string, unknown> = {};
        for (const key of selectedTypes) {
          const res = await fetch(`/api/backup/export?type=${key}`);
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || `导出 ${key} 失败（${res.status}）`);
          }
          const json = await res.json();
          Object.assign(data, json.data);
        }
        payload = {
          exportedAt: new Date().toISOString(),
          version: "1.0",
          data,
        };
      }

      // 计算导出各类型条目数（用于验证对比）
      const exportedData = (payload as { data?: Record<string, unknown[]> }).data || {};
      const counts: Record<string, number> = {};
      for (const [key, value] of Object.entries(exportedData)) {
        counts[key] = Array.isArray(value) ? value.length : 0;
      }
      setExportCounts(counts);

      // 下载 JSON 文件
      const json = JSON.stringify(payload, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const now = new Date();
      const dateStr =
        now.getFullYear().toString() +
        (now.getMonth() + 1).toString().padStart(2, "0") +
        now.getDate().toString().padStart(2, "0");
      const filename = `lynnhub-backup-${dateStr}.json`;

      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast("导出成功", "success");
    } catch (e: any) {
      console.error("导出失败:", e);
      toast(e.message || "导出失败", "error");
    } finally {
      setExporting(false);
    }
  };

  // 导入数据
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportStats(null);
    setImportError(null);

    try {
      const text = await file.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error("JSON 格式无效");
      }

      // 兼容两种结构：{ data: {...} } 或直接 {...}
      const data =
        (parsed as { data?: Record<string, unknown> })?.data ||
        (parsed as Record<string, unknown>);

      const res = await fetch("/api/backup/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data }),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || `导入失败（${res.status}）`);
      }

      setImportStats(result.stats || {});
      toast("导入完成", "success");
      // 导入完成后刷新数据库计数，验证导入效果
      await fetchDbCounts();
    } catch (e: any) {
      console.error("导入失败:", e);
      setImportError(e.message || "导入失败");
      toast(e.message || "导入失败", "error");
    } finally {
      setImporting(false);
      // 重置 input 以便重复选择同一文件
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div className="p-4 sm:p-8">
      <PageHeader
        title="数据备份"
        subtitle="导出 / 导入系统数据 · JSON 格式"
      />

      {/* 导出区域 */}
      <Card className="mb-5">
        <div className="mb-4 flex items-center gap-2">
          <Download className="h-4 w-4 text-northstar" />
          <h2 className="text-sm font-semibold">数据导出</h2>
        </div>

        <div className="mb-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              选择要导出的数据类型（已选 {selectedTypes.size}/{TYPE_OPTIONS.length}）
            </span>
            <button
              onClick={toggleAll}
              className="text-[11px] text-northstar hover:underline"
            >
              {selectedTypes.size === TYPE_OPTIONS.length ? "取消全选" : "全选"}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {TYPE_OPTIONS.map((opt) => {
              const checked = selectedTypes.has(opt.key);
              return (
                <label
                  key={opt.key}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-lg border p-2.5 text-xs transition-colors",
                    checked
                      ? "border-northstar/40 bg-northstar/5 text-foreground"
                      : "border-border bg-muted/20 text-muted-foreground hover:bg-muted/40"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleType(opt.key)}
                    className="h-3.5 w-3.5 accent-northstar"
                  />
                  <span className="font-medium">{opt.label}</span>
                </label>
              );
            })}
          </div>
        </div>

        <Button
          onClick={handleExport}
          disabled={exporting || selectedTypes.size === 0}
        >
          {exporting ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> 导出中...
            </>
          ) : (
            <>
              <Download className="h-3.5 w-3.5" /> 导出 JSON
            </>
          )}
        </Button>
      </Card>

      {/* 数据验证区域 */}
      <Card className="mb-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-cognition" />
            <h2 className="text-sm font-semibold">数据验证</h2>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={fetchDbCounts}
            disabled={verifying}
          >
            {verifying ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" /> 校验中...
              </>
            ) : (
              <>刷新计数</>
            )}
          </Button>
        </div>

        {verifyError && (
          <div className="mb-3 rounded-md border border-graveyard/30 bg-graveyard/5 p-2.5 text-xs text-graveyard">
            {verifyError}
          </div>
        )}

        {dbCounts && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {TYPE_OPTIONS.map((opt) => {
              const dbCount = dbCounts[opt.key] ?? 0;
              const expCount = exportCounts?.[opt.key];
              const hasExport = exportCounts && expCount !== undefined;
              const mismatch = hasExport && expCount !== dbCount;
              return (
                <div
                  key={opt.key}
                  className={cn(
                    "rounded-lg border p-2.5",
                    mismatch
                      ? "border-graveyard/40 bg-graveyard/5"
                      : hasExport
                      ? "border-task/40 bg-task/5"
                      : "border-border bg-muted/30"
                  )}
                >
                  <div className="text-[10px] text-muted-foreground">
                    {opt.label}
                  </div>
                  <div className="text-lg font-bold tabular-nums text-foreground">
                    {dbCount}
                  </div>
                  {hasExport && (
                    <div className={cn(
                      "mt-0.5 text-[10px]",
                      mismatch ? "text-graveyard" : "text-task"
                    )}>
                      导出 {expCount}
                      {mismatch ? " ⚠" : " ✓"}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {dbCounts && (
          <div className="mt-3 text-[11px] text-muted-foreground">
            共 <span className="font-semibold text-foreground">
              {Object.values(dbCounts).reduce((s, n) => s + n, 0)}
            </span> 条记录
            {exportCounts && (
              <span className="ml-3">
                导出 <span className="font-semibold text-foreground">
                  {Object.values(exportCounts).reduce((s, n) => s + n, 0)}
                </span> 条
                {Object.values(exportCounts).reduce((s, n) => s + n, 0) ===
                  Object.values(dbCounts).reduce((s, n) => s + n, 0)
                  ? " ✓ 数量一致"
                  : " ⚠ 数量不一致"}
              </span>
            )}
          </div>
        )}
      </Card>

      {/* 导入区域 */}
      <Card className="mb-5">
        <div className="mb-4 flex items-center gap-2">
          <Upload className="h-4 w-4 text-campaign" />
          <h2 className="text-sm font-semibold">数据导入</h2>
        </div>

        <div className="mb-3 rounded-md border border-campaign/30 bg-campaign/5 p-3 text-xs text-campaign">
          ⚠️ 导入功能仅管理员可用。已存在的 ID 将被跳过（不覆盖）。
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          onChange={handleFileChange}
          className="hidden"
        />

        <Button
          variant="outline"
          onClick={handleImportClick}
          disabled={importing}
        >
          {importing ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> 导入中...
            </>
          ) : (
            <>
              <Upload className="h-3.5 w-3.5" /> 选择 JSON 文件导入
            </>
          )}
        </Button>

        {/* 导入结果 */}
        {importError && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-graveyard/30 bg-graveyard/5 p-3 text-xs text-graveyard">
            <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <div className="font-medium">导入失败</div>
              <div className="mt-0.5">{importError}</div>
            </div>
          </div>
        )}

        {importStats && (
          <div className="mt-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-task">
              <CheckCircle2 className="h-4 w-4" />
              导入完成统计
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {Object.entries(importStats).map(([key, count]) => (
                <div
                  key={key}
                  className="rounded-lg border border-border bg-muted/30 p-2.5"
                >
                  <div className="text-[10px] text-muted-foreground">
                    {TYPE_OPTIONS.find((t) => t.key === key)?.label || key}
                  </div>
                  <div className="text-lg font-bold tabular-nums">{count}</div>
                </div>
              ))}
              {Object.keys(importStats).length === 0 && (
                <div className="col-span-full text-xs text-muted-foreground">
                  没有可导入的数据
                </div>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* 说明 */}
      <Card>
        <div className="mb-3 flex items-center gap-2">
          <FileJson className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">格式说明</h2>
        </div>
        <div className="space-y-2 text-xs text-muted-foreground">
          <div>
            <span className="font-medium text-foreground">导出格式：</span>
            JSON 文件，包含 <code className="rounded bg-muted/40 px-1">exportedAt</code>、
            <code className="rounded bg-muted/40 px-1">version</code>、
            <code className="rounded bg-muted/40 px-1">data</code> 三个字段。
          </div>
          <div>
            <span className="font-medium text-foreground">权限说明：</span>
            管理员可导出全部数据，普通用户仅能导出自己的数据。导入功能仅管理员可用。
          </div>
          <div>
            <span className="font-medium text-foreground">导入策略：</span>
            按主键 ID upsert，已存在的记录会被跳过（不覆盖），仅新增不存在的记录。
          </div>
          <div>
            <span className="font-medium text-foreground">注意：</span>
            记忆节点（Memory）的 embedding 向量字段不导出，导入后需在「记忆图谱」页面重建。
          </div>
        </div>
      </Card>
    </div>
  );
}

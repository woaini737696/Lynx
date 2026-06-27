"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import useSWR from "swr";
import {
  RefreshCw,
  Skull,
  X,
  Eye,
  Pencil,
  Trash2,
  Search,
  CheckSquare,
  Square,
  XCircle,
  Loader2,
} from "lucide-react";
import { toast } from "@/components/ui/toast";
import { PageHeader, Card, Button, Badge, LoadingState } from "@/components/layout/PageHeader";
import { HelpButton } from "@/components/layout/HelpButton";
import { EmptyState } from "@/components/layout/EmptyState";
import { Pagination, useClientPagination } from "@/components/ui/ListControls";
import { cn } from "@/lib/utils";
import { fetcher } from "@/lib/swr-config";

interface GraveyardItem {
  id: string;
  ideaId: string;
  content: string;
  reason: string;
  reviveCondition: string;
  revivedAt?: string;
  createdAt: string;
  abandonedAt: string;
}

type SortBy = "abandonedAt" | "createdAt";

export default function GraveyardPage() {
  // SWR 获取数据：自动去重 / 重试 / 缓存
  const { data: swrData, error: swrError, isLoading, mutate } = useSWR<{ items: GraveyardItem[] }>(
    "/api/graveyard",
    fetcher
  );

  const [items, setItems] = useState<GraveyardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [revivingId, setRevivingId] = useState<string | null>(null);
  const [detailItem, setDetailItem] = useState<GraveyardItem | null>(null);

  // 编辑相关
  const [editItem, setEditItem] = useState<GraveyardItem | null>(null);
  const [editReason, setEditReason] = useState("");
  const [editCondition, setEditCondition] = useState("");
  const [saving, setSaving] = useState(false);

  // 删除确认相关
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // 批量操作相关
  const [batchMode, setBatchMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchAction, setBatchAction] = useState(false);

  // 搜索与排序
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("abandonedAt");

  // SWR 数据同步到本地 state（保留本地状态作为操作中的乐观更新载体）
  useEffect(() => {
    if (swrData?.items) {
      setItems(swrData.items);
      setLoading(false);
    }
    if (swrError && !swrData) {
      setLoading(false);
      toast("加载灵感墓地失败", "error");
    }
    if (isLoading) {
      setLoading(true);
    }
  }, [swrData, swrError, isLoading]);

  // 过滤 + 排序（基于搜索词和排序选项）
  const visibleItems = useMemo(() => {
    let list = items;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (it) =>
          it.content?.toLowerCase().includes(q) ||
          it.reason?.toLowerCase().includes(q) ||
          it.reviveCondition?.toLowerCase().includes(q)
      );
    }
    const sorted = [...list].sort((a, b) => {
      const da = new Date(a[sortBy]).getTime();
      const db = new Date(b[sortBy]).getTime();
      return db - da;
    });
    return sorted;
  }, [items, searchQuery, sortBy]);

  // 分页（基于搜索+排序后的列表）
  const {
    page,
    pageSize,
    total,
    paginated,
    onPageChange,
    onPageSizeChange,
  } = useClientPagination(visibleItems);

  // 统计信息
  const stats = useMemo(() => {
    const total = items.length;
    const revived = items.filter((it) => it.revivedAt).length;
    const pending = total - revived;
    return { total, revived, pending };
  }, [items]);

  // 复活单条
  const revive = useCallback(async (graveyardId: string) => {
    setRevivingId(graveyardId);
    try {
      const res = await fetch("/api/graveyard", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ graveyardId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "复活失败");
      }
      // 本地标记为已复活（保留记录用于统计）
      setItems((prev) =>
        prev.map((it) =>
          it.id === graveyardId ? { ...it, revivedAt: new Date().toISOString() } : it
        )
      );
      setDetailItem(null);
      toast("灵感已复活，回到 Inbox", "success");
    } catch {
      toast("复活失败", "error");
    } finally {
      setRevivingId(null);
    }
  }, []);

  // 彻底删除单条
  const deleteItem = useCallback(async (graveyardId: string) => {
    setDeletingId(graveyardId);
    try {
      const res = await fetch("/api/graveyard", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ graveyardId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "删除失败");
      }
      setItems((prev) => prev.filter((it) => it.id !== graveyardId));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(graveyardId);
        return next;
      });
      setConfirmDeleteId(null);
      setDetailItem(null);
      toast("已彻底删除", "success");
    } catch {
      toast("删除失败", "error");
    } finally {
      setDeletingId(null);
    }
  }, []);

  // 打开编辑弹窗
  const openEdit = useCallback((item: GraveyardItem) => {
    setEditItem(item);
    setEditReason(item.reason || "");
    setEditCondition(item.reviveCondition || "");
  }, []);

  // 保存编辑
  const saveEdit = useCallback(async () => {
    if (!editItem) return;
    setSaving(true);
    try {
      const res = await fetch("/api/graveyard", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          graveyardId: editItem.id,
          reason: editReason,
          reviveCondition: editCondition,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "保存失败");
      }
      setItems((prev) =>
        prev.map((it) =>
          it.id === editItem.id
            ? { ...it, reason: editReason, reviveCondition: editCondition }
            : it
        )
      );
      setEditItem(null);
      toast("已保存修改", "success");
    } catch {
      toast("保存失败", "error");
    } finally {
      setSaving(false);
    }
  }, [editItem, editReason, editCondition]);

  // 切换选中
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // 全选 / 取消全选（仅当前页可见项）
  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (paginated.every((it) => prev.has(it.id))) {
        // 全部已选则取消
        const next = new Set(prev);
        paginated.forEach((it) => next.delete(it.id));
        return next;
      }
      // 否则全选
      const next = new Set(prev);
      paginated.forEach((it) => next.add(it.id));
      return next;
    });
  }, [paginated]);

  // 退出批量模式
  const exitBatchMode = useCallback(() => {
    setBatchMode(false);
    setSelectedIds(new Set());
  }, []);

  // 批量复活
  const batchRevive = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setBatchAction(true);
    let ok = 0;
    let fail = 0;
    for (const id of selectedIds) {
      try {
        const res = await fetch("/api/graveyard", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ graveyardId: id }),
        });
        if (res.ok) ok++;
        else fail++;
      } catch {
        fail++;
      }
    }
    // 本地更新
    const now = new Date().toISOString();
    setItems((prev) =>
      prev.map((it) => (selectedIds.has(it.id) ? { ...it, revivedAt: now } : it))
    );
    setSelectedIds(new Set());
    setBatchAction(false);
    toast(`批量复活完成（成功 ${ok}，失败 ${fail}）`, ok > 0 ? "success" : "error");
  }, [selectedIds]);

  // 批量删除
  const batchDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setBatchAction(true);
    let ok = 0;
    let fail = 0;
    for (const id of selectedIds) {
      try {
        const res = await fetch("/api/graveyard", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ graveyardId: id }),
        });
        if (res.ok) ok++;
        else fail++;
      } catch {
        fail++;
      }
    }
    setItems((prev) => prev.filter((it) => !selectedIds.has(it.id)));
    setSelectedIds(new Set());
    setBatchAction(false);
    toast(`批量删除完成（成功 ${ok}，失败 ${fail}）`, ok > 0 ? "success" : "error");
  }, [selectedIds]);

  const allVisibleSelected =
    paginated.length > 0 && paginated.every((it) => selectedIds.has(it.id));

  return (
    <div className="p-4 sm:p-8">
      <PageHeader
        title="灵感墓地"
        subtitle="记录放弃原因和复活条件，时机成熟可一键复活"
        action={
          <div className="flex items-center gap-2">
            <Button
              variant={batchMode ? "primary" : "outline"}
              onClick={() => (batchMode ? exitBatchMode() : setBatchMode(true))}
            >
              <CheckSquare className="h-3.5 w-3.5" />
              {batchMode ? "退出批量" : "批量操作"}
            </Button>
            <HelpButton contentKey="graveyard" />
          </div>
        }
      />

      {/* 统计信息 */}
      <div className="mb-5 grid grid-cols-3 gap-3">
        <Card className="p-4">
          <div className="text-[11px] text-muted-foreground">总数</div>
          <div className="mt-1 text-2xl font-semibold text-foreground">{stats.total}</div>
        </Card>
        <Card className="p-4">
          <div className="text-[11px] text-muted-foreground">已复活</div>
          <div className="mt-1 text-2xl font-semibold text-task">{stats.revived}</div>
        </Card>
        <Card className="p-4">
          <div className="text-[11px] text-muted-foreground">待复活</div>
          <div className="mt-1 text-2xl font-semibold text-graveyard">{stats.pending}</div>
        </Card>
      </div>

      {/* 搜索 + 排序 */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="按灵感内容、原因、条件搜索..."
            className="w-full rounded-xl border border-border bg-card py-2 pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary/40"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground">排序</span>
          <div className="flex rounded-xl border border-border bg-card p-0.5">
            <button
              onClick={() => setSortBy("abandonedAt")}
              className={cn(
                "rounded-lg px-3 py-1.5 text-[11px] transition-colors",
                sortBy === "abandonedAt"
                  ? "bg-primary/10 font-medium text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              放弃时间
            </button>
            <button
              onClick={() => setSortBy("createdAt")}
              className={cn(
                "rounded-lg px-3 py-1.5 text-[11px] transition-colors",
                sortBy === "createdAt"
                  ? "bg-primary/10 font-medium text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              创建时间
            </button>
          </div>
        </div>
      </div>

      {/* 批量操作工具栏 */}
      {batchMode && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-cognition/30 bg-cognition/5 p-3">
          <button
            onClick={toggleSelectAll}
            className="flex items-center gap-1.5 text-xs text-foreground/80 hover:text-foreground"
          >
            {allVisibleSelected ? (
              <CheckSquare className="h-4 w-4 text-cognition" />
            ) : (
              <Square className="h-4 w-4 text-muted-foreground" />
            )}
            {allVisibleSelected ? "取消全选" : "全选"}
          </button>
          <span className="text-[11px] text-muted-foreground">
            已选 {selectedIds.size} 项
          </span>
          <div className="flex-1" />
          <Button
            size="sm"
            variant="outline"
            onClick={batchRevive}
            disabled={batchAction || selectedIds.size === 0}
          >
            <RefreshCw className={`h-3 w-3 ${batchAction ? "animate-spin" : ""}`} />
            批量复活
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={batchDelete}
            disabled={batchAction || selectedIds.size === 0}
          >
            <Trash2 className="h-3 w-3" />
            批量删除
          </Button>
        </div>
      )}

      {loading ? (
        <LoadingState title="灵感墓地" />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Skull}
          title="墓地空空如也"
          description="暂时没有放弃的灵感"
        />
      ) : visibleItems.length === 0 ? (
        <EmptyState
          icon={Search}
          title="未匹配到结果"
          description="尝试更换搜索关键词"
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {paginated.map((item) => {
            const isRevived = !!item.revivedAt;
            const isSelected = selectedIds.has(item.id);
            return (
              <Card
                key={item.id}
                className={cn(
                  "flex flex-col",
                  batchMode && "cursor-default",
                  isSelected && "ring-2 ring-cognition/40"
                )}
                hover={!batchMode}
                onClick={
                  batchMode
                    ? () => toggleSelect(item.id)
                    : () => setDetailItem(item)
                }
              >
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {batchMode && (
                      isSelected ? (
                        <CheckSquare className="h-4 w-4 text-cognition" />
                      ) : (
                        <Square className="h-4 w-4 text-muted-foreground" />
                      )
                    )}
                    {isRevived ? (
                      <Badge color="task">已复活</Badge>
                    ) : (
                      <Badge color="graveyard">已放弃</Badge>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {formatTime(item.abandonedAt)}放弃
                  </span>
                </div>
                <p className="mb-4 line-clamp-3 text-sm font-medium leading-relaxed">
                  {item.content || "无内容"}
                </p>

                <div className="space-y-2">
                  <div className="rounded-xl bg-graveyard/5 p-2.5">
                    <div className="mb-0.5 text-[10px] text-graveyard/80">放弃原因</div>
                    <div className="line-clamp-2 text-xs text-foreground/80">{item.reason}</div>
                  </div>
                  <div className="rounded-xl bg-northstar/5 p-2.5">
                    <div className="mb-0.5 text-[10px] text-northstar/80">复活条件</div>
                    <div className="line-clamp-2 text-xs text-foreground/80">{item.reviveCondition}</div>
                  </div>
                </div>

                {!batchMode && (
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDetailItem(item);
                      }}
                      className="flex-1"
                    >
                      <Eye className="h-3 w-3" /> 详情
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEdit(item);
                      }}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    {!isRevived && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          revive(item.id);
                        }}
                        disabled={revivingId === item.id}
                        className="flex-1"
                      >
                        <RefreshCw className={`h-3 w-3 ${revivingId === item.id ? "animate-spin" : ""}`} />
                        {revivingId === item.id ? "复活中..." : "复活"}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDeleteId(item.id);
                      }}
                      className="text-graveyard hover:bg-graveyard/10"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {total > 0 && (
        <div className="mt-5">
          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={onPageChange}
            onPageSizeChange={onPageSizeChange}
          />
        </div>
      )}

      {/* 详情弹窗 */}
      {detailItem && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-md"
          onClick={() => setDetailItem(null)}
        >
          <div
            className="w-full max-w-lg max-h-[80vh] overflow-auto rounded-3xl border border-graveyard/30 bg-card p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-graveyard">
                <Skull className="h-4 w-4" />
                <span className="text-sm font-semibold">灵感墓地详情</span>
              </div>
              <button
                onClick={() => setDetailItem(null)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="关闭"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-4 rounded-2xl bg-muted/40 p-4">
              <div className="mb-1.5 text-[11px] text-muted-foreground">原始灵感</div>
              <p className="text-sm leading-relaxed">{detailItem.content || "无内容"}</p>
            </div>

            <div className="mb-3 space-y-3">
              <div className="rounded-xl bg-graveyard/5 p-3">
                <div className="mb-1 text-[11px] text-graveyard/80">放弃原因</div>
                <div className="text-sm text-foreground/80">{detailItem.reason}</div>
              </div>
              <div className="rounded-xl bg-northstar/5 p-3">
                <div className="mb-1 text-[11px] text-northstar/80">复活条件</div>
                <div className="text-sm text-foreground/80">{detailItem.reviveCondition}</div>
              </div>
            </div>

            <div className="mb-4 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
              <span>创建于 {formatTime(detailItem.createdAt)}</span>
              <span>放弃于 {formatTime(detailItem.abandonedAt)}</span>
              {detailItem.revivedAt && (
                <span className="text-task">复活于 {formatTime(detailItem.revivedAt)}</span>
              )}
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const item = detailItem;
                  setDetailItem(null);
                  openEdit(item);
                }}
              >
                <Pencil className="h-3 w-3" /> 编辑
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setConfirmDeleteId(detailItem.id);
                }}
                className="text-graveyard hover:bg-graveyard/10"
              >
                <Trash2 className="h-3 w-3" /> 彻底删除
              </Button>
              {!detailItem.revivedAt && (
                <Button
                  size="sm"
                  onClick={() => revive(detailItem.id)}
                  disabled={revivingId === detailItem.id}
                >
                  <RefreshCw className={`h-3 w-3 ${revivingId === detailItem.id ? "animate-spin" : ""}`} />
                  {revivingId === detailItem.id ? "复活中..." : "复活到 Inbox"}
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => setDetailItem(null)}>
                关闭
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 编辑弹窗 */}
      {editItem && (
        <div
          className="fixed inset-0 z-[75] flex items-center justify-center bg-black/60 p-4 backdrop-blur-md"
          onClick={() => setEditItem(null)}
        >
          <div
            className="w-full max-w-lg max-h-[80vh] overflow-auto rounded-3xl border border-northstar/30 bg-card p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-northstar">
                <Pencil className="h-4 w-4" />
                <span className="text-sm font-semibold">编辑墓地记录</span>
              </div>
              <button
                onClick={() => setEditItem(null)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="关闭"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-4 rounded-2xl bg-muted/40 p-3">
              <div className="mb-1 text-[11px] text-muted-foreground">原始灵感</div>
              <p className="text-xs leading-relaxed text-foreground/80">
                {editItem.content || "无内容"}
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-[11px] font-medium text-graveyard/80">
                  放弃原因
                </label>
                <textarea
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  rows={3}
                  className="w-full resize-none rounded-xl border border-border bg-background p-3 text-sm outline-none transition-colors focus:border-primary/40"
                  placeholder="为什么放弃这个灵感？"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-medium text-northstar/80">
                  复活条件
                </label>
                <textarea
                  value={editCondition}
                  onChange={(e) => setEditCondition(e.target.value)}
                  rows={3}
                  className="w-full resize-none rounded-xl border border-border bg-background p-3 text-sm outline-none transition-colors focus:border-primary/40"
                  placeholder="什么条件下可以重新考虑这个灵感？"
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setEditItem(null)}>
                取消
              </Button>
              <Button size="sm" onClick={saveEdit} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" /> 保存中...
                  </>
                ) : (
                  "保存"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 删除确认弹窗 */}
      {confirmDeleteId && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4 backdrop-blur-md"
          onClick={() => setConfirmDeleteId(null)}
        >
          <div
            className="w-full max-w-sm rounded-3xl border border-graveyard/30 bg-card p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center gap-2 text-graveyard">
              <XCircle className="h-5 w-5" />
              <span className="text-sm font-semibold">确认彻底删除？</span>
            </div>
            <p className="mb-1 text-xs text-muted-foreground">
              此操作将同时删除墓地记录和关联的灵感，<strong className="text-foreground">无法恢复</strong>。
            </p>
            <p className="mb-5 text-xs text-muted-foreground">
              如果只是想重新启用，请使用「复活」功能。
            </p>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setConfirmDeleteId(null)}>
                取消
              </Button>
              <Button
                size="sm"
                variant="danger"
                onClick={() => deleteItem(confirmDeleteId)}
                disabled={deletingId === confirmDeleteId}
              >
                {deletingId === confirmDeleteId ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" /> 删除中...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-3 w-3" /> 确认删除
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatTime(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return "刚刚";
  if (hours < 24) return `${hours}小时前`;
  return `${Math.floor(hours / 24)}天前`;
}

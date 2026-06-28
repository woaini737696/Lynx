import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Skull,
  Search as SearchIcon,
  Loader2,
  RotateCcw,
  Trash2,
  Edit3,
  Check,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cloudApi } from "@/lib/cloud-api";
import { toast } from "@/lib/toast";
import { HelpButton } from "@/components/ui/HelpButton";
import { Modal } from "@/components/ui/Modal";
import { formatRelativeTime } from "@/lib/utils";
import type { GraveyardItem } from "@/types/api";

export function GraveyardPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [detailTarget, setDetailTarget] = useState<GraveyardItem | null>(null);
  const [editTarget, setEditTarget] = useState<GraveyardItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GraveyardItem | null>(null);
  const [editReason, setEditReason] = useState("");
  const [editCondition, setEditCondition] = useState("");

  // 加载墓地列表
  const { data: items = [], isLoading } = useQuery<GraveyardItem[]>({
    queryKey: ["graveyard"],
    queryFn: async () => {
      const res = await cloudApi.get<{ items?: GraveyardItem[] }>("/api/graveyard");
      return res.items || [];
    },
  });

  // 搜索过滤
  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (it) =>
        it.content.toLowerCase().includes(q) ||
        it.reason.toLowerCase().includes(q) ||
        it.reviveCondition.toLowerCase().includes(q)
    );
  }, [items, searchQuery]);

  // 统计
  const stats = useMemo(() => {
    const total = items.length;
    const revived = items.filter((it) => it.revivedAt).length;
    const pending = total - revived;
    return { total, revived, pending };
  }, [items]);

  // 复活 mutation
  const reviveMutation = useMutation({
    mutationFn: async (graveyardId: string) => {
      return cloudApi.patch("/api/graveyard", { graveyardId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["graveyard"] });
      queryClient.invalidateQueries({ queryKey: ["inbox"] });
      toast.success("已恢复到 Inbox");
      setDetailTarget(null);
    },
    onError: (e: Error) => toast.error(e.message || "恢复失败"),
  });

  // 永久删除 mutation
  const deleteMutation = useMutation({
    mutationFn: async (graveyardId: string) => {
      return cloudApi.delete("/api/graveyard", { graveyardId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["graveyard"] });
      toast.success("已永久删除");
      setDeleteTarget(null);
      setDetailTarget(null);
    },
    onError: (e: Error) => toast.error(e.message || "删除失败"),
  });

  // 编辑 mutation
  const editMutation = useMutation({
    mutationFn: async (params: { graveyardId: string; reason: string; reviveCondition: string }) => {
      return cloudApi.put("/api/graveyard", params);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["graveyard"] });
      toast.success("已更新");
      setEditTarget(null);
    },
    onError: (e: Error) => toast.error(e.message || "更新失败"),
  });

  // 打开编辑弹窗
  const openEdit = (item: GraveyardItem) => {
    setEditTarget(item);
    setEditReason(item.reason);
    setEditCondition(item.reviveCondition);
  };

  // 提交编辑
  const submitEdit = () => {
    if (!editTarget) return;
    if (!editReason.trim() || !editCondition.trim()) {
      toast.error("放弃原因和复活条件都不能为空");
      return;
    }
    editMutation.mutate({
      graveyardId: editTarget.id,
      reason: editReason.trim(),
      reviveCondition: editCondition.trim(),
    });
  };

  return (
    <div className="mx-auto max-w-5xl">
      {/* 页头 */}
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
            <Skull className="h-6 w-6 text-muted-foreground" />
            灵感墓地
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            被放弃的灵感在此安息 · AI 巡检会自动监测复活条件
          </p>
        </div>
        <HelpButton module="graveyard" />
      </div>

      {/* 统计卡片 */}
      <div className="mb-4 grid grid-cols-3 gap-3">
        <div className="glass-card p-3 text-center">
          <div className="text-xl font-bold text-foreground">{stats.total}</div>
          <div className="text-[11px] text-muted-foreground">总数</div>
        </div>
        <div className="glass-card p-3 text-center">
          <div className="text-xl font-bold text-task">{stats.revived}</div>
          <div className="text-[11px] text-muted-foreground">已复活</div>
        </div>
        <div className="glass-card p-3 text-center">
          <div className="text-xl font-bold text-muted-foreground">{stats.pending}</div>
          <div className="text-[11px] text-muted-foreground">待复活</div>
        </div>
      </div>

      {/* 搜索框 */}
      <div className="glass-card mb-4 flex items-center gap-2 px-3 py-2">
        <SearchIcon className="h-3.5 w-3.5 text-muted-foreground" />
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="搜索灵感内容、放弃原因或复活条件..."
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
        />
      </div>

      {/* 内容区 */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="mt-3 text-sm text-muted-foreground">加载灵感墓地...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card flex flex-col items-center justify-center py-20 text-center">
          <Skull className="h-12 w-12 text-muted-foreground/40" />
          <p className="mt-4 text-sm font-medium text-foreground">
            {items.length === 0 ? "墓地空空如也" : "无匹配结果"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {items.length === 0
              ? "在 Inbox 中放弃灵感时，会自动送到这里"
              : "尝试更换关键词"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {filtered.map((item) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                className="glass-card group relative flex flex-col p-4"
              >
                {/* 状态徽章 + 时间 */}
                <div className="mb-2 flex items-center justify-between">
                  {item.revivedAt ? (
                    <span className="flex items-center gap-1 rounded-full bg-task/10 px-2 py-0.5 text-[10px] font-medium text-task">
                      <Check className="h-2.5 w-2.5" />
                      已复活
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 rounded-full bg-muted/40 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                      <Skull className="h-2.5 w-2.5" />
                      已放弃
                    </span>
                  )}
                  <span className="text-[10px] text-muted-foreground/60">
                    {formatRelativeTime(item.abandonedAt)}
                  </span>
                </div>

                {/* 内容 */}
                <p className="mb-2 line-clamp-3 whitespace-pre-wrap break-words text-xs leading-relaxed text-foreground/85">
                  {item.content}
                </p>

                {/* 放弃原因 */}
                <div className="mb-1.5 rounded-lg bg-destructive/5 p-2">
                  <div className="mb-0.5 text-[10px] font-medium text-destructive/80">
                    放弃原因
                  </div>
                  <p className="line-clamp-2 text-[11px] text-muted-foreground">
                    {item.reason}
                  </p>
                </div>

                {/* 复活条件 */}
                <div className="mb-2 rounded-lg bg-northstar/5 p-2">
                  <div className="mb-0.5 text-[10px] font-medium text-northstar/80">
                    复活条件
                  </div>
                  <p className="line-clamp-2 text-[11px] text-muted-foreground">
                    {item.reviveCondition}
                  </p>
                </div>

                {/* 操作按钮 */}
                {!item.revivedAt && (
                  <div className="flex items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={() => reviveMutation.mutate(item.id)}
                      disabled={reviveMutation.isPending}
                      title="恢复到 Inbox"
                      className="flex h-7 flex-1 items-center justify-center gap-1 rounded-lg bg-task/10 text-[11px] font-medium text-task transition-colors hover:bg-task/20"
                    >
                      {reviveMutation.isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <RotateCcw className="h-3 w-3" />
                      )}
                      恢复
                    </button>
                    <button
                      onClick={() => openEdit(item)}
                      title="编辑"
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground"
                    >
                      <Edit3 className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(item)}
                      title="永久删除"
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                )}

                {/* 详情按钮 */}
                <button
                  onClick={() => setDetailTarget(item)}
                  className="mt-1 text-center text-[10px] text-muted-foreground/60 transition-colors hover:text-foreground"
                >
                  查看详情
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* 详情弹窗 */}
      <Modal
        open={!!detailTarget}
        onClose={() => setDetailTarget(null)}
        title="灵感详情"
        size="md"
      >
        {detailTarget && (
          <div className="space-y-4">
            <div>
              <div className="mb-1 text-xs font-medium text-muted-foreground">原始灵感</div>
              <p className="whitespace-pre-wrap rounded-xl bg-muted/30 p-3 text-sm text-foreground/90">
                {detailTarget.content}
              </p>
            </div>
            <div>
              <div className="mb-1 text-xs font-medium text-destructive/80">放弃原因</div>
              <p className="whitespace-pre-wrap rounded-xl bg-destructive/5 p-3 text-sm text-foreground/80">
                {detailTarget.reason}
              </p>
            </div>
            <div>
              <div className="mb-1 text-xs font-medium text-northstar/80">复活条件</div>
              <p className="whitespace-pre-wrap rounded-xl bg-northstar/5 p-3 text-sm text-foreground/80">
                {detailTarget.reviveCondition}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
              <div>
                <span className="opacity-60">创建时间：</span>
                {new Date(detailTarget.createdAt).toLocaleString("zh-CN")}
              </div>
              <div>
                <span className="opacity-60">放弃时间：</span>
                {new Date(detailTarget.abandonedAt).toLocaleString("zh-CN")}
              </div>
              {detailTarget.revivedAt && (
                <div>
                  <span className="opacity-60">复活时间：</span>
                  {new Date(detailTarget.revivedAt).toLocaleString("zh-CN")}
                </div>
              )}
            </div>
            {!detailTarget.revivedAt && (
              <div className="flex items-center justify-end gap-2 border-t border-border/60 pt-3">
                <button
                  onClick={() => openEdit(detailTarget)}
                  className="btn-glass flex h-8 items-center gap-1.5 px-3 text-xs"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  编辑
                </button>
                <button
                  onClick={() => setDeleteTarget(detailTarget)}
                  className="flex h-8 items-center gap-1.5 rounded-lg bg-destructive/10 px-3 text-xs font-medium text-destructive transition-colors hover:bg-destructive/20"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  永久删除
                </button>
                <button
                  onClick={() => reviveMutation.mutate(detailTarget.id)}
                  disabled={reviveMutation.isPending}
                  className="flex h-8 items-center gap-1.5 rounded-lg bg-task/10 px-3 text-xs font-medium text-task transition-colors hover:bg-task/20"
                >
                  {reviveMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RotateCcw className="h-3.5 w-3.5" />
                  )}
                  恢复到 Inbox
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* 编辑弹窗 */}
      <Modal
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        title="编辑墓地记录"
        size="md"
      >
        {editTarget && (
          <div className="space-y-4">
            <div>
              <div className="mb-1 text-xs font-medium text-muted-foreground">原始灵感</div>
              <p className="line-clamp-2 rounded-xl bg-muted/30 p-3 text-xs text-muted-foreground">
                {editTarget.content}
              </p>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-destructive/80">
                放弃原因
              </label>
              <textarea
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                rows={3}
                className="w-full resize-none rounded-xl border border-border/60 bg-background/40 p-3 text-sm outline-none focus:ring-2 focus:ring-destructive/20"
                placeholder="为什么放弃这个灵感？"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-northstar/80">
                复活条件
              </label>
              <textarea
                value={editCondition}
                onChange={(e) => setEditCondition(e.target.value)}
                rows={3}
                className="w-full resize-none rounded-xl border border-border/60 bg-background/40 p-3 text-sm outline-none focus:ring-2 focus:ring-northstar/20"
                placeholder="什么情况下应该复活这个灵感？"
              />
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setEditTarget(null)}
                className="btn-glass flex h-8 items-center px-3 text-xs"
              >
                取消
              </button>
              <button
                onClick={submitEdit}
                className="btn-primary-glass flex h-8 items-center gap-1.5 px-3 text-xs"
              >
                <Check className="h-3.5 w-3.5" />
                保存
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* 删除确认弹窗 */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="永久删除"
        size="sm"
      >
        {deleteTarget && (
          <div className="space-y-4">
            <p className="text-sm text-foreground/80">
              确认永久删除这条灵感？此操作不可撤销，灵感内容和墓地记录都会被清除。
            </p>
            <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
              <p className="line-clamp-3 text-xs text-muted-foreground">
                {deleteTarget.content}
              </p>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="btn-glass flex h-8 items-center px-3 text-xs"
              >
                取消
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteTarget.id)}
                disabled={deleteMutation.isPending}
                className="flex h-8 items-center gap-1.5 rounded-lg bg-destructive/10 px-3 text-xs font-medium text-destructive transition-colors hover:bg-destructive/20"
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                确认删除
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

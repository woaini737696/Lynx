"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import {
  Trash2,
  RotateCcw,
  ArrowLeft,
  XCircle,
  Loader2,
} from "lucide-react";
import { toast } from "@/components/ui/toast";
import {
  PageHeader,
  Card,
  Button,
  Badge,
  LoadingState,
} from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/layout/EmptyState";
import { Pagination, useClientPagination } from "@/components/ui/ListControls";
import { AnimatedList } from "@/components/ui/AnimatedList";
import { useAsyncLoading } from "@/lib/use-async-loading";
import { fetcher } from "@/components/providers/SWRProvider";
import { BOARD_COLUMNS, type BoardColumn } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface Task {
  id: string;
  content: string;
  column: BoardColumn;
  status: "active" | "done" | "dropped";
  position: number;
  updatedAt?: string;
  sourceId?: string | null;
}

export default function TrashPage() {
  const router = useRouter();
  // SWR 获取软删除任务列表
  const { data, isLoading, mutate } = useSWR<{ tasks: Task[] }>(
    "/api/tasks?status=dropped",
    fetcher
  );

  const tasks: Task[] = data?.tasks || [];
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // 全局异步加载反馈
  const { run: runAsync } = useAsyncLoading();

  const {
    page,
    pageSize,
    total,
    paginated,
    onPageChange,
    onPageSizeChange,
  } = useClientPagination(tasks);

  // 恢复任务：PATCH status → active
  const handleRestore = async (taskId: string) => {
    setRestoringId(taskId);
    try {
      const res = await runAsync(
        "恢复任务",
        fetch(`/api/tasks/${taskId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "active" }),
        })
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "恢复失败");
      }
      toast("任务已恢复到看板", "success");
      // 刷新列表
      await mutate();
      // 通知看板页面刷新
      window.postMessage({ type: "LYNNHUB_REFRESH_BOARD" }, "*");
    } catch (e: any) {
      toast(e.message || "恢复失败", "error");
    } finally {
      setRestoringId(null);
    }
  };

  // 永久删除任务
  const handlePermanentDelete = async (taskId: string) => {
    setDeletingId(taskId);
    try {
      const res = await runAsync(
        "永久删除任务",
        fetch(`/api/tasks/${taskId}`, { method: "DELETE" })
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "删除失败");
      }
      toast("任务已永久删除", "success");
      setConfirmDeleteId(null);
      await mutate();
    } catch (e: any) {
      toast(e.message || "删除失败", "error");
    } finally {
      setDeletingId(null);
    }
  };

  if (isLoading) {
    return <LoadingState title="回收站" />;
  }

  return (
    <div className="p-4 sm:p-8">
      <PageHeader
        title="回收站"
        subtitle="已软删除的任务可在此恢复或永久删除"
        action={
          <Button variant="outline" onClick={() => router.push("/board")}>
            <ArrowLeft className="h-3.5 w-3.5" />
            返回看板
          </Button>
        }
      />

      {tasks.length === 0 ? (
        <EmptyState
          icon={Trash2}
          title="回收站为空"
          description="没有已删除的任务"
          action={
            <Button variant="outline" onClick={() => router.push("/board")}>
              <ArrowLeft className="h-3.5 w-3.5" />
              返回看板
            </Button>
          }
        />
      ) : (
        <>
          <div className="mb-4 text-xs text-muted-foreground">
            共 {tasks.length} 条已删除任务
          </div>
          <AnimatedList
            items={paginated}
            keyExtractor={(t: Task) => t.id}
            className="space-y-3"
          >
            {(task: Task) => {
              const colMeta = BOARD_COLUMNS[task.column];
              return (
                <Card className="flex flex-col gap-3 border-l-4 border-graveyard/40 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="mb-1.5 flex flex-wrap items-center gap-2">
                        {colMeta && (
                          <Badge color="graveyard">{colMeta.label}</Badge>
                        )}
                        <span className="text-[10px] text-muted-foreground">
                          删除于{" "}
                          {task.updatedAt
                            ? new Date(task.updatedAt).toLocaleString("zh-CN")
                            : "未知时间"}
                        </span>
                      </div>
                      <p className="text-sm leading-relaxed text-foreground/80 line-clamp-3">
                        {task.content}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRestore(task.id)}
                      disabled={restoringId === task.id}
                    >
                      {restoringId === task.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <RotateCcw className="h-3 w-3" />
                      )}
                      {restoringId === task.id ? "恢复中..." : "恢复"}
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => setConfirmDeleteId(task.id)}
                      disabled={deletingId === task.id}
                    >
                      <Trash2 className="h-3 w-3" />
                      永久删除
                    </Button>
                  </div>
                </Card>
              );
            }}
          </AnimatedList>

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
        </>
      )}

      {/* 永久删除确认弹窗 */}
      {confirmDeleteId && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/30 p-4 backdrop-blur-md"
          onClick={() => setConfirmDeleteId(null)}
        >
          <div
            className="w-full max-w-sm rounded-3xl border border-graveyard/30 glass-modal p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center gap-2 text-graveyard">
              <XCircle className="h-5 w-5" />
              <span className="text-sm font-semibold">确认永久删除？</span>
            </div>
            <p className="mb-1 text-xs text-muted-foreground">
              此操作将永久删除该任务，<strong className="text-foreground">无法恢复</strong>。
            </p>
            <p className="mb-5 text-xs text-muted-foreground">
              如果只是想重新启用，请使用「恢复」功能。
            </p>
            <div className="flex justify-end gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setConfirmDeleteId(null)}
              >
                取消
              </Button>
              <Button
                size="sm"
                variant="danger"
                onClick={() => handlePermanentDelete(confirmDeleteId)}
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

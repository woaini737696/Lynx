"use client";

import { useState } from "react";
import { toast } from "@/components/ui/toast";
import type { TaskPatternItem } from "../types";

/** 任务模式学习（Task 7：auto-work） */
export function useTaskPatterns() {
  const [taskPatterns, setTaskPatterns] = useState<TaskPatternItem[]>([]);
  const [taskPatternsLoading, setTaskPatternsLoading] = useState(false);
  const [autoCheckInput, setAutoCheckInput] = useState("");
  const [autoChecking, setAutoChecking] = useState(false);

  const fetchTaskPatterns = async () => {
    try {
      setTaskPatternsLoading(true);
      const res = await fetch("/api/hermes/patterns?pageSize=50");
      const data = await res.json();
      if (Array.isArray(data.patterns)) {
        setTaskPatterns(data.patterns as TaskPatternItem[]);
      }
    } catch {
      // 静默失败，不打扰用户
    } finally {
      setTaskPatternsLoading(false);
    }
  };

  const togglePatternAutoExecute = async (patternId: string, next: boolean) => {
    // 乐观更新
    setTaskPatterns((prev) =>
      prev.map((p) => (p.id === patternId ? { ...p, autoExecute: next } : p))
    );
    try {
      const res = await fetch(`/api/hermes/patterns/${patternId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoExecute: next }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        // 回滚
        setTaskPatterns((prev) =>
          prev.map((p) => (p.id === patternId ? { ...p, autoExecute: !next } : p))
        );
        toast(data.error || "更新失败", "error");
      } else {
        toast(next ? "已启用自动执行" : "已关闭自动执行", "success");
      }
    } catch {
      setTaskPatterns((prev) =>
        prev.map((p) => (p.id === patternId ? { ...p, autoExecute: !next } : p))
      );
      toast("更新失败", "error");
    }
  };

  const deleteTaskPattern = async (patternId: string) => {
    try {
      const res = await fetch(`/api/hermes/patterns/${patternId}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok && data.success) {
        setTaskPatterns((prev) => prev.filter((p) => p.id !== patternId));
        toast("已删除任务模式", "success");
      } else {
        toast(data.error || "删除失败", "error");
      }
    } catch {
      toast("删除失败", "error");
    }
  };

  const runAutoCheck = async () => {
    const desc = autoCheckInput.trim();
    if (!desc) {
      toast("请输入任务描述", "error");
      return;
    }
    try {
      setAutoChecking(true);
      const res = await fetch("/api/hermes/patterns/auto-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskDescription: desc, execute: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "检查失败", "error");
        return;
      }
      if (!data.matched) {
        toast("未匹配到可自动执行的任务模式", "info");
        return;
      }
      if (!data.executed) {
        toast(`匹配到模式（得分 ${data.score?.toFixed(2)}），但未执行`, "info");
        return;
      }
      const success = data.result?.success;
      toast(
        success
          ? `✅ 自动执行成功（模式：${data.patternKey}）`
          : `❌ 自动执行失败：${data.result?.error || "未知原因"}`,
        success ? "success" : "error"
      );
      // 刷新列表以更新执行次数
      fetchTaskPatterns();
    } catch {
      toast("检查失败", "error");
    } finally {
      setAutoChecking(false);
    }
  };

  return {
    taskPatterns,
    taskPatternsLoading,
    autoCheckInput,
    setAutoCheckInput,
    autoChecking,
    fetchTaskPatterns,
    togglePatternAutoExecute,
    deleteTaskPattern,
    runAutoCheck,
  };
}

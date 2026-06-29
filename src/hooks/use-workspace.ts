/**
 * useWorkspace - 当前用户的职业 AI 工作空间
 *
 * 返回：profession key + workspace 配置（4 个维度）
 *   - quickCommands: 可见快捷技能（[{label, ...}]）
 *   - systemPrompt: 职业 system prompt（仅后端注入，前端展示可只读）
 *   - defaultProvider/defaultModel/defaultReasoningMode: 默认 LLM
 *   - allowedTools: 可见工具白名单
 *   - enabled/isDefault: 是否启用 / 是否回退到默认
 *
 * 数据源：/api/ai/workspace（GET）
 * 缓存：模块级 Map<userId, workspace>，5 分钟内复用
 */

"use client";

import { useEffect, useState } from "react";

export interface WorkspaceConfig {
  profession: string;
  displayName: string;
  icon: string;
  accentColor: string;
  description: string | null;
  quickCommands: Array<{ label?: string; icon?: string; message?: string; description?: string }>;
  systemPrompt: string;
  defaultProvider: string | null;
  defaultModel: string | null;
  defaultReasoningMode: string | null;
  allowedTools: string[];
  enabled: boolean;
  isDefault: boolean;
}

interface WorkspaceState {
  profession: string | null;
  workspace: WorkspaceConfig | null;
  loading: boolean;
  error: string | null;
}

// 简单内存缓存（key 用 profession+user，避免跨用户串数据）
let cache: { key: string; data: WorkspaceState; ts: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

export function useWorkspace(): WorkspaceState & { refetch: () => Promise<void> } {
  const [state, setState] = useState<WorkspaceState>({
    profession: null,
    workspace: null,
    loading: true,
    error: null,
  });

  const fetchData = async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await fetch("/api/ai/workspace", { cache: "no-store" });
      if (!res.ok) {
        setState({
          profession: null,
          workspace: null,
          loading: false,
          error: `加载失败 (${res.status})`,
        });
        return;
      }
      const data = await res.json();
      const next: WorkspaceState = {
        profession: data.profession || null,
        workspace: data.workspace || null,
        loading: false,
        error: null,
      };
      setState(next);
      cache = {
        key: data.profession || "none",
        data: next,
        ts: Date.now(),
      };
    } catch (e) {
      setState({
        profession: null,
        workspace: null,
        loading: false,
        error: e instanceof Error ? e.message : "未知错误",
      });
    }
  };

  useEffect(() => {
    if (cache && Date.now() - cache.ts < CACHE_TTL_MS) {
      setState(cache.data);
      return;
    }
    void fetchData();
  }, []);

  return { ...state, refetch: fetchData };
}

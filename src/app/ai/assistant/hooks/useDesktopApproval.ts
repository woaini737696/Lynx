"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "@/components/ui/toast";
import {
  isDesktop,
  getAuthMode,
  setAuthMode as desktopSetAuthMode,
  getAgentStatus,
  onApprovalRequest,
  respondApproval,
  type ApprovalRequest,
} from "@/lib/desktop-client";

/** 桌面端 HermesAgent 授权模式相关状态 */
export function useDesktopApproval() {
  const [desktopMode, setDesktopMode] = useState(false);
  const [authMode, setAuthModeState] = useState<"approve" | "once" | "free">("approve");
  const [showApproval, setShowApproval] = useState(false);
  const [currentApproval, setCurrentApproval] = useState<ApprovalRequest | null>(null);
  const [wsConnected, setWsConnected] = useState(false);

  // 桌面端：初始化授权模式 + 注册审批请求监听
  useEffect(() => {
    if (!isDesktop()) return;
    setDesktopMode(true);

    // 获取当前授权模式
    getAuthMode().then((mode) => {
      if (mode === "approve" || mode === "once" || mode === "free") {
        setAuthModeState(mode);
      }
    }).catch(() => {});

    // 获取 WS 连接状态
    getAgentStatus().then((s) => {
      if (s) setWsConnected(s.wsConnected);
    }).catch(() => {});

    // 注册审批请求监听
    let unlistenApproval: (() => void) | null = null;
    onApprovalRequest((req) => {
      setCurrentApproval(req);
      setShowApproval(true);
    }).then((fn) => {
      unlistenApproval = fn;
    });

    return () => {
      unlistenApproval?.();
    };
  }, []);

  // 切换授权模式
  const handleAuthModeChange = useCallback(async (mode: "approve" | "once" | "free") => {
    try {
      await desktopSetAuthMode(mode);
      setAuthModeState(mode);
      toast(`授权模式：${mode === "approve" ? "弹窗审批" : mode === "once" ? "一次授权" : "免审批"}`, "success");
    } catch (e: any) {
      toast("切换授权模式失败：" + e.message, "error");
    }
  }, []);

  // 响应审批请求
  const handleApprovalResponse = useCallback(async (approved: boolean) => {
    if (!currentApproval) return;
    try {
      await respondApproval(currentApproval.requestId, approved);
      toast(approved ? "已批准执行" : "已拒绝执行", "success");
    } catch (e: any) {
      toast("响应审批失败：" + e.message, "error");
    } finally {
      setShowApproval(false);
      setCurrentApproval(null);
    }
  }, [currentApproval]);

  return {
    desktopMode,
    authMode,
    showApproval,
    currentApproval,
    wsConnected,
    handleAuthModeChange,
    handleApprovalResponse,
  };
}

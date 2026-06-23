"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check, Circle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/layout/PageHeader";
import type { LLMProvider, ReasoningMode } from "@/lib/ai-provider";

/** 模型选择值：Provider + 具体模型变体 + 推理模式 */
export interface ModelSwitcherValue {
  provider: LLMProvider;
  model: string;
  reasoningMode: ReasoningMode;
}

// Provider 下的模型变体（来自 /api/ai/models 的 catalog）
interface ModelVariantItem {
  id: string;
  name: string;
  desc: string;
  multimodal?: boolean;
}
interface ProviderItem {
  id: LLMProvider;
  name: string;
  available: boolean;
  models: ModelVariantItem[];
}
interface ReasoningModeItem {
  id: ReasoningMode;
  name: string;
  desc: string;
}
interface Catalog {
  providers: ProviderItem[];
  reasoningModes: ReasoningModeItem[];
}

interface ModelSwitcherProps {
  /** 当前选中的值 */
  value: ModelSwitcherValue;
  /** 切换回调 */
  onChange: (v: ModelSwitcherValue) => void;
  /** 是否禁用 */
  disabled?: boolean;
  /** 自定义类名 */
  className?: string;
}

/**
 * LLM 模型切换器（三级选择）
 * Provider → 具体模型变体（Flash/Pro、2.5/2.5Pro）→ 推理模式（快速/标准/深度推理）
 * 数据来自 /api/ai/models 的 catalog 字段
 */
export function ModelSwitcher({
  value,
  onChange,
  disabled,
  className,
}: ModelSwitcherProps) {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // 拉取模型目录
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("/api/ai/models")
      .then((r) => r.json())
      .then((data: { catalog?: Catalog }) => {
        if (cancelled) return;
        if (data.catalog && Array.isArray(data.catalog.providers)) {
          setCatalog(data.catalog);
        }
      })
      .catch(() => {
        // 拉取失败时静默处理，保留空目录
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 点击外部关闭下拉
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const providers = catalog?.providers ?? [];
  const reasoningModes = catalog?.reasoningModes ?? [];

  // 当前 provider 信息
  const currentProvider =
    providers.find((p) => p.id === value.provider) || null;
  // 当前模型变体信息
  const currentModel =
    currentProvider?.models.find((m) => m.id === value.model) || null;
  // 当前推理模式信息
  const currentMode =
    reasoningModes.find((m) => m.id === value.reasoningMode) || null;

  // 切换 provider：同时把 model 重置为该 provider 的第一个可用模型
  const handleProviderChange = (p: ProviderItem) => {
    if (!p.available) return;
    const firstModel = p.models[0]?.id || "";
    onChange({
      provider: p.id,
      model: firstModel,
      reasoningMode: value.reasoningMode,
    });
  };

  const handleModelChange = (m: ModelVariantItem) => {
    onChange({
      provider: value.provider,
      model: m.id,
      reasoningMode: value.reasoningMode,
    });
  };

  const handleModeChange = (m: ReasoningModeItem) => {
    onChange({
      provider: value.provider,
      model: value.model,
      reasoningMode: m.id,
    });
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <Button
        size="sm"
        variant="outline"
        disabled={disabled || loading}
        onClick={() => setOpen((v) => !v)}
        title="切换 LLM 模型 / 推理模式"
      >
        {loading ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <StatusDot available={currentProvider?.available ?? false} />
        )}
        <span className="max-w-[180px] truncate">
          {currentProvider ? currentProvider.name : "选择模型"}
          {currentModel && <span className="text-muted-foreground"> · {currentModel.name}</span>}
          {currentMode && <span className="text-muted-foreground"> · {currentMode.name}</span>}
        </span>
        <ChevronDown
          className={cn(
            "h-3 w-3 transition-transform",
            open && "rotate-180"
          )}
        />
      </Button>

      {open && (
        <div className="absolute right-0 z-50 mt-1 min-w-[260px] overflow-hidden rounded-xl border border-border bg-card shadow-lg animate-in fade-in zoom-in-95 duration-150">
          {/* Provider 分组 */}
          <div className="border-b border-border px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            服务商
          </div>
          <ul className="py-1">
            {providers.length === 0 && !loading && (
              <li className="px-3 py-2 text-[11px] text-muted-foreground">
                暂无可用模型
              </li>
            )}
            {providers.map((p) => {
              const selected = p.id === value.provider;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    disabled={!p.available}
                    onClick={() => handleProviderChange(p)}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-2 text-left transition-colors",
                      selected
                        ? "bg-cognition/10 text-cognition"
                        : "text-foreground hover:bg-muted",
                      !p.available && "cursor-not-allowed opacity-50"
                    )}
                  >
                    <StatusDot available={p.available} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-xs font-medium">
                        {p.name}
                        {!p.available && (
                          <span className="text-[9px] text-muted-foreground">
                            (未配置)
                          </span>
                        )}
                      </div>
                    </div>
                    {selected && <Check className="h-3 w-3 shrink-0" />}
                  </button>
                </li>
              );
            })}
          </ul>

          {/* 模型变体分组 */}
          {currentProvider && currentProvider.models.length > 0 && (
            <>
              <div className="border-t border-b border-border px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                模型变体
              </div>
              <ul className="py-1">
                {currentProvider.models.map((m) => {
                  const selected = m.id === value.model;
                  return (
                    <li key={m.id}>
                      <button
                        type="button"
                        onClick={() => handleModelChange(m)}
                        className={cn(
                          "flex w-full items-center gap-2 px-3 py-2 text-left transition-colors",
                          selected
                            ? "bg-cognition/10 text-cognition"
                            : "text-foreground hover:bg-muted"
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 text-xs font-medium">
                            {m.name}
                            {m.multimodal && (
                              <span className="rounded bg-cognition/15 px-1 py-0.5 text-[8px] font-medium text-cognition">
                                多模态
                              </span>
                            )}
                          </div>
                          <div className="truncate text-[10px] text-muted-foreground">
                            {m.desc}
                          </div>
                        </div>
                        {selected && <Check className="h-3 w-3 shrink-0" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          {/* 推理模式分组 */}
          {reasoningModes.length > 0 && (
            <>
              <div className="border-t border-b border-border px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                推理模式
              </div>
              <ul className="py-1">
                {reasoningModes.map((m) => {
                  const selected = m.id === value.reasoningMode;
                  return (
                    <li key={m.id}>
                      <button
                        type="button"
                        onClick={() => handleModeChange(m)}
                        className={cn(
                          "flex w-full items-center gap-2 px-3 py-2 text-left transition-colors",
                          selected
                            ? "bg-cognition/10 text-cognition"
                            : "text-foreground hover:bg-muted"
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-medium">{m.name}</div>
                          <div className="truncate text-[10px] text-muted-foreground">
                            {m.desc}
                          </div>
                        </div>
                        {selected && <Check className="h-3 w-3 shrink-0" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** 可用状态指示灯 */
function StatusDot({ available }: { available: boolean }) {
  return (
    <Circle
      className={cn(
        "h-2.5 w-2.5 fill-current",
        available ? "text-task" : "text-graveyard"
      )}
    />
  );
}

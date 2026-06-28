"use client";

// 通用列表控件：分页 + 搜索 + 筛选
// 所有列表页统一使用，保证一致的交互体验

import { useMemo, useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

// ============ 搜索输入框 ============

export function SearchInput({
  value,
  onChange,
  placeholder = "搜索...",
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <svg
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <circle cx={11} cy={11} r={7} />
        <path d="m21 21-4.3-4.3" />
      </svg>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="ios-glass-sm h-9 w-full rounded-xl border-0 bg-transparent pl-9 pr-8 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20"
      />
      {value && (
        <button
          onClick={() => onChange("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground"
          aria-label="清除搜索"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

// ============ 筛选下拉 ============

export function FilterSelect<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: string }>;
  label?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      {label && (
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">
          {label}
        </span>
      )}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className={cn(
          "ios-glass-sm h-9 cursor-pointer rounded-xl border-0 bg-transparent text-sm text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20",
          label ? "pl-14 pr-8" : "pl-3 pr-8"
        )}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <svg
        className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </div>
  );
}

// ============ 分页器 ============

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (p: number) => void;
  onPageSizeChange?: (s: number) => void;
  pageSizeOptions?: number[];
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, total);

  // 生成页码按钮（最多显示 7 个，包含首尾和省略号）
  const pages = useMemo(() => {
    const result: (number | "...")[] = [];
    const max = 7;
    if (totalPages <= max) {
      for (let i = 1; i <= totalPages; i++) result.push(i);
      return result;
    }
    result.push(1);
    const left = Math.max(2, safePage - 1);
    const right = Math.min(totalPages - 1, safePage + 1);
    if (left > 2) result.push("...");
    for (let i = left; i <= right; i++) result.push(i);
    if (right < totalPages - 1) result.push("...");
    result.push(totalPages);
    return result;
  }, [safePage, totalPages]);

  if (total === 0) return null;

  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t border-border/60 pt-3 sm:flex-row">
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span>
          共 <span className="font-medium text-foreground">{total}</span> 条 · 第 {start}-{end} 条
        </span>
        {onPageSizeChange && (
          <div className="flex items-center gap-1.5">
            <span>每页</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="ios-glass-sm h-7 cursor-pointer rounded-lg border-0 bg-transparent px-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              {pageSizeOptions.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(safePage - 1)}
          disabled={safePage <= 1}
          className="flex h-8 items-center rounded-lg px-2.5 text-xs text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
          aria-label="上一页"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        {pages.map((p, i) =>
          p === "..." ? (
            <span key={`e${i}`} className="px-1.5 text-xs text-muted-foreground">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={cn(
                  "flex h-8 min-w-[2rem] items-center justify-center rounded-lg px-2 text-xs font-medium transition-colors",
                  p === safePage
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-primary/10 hover:text-foreground"
                )}
            >
              {p}
            </button>
          )
        )}
        <button
          onClick={() => onPageChange(safePage + 1)}
          disabled={safePage >= totalPages}
          className="flex h-8 items-center rounded-lg px-2.5 text-xs text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
          aria-label="下一页"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ============ 客户端分页 Hook ============
// 适用于数据已全部加载到前端的列表

export function useClientPagination<T>(items: T[], initialPageSize = 10) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  // 数据或每页条数变化时，回到第 1 页（仅当当前页超出范围）
  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
    if (page > totalPages) setPage(1);
  }, [items.length, pageSize, page]);

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page, pageSize]);

  const handlePageSizeChange = useCallback((s: number) => {
    setPageSize(s);
    setPage(1);
  }, []);

  return {
    page,
    pageSize,
    total: items.length,
    paginated,
    onPageChange: setPage,
    onPageSizeChange: handlePageSizeChange,
  };
}

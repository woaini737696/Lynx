"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { ScrollText, RefreshCw, Copy, Check, Calendar } from "lucide-react";
import { PageHeader, Card, Button, LoadingState } from "@/components/layout/PageHeader";
import { SearchInput, FilterSelect, Pagination, useClientPagination } from "@/components/ui/ListControls";
import { HelpButton } from "@/components/layout/HelpButton";
import { toast } from "@/components/ui/toast";

interface DevLogEntry {
  number: number;
  date: string;
  title: string;
  rawContent: string;
}

export default function DevLogPage() {
  const [entries, setEntries] = useState<DevLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState<string>("all");

  const fetchLog = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/dev-log");
      const data = await res.json();
      if (res.ok) {
        setEntries(data.entries || []);
      } else {
        toast(data.error || "读取失败", "error");
      }
    } catch {
      toast("网络错误", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLog();
  }, [fetchLog]);

  // 日期选项（按日期去重，倒序）
  const dateOptions = useMemo(() => {
    const set = new Set(entries.map((e) => e.date));
    const dates = Array.from(set).sort((a, b) => b.localeCompare(a));
    return [
      { value: "all", label: "全部日期" },
      ...dates.map((d) => ({ value: d, label: d })),
    ];
  }, [entries]);

  // 筛选+搜索
  const filtered = useMemo(() => {
    let list = entries;
    if (dateFilter !== "all") {
      list = list.filter((e) => e.date === dateFilter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.rawContent.toLowerCase().includes(q) ||
          String(e.number).includes(q)
      );
    }
    // 按迭代号倒序（最新在前）
    return [...list].sort((a, b) => b.number - a.number);
  }, [entries, dateFilter, search]);

  // 分页
  const { page, pageSize, total, paginated, onPageChange, onPageSizeChange } =
    useClientPagination(filtered, 5);

  const handleCopy = async () => {
    try {
      const text = entries.map((e) => e.rawContent).join("\n\n---\n\n");
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast("已复制到剪贴板", "success");
    } catch {
      toast("复制失败", "error");
    }
  };

  // 简易 Markdown 渲染（按迭代条目渲染）
  const renderEntry = (entry: DevLogEntry) => {
    const lines = entry.rawContent.split("\n");
    const blocks: React.ReactNode[] = [];
    let codeBlock: string[] = [];
    let inCodeBlock = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.trim().startsWith("```")) {
        if (inCodeBlock) {
          blocks.push(
            <pre key={`code-${i}`} className="glass-card my-2 overflow-x-auto rounded-lg border border-border p-3 text-xs">
              {codeBlock.join("\n")}
            </pre>
          );
          codeBlock = [];
          inCodeBlock = false;
        } else {
          inCodeBlock = true;
        }
        continue;
      }
      if (inCodeBlock) {
        codeBlock.push(line);
        continue;
      }

      if (line.startsWith("## ")) {
        blocks.push(
          <h2 key={i} className="mt-2 mb-2 text-lg font-bold text-foreground">
            {line.slice(3)}
          </h2>
        );
      } else if (line.startsWith("### ")) {
        blocks.push(
          <h3 key={i} className="mt-3 mb-1.5 text-base font-semibold text-foreground">
            {line.slice(4)}
          </h3>
        );
      } else if (line.startsWith("#### ")) {
        blocks.push(
          <h4 key={i} className="mt-2 mb-1 text-sm font-semibold text-cognition">
            {line.slice(5)}
          </h4>
        );
      } else if (line.startsWith("> ")) {
        blocks.push(
          <blockquote key={i} className="my-2 border-l-2 border-cognition/40 pl-3 text-xs italic text-muted-foreground">
            {line.slice(2)}
          </blockquote>
        );
      } else if (line.startsWith("- ") || line.startsWith("* ")) {
        blocks.push(
          <div key={i} className="ml-4 flex gap-1.5 py-0.5 text-xs">
            <span className="text-muted-foreground">•</span>
            <span className="flex-1 text-foreground/90">{renderInline(line.slice(2))}</span>
          </div>
        );
      } else if (line.match(/^\d+\.\s/)) {
        blocks.push(
          <div key={i} className="ml-4 flex gap-1.5 py-0.5 text-xs">
            <span className="text-muted-foreground">{line.match(/^\d+\./)?.[0]}</span>
            <span className="flex-1 text-foreground/90">{renderInline(line.replace(/^\d+\.\s/, ""))}</span>
          </div>
        );
      } else if (line.trim() === "---") {
        blocks.push(<hr key={i} className="my-3 border-border" />);
      } else if (line.trim() === "") {
        blocks.push(<div key={i} className="h-2" />);
      } else {
        blocks.push(
          <p key={i} className="py-0.5 text-xs leading-relaxed text-foreground/90">
            {renderInline(line)}
          </p>
        );
      }
    }

    if (inCodeBlock && codeBlock.length > 0) {
      blocks.push(
        <pre key="code-final" className="glass-card my-2 overflow-x-auto rounded-lg border border-border p-3 text-xs">
          {codeBlock.join("\n")}
        </pre>
      );
    }

    return blocks;
  };

  const renderInline = (text: string): React.ReactNode => {
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let key = 0;

    while (remaining.length > 0) {
      const codeMatch = remaining.match(/^`([^`]+)`/);
      if (codeMatch) {
        parts.push(
          <code key={key++} className="ios-glass-sm rounded px-1 py-0.5 text-[10px] text-cognition">
            {codeMatch[1]}
          </code>
        );
        remaining = remaining.slice(codeMatch[0].length);
        continue;
      }
      const boldMatch = remaining.match(/^\*\*([^*]+)\*\*/);
      if (boldMatch) {
        parts.push(
          <strong key={key++} className="font-semibold text-foreground">
            {boldMatch[1]}
          </strong>
        );
        remaining = remaining.slice(boldMatch[0].length);
        continue;
      }
      const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
      if (linkMatch) {
        parts.push(
          <a key={key++} href={linkMatch[2]} target="_blank" rel="noopener noreferrer" className="text-cognition underline hover:text-cognition/80">
            {linkMatch[1]}
          </a>
        );
        remaining = remaining.slice(linkMatch[0].length);
        continue;
      }
      const nextSpecial = remaining.search(/[`*\[]/);
      if (nextSpecial === -1) {
        parts.push(<span key={key++}>{remaining}</span>);
        break;
      }
      if (nextSpecial > 0) {
        parts.push(<span key={key++}>{remaining.slice(0, nextSpecial)}</span>);
        remaining = remaining.slice(nextSpecial);
      } else {
        parts.push(<span key={key++}>{remaining[0]}</span>);
        remaining = remaining.slice(1);
      }
    }

    return parts;
  };

  return (
    <div className="p-4 sm:p-8">
      <PageHeader
        title="开发日志"
        subtitle={`记录每次迭代的变更内容 · 共 ${entries.length} 条迭代`}
        action={
          <div className="flex gap-2">
            <HelpButton contentKey="dev-log" />
            <Button variant="outline" onClick={handleCopy} disabled={entries.length === 0}>
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              复制
            </Button>
            <Button variant="outline" onClick={fetchLog} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              刷新
            </Button>
          </div>
        }
      />

      {/* 筛选栏 */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="搜索迭代号、标题或内容..."
          className="min-w-[200px] flex-1"
        />
        <FilterSelect
          value={dateFilter}
          onChange={setDateFilter}
          options={dateOptions}
          label="日期"
        />
      </div>

      {loading ? (
        <LoadingState title="开发日志" />
      ) : filtered.length === 0 ? (
        <Card className="py-12">
          <div className="flex flex-col items-center justify-center text-center">
            <ScrollText className="h-8 w-8 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">
              {search || dateFilter !== "all" ? "没有匹配的迭代记录" : "暂无开发日志"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground/60">
              日志文件位于项目根目录 DEV_LOG.md
            </p>
          </div>
        </Card>
      ) : (
        <>
          {/* 迭代列表 - 按页展示 */}
          <div className="space-y-4">
            {paginated.map((entry) => (
              <Card key={entry.number} className="overflow-hidden">
                {/* 迭代头部 - sticky */}
                <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-background/95 px-4 py-3 backdrop-blur-xl">
                  <Calendar className="h-4 w-4 text-cognition" />
                  <span className="text-sm font-semibold text-foreground">
                    迭代 {entry.number}
                  </span>
                  <span className="text-xs text-muted-foreground">{entry.date}</span>
                  {entry.title && (
                    <span className="ml-1 truncate text-xs text-foreground/70">· {entry.title}</span>
                  )}
                </div>
                {/* 迭代内容 */}
                <div className="max-h-[600px] overflow-y-auto p-4">
                  {renderEntry(entry)}
                </div>
              </Card>
            ))}
          </div>

          {/* 分页 */}
          {filtered.length > 0 && (
            <div className="mt-4">
              <Pagination
                page={page}
                pageSize={pageSize}
                total={total}
                onPageChange={onPageChange}
                onPageSizeChange={onPageSizeChange}
                pageSizeOptions={[5, 10, 20]}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { ScrollText, RefreshCw, Copy, Check } from "lucide-react";
import { PageHeader, Card, Button, LoadingState } from "@/components/layout/PageHeader";
import { toast } from "@/components/ui/toast";

export default function DevLogPage() {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const fetchLog = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/dev-log");
      const data = await res.json();
      if (res.ok) {
        setContent(data.content || "");
      } else {
        toast(data.error || "读取失败", "error");
      }
    } catch {
      toast("网络错误", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLog();
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast("已复制到剪贴板", "success");
    } catch {
      toast("复制失败", "error");
    }
  };

  // 简易 Markdown 渲染：按行分割，标题加粗，列表缩进
  const renderMarkdown = (text: string) => {
    const lines = text.split("\n");
    const blocks: React.ReactNode[] = [];
    let codeBlock: string[] = [];
    let inCodeBlock = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // 代码块处理
      if (line.trim().startsWith("```")) {
        if (inCodeBlock) {
          blocks.push(
            <pre key={`code-${i}`} className="my-2 overflow-x-auto rounded-lg border border-border bg-muted/50 p-3 text-xs">
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

      // 标题
      if (line.startsWith("# ")) {
        blocks.push(
          <h1 key={i} className="mt-4 mb-2 text-xl font-bold text-foreground">
            {line.slice(2)}
          </h1>
        );
      } else if (line.startsWith("## ")) {
        blocks.push(
          <h2 key={i} className="mt-4 mb-2 text-lg font-bold text-foreground">
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
            <span className="flex-1">{renderInline(line.slice(2))}</span>
          </div>
        );
      } else if (line.match(/^\d+\.\s/)) {
        blocks.push(
          <div key={i} className="ml-4 flex gap-1.5 py-0.5 text-xs">
            <span className="text-muted-foreground">{line.match(/^\d+\./)?.[0]}</span>
            <span className="flex-1">{renderInline(line.replace(/^\d+\.\s/, ""))}</span>
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

    // 处理未关闭的代码块
    if (inCodeBlock && codeBlock.length > 0) {
      blocks.push(
        <pre key="code-final" className="my-2 overflow-x-auto rounded-lg border border-border bg-muted/50 p-3 text-xs">
          {codeBlock.join("\n")}
        </pre>
      );
    }

    return blocks;
  };

  // 行内格式：`code`、**bold**、[link](url)
  const renderInline = (text: string): React.ReactNode => {
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let key = 0;

    while (remaining.length > 0) {
      // `code`
      const codeMatch = remaining.match(/^`([^`]+)`/);
      if (codeMatch) {
        parts.push(
          <code key={key++} className="rounded bg-muted px-1 py-0.5 text-[10px] text-cognition">
            {codeMatch[1]}
          </code>
        );
        remaining = remaining.slice(codeMatch[0].length);
        continue;
      }
      // **bold**
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
      // [link](url)
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
      // 普通文本：找到下一个特殊字符
      const nextSpecial = remaining.search(/[`*\[]/);
      if (nextSpecial === -1) {
        parts.push(<span key={key++}>{remaining}</span>);
        break;
      }
      if (nextSpecial > 0) {
        parts.push(<span key={key++}>{remaining.slice(0, nextSpecial)}</span>);
        remaining = remaining.slice(nextSpecial);
      } else {
        // 以特殊字符开头但未匹配，直接取一个字符
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
        subtitle="记录每次迭代的变更内容，开发时先读取了解历史"
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleCopy} disabled={!content}>
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

      {loading ? (
        <LoadingState title="开发日志" />
      ) : (
        <Card>
          <div className="max-h-[calc(100vh-12rem)] overflow-y-auto p-4">
            {content ? (
              renderMarkdown(content)
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <ScrollText className="h-8 w-8 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">暂无开发日志</p>
                <p className="mt-1 text-xs text-muted-foreground/60">
                  日志文件位于项目根目录 DEV_LOG.md
                </p>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

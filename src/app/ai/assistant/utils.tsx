import { Fragment } from "react";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/toast";
import { webmToWav } from "@/lib/audio-utils";

// ============ Markdown 渲染 ============

export function renderMarkdown(text: string): React.ReactNode {
  const blocks = splitMarkdownBlocks(text);
  return blocks.map((block, i) => {
    if (block.type === "code") {
      return (
        <pre
          key={i}
          className="my-2 overflow-x-auto rounded-lg border border-border bg-muted/50 p-3 text-[12px] leading-relaxed"
        >
          {block.lang && (
            <div className="mb-1.5 text-[10px] font-medium uppercase text-muted-foreground">
              {block.lang}
            </div>
          )}
          <code className="font-mono text-foreground">{block.content}</code>
        </pre>
      );
    }
    return <Fragment key={i}>{renderInlineBlock(block.content)}</Fragment>;
  });
}

function splitMarkdownBlocks(text: string): Array<{ type: "text" | "code"; content: string; lang?: string }> {
  const blocks: Array<{ type: "text" | "code"; content: string; lang?: string }> = [];
  const codeBlockRe = /```(\w*)\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = codeBlockRe.exec(text)) !== null) {
    if (match.index > lastIndex) {
      blocks.push({ type: "text", content: text.slice(lastIndex, match.index) });
    }
    blocks.push({ type: "code", lang: match[1] || undefined, content: match[2].replace(/\n$/, "") });
    lastIndex = codeBlockRe.lastIndex;
  }
  if (lastIndex < text.length) {
    blocks.push({ type: "text", content: text.slice(lastIndex) });
  }
  return blocks;
}

function renderInlineBlock(text: string): React.ReactNode {
  const lines = text.split("\n");
  const nodes: React.ReactNode[] = [];
  let listItems: Array<{ ordered: boolean; items: string[] }> = [];
  let currentOrdered = false;

  const flushList = (key: string) => {
    if (listItems.length === 0) return;
    listItems.forEach((group, gi) => {
      if (group.ordered) {
        nodes.push(
          <ol key={`${key}-ol-${gi}`} className="my-1.5 ml-5 list-decimal space-y-1">
            {group.items.map((it, ii) => (
              <li key={ii} className="text-sm leading-relaxed">{renderInline(it)}</li>
            ))}
          </ol>
        );
      } else {
        nodes.push(
          <ul key={`${key}-ul-${gi}`} className="my-1.5 ml-5 list-disc space-y-1">
            {group.items.map((it, ii) => (
              <li key={ii} className="text-sm leading-relaxed">{renderInline(it)}</li>
            ))}
          </ul>
        );
      }
    });
    listItems = [];
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushList(`fl-${idx}`);
      return;
    }
    const headingMatch = trimmed.match(/^(#{1,4})\s+(.*)$/);
    if (headingMatch) {
      flushList(`fl-${idx}`);
      const level = headingMatch[1].length;
      const sizes = ["text-base", "text-sm", "text-sm", "text-xs"];
      nodes.push(
        <div key={`h-${idx}`} className={cn("mt-2 mb-1 font-semibold", sizes[level - 1])}>
          {renderInline(headingMatch[2])}
        </div>
      );
      return;
    }
    if (trimmed.startsWith("> ")) {
      flushList(`fl-${idx}`);
      nodes.push(
        <blockquote key={`bq-${idx}`} className="my-1.5 border-l-2 border-cognition/40 bg-cognition/5 py-1 pl-3 text-sm italic text-muted-foreground">
          {renderInline(trimmed.slice(2))}
        </blockquote>
      );
      return;
    }
    const olMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (olMatch) {
      if (!currentOrdered || listItems.length === 0) {
        if (listItems.length > 0) flushList(`fl-${idx}`);
        currentOrdered = true;
        listItems.push({ ordered: true, items: [] });
      }
      listItems[listItems.length - 1].items.push(olMatch[2]);
      return;
    }
    const ulMatch = trimmed.match(/^[-*+]\s+(.*)$/);
    if (ulMatch) {
      if (currentOrdered || listItems.length === 0) {
        if (listItems.length > 0) flushList(`fl-${idx}`);
        currentOrdered = false;
        listItems.push({ ordered: false, items: [] });
      }
      listItems[listItems.length - 1].items.push(ulMatch[1]);
      return;
    }
    flushList(`fl-${idx}`);
    nodes.push(
      <p key={`p-${idx}`} className="text-sm leading-relaxed">
        {renderInline(trimmed)}
      </p>
    );
  });
  flushList("fl-end");
  return nodes;
}

function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const regex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith("`")) {
      parts.push(
        <code key={key++} className="rounded bg-muted px-1 py-0.5 font-mono text-[12px] text-cognition">
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith("**")) {
      parts.push(<strong key={key++} className="font-semibold text-foreground">{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("*")) {
      parts.push(<em key={key++} className="italic">{token.slice(1, -1)}</em>);
    } else if (token.startsWith("[")) {
      const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        parts.push(
          <a key={key++} href={linkMatch[2]} target="_blank" rel="noopener noreferrer" className="text-cognition underline hover:opacity-80">
            {linkMatch[1]}
          </a>
        );
      } else {
        parts.push(token);
      }
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
}

// ============ 消息/工具辅助 ============

/** 判断消息是否已持久化到数据库（可标注）。
 *  数据库消息 id 为 cuid（以 'c' 开头），本地临时 id 形如 'a-...'、'msg-...' 或 'welcome'。 */
export function isPersistedMessage(msgId: string): boolean {
  return (
    !!msgId &&
    msgId !== "welcome" &&
    !msgId.startsWith("a-") &&
    !msgId.startsWith("msg-")
  );
}

/** 生成工具调用结果的简短摘要（用于卡片标题） */
export function summarizeToolResult(result: any): string {
  if (!result) return "无结果";
  if (result.error) return `失败：${String(result.error).slice(0, 30)}`;
  // 常见字段优先
  if (typeof result.total === "number") return `${result.total} 项`;
  if (typeof result.success === "boolean" && result.success) {
    if (typeof result.count === "number") return `${result.count} 项`;
    if (typeof result.sentCount === "number") return `已发送 ${result.sentCount}`;
    if (typeof result.cognitionCount === "number") return `提取 ${result.cognitionCount} 条认知`;
    if (typeof result.edges === "number") return `${result.edges} 条边`;
    return "成功";
  }
  if (Array.isArray(result.ideas)) return `${result.ideas.length} 条灵感`;
  if (Array.isArray(result.tasks)) return `${result.tasks.length} 条任务`;
  if (Array.isArray(result.cognitions)) return `${result.cognitions.length} 条认知`;
  if (Array.isArray(result.skills)) return `${result.skills.length} 个技能`;
  if (Array.isArray(result.flows)) return `${result.flows.length} 个工作流`;
  if (Array.isArray(result.rules)) return `${result.rules.length} 条规则`;
  if (Array.isArray(result.logs)) return `${result.logs.length} 条日志`;
  if (Array.isArray(result.results)) return `${result.results.length} 项结果`;
  if (result.totalCompleted != null && result.totalActive != null) {
    return `完成 ${result.totalCompleted} / 进行中 ${result.totalActive}`;
  }
  if (result.output) return String(result.output).slice(0, 30);
  return "已执行";
}

// ============ TTS 辅助 ============

/** 将文本按句子切分（用于流式 TTS，降低首包延迟） */
export function splitSentences(text: string): string[] {
  // 按中文标点、英文标点、换行切分，保留标点
  const parts = text.split(/(?<=[。！？；\n.!?;])\s*/).filter(s => s.trim());
  // 合并过短的片段（<5 字符合并到前一句），避免过多请求
  const merged: string[] = [];
  for (const part of parts) {
    if (merged.length > 0 && part.trim().length < 5) {
      merged[merged.length - 1] += part;
    } else {
      merged.push(part);
    }
  }
  return merged.length > 0 ? merged : [text];
}

// ============ 录音/ASR 辅助 ============

/** 优先选择 mp4（Safari），回退 webm（Chrome），再回退默认 */
export function createMediaRecorder(stream: MediaStream): MediaRecorder {
  const mimeTypes = ["audio/mp4", "audio/m4a", "audio/webm", "audio/ogg"];
  const mimeType = mimeTypes.find((t) => MediaRecorder.isTypeSupported(t)) || "";
  return mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
}

/** 将音频 blob 转写为文字（调用 /api/ai/asr） */
export async function transcribeAudioBlob(blob: Blob): Promise<string | null> {
  // 将 webm/mp4 转为 wav（MiMo ASR 只支持 wav/mp3/flac/m4a/ogg）
  let wavBlob: Blob;
  let convertError: Error | null = null;
  try {
    wavBlob = await webmToWav(blob);
  } catch (e) {
    convertError = e as Error;
    // 转换失败：如果是原始 webm，不能伪装成 wav 发送（ASR 会解析失败）
    // 只有原始格式本身就是 ASR 支持的格式时才直接发送
    const rawType = blob.type || "";
    if (rawType.includes("mp4") || rawType.includes("m4a") || rawType.includes("ogg")) {
      wavBlob = blob;
    } else {
      // webm 格式无法转换也无法直接识别
      console.error("[ASR] webmToWav 转换失败:", convertError);
      toast("音频格式转换失败，请重试", "error");
      return null;
    }
  }
  const form = new FormData();
  // 根据转换后的 blob 类型设置扩展名
  const ext = wavBlob.type.includes("wav") ? "wav" : wavBlob.type.includes("mp4") ? "m4a" : "wav";
  form.append("file", wavBlob, `audio.${ext}`);
  const res = await fetch("/api/ai/asr", { method: "POST", body: form });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data) {
    toast(data?.error || `语音识别失败（${res.status}）`, "error");
    return null;
  }
  const text = (data as { text?: string }).text?.trim();
  return text || null;
}

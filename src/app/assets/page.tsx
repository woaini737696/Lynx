"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { MessageSquare, Plus, Sparkles, ChevronDown, ChevronUp, UploadCloud, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { CONVERSATION_SOURCES, type ConversationSource } from "@/lib/utils";
import { toast } from "@/components/ui/toast";
import { PageHeader, Card, Button, Badge, Skeleton } from "@/components/layout/PageHeader";
import { HelpButton } from "@/components/layout/HelpButton";
import { EmptyState } from "@/components/layout/EmptyState";
import { SearchInput, FilterSelect, Pagination, useClientPagination } from "@/components/ui/ListControls";
import { useAsyncLoading } from "@/lib/use-async-loading";
import {
  getFileType,
  fileTypeToSource,
  parseHtml,
  parseCsv,
  parseJson,
  imageThumb,
  parseSpreadsheetPlaceholder,
} from "@/lib/file-parser";

const CONVERSATION_SOURCE_LIST = Object.entries(CONVERSATION_SOURCES).map(([key, value]) => ({
  key: key as ConversationSource,
  ...value,
}));

// 手动捕获仅展示聊天来源
const CHAT_SOURCE_LIST = CONVERSATION_SOURCE_LIST.filter((s) => s.kind === "chat");

interface Conversation {
  id: string;
  source: ConversationSource;
  title: string;
  rawContent: string;
  conclusions: string[];
  todos: string[];
  prompts: string[];
  data: string[];
  createdAt: string;
}

interface UploadItem {
  id: string;
  filename: string;
  status: "reading" | "uploading" | "ai-extracting" | "done" | "error";
  error?: string;
}

// 读取文本文件
function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

// 读取图片为 DataURL
function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

// 读取 PDF 为 base64 字符串（不带 data URL 前缀）
function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        // reader.result 是 ArrayBuffer
        const arrayBuffer = reader.result as ArrayBuffer;
        const bytes = new Uint8Array(arrayBuffer);
        // 转为 base64
        let binary = "";
        const chunkSize = 0x8000; // 32KB 分块，避免 call stack 溢出
        for (let i = 0; i < bytes.length; i += chunkSize) {
          const chunk = bytes.subarray(i, i + chunkSize);
          binary += String.fromCharCode.apply(null, Array.from(chunk) as unknown as number[]);
        }
        resolve(btoa(binary));
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

export default function AssetsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCapture, setShowCapture] = useState(false);
  const [source, setSource] = useState<ConversationSource>("kimi");
  const [title, setTitle] = useState("");
  const [rawContent, setRawContent] = useState("");
  const [useAI, setUseAI] = useState(true);
  const [capturing, setCapturing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const captureFileInputRef = useRef<HTMLInputElement>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [filterSource, setFilterSource] = useState<ConversationSource | "all">("all");
  // 全局异步加载反馈：耗时超过 800ms 的操作会显示 overlay
  const { run: runAsync } = useAsyncLoading();

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/conversations");
        if (!mounted) return;
        if (res.ok) {
          const data = await res.json();
          setConversations(data.conversations || []);
        }
      } catch (e) {
        if (!mounted) return;
        console.error(e);
        toast("加载对话资产失败", "error");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const handleCapture = async () => {
    if (!rawContent.trim()) {
      toast("请粘贴对话内容或上传文件", "error");
      return;
    }
    setCapturing(true);
    try {
      const res = await runAsync("捕获对话", fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, title, rawContent, useAI }),
      }));
      if (res.ok) {
        const data = await res.json();
        setConversations((prev) => [data.conversation, ...prev]);
        setShowCapture(false);
        setTitle("");
        setRawContent("");
        toast(
          data.conversation.conclusions?.length
            ? `已捕获并提取 ${data.conversation.conclusions.length} 条结论`
            : "已捕获对话",
          "success"
        );
      } else {
        const err = await res.json();
        toast(err.error || "捕获失败", "error");
      }
    } catch {
      toast("网络错误", "error");
    }
    setCapturing(false);
  };

  // 在捕获表单中上传文件：读取文件内容填入 rawContent
  const handleCaptureFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    for (const file of files) {
      try {
        const fileType = getFileType(file.name);
        if (fileType === "image") {
          const dataUrl = await readFileAsDataURL(file);
          const thumb = imageThumb(dataUrl);
          setRawContent((prev) =>
            prev ? `${prev}\n\n[${file.name}]\n[图片资产缩略图]\n${thumb}` : `${file.name}\n[图片资产缩略图]\n${thumb}`
          );
        } else if (fileType === "pdf") {
          // PDF 在捕获表单中仅记录文件名
          setRawContent((prev) =>
            prev ? `${prev}\n\n[${file.name}]\n[PDF 文件，请使用拖拽上传区域进行 AI 解析]` : `${file.name}\n[PDF 文件，请使用拖拽上传区域进行 AI 解析]`
          );
        } else {
          const text = await readFileAsText(file);
          let content = text;
          if (fileType === "html") {
            content = parseHtml(text);
          } else if (fileType === "csv") {
            content = parseCsv(text);
          } else if (fileType === "json") {
            content = parseJson(text);
          }
          setRawContent((prev) =>
            prev ? `${prev}\n\n=== ${file.name} ===\n${content}` : `=== ${file.name} ===\n${content}`
          );
        }
        toast(`已加载文件: ${file.name}`, "info");
      } catch {
        toast(`读取文件失败: ${file.name}`, "error");
      }
    }
    // 清空 input 以便重复选择
    if (captureFileInputRef.current) captureFileInputRef.current.value = "";
  };

  // 处理单个文件：读取 -> 解析 -> 上传
  const processFile = async (file: File) => {
    const fileType = getFileType(file.name);
    const fileSource = fileTypeToSource(fileType);

    if (!fileSource) {
      toast(`不支持的文件格式: ${file.name}`, "error");
      return;
    }

    const fileId = `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setUploads((prev) => [...prev, { id: fileId, filename: file.name, status: "reading" }]);

    try {
      let content = "";
      const fileTitle = file.name;
      // PDF 专用：base64 文件数据传给后端
      let pdfFileData: string | undefined;
      let isPdf = false;

      if (fileType === "image") {
        const dataUrl = await readFileAsDataURL(file);
        content = `${file.name}\n[图片资产缩略图]\n${imageThumb(dataUrl)}`;
      } else if (fileType === "pdf") {
        isPdf = true;
        // 读取为 base64 传给后端解析
        pdfFileData = await readFileAsBase64(file);
        // content 留空，由后端解析后回填
        content = file.name;
      } else if (fileType === "spreadsheet") {
        // 表格类暂不解析，仅记录文件名
        content = parseSpreadsheetPlaceholder(file.name);
      } else {
        const text = await readFileAsText(file);
        if (fileType === "html") {
          content = parseHtml(text);
        } else if (fileType === "csv") {
          content = parseCsv(text);
        } else if (fileType === "json") {
          content = parseJson(text);
        } else {
          content = text;
        }
      }

      if (!content.trim() && !pdfFileData) {
        setUploads((prev) =>
          prev.map((u) =>
            u.id === fileId ? { ...u, status: "error", error: "文件内容为空" } : u
          )
        );
        return;
      }

      // PDF 进入 AI 提取阶段时显示 ai-extracting
      if (isPdf) {
        setUploads((prev) =>
          prev.map((u) => (u.id === fileId ? { ...u, status: "ai-extracting" } : u))
        );
      } else {
        setUploads((prev) =>
          prev.map((u) => (u.id === fileId ? { ...u, status: "uploading" } : u))
        );
      }

      const res = await runAsync(`上传文件：${file.name}`, fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: fileSource,
          title: fileTitle,
          rawContent: content,
          useAI: true,
          fileData: pdfFileData,
          filename: file.name,
        }),
      }));

      if (res.ok) {
        const data = await res.json();
        setConversations((prev) => [data.conversation, ...prev]);
        setUploads((prev) =>
          prev.map((u) => (u.id === fileId ? { ...u, status: "done" } : u))
        );
        // PDF 解析状态提示
        if (isPdf && data.pdfParseStatus) {
          const statusMsg: Record<string, string> = {
            local: "PDF 本地解析完成",
            "ai-fallback": "PDF 本地解析失败，已用 AI 视觉降级",
            failed: "PDF 解析失败",
            skipped: "PDF 仅记录文件名（未提供文件数据）",
          };
          const msg = statusMsg[data.pdfParseStatus] || "PDF 处理完成";
          toast(msg, data.pdfParseStatus === "failed" ? "error" : "info");
        }
        // 3 秒后自动清除已完成项
        setTimeout(() => {
          setUploads((prev) => prev.filter((u) => u.id !== fileId));
        }, 3000);
      } else {
        const err = await res.json();
        setUploads((prev) =>
          prev.map((u) =>
            u.id === fileId ? { ...u, status: "error", error: err.error || "上传失败" } : u
          )
        );
      }
    } catch {
      setUploads((prev) =>
        prev.map((u) =>
          u.id === fileId ? { ...u, status: "error", error: "读取失败" } : u
        )
      );
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;
    toast(`正在处理 ${files.length} 个文件...`, "info");
    // 并行处理所有文件
    await Promise.all(files.map(processFile));
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    toast(`正在处理 ${files.length} 个文件...`, "info");
    await Promise.all(files.map(processFile));
    // 重置 input 以便重复选择同一文件
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const clearUploads = () => setUploads([]);

  const filtered = useMemo(() => {
    return conversations.filter((c) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!c.title.toLowerCase().includes(q) && !c.rawContent.toLowerCase().includes(q)) return false;
      }
      if (filterSource !== "all" && c.source !== filterSource) return false;
      return true;
    });
  }, [conversations, searchQuery, filterSource]);

  const { page, pageSize, total, paginated, onPageChange, onPageSizeChange } = useClientPagination(filtered);

  return (
    <div className="p-4 sm:p-8">
      <PageHeader
        title="对话资产"
        subtitle="捕获 Kimi/Trae Solo/Claude/Codex/GPT 对话，或拖拽文件自动解析"
        action={
          <div className="flex items-center gap-2">
            <HelpButton contentKey="assets" />
            <Button onClick={() => setShowCapture(true)}>
              <Plus className="h-3.5 w-3.5" /> 捕获对话
            </Button>
          </div>
        }
      />

      {/* 拖拽上传区域 */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "mb-6 cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition-all",
          dragOver
            ? "border-campaign bg-campaign/10"
            : "glass-card hover:border-campaign/50"
        )}
      >
        <UploadCloud
          className={cn(
            "mx-auto h-8 w-8 transition-colors",
            dragOver ? "text-campaign" : "text-muted-foreground"
          )}
        />
        <p className="mt-2 text-sm font-medium text-foreground">
          {dragOver ? "松开以上传文件" : "拖拽文件到此处上传"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          支持 MD / HTML / TXT / CSV / JSON / 图片 / PDF / XLSX，可多文件批量上传
        </p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileSelect}
          accept=".md,.markdown,.html,.htm,.txt,.csv,.json,.png,.jpg,.jpeg,.gif,.webp,.pdf,.xlsx,.xls"
        />
      </div>

      {/* 上传进度列表 */}
      {uploads.length > 0 && (
        <div className="mb-6 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">上传进度</span>
            {uploads.some((u) => u.status === "error") && (
              <button
                onClick={clearUploads}
                className="text-[11px] text-muted-foreground hover:text-foreground"
              >
                清除
              </button>
            )}
          </div>
          {uploads.map((u) => (
            <div
              key={u.id}
              className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs"
            >
              <span className="flex-1 truncate text-foreground">{u.filename}</span>
              {u.status === "reading" && (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> 读取中
                </span>
              )}
              {u.status === "ai-extracting" && (
                <span className="flex items-center gap-1 text-cognition">
                  <Loader2 className="h-3 w-3 animate-spin" /> AI 提取中
                </span>
              )}
              {u.status === "uploading" && (
                <span className="flex items-center gap-1 text-cognition">
                  <Loader2 className="h-3 w-3 animate-spin" /> 提取中
                </span>
              )}
              {u.status === "done" && (
                <span className="flex items-center gap-1 text-task">
                  <CheckCircle2 className="h-3 w-3" /> 完成
                </span>
              )}
              {u.status === "error" && (
                <span className="flex items-center gap-1 text-graveyard">
                  <XCircle className="h-3 w-3" /> {u.error || "失败"}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {showCapture && (
        <Card className="mb-6">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <MessageSquare className="h-4 w-4 text-campaign" />
            捕获新对话
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {CHAT_SOURCE_LIST.map((s) => (
              <button
                key={s.key}
                onClick={() => setSource(s.key)}
                className={cn(
                  "rounded-xl border px-3 py-2 text-xs transition-all",
                  source === s.key
                    ? "border-campaign bg-campaign/10 text-campaign"
                    : "ios-glass-sm text-muted-foreground"
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="对话标题（可选，默认取前 50 字）"
            className="mt-3 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs outline-none transition-colors focus:border-campaign"
          />
          <textarea
            value={rawContent}
            onChange={(e) => setRawContent(e.target.value)}
            placeholder="粘贴对话原文，或点击下方按钮上传文件..."
            className="mt-3 min-h-[120px] w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-xs outline-none transition-colors focus:border-campaign"
          />
          {/* 文件上传按钮 */}
          <div className="mt-2 flex items-center gap-2">
            <input
              ref={captureFileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleCaptureFileUpload}
              accept=".md,.markdown,.html,.htm,.txt,.csv,.json,.png,.jpg,.jpeg,.gif,.webp,.pdf"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => captureFileInputRef.current?.click()}
            >
              <UploadCloud className="h-3 w-3" /> 上传文件/图片
            </Button>
            <span className="text-[10px] text-muted-foreground">
              支持 MD / HTML / TXT / CSV / JSON / 图片 / PDF
            </span>
          </div>
          <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={useAI}
              onChange={(e) => setUseAI(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-border"
            />
            使用 AI 自动提取结论 / 待办 / 提示词 / 数据
            <span className="text-graveyard">（需先在 设置 页配置 AI_API_KEY）</span>
          </label>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowCapture(false)}>
              取消
            </Button>
            <Button onClick={handleCapture} disabled={capturing}>
              {capturing ? "提取中..." : "捕获"}
            </Button>
          </div>
        </Card>
      )}

      {loading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-0 overflow-hidden">
              <div className="flex cursor-pointer items-center justify-between p-4">
                <div className="flex items-center gap-3 min-w-0">
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-4 w-40" />
                </div>
                <Skeleton className="h-4 w-4" />
              </div>
            </Card>
          ))}
        </div>
      ) : conversations.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="暂无对话资产"
          description="粘贴 Kimi/Trae Solo/Claude/Codex/GPT 对话，或拖拽文件自动解析"
          action={
            <Button onClick={() => setShowCapture(true)}>
              <Plus className="h-3.5 w-3.5" /> 捕获第一条对话
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="搜索标题或内容..." className="max-w-xs" />
            <FilterSelect
              value={filterSource}
              onChange={setFilterSource}
              options={[
                { value: "all", label: "全部来源" },
                ...CONVERSATION_SOURCE_LIST.map((s) => ({ value: s.key, label: s.label })),
              ]}
            />
          </div>
          {paginated.map((c) => {
            const isExpanded = expandedId === c.id;
            return (
              <Card key={c.id} className="p-0 overflow-hidden" hover>
                <div
                  className="flex cursor-pointer items-center justify-between p-4"
                  onClick={() => setExpandedId(isExpanded ? null : c.id)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Badge color="campaign">
                      {CONVERSATION_SOURCE_LIST.find((s) => s.key === c.source)?.label || c.source}
                    </Badge>
                    <span className="truncate text-sm font-medium">{c.title}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 text-muted-foreground">
                    <span className="hidden text-[10px] sm:inline">{formatTime(c.createdAt)}</span>
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </div>
                {isExpanded && (
                  <div className="border-t border-border px-4 pb-4">
                    <div className="mt-3 rounded-xl bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">
                      {c.rawContent.slice(0, 500)}
                      {c.rawContent.length > 500 && "..."}
                    </div>
                    <ExtractSection icon={<Sparkles className="h-3 w-3" />} title="结论" items={c.conclusions} color="northstar" />
                    <ExtractSection icon={<Sparkles className="h-3 w-3" />} title="待办" items={c.todos} color="task" />
                    <ExtractSection icon={<Sparkles className="h-3 w-3" />} title="提示词" items={c.prompts} color="cognition" />
                    <ExtractSection icon={<Sparkles className="h-3 w-3" />} title="数据" items={c.data} color="campaign" />
                  </div>
                )}
              </Card>
            );
          })}
          {filtered.length === 0 && (
            <div className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-12 text-center text-sm text-muted-foreground">
              没有匹配的对话
            </div>
          )}
          <Pagination page={page} pageSize={pageSize} total={total} onPageChange={onPageChange} onPageSizeChange={onPageSizeChange} />
        </div>
      )}
    </div>
  );
}

function ExtractSection({
  icon,
  title,
  items,
  color,
}: {
  icon: React.ReactNode;
  title: string;
  items: string[];
  color: "northstar" | "campaign" | "task" | "cognition" | "graveyard";
}) {
  if (!items?.length) return null;
  const colorClasses = {
    northstar: "text-northstar",
    campaign: "text-campaign",
    task: "text-task",
    cognition: "text-cognition",
    graveyard: "text-graveyard",
  };
  return (
    <div className="mt-3">
      <div className={cn("mb-1.5 flex items-center gap-1 text-[11px] font-semibold", colorClasses[color])}>
        {icon}
        {title}
      </div>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li
            key={i}
            className="rounded-lg bg-muted/40 px-2.5 py-1.5 text-xs text-foreground/80"
          >
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatTime(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return "刚刚";
  if (hours < 24) return `${hours}小时前`;
  return `${Math.floor(hours / 24)}天前`;
}

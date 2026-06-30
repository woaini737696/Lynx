import { useState, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  MessageSquare,
  Plus,
  Sparkles,
  ChevronDown,
  ChevronUp,
  UploadCloud,
  Loader2,
  CheckCircle2,
  XCircle,
  HelpCircle,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn, formatRelativeTime } from "@/lib/utils";
import { cloudApi } from "@/lib/cloud-api";
import { toast } from "@/lib/toast";

// ============ 对话来源定义 ============
interface SourceMeta {
  label: string;
  kind: "chat" | "file";
}

const CONVERSATION_SOURCES: Record<string, SourceMeta> = {
  kimi: { label: "Kimi", kind: "chat" },
  "trae-solo": { label: "Trae Solo", kind: "chat" },
  claude: { label: "Claude", kind: "chat" },
  codex: { label: "Codex", kind: "chat" },
  gpt: { label: "GPT", kind: "chat" },
  "file-md": { label: "Markdown", kind: "file" },
  "file-html": { label: "HTML", kind: "file" },
  "file-txt": { label: "文本", kind: "file" },
  "file-csv": { label: "CSV", kind: "file" },
  "file-json": { label: "JSON", kind: "file" },
  "file-image": { label: "图片", kind: "file" },
  "file-pdf": { label: "PDF", kind: "file" },
};

type ConversationSource = keyof typeof CONVERSATION_SOURCES;

const SOURCE_LIST = Object.entries(CONVERSATION_SOURCES).map(([key, value]) => ({
  key: key as ConversationSource,
  ...value,
}));

// 手动捕获仅展示聊天来源
const CHAT_SOURCE_LIST = SOURCE_LIST.filter((s) => s.kind === "chat");

function getSourceLabel(source: string): string {
  return CONVERSATION_SOURCES?.[source]?.label || source;
}

// ============ 类型定义 ============
interface Conversation {
  id: string;
  source: string;
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

interface CaptureResponse {
  conversation?: Conversation;
  success?: boolean;
  pdfParseStatus?: string;
  error?: string;
}

interface ListResponse {
  success?: boolean;
  data?: Conversation[];
  conversations?: Conversation[];
  total?: number;
}

// ============ 文件读取工具 ============
function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const arrayBuffer = reader.result as ArrayBuffer;
        const bytes = new Uint8Array(arrayBuffer);
        let binary = "";
        const chunkSize = 0x8000; // 32KB 分块，避免 call stack 溢出
        for (let i = 0; i < bytes.length; i += chunkSize) {
          const chunk = bytes.subarray(i, i + chunkSize);
          binary += String.fromCharCode.apply(
            null,
            Array.from(chunk) as unknown as number[]
          );
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

type FileType = "text" | "image" | "pdf";

function getFileType(filename: string): FileType {
  const ext = filename.toLowerCase().split(".").pop() || "";
  if (["png", "jpg", "jpeg", "gif", "webp"].includes(ext)) return "image";
  if (ext === "pdf") return "pdf";
  return "text";
}

function fileTypeToSource(type: FileType): ConversationSource | null {
  switch (type) {
    case "image":
      return "file-image";
    case "pdf":
      return "file-pdf";
    default:
      return "file-md";
  }
}

// ============ 帮助内容（自包含，不依赖 help-content.ts）============
const ASSETS_HELP = {
  title: "对话资产使用说明",
  paragraphs: [
    "「对话资产」用于捕获 Kimi / Trae Solo / Claude / Codex / GPT 等对话内容，并自动提取结论、待办、提示词和数据。",
    "点击右上角「捕获对话」可粘贴对话原文，开启 AI 提取后会自动生成四类结构化资产。",
    "拖拽文件到上传区域可批量解析 MD / HTML / TXT / CSV / JSON / 图片 / PDF，PDF 会由后端自动解析。",
  ],
  tips: [
    "AI 提取需先在设置页配置 AI_API_KEY",
    "点击卡片可展开查看对话原文与提取的四类资产",
    "支持按来源筛选和关键词搜索历史对话",
  ],
};

// ============ 主组件 ============
export function AssetsPage() {
  const queryClient = useQueryClient();
  const [showCapture, setShowCapture] = useState(false);
  const [source, setSource] = useState<ConversationSource>("kimi");
  const [title, setTitle] = useState("");
  const [rawContent, setRawContent] = useState("");
  const [useAI, setUseAI] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterSource, setFilterSource] = useState<string>("all");
  const [helpOpen, setHelpOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const captureFileInputRef = useRef<HTMLInputElement>(null);

  // 加载对话列表
  const { data: conversations = [], isLoading } = useQuery<Conversation[]>({
    queryKey: ["conversations"],
    queryFn: async () => {
      const res = await cloudApi.get<ListResponse>("/api/conversations");
      // 防御性处理：API 返回 { data: [...] }，同时兼容 { conversations: [...] }
      if (Array.isArray(res?.data)) return res.data;
      if (Array.isArray(res?.conversations)) return res.conversations;
      return [];
    },
  });

  // 捕获对话
  const captureMutation = useMutation({
    mutationFn: async (payload: {
      source: string;
      title: string;
      rawContent: string;
      useAI: boolean;
    }) => {
      return cloudApi.post<CaptureResponse>("/api/conversations", payload);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      setShowCapture(false);
      setTitle("");
      setRawContent("");
      const conclusions = data?.conversation?.conclusions;
      const count = Array.isArray(conclusions) ? conclusions.length : 0;
      toast.success(count ? `已捕获并提取 ${count} 条结论` : "已捕获对话");
    },
    onError: (e: Error) => toast.error(e.message || "捕获失败"),
  });

  const handleCapture = () => {
    if (!rawContent.trim()) {
      toast.error("请粘贴对话内容或上传文件");
      return;
    }
    captureMutation.mutate({ source, title, rawContent, useAI });
  };

  // 捕获表单中上传文件：读取文件内容填入 rawContent
  const handleCaptureFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    for (const file of files) {
      try {
        const fileType = getFileType(file.name);
        if (fileType === "image") {
          const dataUrl = await readFileAsDataURL(file);
          setRawContent((prev) =>
            prev
              ? `${prev}\n\n[${file.name}]\n[图片资产缩略图]\n${dataUrl}`
              : `${file.name}\n[图片资产缩略图]\n${dataUrl}`
          );
        } else if (fileType === "pdf") {
          setRawContent((prev) =>
            prev
              ? `${prev}\n\n[${file.name}]\n[PDF 文件，请使用拖拽上传区域进行 AI 解析]`
              : `${file.name}\n[PDF 文件，请使用拖拽上传区域进行 AI 解析]`
          );
        } else {
          const text = await readFileAsText(file);
          setRawContent((prev) =>
            prev
              ? `${prev}\n\n=== ${file.name} ===\n${text}`
              : `=== ${file.name} ===\n${text}`
          );
        }
        toast.info(`已加载文件: ${file.name}`);
      } catch {
        toast.error(`读取文件失败: ${file.name}`);
      }
    }
    if (captureFileInputRef.current) captureFileInputRef.current.value = "";
  };

  // 处理单个文件：读取 -> 上传
  const processFile = async (file: File) => {
    const fileType = getFileType(file.name);
    const fileSource = fileTypeToSource(fileType);

    if (!fileSource) {
      toast.error(`不支持的文件格式: ${file.name}`);
      return;
    }

    const fileId = `${file.name}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}`;
    setUploads((prev) => [
      ...prev,
      { id: fileId, filename: file.name, status: "reading" },
    ]);

    try {
      let content = "";
      const fileTitle = file.name;
      let pdfFileData: string | undefined;
      let isPdf = false;

      if (fileType === "image") {
        const dataUrl = await readFileAsDataURL(file);
        content = `${file.name}\n[图片资产缩略图]\n${dataUrl}`;
      } else if (fileType === "pdf") {
        isPdf = true;
        pdfFileData = await readFileAsBase64(file);
        content = file.name;
      } else {
        const text = await readFileAsText(file);
        content = text;
      }

      if (!content.trim() && !pdfFileData) {
        setUploads((prev) =>
          prev.map((u) =>
            u.id === fileId ? { ...u, status: "error", error: "文件内容为空" } : u
          )
        );
        return;
      }

      // PDF 进入 AI 提取阶段
      setUploads((prev) =>
        prev.map((u) =>
          u.id === fileId
            ? { ...u, status: isPdf ? "ai-extracting" : "uploading" }
            : u
        )
      );

      const res = await cloudApi.post<CaptureResponse>("/api/conversations", {
        source: fileSource,
        title: fileTitle,
        rawContent: content,
        useAI: true,
        fileData: pdfFileData,
        filename: file.name,
      });

      if (res?.conversation) {
        queryClient.invalidateQueries({ queryKey: ["conversations"] });
        setUploads((prev) =>
          prev.map((u) => (u.id === fileId ? { ...u, status: "done" } : u))
        );
        // PDF 解析状态提示
        if (isPdf && res.pdfParseStatus) {
          const statusMsg: Record<string, string> = {
            local: "PDF 本地解析完成",
            "ai-fallback": "PDF 本地解析失败，已用 AI 视觉降级",
            failed: "PDF 解析失败",
            skipped: "PDF 仅记录文件名（未提供文件数据）",
          };
          const msg = statusMsg[res.pdfParseStatus] || "PDF 处理完成";
          toast[res.pdfParseStatus === "failed" ? "error" : "info"](msg);
        }
        // 3 秒后自动清除已完成项
        setTimeout(() => {
          setUploads((prev) => prev.filter((u) => u.id !== fileId));
        }, 3000);
      } else {
        setUploads((prev) =>
          prev.map((u) =>
            u.id === fileId
              ? { ...u, status: "error", error: res?.error || "上传失败" }
              : u
          )
        );
      }
    } catch (err) {
      setUploads((prev) =>
        prev.map((u) =>
          u.id === fileId
            ? {
                ...u,
                status: "error",
                error: err instanceof Error ? err.message : "读取失败",
              }
            : u
        )
      );
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;
    toast.info(`正在处理 ${files.length} 个文件...`);
    await Promise.all(files.map(processFile));
  };

  const handleFileSelect = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    toast.info(`正在处理 ${files.length} 个文件...`);
    await Promise.all(files.map(processFile));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const clearUploads = () => setUploads([]);

  // 过滤
  const filtered = useMemo(() => {
    const list = Array.isArray(conversations) ? conversations : [];
    return list.filter((c) => {
      if (!c) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const title = (c.title || "").toLowerCase();
        const raw = (c.rawContent || "").toLowerCase();
        if (!title.includes(q) && !raw.includes(q)) return false;
      }
      if (filterSource !== "all" && c.source !== filterSource) return false;
      return true;
    });
  }, [conversations, searchQuery, filterSource]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-4">
      {/* 页头 */}
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            对话资产
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            捕获 Kimi / Trae Solo / Claude / Codex / GPT 对话，或拖拽文件自动解析
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setHelpOpen(true)}
            title="使用说明"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground"
          >
            <HelpCircle className="h-[18px] w-[18px]" />
          </button>
          <button
            onClick={() => setShowCapture(true)}
            className="btn-primary-glass flex h-8 items-center gap-1.5 px-3 text-xs"
          >
            <Plus className="h-3.5 w-3.5" /> 捕获对话
          </button>
        </div>
      </div>

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
          "ios-glass mb-6 cursor-pointer p-8 text-center transition-all",
          dragOver && "ring-2 ring-campaign/50"
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
          支持 MD / HTML / TXT / CSV / JSON / 图片 / PDF，可多文件批量上传
        </p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileSelect}
          accept=".md,.markdown,.html,.htm,.txt,.csv,.json,.png,.jpg,.jpeg,.gif,.webp,.pdf"
        />
      </div>

      {/* 上传进度列表 */}
      {uploads.length > 0 && (
        <div className="mb-6 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              上传进度
            </span>
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
              className="ios-glass flex items-center gap-2 px-3 py-2 text-xs"
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

      {/* 捕获表单 */}
      <AnimatePresence>
        {showCapture && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-6 overflow-hidden"
          >
            <div className="ios-glass p-4">
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
                <MessageSquare className="h-4 w-4 text-campaign" />
                捕获新对话
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                {CHAT_SOURCE_LIST.map((s) => (
                  <button
                    key={s.key}
                    onClick={() => setSource(s.key)}
                    className={cn(
                      "rounded-xl border px-3 py-2 text-xs transition-all",
                      source === s.key
                        ? "border-campaign bg-campaign/10 text-campaign"
                        : "border-border/60 text-muted-foreground hover:bg-muted/40"
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
                className="mt-3 h-9 w-full rounded-xl border border-border/60 bg-background/40 px-3 text-xs outline-none transition-colors focus:border-campaign"
              />
              <textarea
                value={rawContent}
                onChange={(e) => setRawContent(e.target.value)}
                placeholder="粘贴对话原文，或点击下方按钮上传文件..."
                className="mt-3 min-h-[120px] w-full resize-none rounded-xl border border-border/60 bg-background/40 px-3 py-2 text-xs outline-none transition-colors focus:border-campaign"
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
                <button
                  onClick={() => captureFileInputRef.current?.click()}
                  className="btn-glass flex h-8 items-center gap-1 px-3 text-xs"
                >
                  <UploadCloud className="h-3 w-3" /> 上传文件/图片
                </button>
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
                <span className="text-graveyard">
                  （需先在设置页配置 AI_API_KEY）
                </span>
              </label>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  onClick={() => setShowCapture(false)}
                  className="btn-glass rounded-lg px-3 py-1.5 text-xs"
                >
                  取消
                </button>
                <button
                  onClick={handleCapture}
                  disabled={captureMutation.isPending}
                  className="btn-primary-glass flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs disabled:opacity-50"
                >
                  {captureMutation.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : null}
                  {captureMutation.isPending ? "提取中..." : "捕获"}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 主体内容 */}
      {isLoading ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-sm">加载对话资产...</p>
        </div>
      ) : conversations.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3 text-muted-foreground">
          <MessageSquare className="h-12 w-12 opacity-40" />
          <div className="text-center">
            <p className="text-sm font-medium">暂无对话资产</p>
            <p className="mt-1 text-xs">
              粘贴 Kimi / Trae Solo / Claude / Codex / GPT 对话，或拖拽文件自动解析
            </p>
          </div>
          <button
            onClick={() => setShowCapture(true)}
            className="btn-primary-glass mt-2 flex h-8 items-center gap-1.5 px-3 text-xs"
          >
            <Plus className="h-3.5 w-3.5" /> 捕获第一条对话
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {/* 工具栏 */}
          <div className="glass-card flex items-center gap-2 px-3 py-2">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索标题或内容..."
              className="h-7 w-40 rounded-md bg-transparent px-2 text-xs outline-none placeholder:text-muted-foreground"
            />
            <select
              value={filterSource}
              onChange={(e) => setFilterSource(e.target.value)}
              className="h-7 rounded-md bg-transparent px-2 text-xs outline-none"
            >
              <option value="all">全部来源</option>
              {SOURCE_LIST.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
            <span className="ml-auto text-xs text-muted-foreground">
              {filtered.length} 条对话
            </span>
          </div>

          {/* 对话列表 */}
          <AnimatePresence mode="popLayout">
            {filtered.map((c) => {
              const isExpanded = expandedId === c.id;
              return (
                <motion.div
                  key={c.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ duration: 0.18 }}
                  className="ios-glass overflow-hidden p-0 transition-all hover:-translate-y-0.5"
                >
                  <div
                    className="flex cursor-pointer items-center justify-between p-4"
                    onClick={() => setExpandedId(isExpanded ? null : c.id)}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="shrink-0 rounded-full bg-campaign/10 px-2 py-0.5 text-[10px] font-medium text-campaign">
                        {getSourceLabel(c.source)}
                      </span>
                      <span className="truncate text-sm font-medium">
                        {c.title}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 text-muted-foreground">
                      <span className="hidden text-[10px] sm:inline">
                        {formatRelativeTime(c.createdAt)}
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="border-t border-border/60 px-4 pb-4">
                      {c.rawContent && (
                        <div className="mt-3 rounded-xl bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">
                          {c.rawContent.slice(0, 500)}
                          {c.rawContent.length > 500 && "..."}
                        </div>
                      )}
                      <ExtractSection
                        icon={<Sparkles className="h-3 w-3" />}
                        title="结论"
                        items={c.conclusions}
                        color="northstar"
                      />
                      <ExtractSection
                        icon={<Sparkles className="h-3 w-3" />}
                        title="待办"
                        items={c.todos}
                        color="task"
                      />
                      <ExtractSection
                        icon={<Sparkles className="h-3 w-3" />}
                        title="提示词"
                        items={c.prompts}
                        color="cognition"
                      />
                      <ExtractSection
                        icon={<Sparkles className="h-3 w-3" />}
                        title="数据"
                        items={c.data}
                        color="campaign"
                      />
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>

          {filtered.length === 0 && (
            <div className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-12 text-center text-sm text-muted-foreground">
              没有匹配的对话
            </div>
          )}
        </div>
      )}

      {/* 帮助弹窗（自包含，沿用 HelpButton 视觉模式） */}
      <AnimatePresence>
        {helpOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-background/60 p-4 backdrop-blur-sm"
            onClick={() => setHelpOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 20 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              className="ios-glass w-full max-w-lg overflow-hidden p-0"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
                <h3 className="text-lg font-semibold text-foreground">
                  {ASSETS_HELP.title}
                </h3>
                <button
                  onClick={() => setHelpOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="max-h-[60vh] overflow-auto p-5">
                <div className="space-y-3 text-sm leading-relaxed text-foreground/80">
                  {ASSETS_HELP.paragraphs.map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </div>
                <div className="mt-4 rounded-xl border border-border/50 bg-muted/30 p-4">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">
                    使用技巧
                  </p>
                  <ul className="space-y-1.5 text-sm text-foreground/80">
                    {ASSETS_HELP.tips.map((tip, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============ 提取结果分块 ============
function ExtractSection({
  icon,
  title,
  items,
  color,
}: {
  icon: React.ReactNode;
  title: string;
  items: string[] | undefined;
  color: "northstar" | "campaign" | "task" | "cognition" | "graveyard";
}) {
  if (!Array.isArray(items) || items.length === 0) return null;
  const colorClasses = {
    northstar: "text-northstar",
    campaign: "text-campaign",
    task: "text-task",
    cognition: "text-cognition",
    graveyard: "text-graveyard",
  };
  return (
    <div className="mt-3">
      <div
        className={cn(
          "mb-1.5 flex items-center gap-1 text-[11px] font-semibold",
          colorClasses[color]
        )}
      >
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

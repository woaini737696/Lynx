"use client";

import { useState, useRef, useEffect, Fragment } from "react";
import {
  Bot,
  Send,
  Brain,
  BookOpen,
  Target,
  Zap,
  AlertCircle,
  Mic,
  Square,
  Volume2,
  Loader2,
  Copy,
  Check,
  Trash2,
  FileText,
  ListChecks,
  MessageSquare,
  Image as ImageIcon,
  X,
} from "lucide-react";
import { Button } from "@/components/layout/PageHeader";
import { ModelSwitcher, type ModelSwitcherValue } from "@/components/ui/ModelSwitcher";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { LLMProvider } from "@/lib/ai-provider";

// ============ 类型定义 ============

interface TokenUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  time: string;
  /** 该条回复使用的 provider（仅 assistant 消息） */
  provider?: LLMProvider;
  /** 该条回复使用的模型名（仅 assistant 消息） */
  model?: string;
  /** 是否为错误消息 */
  error?: boolean;
  /** token 使用量（仅 assistant 消息） */
  usage?: TokenUsage;
  /** 是否正在流式输出中 */
  streaming?: boolean;
  /** 用户消息附带的图片（base64 data URL 列表） */
  images?: string[];
}

// ============ 常量 ============

const SYSTEM_PROMPT =
  "你是 LynnHub 的 AI 专属助理，专注于帮助用户管理灵感、分析任务、整理认知。回答简洁友好，必要时主动提问引导思考。支持 Markdown 格式输出。";

const WELCOME_MESSAGE: Message = {
  id: "m1",
  role: "assistant",
  content:
    "你好！我是你的 AI 专属助理。我可以帮你管理灵感、分析任务、整理认知，也可以直接对话讨论问题。有什么我能帮你的？",
  time: "刚刚",
};

// 快捷指令（输入框上方）
const QUICK_COMMANDS = [
  { icon: ListChecks, text: "总结今日", prompt: "帮我总结一下今天的工作进展和待办事项", color: "text-northstar" },
  { icon: Brain, text: "分析灵感", prompt: "帮我分析最近的灵感趋势，找出有价值的方向", color: "text-cognition" },
  { icon: FileText, text: "生成报告", prompt: "请根据近期数据生成一份工作复盘报告", color: "text-campaign" },
  { icon: MessageSquare, text: "对话蒸馏", prompt: "帮我从最近的对话中提取关键结论和待办", color: "text-task" },
];

// 建议提示（首次进入）
const SUGGESTIONS = [
  { icon: Target, text: "今天有哪些任务需要聚焦？", color: "text-northstar" },
  { icon: Brain, text: "帮我分析最近的灵感趋势", color: "text-cognition" },
  { icon: BookOpen, text: "从认知库中找一条方法论", color: "text-cognition" },
  { icon: Zap, text: "快速捕获一条灵感", color: "text-northstar" },
];

// ============ 简易 Markdown 渲染 ============

/**
 * 将 Markdown 文本渲染为 React 节点
 * 支持：代码块、行内代码、加粗、斜体、标题、无序/有序列表、链接、引用
 */
function renderMarkdown(text: string): React.ReactNode {
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
    // 普通文本块：按行渲染
    return <Fragment key={i}>{renderInlineBlock(block.content)}</Fragment>;
  });
}

/** 将 Markdown 拆分为代码块和文本块 */
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

/** 渲染文本块：逐行处理标题、列表、引用、加粗、行内代码、链接 */
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
    // 空行
    if (!trimmed) {
      flushList(`fl-${idx}`);
      return;
    }
    // 标题
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
    // 引用
    if (trimmed.startsWith("> ")) {
      flushList(`fl-${idx}`);
      nodes.push(
        <blockquote key={`bq-${idx}`} className="my-1.5 border-l-2 border-cognition/40 bg-cognition/5 py-1 pl-3 text-sm italic text-muted-foreground">
          {renderInline(trimmed.slice(2))}
        </blockquote>
      );
      return;
    }
    // 有序列表
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
    // 无序列表
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
    // 普通段落
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

/** 渲染行内元素：加粗、斜体、行内代码、链接 */
function renderInline(text: string): React.ReactNode {
  // 按 `code`、**bold**、*italic*、[link](url) 顺序处理
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
      parts.push(
        <strong key={key++} className="font-semibold text-foreground">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith("*")) {
      parts.push(
        <em key={key++} className="italic">
          {token.slice(1, -1)}
        </em>
      );
    } else if (token.startsWith("[")) {
      const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        parts.push(
          <a
            key={key++}
            href={linkMatch[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-cognition underline hover:opacity-80"
          >
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

// ============ 主组件 ============

export default function AIAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  // 模型选择：Provider + 模型变体 + 推理模式
  const [modelConfig, setModelConfig] = useState<ModelSwitcherValue>({
    provider: "deepseek",
    model: "deepseek-chat",
    reasoningMode: "standard",
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  // 用于中断流式请求的 AbortController
  const abortRef = useRef<AbortController | null>(null);

  // 录音相关状态
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // 语音播报相关状态
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [ttsLoadingId, setTtsLoadingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // 复制状态
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // 确认清空对话
  const [confirmClear, setConfirmClear] = useState(false);

  // 图片附件（base64 data URL 列表）
  const [attachedImages, setAttachedImages] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 模型目录（用于判断多模态能力）
  const [modelCatalog, setModelCatalog] = useState<{
    providers: Array<{
      id: LLMProvider;
      models: Array<{ id: string; multimodal?: boolean }>;
    }>;
  } | null>(null);

  // 拉取模型目录
  useEffect(() => {
    fetch("/api/ai/models")
      .then((r) => r.json())
      .then((data: { catalog?: typeof modelCatalog }) => {
        if (data.catalog) setModelCatalog(data.catalog);
      })
      .catch(() => {});
  }, []);

  // 当前模型是否支持多模态
  const isMultimodal = (() => {
    if (!modelCatalog) return false;
    const provider = modelCatalog.providers.find((p) => p.id === modelConfig.provider);
    if (!provider) return false;
    const model = provider.models.find((m) => m.id === modelConfig.model);
    return Boolean(model?.multimodal);
  })();

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  // 组件卸载时清理音频资源 + 中断流式请求
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      abortRef.current?.abort();
    };
  }, []);

  // ============ 流式发送 ============

  // 处理图片上传
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const maxImages = 4;
    const remaining = maxImages - attachedImages.length;
    if (remaining <= 0) {
      toast(`最多上传 ${maxImages} 张图片`, "error");
      return;
    }
    const toProcess = Array.from(files).slice(0, remaining);
    for (const file of toProcess) {
      if (!file.type.startsWith("image/")) {
        toast("仅支持图片文件", "error");
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast("图片大小不能超过 10MB", "error");
        continue;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        if (typeof result === "string") {
          setAttachedImages((prev) => [...prev, result]);
        }
      };
      reader.onerror = () => toast("图片读取失败", "error");
      reader.readAsDataURL(file);
    }
    // 清空 input 以便重复选择同一文件
    e.target.value = "";
  };

  const removeImage = (index: number) => {
    setAttachedImages((prev) => prev.filter((_, i) => i !== index));
  };

  const send = async (text?: string) => {
    const content = (text || input).trim();
    if ((!content && attachedImages.length === 0) || thinking) return;

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: "user",
      content,
      time: "刚刚",
      images: attachedImages.length > 0 ? attachedImages : undefined,
    };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");
    setAttachedImages([]);
    setThinking(true);

    // 创建 AI 占位消息（流式追加内容）
    const aiMsgId = `a-${Date.now()}`;
    const aiPlaceholder: Message = {
      id: aiMsgId,
      role: "assistant",
      content: "",
      time: "刚刚",
      streaming: true,
    };
    setMessages((prev) => [...prev, aiPlaceholder]);

    // 中断上一次请求
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      // 构造发送给 API 的消息：system 提示词 + 历史对话（不含错误消息和占位消息）
      // 支持多模态：如果消息有图片，content 为数组格式
      const apiMessages = [
        { role: "system" as const, content: SYSTEM_PROMPT },
        ...nextMessages
          .filter((m) => !m.error)
          .map((m) => {
            if (m.images && m.images.length > 0) {
              // 多模态消息：文本 + 图片
              const parts: Array<
                { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }
              > = [];
              if (m.content) {
                parts.push({ type: "text", text: m.content });
              }
              for (const img of m.images) {
                parts.push({ type: "image_url", image_url: { url: img } });
              }
              return { role: m.role, content: parts };
            }
            return { role: m.role, content: m.content };
          }),
      ];

      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: apiMessages,
          provider: modelConfig.provider,
          model: modelConfig.model,
          reasoningMode: modelConfig.reasoningMode,
          stream: true,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        // 非流式错误：尝试解析 JSON
        const data = await res.json().catch(() => null);
        const errMsg = data?.error || `请求失败（${res.status}）`;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiMsgId
              ? { ...m, content: errMsg, error: true, streaming: false }
              : m
          )
        );
        toast(errMsg, "error");
        return;
      }

      if (!res.body) {
        const errMsg = "服务器未返回流式数据";
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiMsgId
              ? { ...m, content: errMsg, error: true, streaming: false }
              : m
          )
        );
        toast(errMsg, "error");
        return;
      }

      // 读取 SSE 流
      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      let accumulated = "";
      let metaProvider: LLMProvider | undefined;
      let metaModel: string | undefined;
      let usage: TokenUsage | undefined;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // 按双换行分割 SSE 事件
        const events = buffer.split("\n\n");
        buffer = events.pop() || "";

        for (const evt of events) {
          const line = evt.trim();
          if (!line.startsWith("data:")) continue;
          const dataStr = line.slice(5).trim();
          if (!dataStr) continue;
          try {
            const evtData = JSON.parse(dataStr) as {
              type: "meta" | "delta" | "done" | "error";
              provider?: LLMProvider;
              model?: string;
              content?: string;
              message?: string;
              usage?: TokenUsage;
            };
            if (evtData.type === "meta") {
              metaProvider = evtData.provider;
              metaModel = evtData.model;
            } else if (evtData.type === "delta" && evtData.content) {
              accumulated += evtData.content;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === aiMsgId ? { ...m, content: accumulated } : m
                )
              );
            } else if (evtData.type === "done") {
              usage = evtData.usage;
            } else if (evtData.type === "error") {
              const errMsg = evtData.message || "流式响应错误";
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === aiMsgId
                    ? { ...m, content: accumulated || errMsg, error: !accumulated, streaming: false }
                    : m
                )
              );
              if (!accumulated) toast(errMsg, "error");
              return;
            }
          } catch {
            // 忽略解析错误
          }
        }
      }

      // 流结束：更新最终消息
      setMessages((prev) =>
        prev.map((m) =>
          m.id === aiMsgId
            ? {
                ...m,
                content: accumulated || "(空回复)",
                streaming: false,
                provider: metaProvider,
                model: metaModel,
                usage,
              }
            : m
        )
      );
    } catch (e) {
      const err = e as Error;
      if (err.name === "AbortError") {
        // 用户主动中断，保留已生成内容
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiMsgId ? { ...m, streaming: false } : m
          )
        );
      } else {
        const msg = "网络错误：" + err.message;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiMsgId
              ? { ...m, content: msg, error: true, streaming: false }
              : m
          )
        );
        toast(msg, "error");
      }
    } finally {
      setThinking(false);
      abortRef.current = null;
    }
  };

  // 中断当前流式生成
  const stopGeneration = () => {
    abortRef.current?.abort();
  };

  // ============ 清空对话（确认后执行）============

  const clearConversation = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      setTimeout(() => setConfirmClear(false), 3000);
      return;
    }
    stopSpeaking();
    abortRef.current?.abort();
    setMessages([WELCOME_MESSAGE]);
    setConfirmClear(false);
    toast("已开启新对话", "info");
  };

  // ============ 复制消息 ============

  const copyMessage = async (msg: Message) => {
    try {
      await navigator.clipboard.writeText(msg.content);
      setCopiedId(msg.id);
      toast("已复制到剪贴板", "success");
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast("复制失败", "error");
    }
  };

  // ============ 语音输入（录音 → ASR → 填入输入框）============

  const startRecording = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        toast("当前环境不支持录音（需 HTTPS 或 localhost）", "error");
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        await transcribeAudio(blob);
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
    } catch (e) {
      toast("录音启动失败：" + (e as Error).message, "error");
    }
  };

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
    setRecording(false);
  };

  const transcribeAudio = async (blob: Blob) => {
    setTranscribing(true);
    try {
      const form = new FormData();
      form.append("file", blob, "audio.webm");
      const res = await fetch("/api/ai/asr", {
        method: "POST",
        body: form,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        const errMsg = data?.error || `语音识别失败（${res.status}）`;
        toast(errMsg, "error");
        return;
      }
      const text = (data as { text?: string }).text?.trim();
      if (text) {
        setInput((prev) => (prev ? `${prev} ${text}` : text));
        toast("语音识别完成", "info");
      } else {
        toast("未识别到内容", "info");
      }
    } catch (e) {
      toast("语音识别错误：" + (e as Error).message, "error");
    } finally {
      setTranscribing(false);
    }
  };

  // ============ 语音播报（TTS 播放 AI 回复）============

  const stopSpeaking = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setSpeakingId(null);
  };

  const speak = async (msg: Message) => {
    if (speakingId === msg.id) {
      stopSpeaking();
      return;
    }
    stopSpeaking();
    setTtsLoadingId(msg.id);
    try {
      const res = await fetch("/api/ai/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: msg.content }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const errMsg = data?.error || `语音合成失败（${res.status}）`;
        toast(errMsg, "error");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      setSpeakingId(msg.id);
      audio.onended = () => {
        URL.revokeObjectURL(url);
        audioRef.current = null;
        setSpeakingId(null);
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        audioRef.current = null;
        setSpeakingId(null);
        toast("音频播放失败", "error");
      };
      await audio.play().catch(() => {
        toast("音频播放被浏览器阻止", "error");
        URL.revokeObjectURL(url);
        audioRef.current = null;
        setSpeakingId(null);
      });
    } catch (e) {
      toast("语音合成错误：" + (e as Error).message, "error");
    } finally {
      setTtsLoadingId(null);
    }
  };

  // ============ 渲染 ============

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      {/* 顶部标题 */}
      <div className="border-b border-border px-4 py-3 sm:px-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-cognition to-purple-600 text-white shadow-sm">
              <Bot className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-sm font-semibold">AI 专属助理</h1>
              <p className="text-[10px] text-muted-foreground">基于你的记忆图谱和认知库提供个性化协助</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ModelSwitcher value={modelConfig} onChange={setModelConfig} />
            <Button
              size="sm"
              variant={confirmClear ? "danger" : "ghost"}
              onClick={clearConversation}
              title="清空对话"
            >
              {confirmClear ? (
                <>
                  <Check className="h-3 w-3" /> 确认清空
                </>
              ) : (
                <>
                  <Trash2 className="h-3 w-3" /> 清空
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* 消息区域 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 sm:px-8">
        <div className="mx-auto max-w-2xl space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex gap-3",
                msg.role === "user" && "flex-row-reverse"
              )}
            >
              {/* 头像 */}
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white shadow-sm",
                  msg.role === "assistant"
                    ? msg.error
                      ? "bg-gradient-to-br from-graveyard to-red-700"
                      : "bg-gradient-to-br from-cognition to-purple-600"
                    : "bg-gradient-to-br from-northstar to-orange-600"
                )}
              >
                {msg.role === "assistant" ? (
                  msg.error ? (
                    <AlertCircle className="h-4 w-4" />
                  ) : (
                    <Bot className="h-4 w-4" />
                  )
                ) : (
                  <span className="text-xs font-bold">L</span>
                )}
              </div>

              {/* 消息气泡 */}
              <div className="min-w-0 flex-1">
                <div
                  className={cn(
                    "group relative max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                    msg.role === "assistant"
                      ? msg.error
                        ? "border border-graveyard/30 bg-graveyard/5 text-graveyard"
                        : "bg-card border border-border"
                      : "bg-primary text-primary-foreground"
                  )}
                >
                  {/* 消息内容：AI 支持 Markdown，用户纯文本 */}
                  {msg.role === "assistant" && !msg.error ? (
                    <div className="space-y-0.5">
                      {msg.content ? renderMarkdown(msg.content) : null}
                      {/* 流式光标 */}
                      {msg.streaming && (
                        <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse bg-cognition align-middle" />
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {/* 用户消息中的图片 */}
                      {msg.images && msg.images.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {msg.images.map((img, i) => (
                            <img
                              key={i}
                              src={img}
                              alt={`图片 ${i + 1}`}
                              className="max-h-32 rounded-lg border border-primary-foreground/20 object-cover"
                            />
                          ))}
                        </div>
                      )}
                      {msg.content && (
                        <span className="whitespace-pre-wrap">{msg.content}</span>
                      )}
                    </div>
                  )}

                  {/* 复制按钮（hover 显示） */}
                  {!msg.streaming && msg.content && (
                    <button
                      type="button"
                      onClick={() => copyMessage(msg)}
                      title="复制消息"
                      className={cn(
                        "absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card shadow-sm transition-all opacity-0 group-hover:opacity-100",
                        msg.role === "user" && "bg-primary text-primary-foreground border-primary"
                      )}
                    >
                      {copiedId === msg.id ? (
                        <Check className="h-3 w-3" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </button>
                  )}
                </div>

                {/* 元信息：模型 + token + 语音播报 */}
                {msg.role === "assistant" && !msg.error && !msg.streaming && (msg.provider || msg.model || msg.usage) && (
                  <div className="mt-1 ml-1 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground/70">
                    {msg.provider && (
                      <span className="uppercase">{msg.provider}</span>
                    )}
                    {msg.model && <span>· {msg.model}</span>}
                    {msg.usage?.total_tokens != null && (
                      <span className="rounded bg-muted px-1 py-0.5">
                        {msg.usage.total_tokens} tokens
                        {msg.usage.prompt_tokens != null && msg.usage.completion_tokens != null && (
                          <span className="text-muted-foreground/50">
                            {" "}(↑{msg.usage.prompt_tokens} ↓{msg.usage.completion_tokens})
                          </span>
                        )}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => speak(msg)}
                      title={speakingId === msg.id ? "停止播报" : "语音播报"}
                      className="inline-flex items-center gap-1 rounded-md px-1 py-0.5 transition-colors hover:bg-muted hover:text-foreground"
                    >
                      {ttsLoadingId === msg.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Volume2 className={cn("h-3 w-3", speakingId === msg.id && "text-cognition")} />
                      )}
                      {speakingId === msg.id && <span>停止</span>}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* 打字指示器（思考中且 AI 消息尚无内容） */}
          {thinking && messages[messages.length - 1]?.streaming && messages[messages.length - 1]?.content === "" && (
            <div className="flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cognition to-purple-600 text-white shadow-sm">
                <Bot className="h-4 w-4" />
              </div>
              <div className="flex items-center gap-1 rounded-2xl border border-border bg-card px-4 py-3">
                <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.3s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.15s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60" />
              </div>
            </div>
          )}

          {/* 建议提示 */}
          {messages.length <= 1 && !thinking && (
            <div className="space-y-2 pt-4">
              <p className="text-center text-[11px] text-muted-foreground">试试这些问题</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((s, i) => {
                  const Icon = s.icon;
                  return (
                    <button
                      key={i}
                      onClick={() => send(s.text)}
                      className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-left text-xs transition-all hover:border-cognition/40 hover:bg-cognition/5"
                    >
                      <Icon className={cn("h-3.5 w-3.5 shrink-0", s.color)} />
                      <span className="text-foreground/80">{s.text}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 输入区域 */}
      <div className="border-t border-border px-4 py-3 sm:px-8">
        <div className="mx-auto max-w-2xl">
          {/* 快捷指令 */}
          {!thinking && (
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              {QUICK_COMMANDS.map((cmd, i) => {
                const Icon = cmd.icon;
                return (
                  <button
                    key={i}
                    onClick={() => send(cmd.prompt)}
                    className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] transition-all hover:border-cognition/40 hover:bg-cognition/5"
                  >
                    <Icon className={cn("h-3 w-3", cmd.color)} />
                    <span>{cmd.text}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* 图片预览区 */}
          {attachedImages.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {attachedImages.map((img, i) => (
                <div key={i} className="relative">
                  <img
                    src={img}
                    alt={`附件 ${i + 1}`}
                    className="h-16 w-16 rounded-lg border border-border object-cover"
                  />
                  <button
                    onClick={() => removeImage(i)}
                    className="absolute -right-1 -top-1 rounded-full bg-destructive p-0.5 text-destructive-foreground shadow-sm"
                    title="移除图片"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* 隐藏的文件输入 */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageUpload}
            className="hidden"
          />

          <div className="flex items-center gap-2">
            {/* 语音输入按钮 */}
            <Button
              variant={recording ? "danger" : "outline"}
              size="md"
              onClick={recording ? stopRecording : startRecording}
              disabled={thinking || transcribing}
              title={recording ? "停止录音" : "语音输入"}
            >
              {recording ? (
                <Square className="h-3.5 w-3.5" />
              ) : transcribing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Mic className="h-3.5 w-3.5" />
              )}
            </Button>
            {/* 图片上传按钮（仅多模态模型显示） */}
            {isMultimodal && (
              <Button
                variant="outline"
                size="md"
                onClick={() => fileInputRef.current?.click()}
                disabled={thinking || attachedImages.length >= 4}
                title="上传图片"
              >
                <ImageIcon className="h-3.5 w-3.5" />
              </Button>
            )}
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder={
                recording
                  ? "录音中..."
                  : transcribing
                  ? "识别中..."
                  : isMultimodal
                  ? "输入消息或上传图片，Enter 发送..."
                  : "输入消息，Enter 发送..."
              }
              className="flex-1 rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none transition-colors focus:border-cognition"
            />
            {/* 发送 / 停止生成 */}
            {thinking ? (
              <Button variant="danger" onClick={stopGeneration} title="停止生成">
                <Square className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button
                onClick={() => send()}
                disabled={!input.trim() && attachedImages.length === 0}
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
          <p className="mt-2 text-center text-[10px] text-muted-foreground/60">
            {modelConfig.provider === "deepseek" ? "DeepSeek" : "小米 MiMo"} · {modelConfig.model} · {modelConfig.reasoningMode === "fast" ? "快速" : modelConfig.reasoningMode === "deep" ? "深度推理" : "标准"}模式
            {isMultimodal && " · 多模态"}
            {recording && " · 录音中"}
            {transcribing && " · 语音识别中"}
            {thinking && " · 生成中..."}
          </p>
        </div>
      </div>
    </div>
  );
}

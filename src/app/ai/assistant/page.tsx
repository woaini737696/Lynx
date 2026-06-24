"use client";

import { useState, useRef, useEffect, Fragment, useCallback } from "react";
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
  Settings,
  UserCircle,
  Mic2,
  Phone,
  PhoneOff,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/layout/PageHeader";
import { ModelSwitcher, type ModelSwitcherValue } from "@/components/ui/ModelSwitcher";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { LLMProvider } from "@/lib/ai-provider";

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
  provider?: LLMProvider;
  model?: string;
  error?: boolean;
  usage?: TokenUsage;
  streaming?: boolean;
  images?: string[];
}

interface AISettings {
  assistantName: string;
  clonedVoiceId: string | null;
  clonedVoiceName: string | null;
  clonedAt: string | null;
  defaultVoice: string;
  autoSpeak: boolean;
  voiceMode: boolean;
  feishuNotify: boolean;
}

const DEFAULT_SETTINGS: AISettings = {
  assistantName: "Lynn",
  clonedVoiceId: null,
  clonedVoiceName: null,
  clonedAt: null,
  defaultVoice: "mimo_default",
  autoSpeak: false,
  voiceMode: false,
  feishuNotify: false,
};

const QUICK_COMMANDS = [
  { icon: ListChecks, text: "总结今日", prompt: "帮我总结一下今天的工作进展和待办事项", color: "text-northstar" },
  { icon: Brain, text: "分析灵感", prompt: "帮我分析最近的灵感趋势，找出有价值的方向", color: "text-cognition" },
  { icon: FileText, text: "生成报告", prompt: "请根据近期数据生成一份工作复盘报告", color: "text-campaign" },
  { icon: MessageSquare, text: "对话蒸馏", prompt: "帮我从最近的对话中提取关键结论和待办", color: "text-task" },
];

const SUGGESTIONS = [
  { icon: Target, text: "今天有哪些任务需要聚焦？", color: "text-northstar" },
  { icon: Brain, text: "帮我分析最近的灵感趋势", color: "text-cognition" },
  { icon: BookOpen, text: "从认知库中找一条方法论", color: "text-cognition" },
  { icon: Zap, text: "快速捕获一条灵感", color: "text-northstar" },
];

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

export default function AIAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [modelConfig, setModelConfig] = useState<ModelSwitcherValue>({
    provider: "deepseek",
    model: "deepseek-chat",
    reasoningMode: "standard",
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [settings, setSettings] = useState<AISettings>(DEFAULT_SETTINGS);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const voiceModeActiveRef = useRef(false);

  const [voiceCallActive, setVoiceCallActive] = useState(false);
  const [voiceCallListening, setVoiceCallListening] = useState(false);
  const voiceCallStreamRef = useRef<MediaStream | null>(null);
  const voiceCallRecorderRef = useRef<MediaRecorder | null>(null);
  const voiceCallSilenceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isProcessingVoiceRef = useRef(false);

  // VAD（语音活动检测）相关 refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const vadIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const vadSpeechActiveRef = useRef(false); // 当前是否在说话
  const vadSpeechStartRef = useRef(0); // 说话开始时间
  const vadChunksRef = useRef<Blob[]>([]); // 当前语音段的音频块
  const vadRecorderRef = useRef<MediaRecorder | null>(null);

  // 流式 TTS 播放队列
  const ttsQueueRef = useRef<Array<{ url: string; text: string }>>([]);
  const ttsPlayingRef = useRef(false);
  const ttsAbortRef = useRef(false);

  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [ttsLoadingId, setTtsLoadingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const [attachedImages, setAttachedImages] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [cloneUploading, setCloneUploading] = useState(false);
  const [cloneTesting, setCloneTesting] = useState(false);
  const cloneFileRef = useRef<HTMLInputElement>(null);

  const [modelCatalog, setModelCatalog] = useState<{
    providers: Array<{ id: LLMProvider; models: Array<{ id: string; multimodal?: boolean }> }>;
  } | null>(null);

  useEffect(() => {
    fetch("/api/ai/models")
      .then((r) => r.json())
      .then((data: { catalog?: typeof modelCatalog }) => {
        if (data.catalog) setModelCatalog(data.catalog);
      })
      .catch(() => {});
    fetchSettings();
  }, []);

  useEffect(() => {
    setMessages([{
      id: "m1",
      role: "assistant",
      content: `你好！我是你的 AI 专属助理${settings.assistantName !== "Lynn" ? ` ${settings.assistantName}` : ""}。我可以帮你管理灵感、分析任务、整理认知，也可以直接对话讨论问题。有什么我能帮你的？`,
      time: "刚刚",
    }]);
  }, [settings.assistantName]);

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/ai/settings");
      const data = await res.json();
      if (data.settings) {
        setSettings({
          assistantName: data.settings.assistantName || "Lynn",
          clonedVoiceId: data.settings.clonedVoiceId || null,
          clonedVoiceName: data.settings.clonedVoiceName || null,
          clonedAt: data.settings.clonedAt || null,
          defaultVoice: data.settings.defaultVoice || "mimo_default",
          autoSpeak: data.settings.autoSpeak ?? false,
          voiceMode: data.settings.voiceMode ?? false,
          feishuNotify: data.settings.feishuNotify ?? false,
        });
      }
    } catch {}
  };

  const updateSettings = async (partial: Partial<AISettings>) => {
    try {
      const res = await fetch("/api/ai/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(partial),
      });
      const data = await res.json();
      if (data.settings) {
        setSettings({
          assistantName: data.settings.assistantName || "Lynn",
          clonedVoiceId: data.settings.clonedVoiceId || null,
          clonedVoiceName: data.settings.clonedVoiceName || null,
          clonedAt: data.settings.clonedAt || null,
          defaultVoice: data.settings.defaultVoice || "mimo_default",
          autoSpeak: data.settings.autoSpeak ?? false,
          voiceMode: data.settings.voiceMode ?? false,
          feishuNotify: data.settings.feishuNotify ?? false,
        });
      }
    } catch (e) {
      toast("保存设置失败", "error");
    }
  };

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

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      stopVoiceCall();
      abortRef.current?.abort();
    };
  }, []);

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
    e.target.value = "";
  };

  const removeImage = (index: number) => {
    setAttachedImages((prev) => prev.filter((_, i) => i !== index));
  };

  const stopSpeaking = useCallback(() => {
    ttsAbortRef.current = true;
    ttsQueueRef.current = [];
    ttsPlayingRef.current = false;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setSpeakingId(null);
  }, []);

  /** 将文本按句子切分（用于流式 TTS，降低首包延迟） */
  const splitSentences = (text: string): string[] => {
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
  };

  /** 流式 TTS：按句子分块合成，队列播放，首包延迟 < 300ms */
  const speak = useCallback(async (text: string, msgId?: string) => {
    stopSpeaking();
    ttsAbortRef.current = false;
    const loadingId = msgId || `tts-${Date.now()}`;
    setTtsLoadingId(loadingId);
    if (msgId) setSpeakingId(msgId);

    const sentences = splitSentences(text);
    const queue: Array<{ url: string; text: string }> = [];

    // 并行合成前 2 句（降低首包延迟），后续顺序合成
    const synthesizeSentence = async (sentence: string): Promise<string | null> => {
      try {
        const res = await fetch("/api/ai/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: sentence }),
        });
        if (!res.ok) return null;
        const blob = await res.blob();
        return URL.createObjectURL(blob);
      } catch {
        return null;
      }
    };

    // 预合成前 2 句
    const firstBatch = sentences.slice(0, 2).map(s => synthesizeSentence(s));
    const firstUrls = await Promise.all(firstBatch);
    setTtsLoadingId(null);

    for (let i = 0; i < firstUrls.length; i++) {
      if (firstUrls[i]) {
        queue.push({ url: firstUrls[i]!, text: sentences[i] });
      }
    }

    if (queue.length === 0) {
      toast("语音合成失败", "error");
      setSpeakingId(null);
      return;
    }

    ttsQueueRef.current = queue;

    // 后续句子在后台继续合成
    const synthesizeRest = async () => {
      for (let i = 2; i < sentences.length; i++) {
        if (ttsAbortRef.current) return;
        const url = await synthesizeSentence(sentences[i]);
        if (url && !ttsAbortRef.current) {
          ttsQueueRef.current.push({ url, text: sentences[i] });
        }
      }
    };
    synthesizeRest();

    // 播放队列
    const playQueue = async () => {
      ttsPlayingRef.current = true;
      while (!ttsAbortRef.current) {
        const item = ttsQueueRef.current.shift();
        if (!item) {
          // 队列为空，等待一小段时间看是否有新内容
          if (ttsAbortRef.current) break;
          await new Promise(r => setTimeout(r, 100));
          continue;
        }
        const audio = new Audio(item.url);
        audioRef.current = audio;
        try {
          await audio.play();
          // 等待播放结束
          await new Promise<void>((resolve) => {
            audio.onended = () => { URL.revokeObjectURL(item.url); resolve(); };
            audio.onerror = () => { URL.revokeObjectURL(item.url); resolve(); };
          });
        } catch {
          URL.revokeObjectURL(item.url);
        }
        audioRef.current = null;
      }
      ttsPlayingRef.current = false;
      setSpeakingId(null);
    };
    playQueue();
  }, [stopSpeaking]);

  const send = async (text?: string) => {
    const content = (text || input).trim();
    if ((!content && attachedImages.length === 0) || thinking) return;

    stopSpeaking();

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

    const aiMsgId = `a-${Date.now()}`;
    const aiPlaceholder: Message = {
      id: aiMsgId,
      role: "assistant",
      content: "",
      time: "刚刚",
      streaming: true,
    };
    setMessages((prev) => [...prev, aiPlaceholder]);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const systemPrompt = `你是 ${settings.assistantName}，LynnHub 的 AI 专属助理，专注于帮助用户管理灵感、分析任务、整理认知。回答简洁友好，必要时主动提问引导思考。支持 Markdown 格式输出。`;

      const apiMessages = [
        { role: "system" as const, content: systemPrompt },
        ...nextMessages
          .filter((m) => !m.error)
          .map((m) => {
            if (m.images && m.images.length > 0) {
              const parts: Array<
                { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }
              > = [];
              if (m.content) parts.push({ type: "text", text: m.content });
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
        const data = await res.json().catch(() => null);
        const errMsg = data?.error || `请求失败（${res.status}）`;
        setMessages((prev) => prev.map((m) => m.id === aiMsgId ? { ...m, content: errMsg, error: true, streaming: false } : m));
        toast(errMsg, "error");
        return;
      }

      if (!res.body) {
        const errMsg = "服务器未返回流式数据";
        setMessages((prev) => prev.map((m) => m.id === aiMsgId ? { ...m, content: errMsg, error: true, streaming: false } : m));
        toast(errMsg, "error");
        return;
      }

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
              setMessages((prev) => prev.map((m) => m.id === aiMsgId ? { ...m, content: accumulated } : m));
            } else if (evtData.type === "done") {
              usage = evtData.usage;
            } else if (evtData.type === "error") {
              const errMsg = evtData.message || "流式响应错误";
              setMessages((prev) => prev.map((m) => m.id === aiMsgId ? { ...m, content: accumulated || errMsg, error: !accumulated, streaming: false } : m));
              if (!accumulated) toast(errMsg, "error");
              return;
            }
          } catch {}
        }
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === aiMsgId
            ? { ...m, content: accumulated || "(空回复)", streaming: false, provider: metaProvider, model: metaModel, usage }
            : m
        )
      );

      if ((settings.autoSpeak || settings.voiceMode) && accumulated) {
        setTimeout(() => speak(accumulated, aiMsgId), 300);
      }
    } catch (e) {
      const err = e as Error;
      if (err.name === "AbortError") {
        setMessages((prev) => prev.map((m) => m.id === aiMsgId ? { ...m, streaming: false } : m));
      } else {
        const msg = "网络错误：" + err.message;
        setMessages((prev) => prev.map((m) => m.id === aiMsgId ? { ...m, content: msg, error: true, streaming: false } : m));
        toast(msg, "error");
      }
    } finally {
      setThinking(false);
      abortRef.current = null;
    }
  };

  const stopGeneration = () => {
    abortRef.current?.abort();
  };

  const clearConversation = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      setTimeout(() => setConfirmClear(false), 3000);
      return;
    }
    stopSpeaking();
    abortRef.current?.abort();
    setMessages([{
      id: "m1",
      role: "assistant",
      content: `你好！我是你的 AI 专属助理${settings.assistantName !== "Lynn" ? ` ${settings.assistantName}` : ""}。有什么我能帮你的？`,
      time: "刚刚",
    }]);
    setConfirmClear(false);
    toast("已开启新对话", "info");
  };

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

  const transcribeAudio = async (blob: Blob): Promise<string | null> => {
    setTranscribing(true);
    try {
      const form = new FormData();
      form.append("file", blob, "audio.webm");
      const res = await fetch("/api/ai/asr", { method: "POST", body: form });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        toast(data?.error || `语音识别失败（${res.status}）`, "error");
        return null;
      }
      const text = (data as { text?: string }).text?.trim();
      return text || null;
    } catch (e) {
      toast("语音识别错误：" + (e as Error).message, "error");
      return null;
    } finally {
      setTranscribing(false);
    }
  };

  const startRecording = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        toast("当前环境不支持录音（需 HTTPS 或 localhost）", "error");
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        const text = await transcribeAudio(blob);
        if (text) {
          if (voiceModeActiveRef.current && voiceCallActive) {
            send(text);
          } else {
            setInput((prev) => (prev ? `${prev} ${text}` : text));
            toast("语音识别完成", "info");
          }
        }
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
    if (recorder && recorder.state !== "inactive") recorder.stop();
    setRecording(false);
  };

  const startVoiceCall = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        toast("当前环境不支持语音对话", "error");
        return;
      }
      stopSpeaking();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      voiceCallStreamRef.current = stream;
      voiceModeActiveRef.current = true;
      setVoiceCallActive(true);
      setVoiceCallListening(true);
      isProcessingVoiceRef.current = false;
      toast("语音对话已开启（VAD 已启用），开始说话即可", "success");
      startVadRecording();
    } catch (e) {
      toast("无法访问麦克风：" + (e as Error).message, "error");
    }
  };

  /**
   * VAD（语音活动检测）录音：基于 Web Audio API AnalyserNode 实时分析音量，
   * 精准检测语音起止，实现"说完即识别"的低延迟体验。
   * - 音量高于阈值且持续 > 300ms → 语音开始
   * - 音量低于阈值且持续 > 800ms → 语音结束，立即发送识别
   */
  const startVadRecording = () => {
    const stream = voiceCallStreamRef.current;
    if (!stream || !voiceModeActiveRef.current) return;

    // 创建 AudioContext + AnalyserNode
    try {
      if (!audioContextRef.current || audioContextRef.current.state === "closed") {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.6;
      source.connect(analyser);
      analyserRef.current = analyser;
    } catch (e) {
      // AudioContext 创建失败，回退到旧方式
      console.warn("VAD 初始化失败，回退到定时录音:", e);
      startVoiceChunkRecordingLegacy();
      return;
    }

    // 重置 VAD 状态
    vadSpeechActiveRef.current = false;
    vadSpeechStartRef.current = 0;
    vadChunksRef.current = [];

    // 创建 MediaRecorder，使用 timeslice 获取周期性数据块
    try {
      const recorder = new MediaRecorder(stream);
      vadRecorderRef.current = recorder;
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0 && vadSpeechActiveRef.current) {
          vadChunksRef.current.push(e.data);
        }
      };
      recorder.start(200); // 每 200ms 产生一个数据块
    } catch {
      startVoiceChunkRecordingLegacy();
      return;
    }

    // VAD 参数
    const VOLUME_THRESHOLD = 18; // 音量阈值（dB，经验值）
    const SPEECH_START_MS = 300; // 音量超阈值持续 300ms 判定为语音开始
    const SPEECH_END_MS = 800; // 音量低于阈值持续 800ms 判定为语音结束
    const MAX_SPEECH_MS = 30000; // 单次最长 30 秒

    let highVolumeStart = 0;
    let lowVolumeStart = 0;
    const buffer = new Uint8Array(analyserRef.current!.frequencyBinCount);

    vadIntervalRef.current = setInterval(() => {
      if (!voiceModeActiveRef.current || isProcessingVoiceRef.current) return;
      if (!analyserRef.current) return;

      analyserRef.current.getByteFrequencyData(buffer);
      // 计算平均音量（RMS 近似）
      let sum = 0;
      for (let i = 0; i < buffer.length; i++) sum += buffer[i] * buffer[i];
      const rms = Math.sqrt(sum / buffer.length);
      const volume = rms > 0 ? 20 * Math.log10(rms) : -100;

      const now = Date.now();

      if (volume > VOLUME_THRESHOLD) {
        highVolumeStart = highVolumeStart || now;
        lowVolumeStart = 0;

        // 语音开始检测
        if (!vadSpeechActiveRef.current && now - highVolumeStart > SPEECH_START_MS) {
          vadSpeechActiveRef.current = true;
          vadSpeechStartRef.current = now;
          vadChunksRef.current = [];
          setVoiceCallListening(false);
        }
      } else {
        lowVolumeStart = lowVolumeStart || now;
        highVolumeStart = 0;

        // 语音结束检测
        if (vadSpeechActiveRef.current && now - lowVolumeStart > SPEECH_END_MS) {
          // 收集音频并发送识别
          const speechDuration = now - vadSpeechStartRef.current;
          vadSpeechActiveRef.current = false;

          const chunks = [...vadChunksRef.current];
          vadChunksRef.current = [];

          if (chunks.length > 0 && speechDuration > 400) {
            // 停止当前 recorder 并处理音频
            const recorder = vadRecorderRef.current;
            if (recorder && recorder.state !== "inactive") {
              recorder.onstop = async () => {
                const blob = new Blob(chunks, { type: "audio/webm" });
                if (blob.size > 2000 && voiceModeActiveRef.current) {
                  isProcessingVoiceRef.current = true;
                  const text = await transcribeAudio(blob);
                  if (text && voiceModeActiveRef.current) {
                    await send(text);
                  }
                  isProcessingVoiceRef.current = false;
                  if (voiceModeActiveRef.current) {
                    setVoiceCallListening(true);
                    // 重新启动 recorder
                    startVadRecording();
                  }
                } else if (voiceModeActiveRef.current) {
                  setVoiceCallListening(true);
                  startVadRecording();
                }
              };
              recorder.stop();
            }
          } else {
            setVoiceCallListening(true);
          }
        }
      }

      // 超时保护：单次语音超过 30 秒强制结束
      if (vadSpeechActiveRef.current && now - vadSpeechStartRef.current > MAX_SPEECH_MS) {
        vadSpeechActiveRef.current = false;
        const chunks = [...vadChunksRef.current];
        vadChunksRef.current = [];
        const recorder = vadRecorderRef.current;
        if (recorder && recorder.state !== "inactive") {
          recorder.onstop = async () => {
            const blob = new Blob(chunks, { type: "audio/webm" });
            if (blob.size > 2000 && voiceModeActiveRef.current) {
              isProcessingVoiceRef.current = true;
              const text = await transcribeAudio(blob);
              if (text && voiceModeActiveRef.current) await send(text);
              isProcessingVoiceRef.current = false;
              if (voiceModeActiveRef.current) {
                setVoiceCallListening(true);
                startVadRecording();
              }
            }
          };
          recorder.stop();
        }
      }
    }, 100);
  };

  /** 旧版定时录音（VAD 不可用时的回退方案） */
  const startVoiceChunkRecordingLegacy = () => {
    if (!voiceCallStreamRef.current || !voiceModeActiveRef.current) return;
    try {
      const recorder = new MediaRecorder(voiceCallStreamRef.current);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = async () => {
        if (chunks.length === 0 || isProcessingVoiceRef.current || !voiceModeActiveRef.current) {
          if (voiceModeActiveRef.current && !isProcessingVoiceRef.current) startVoiceChunkRecordingLegacy();
          return;
        }
        const blob = new Blob(chunks, { type: "audio/webm" });
        if (blob.size < 2000) {
          if (voiceModeActiveRef.current) startVoiceChunkRecordingLegacy();
          return;
        }
        isProcessingVoiceRef.current = true;
        setVoiceCallListening(false);
        const text = await transcribeAudio(blob);
        if (text && voiceModeActiveRef.current) {
          await send(text);
        }
        isProcessingVoiceRef.current = false;
        if (voiceModeActiveRef.current) {
          setVoiceCallListening(true);
          startVoiceChunkRecordingLegacy();
        }
      };
      recorder.start();
      voiceCallRecorderRef.current = recorder;
      if (voiceCallSilenceRef.current) clearTimeout(voiceCallSilenceRef.current);
      voiceCallSilenceRef.current = setTimeout(() => {
        if (recorder.state !== "inactive") recorder.stop();
      }, 3000);
    } catch {}
  };

  const stopVoiceCall = () => {
    voiceModeActiveRef.current = false;
    // 清理 VAD
    if (vadIntervalRef.current) {
      clearInterval(vadIntervalRef.current);
      vadIntervalRef.current = null;
    }
    if (vadRecorderRef.current && vadRecorderRef.current.state !== "inactive") {
      vadRecorderRef.current.stop();
    }
    vadRecorderRef.current = null;
    vadSpeechActiveRef.current = false;
    vadChunksRef.current = [];
    if (analyserRef.current) {
      analyserRef.current.disconnect();
      analyserRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    // 清理旧版定时器
    if (voiceCallSilenceRef.current) {
      clearTimeout(voiceCallSilenceRef.current);
      voiceCallSilenceRef.current = null;
    }
    if (voiceCallRecorderRef.current && voiceCallRecorderRef.current.state !== "inactive") {
      voiceCallRecorderRef.current.stop();
    }
    if (voiceCallStreamRef.current) {
      voiceCallStreamRef.current.getTracks().forEach((t) => t.stop());
      voiceCallStreamRef.current = null;
    }
    setVoiceCallActive(false);
    setVoiceCallListening(false);
    stopSpeaking();
  };

  const handleVoiceCloneUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast("音频文件不能超过 10MB（60秒以内）", "error");
      e.target.value = "";
      return;
    }
    setCloneUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("name", `${settings.assistantName}的音色`);
      const res = await fetch("/api/ai/voice-clone", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "音色复刻失败", "error");
      } else {
        toast(data.message || "音色复刻成功！", "success");
        await fetchSettings();
      }
    } catch (e) {
      toast("音色复刻错误：" + (e as Error).message, "error");
    } finally {
      setCloneUploading(false);
      e.target.value = "";
    }
  };

  const testClonedVoice = async () => {
    if (!settings.clonedVoiceId) return;
    setCloneTesting(true);
    await speak(`你好，我是${settings.assistantName}，这是我的复刻声音。`);
    setCloneTesting(false);
  };

  const deleteClonedVoice = async () => {
    try {
      await fetch("/api/ai/voice-clone", { method: "DELETE" });
      toast("已清除复刻音色", "info");
      await fetchSettings();
    } catch {
      toast("清除失败", "error");
    }
  };

  const sendFeishuTest = async () => {
    try {
      const res = await fetch("/api/ai/notify-feishu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: `这是来自${settings.assistantName}的测试通知，飞书紧急通知功能已正常开启。`, urgent: false }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "发送失败", "error");
      } else {
        toast("测试消息已发送到飞书", "success");
      }
    } catch (e) {
      toast("发送错误：" + (e as Error).message, "error");
    }
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      <div className="border-b border-border px-4 py-3 sm:px-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-cognition to-purple-600 text-white shadow-sm">
              <Bot className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-sm font-semibold">AI 专属助理 {settings.assistantName !== "Lynn" && <span className="text-cognition">· {settings.assistantName}</span>}</h1>
              <p className="text-[10px] text-muted-foreground">基于你的记忆图谱和认知库提供个性化协助</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setSettingsOpen(true)} title="设置">
              <Settings className="h-3.5 w-3.5" />
            </Button>
            <ModelSwitcher value={modelConfig} onChange={setModelConfig} />
            <Button
              size="sm"
              variant={confirmClear ? "danger" : "ghost"}
              onClick={clearConversation}
              title="清空对话"
            >
              {confirmClear ? <><Check className="h-3 w-3" /> 确认清空</> : <><Trash2 className="h-3 w-3" /> 清空</>}
            </Button>
          </div>
        </div>
      </div>

      {voiceCallActive && (
        <div className="border-b border-cognition/20 bg-cognition/5 px-4 py-2 sm:px-8">
          <div className="mx-auto flex max-w-2xl items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn("flex h-10 w-10 items-center justify-center rounded-full", voiceCallListening ? "bg-northstar animate-pulse" : "bg-muted")}>
                <Mic2 className={cn("h-5 w-5", voiceCallListening ? "text-white" : "text-muted-foreground")} />
              </div>
              <div>
                <p className="text-sm font-medium">语音对话中</p>
                <p className="text-[10px] text-muted-foreground">
                  {voiceCallListening ? "正在聆听..." : thinking ? "思考中..." : "AI回复中..."}
                </p>
              </div>
            </div>
            <Button variant="danger" size="sm" onClick={stopVoiceCall}>
              <PhoneOff className="h-4 w-4" /> 挂断
            </Button>
          </div>
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 sm:px-8">
        <div className="mx-auto max-w-2xl space-y-4">
          {messages.map((msg) => (
            <div key={msg.id} className={cn("flex gap-3", msg.role === "user" && "flex-row-reverse")}>
              <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white shadow-sm",
                msg.role === "assistant"
                  ? msg.error ? "bg-gradient-to-br from-graveyard to-red-700" : "bg-gradient-to-br from-cognition to-purple-600"
                  : "bg-gradient-to-br from-northstar to-orange-600"
              )}>
                {msg.role === "assistant"
                  ? msg.error ? <AlertCircle className="h-4 w-4" /> : <Bot className="h-4 w-4" />
                  : <UserCircle className="h-4 w-4" />}
              </div>

              <div className="min-w-0 flex-1">
                <div className={cn("group relative max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                  msg.role === "assistant"
                    ? msg.error ? "border border-graveyard/30 bg-graveyard/5 text-graveyard" : "bg-card border border-border"
                    : "bg-primary text-primary-foreground"
                )}>
                  {msg.role === "assistant" && !msg.error ? (
                    <div className="space-y-0.5">
                      {msg.content ? renderMarkdown(msg.content) : null}
                      {msg.streaming && <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse bg-cognition align-middle" />}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {msg.images && msg.images.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {msg.images.map((img, i) => (
                            <img key={i} src={img} alt={`图片 ${i + 1}`} className="max-h-32 rounded-lg border border-primary-foreground/20 object-cover" />
                          ))}
                        </div>
                      )}
                      {msg.content && <span className="whitespace-pre-wrap">{msg.content}</span>}
                    </div>
                  )}
                  {!msg.streaming && msg.content && (
                    <button
                      type="button"
                      onClick={() => copyMessage(msg)}
                      title="复制消息"
                      className={cn("absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card shadow-sm transition-all opacity-0 group-hover:opacity-100",
                        msg.role === "user" && "bg-primary text-primary-foreground border-primary"
                      )}
                    >
                      {copiedId === msg.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    </button>
                  )}
                </div>

                {msg.role === "assistant" && !msg.error && !msg.streaming && (msg.provider || msg.model || msg.usage) && (
                  <div className="mt-1 ml-1 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground/70">
                    {msg.provider && <span className="uppercase">{msg.provider}</span>}
                    {msg.model && <span>· {msg.model}</span>}
                    {msg.usage?.total_tokens != null && (
                      <span className="rounded bg-muted px-1 py-0.5">
                        {msg.usage.total_tokens} tokens
                        {msg.usage.prompt_tokens != null && msg.usage.completion_tokens != null && (
                          <span className="text-muted-foreground/50"> (↑{msg.usage.prompt_tokens} ↓{msg.usage.completion_tokens})</span>
                        )}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => { if (speakingId === msg.id) stopSpeaking(); else speak(msg.content, msg.id); }}
                      title={speakingId === msg.id ? "停止播报" : "语音播报"}
                      className="inline-flex items-center gap-1 rounded-md px-1 py-0.5 transition-colors hover:bg-muted hover:text-foreground"
                    >
                      {ttsLoadingId === msg.id ? <Loader2 className="h-3 w-3 animate-spin" />
                        : <Volume2 className={cn("h-3 w-3", speakingId === msg.id && "text-cognition")} />}
                      {speakingId === msg.id && <span>停止</span>}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

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

      <div className="border-t border-border px-4 py-3 sm:px-8">
        <div className="mx-auto max-w-2xl">
          {!thinking && !voiceCallActive && (
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

          {attachedImages.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {attachedImages.map((img, i) => (
                <div key={i} className="relative">
                  <img src={img} alt={`附件 ${i + 1}`} className="h-16 w-16 rounded-lg border border-border object-cover" />
                  <button onClick={() => removeImage(i)} className="absolute -right-1 -top-1 rounded-full bg-destructive p-0.5 text-destructive-foreground shadow-sm" title="移除图片">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" />

          {!voiceCallActive ? (
            <div className="flex items-center gap-2">
              <Button
                variant={recording ? "danger" : settings.voiceMode ? "primary" : "outline"}
                size="md"
                onClick={recording ? stopRecording : startRecording}
                disabled={thinking || transcribing}
                title={recording ? "停止录音" : settings.voiceMode ? "语音输入（语音模式已开启）" : "语音输入"}
              >
                {recording ? <Square className="h-3.5 w-3.5" />
                  : transcribing ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <Mic className="h-3.5 w-3.5" />}
              </Button>
              {settings.voiceMode && (
                <Button variant="primary" size="md" onClick={startVoiceCall} title="开启全双工语音对话">
                  <Phone className="h-3.5 w-3.5" />
                </Button>
              )}
              {isMultimodal && (
                <Button variant="outline" size="md" onClick={() => fileInputRef.current?.click()} disabled={thinking || attachedImages.length >= 4} title="上传图片">
                  <ImageIcon className="h-3.5 w-3.5" />
                </Button>
              )}
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder={
                  recording ? "录音中..." : transcribing ? "识别中..."
                    : isMultimodal ? "输入消息或上传图片，Enter 发送..." : "输入消息，Enter 发送..."
                }
                className="flex-1 rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none transition-colors focus:border-cognition"
              />
              {thinking ? (
                <Button variant="danger" onClick={stopGeneration} title="停止生成"><Square className="h-3.5 w-3.5" /></Button>
              ) : (
                <Button onClick={() => send()} disabled={!input.trim() && attachedImages.length === 0}>
                  <Send className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center py-4">
              <button
                onClick={recording ? stopRecording : startRecording}
                className={cn(
                  "flex h-16 w-16 items-center justify-center rounded-full shadow-lg transition-all",
                  recording ? "bg-destructive animate-pulse" : "bg-northstar hover:bg-northstar/90"
                )}
              >
                {recording ? <Square className="h-6 w-6 text-white" /> : <Mic className="h-6 w-6 text-white" />}
              </button>
            </div>
          )}
          <p className="mt-2 text-center text-[10px] text-muted-foreground/60">
            {modelConfig.provider === "deepseek" ? "DeepSeek" : "小米 MiMo"} · {modelConfig.model}
            {isMultimodal && " · 多模态"}
            {settings.autoSpeak && " · 自动播报"}
            {settings.voiceMode && " · 语音模式"}
            {recording && " · 录音中"}
            {transcribing && " · 语音识别中"}
            {thinking && " · 生成中..."}
          </p>
        </div>
      </div>

      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setSettingsOpen(false)}>
          <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">助理设置</h2>
              <button onClick={() => setSettingsOpen(false)} className="rounded-full p-1 hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-5">
              <div>
                <label className="mb-1.5 block text-xs font-medium">助理名称</label>
                <input
                  type="text"
                  value={settings.assistantName}
                  onChange={(e) => setSettings((s) => ({ ...s, assistantName: e.target.value }))}
                  onBlur={() => updateSettings({ assistantName: settings.assistantName })}
                  maxLength={20}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-cognition"
                  placeholder="给你的AI助理取个名字"
                />
              </div>

              <div className="space-y-3 rounded-xl border border-border p-4">
                <h3 className="text-sm font-medium">🔊 语音设置</h3>

                <div>
                  <p className="mb-2 text-xs text-muted-foreground">音色复刻：上传60秒内的说话录音，让AI用你的声音说话</p>
                  {settings.clonedVoiceId ? (
                    <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
                      <div>
                        <p className="text-xs font-medium">{settings.clonedVoiceName || "自定义音色"}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {settings.clonedAt ? new Date(settings.clonedAt).toLocaleString("zh-CN") : "已复刻"}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" onClick={testClonedVoice} disabled={cloneTesting}>
                          {cloneTesting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Volume2 className="h-3 w-3" />}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={deleteClonedVoice} title="删除复刻音色">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <input ref={cloneFileRef} type="file" accept="audio/*" onChange={handleVoiceCloneUpload} className="hidden" />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => cloneFileRef.current?.click()}
                        disabled={cloneUploading}
                        className="w-full"
                      >
                        {cloneUploading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Mic2 className="mr-1 h-3 w-3" />}
                        {cloneUploading ? "复刻中..." : "上传录音复刻音色"}
                      </Button>
                    </>
                  )}
                </div>

                <label className="flex cursor-pointer items-center justify-between">
                  <span className="text-xs">AI回复后自动语音播报</span>
                  <input
                    type="checkbox"
                    checked={settings.autoSpeak}
                    onChange={(e) => { setSettings((s) => ({ ...s, autoSpeak: e.target.checked })); updateSettings({ autoSpeak: e.target.checked }); }}
                    className="h-4 w-4 rounded accent-cognition"
                  />
                </label>

                <label className="flex cursor-pointer items-center justify-between">
                  <span className="text-xs">开启全双工语音对话模式</span>
                  <input
                    type="checkbox"
                    checked={settings.voiceMode}
                    onChange={(e) => { setSettings((s) => ({ ...s, voiceMode: e.target.checked })); updateSettings({ voiceMode: e.target.checked }); }}
                    className="h-4 w-4 rounded accent-cognition"
                  />
                </label>
              </div>

              <div className="space-y-3 rounded-xl border border-border p-4">
                <h3 className="text-sm font-medium">🔔 飞书通知</h3>
                <label className="flex cursor-pointer items-center justify-between">
                  <span className="text-xs">紧急事项通过飞书机器人通知我</span>
                  <input
                    type="checkbox"
                    checked={settings.feishuNotify}
                    onChange={(e) => { setSettings((s) => ({ ...s, feishuNotify: e.target.checked })); updateSettings({ feishuNotify: e.target.checked }); }}
                    className="h-4 w-4 rounded accent-cognition"
                  />
                </label>
                {settings.feishuNotify && (
                  <Button size="sm" variant="outline" onClick={sendFeishuTest} className="w-full">
                    <RefreshCw className="mr-1 h-3 w-3" /> 发送测试通知
                  </Button>
                )}
              </div>

              <div className="rounded-xl bg-muted/30 p-3">
                <p className="text-[10px] text-muted-foreground">
                  MiMo API Key 状态：<span className="text-northstar">已配置</span><br />
                  TTS模型：mimo-v2.5-tts · 音色复刻：mimo-v2.5-tts-voiceclone
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

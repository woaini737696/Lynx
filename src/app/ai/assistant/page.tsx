"use client";

import { useState, useRef, useEffect, Fragment, useCallback, useMemo } from "react";
import {
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
  MessageSquare,
  Image as ImageIcon,
  X,
  Settings,
  UserCircle,
  Mic2,
  Phone,
  PhoneOff,
  RefreshCw,
  Plus,
  ChevronDown,
  ChevronRight,
  Wrench,
  Star,
  History,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/layout/PageHeader";
import { HelpButton } from "@/components/layout/HelpButton";
import { ModelSwitcher, type ModelSwitcherValue } from "@/components/ui/ModelSwitcher";
import { toast } from "@/components/ui/toast";
import { SearchInput, Pagination, useClientPagination } from "@/components/ui/ListControls";
import { cn } from "@/lib/utils";
import type { LLMProvider } from "@/lib/ai-provider";
import { QUICK_COMMANDS } from "@/lib/ai-assistant-tools";
import { webmToWav } from "@/lib/audio-utils";

interface TokenUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

/** 工具调用信息（后端 assistantMode 返回） */
interface ToolCalled {
  tool: string;
  args: Record<string, any>;
  result: any;
}

/** 技能参数定义（与 @/lib/skill-parser 一致） */
interface SkillParameter {
  key: string;
  label: string;
  type: "text" | "textarea" | "select" | "date" | "number";
  required: boolean;
  placeholder?: string;
  options?: string[];
  defaultValue?: string;
}

/** 技能（用于技能选择面板） */
interface Skill {
  id: string;
  name: string;
  description: string;
  category: string;
  content: string;
  parameters: SkillParameter[];
  promptTemplate: string;
  source: string;
  tags: string[];
  usageCount: number;
  createdAt: string;
  updatedAt: string;
  /** Hermes 技能的原始 ID（source=hermes 时使用） */
  originalId?: string;
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
  toolCalled?: ToolCalled | null;
  /** 标记本条回复由 Hermes Agent 生成（模式 C） */
  hermesMode?: boolean;
  /** 标记 Hermes 失败后回退到 LLM 模式生成 */
  hermesFallback?: boolean;
}

interface AISettings {
  assistantName: string;
  assistantAvatar: string;
  avatarUrl: string | null;
  personaStyle: string | null;
  distilledStyle: string | null;
  styleStrength: number;
  clonedVoiceId: string | null;
  clonedVoiceName: string | null;
  clonedAt: string | null;
  defaultVoice: string;
  autoSpeak: boolean;
  voiceMode: boolean;
  feishuNotify: boolean;
  hermesTakeover: boolean;
  hermesAutoReport: boolean;
  hermesReportCron: string;
}

const DEFAULT_SETTINGS: AISettings = {
  assistantName: "Lynn",
  assistantAvatar: "🤖",
  avatarUrl: null,
  personaStyle: null,
  distilledStyle: null,
  styleStrength: 0.7,
  clonedVoiceId: null,
  clonedVoiceName: null,
  clonedAt: null,
  defaultVoice: "mimo_default",
  autoSpeak: false,
  voiceMode: false,
  feishuNotify: false,
  hermesTakeover: false,
  hermesAutoReport: false,
  hermesReportCron: "0 9 * * *",
};

// 快捷指令从 @/lib/ai-assistant-tools 导入（与后端工具定义同源）

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

/** 生成工具调用结果的简短摘要（用于卡片标题） */
function summarizeToolResult(result: any): string {
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

/** 任务模式（Task 7：auto-work） */
interface TaskPatternItem {
  id: string;
  patternKey: string;
  taskTemplate: string;
  executionCount: number;
  autoExecutedCount: number;
  autoExecute: boolean;
  lastExecutedAt: string | null;
  lastAutoResult: string | null;
  matchKeywords: string[];
  createdAt: string;
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

  // 对话会话持久化
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Array<{
    id: string;
    title: string;
    updatedAt: string;
    messageCount: number;
    pinned: boolean;
  }>>([]);
  const [showSessionList, setShowSessionList] = useState(false);
  const [sessionQuery, setSessionQuery] = useState("");
  const filteredSessions = useMemo(() => {
    const q = sessionQuery.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter((s) => s.title.toLowerCase().includes(q));
  }, [sessions, sessionQuery]);
  const sessionPagination = useClientPagination(filteredSessions, 10);

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
  const vadThresholdRef = useRef(18); // 自适应音量阈值（dB），初始值 18
  const vadCalibratingRef = useRef(false); // 是否正在校准环境噪声

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
  const inputRef = useRef<HTMLInputElement>(null);

  const [cloneUploading, setCloneUploading] = useState(false);
  const [cloneTesting, setCloneTesting] = useState(false);
  const cloneFileRef = useRef<HTMLInputElement>(null);

  // 头像上传
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarFileRef = useRef<HTMLInputElement>(null);

  // 风格蒸馏增强
  const [distillPreviewing, setDistillPreviewing] = useState(false);
  const [distillPreviewReply, setDistillPreviewReply] = useState<string | null>(null);

  // 任务模式学习（Task 7：auto-work）
  const [taskPatterns, setTaskPatterns] = useState<TaskPatternItem[]>([]);
  const [taskPatternsLoading, setTaskPatternsLoading] = useState(false);
  const [autoCheckInput, setAutoCheckInput] = useState("");
  const [autoChecking, setAutoChecking] = useState(false);

  const [modelCatalog, setModelCatalog] = useState<{
    providers: Array<{ id: LLMProvider; models: Array<{ id: string; multimodal?: boolean }> }>;
  } | null>(null);

  // 工具调用卡片展开状态（按消息 ID 记录）
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());

  // 技能选择面板相关状态
  const [showSkillPanel, setShowSkillPanel] = useState(false);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [skillParams, setSkillParams] = useState<Record<string, string>>({});
  const [skillExecuting, setSkillExecuting] = useState(false);
  const [skillSearch, setSkillSearch] = useState("");
  const [skillCategory, setSkillCategory] = useState("all");
  const [skillsLoading, setSkillsLoading] = useState(false);
  // 技能面板扩展：收藏/历史/Hermes
  const [skillTab, setSkillTab] = useState<"all" | "favorites" | "history" | "hermes">("all");
  const [favorites, setFavorites] = useState<Array<{ skillId: string; skillName: string; source: string; category: string }>>([]);
  const [executions, setExecutions] = useState<Array<{ id: string; skillId: string; skillName: string; source: string; success: boolean; durationMs: number; result: string; error: string | null; createdAt: string }>>([]);
  const [hermesSkills, setHermesSkills] = useState<Skill[]>([]);
  // Hermes 技能来源与运行状态，用于空状态提示
  const [hermesSource, setHermesSource] = useState<"hermes" | "database" | "filesystem">("hermes");
  const [hermesRunning, setHermesRunning] = useState<boolean>(false);
  const [hermesPreloading, setHermesPreloading] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());

  const toggleToolExpand = useCallback((msgId: string) => {
    setExpandedTools((prev) => {
      const next = new Set(prev);
      if (next.has(msgId)) {
        next.delete(msgId);
      } else {
        next.add(msgId);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    fetch("/api/ai/models")
      .then((r) => r.json())
      .then((data: { catalog?: typeof modelCatalog }) => {
        if (data.catalog) setModelCatalog(data.catalog);
      })
      .catch(() => {});
    fetchSettings();
  }, []);

  // 加载对话会话列表
  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/ai/chat/sessions?limit=30");
      const data = await res.json();
      if (data.sessions) {
        setSessions(data.sessions);
        return data.sessions as Array<{ id: string; title: string; updatedAt: string; messageCount: number; pinned: boolean }>;
      }
    } catch {}
    return [];
  }, []);

  // 加载指定会话的消息
  const loadSession = useCallback(async (sessionId: string) => {
    try {
      const res = await fetch(`/api/ai/chat/sessions/${sessionId}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.session) {
        setCurrentSessionId(sessionId);
        const loadedMessages: Message[] = data.session.messages.map((m: any) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          time: new Date(m.createdAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
          provider: m.provider,
          model: m.model,
          images: m.images || undefined,
        }));
        // 若会话为空，添加欢迎消息
        if (loadedMessages.length === 0) {
          loadedMessages.push({
            id: "welcome",
            role: "assistant",
            content: `你好！我是你的 AI 专属助理${settings.assistantName !== "Lynn" ? ` ${settings.assistantName}` : ""}。我可以帮你管理灵感、分析任务、整理认知，也可以直接对话讨论问题。有什么我能帮你的？`,
            time: "刚刚",
          });
        }
        setMessages(loadedMessages);
      }
    } catch {}
  }, [settings.assistantName]);

  // 创建新对话
  const createNewSession = useCallback(async () => {
    try {
      const res = await fetch("/api/ai/chat/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "新对话",
          provider: modelConfig.provider,
          model: modelConfig.model,
        }),
      });
      const data = await res.json();
      if (data.session) {
        setCurrentSessionId(data.session.id);
        setMessages([{
          id: "welcome",
          role: "assistant",
          content: `你好！我是你的 AI 专属助理${settings.assistantName !== "Lynn" ? ` ${settings.assistantName}` : ""}。我可以帮你管理灵感、分析任务、整理认知，也可以直接对话讨论问题。有什么我能帮你的？`,
          time: "刚刚",
        }]);
        fetchSessions();
      }
    } catch {}
  }, [modelConfig.provider, modelConfig.model, settings.assistantName, fetchSessions]);

  // 初始化：加载会话列表，若有会话则加载最近一个，否则创建新会话
  useEffect(() => {
    (async () => {
      const sessionList = await fetchSessions();
      if (sessionList.length > 0) {
        await loadSession(sessionList[0].id);
      } else {
        await createNewSession();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/ai/settings");
      const data = await res.json();
      if (data.settings) {
        setSettings({
          assistantName: data.settings.assistantName || "Lynn",
          assistantAvatar: data.settings.assistantAvatar || "🤖",
          avatarUrl: data.settings.avatarUrl || null,
          personaStyle: data.settings.personaStyle || null,
          distilledStyle: data.settings.distilledStyle || null,
          styleStrength: data.settings.styleStrength ?? 0.7,
          clonedVoiceId: data.settings.clonedVoiceId || null,
          clonedVoiceName: data.settings.clonedVoiceName || null,
          clonedAt: data.settings.clonedAt || null,
          defaultVoice: data.settings.defaultVoice || "mimo_default",
          autoSpeak: data.settings.autoSpeak ?? false,
          voiceMode: data.settings.voiceMode ?? false,
          feishuNotify: data.settings.feishuNotify ?? false,
          hermesTakeover: data.settings.hermesTakeover ?? false,
          hermesAutoReport: data.settings.hermesAutoReport ?? false,
          hermesReportCron: data.settings.hermesReportCron || "0 9 * * *",
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
          assistantAvatar: data.settings.assistantAvatar || "🤖",
          avatarUrl: data.settings.avatarUrl || null,
          personaStyle: data.settings.personaStyle || null,
          distilledStyle: data.settings.distilledStyle || null,
          styleStrength: data.settings.styleStrength ?? 0.7,
          clonedVoiceId: data.settings.clonedVoiceId || null,
          clonedVoiceName: data.settings.clonedVoiceName || null,
          clonedAt: data.settings.clonedAt || null,
          defaultVoice: data.settings.defaultVoice || "mimo_default",
          autoSpeak: data.settings.autoSpeak ?? false,
          voiceMode: data.settings.voiceMode ?? false,
          feishuNotify: data.settings.feishuNotify ?? false,
          hermesTakeover: data.settings.hermesTakeover ?? false,
          hermesAutoReport: data.settings.hermesAutoReport ?? false,
          hermesReportCron: data.settings.hermesReportCron || "0 9 * * *",
        });
      }
    } catch (e) {
      toast("保存设置失败", "error");
    }
  };

  // ============ 任务模式学习（Task 7：auto-work） ============
  const fetchTaskPatterns = async () => {
    try {
      setTaskPatternsLoading(true);
      const res = await fetch("/api/hermes/patterns?pageSize=50");
      const data = await res.json();
      if (Array.isArray(data.patterns)) {
        setTaskPatterns(data.patterns as TaskPatternItem[]);
      }
    } catch {
      // 静默失败，不打扰用户
    } finally {
      setTaskPatternsLoading(false);
    }
  };

  const togglePatternAutoExecute = async (patternId: string, next: boolean) => {
    // 乐观更新
    setTaskPatterns((prev) =>
      prev.map((p) => (p.id === patternId ? { ...p, autoExecute: next } : p))
    );
    try {
      const res = await fetch(`/api/hermes/patterns/${patternId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoExecute: next }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        // 回滚
        setTaskPatterns((prev) =>
          prev.map((p) => (p.id === patternId ? { ...p, autoExecute: !next } : p))
        );
        toast(data.error || "更新失败", "error");
      } else {
        toast(next ? "已启用自动执行" : "已关闭自动执行", "success");
      }
    } catch {
      setTaskPatterns((prev) =>
        prev.map((p) => (p.id === patternId ? { ...p, autoExecute: !next } : p))
      );
      toast("更新失败", "error");
    }
  };

  const deleteTaskPattern = async (patternId: string) => {
    try {
      const res = await fetch(`/api/hermes/patterns/${patternId}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok && data.success) {
        setTaskPatterns((prev) => prev.filter((p) => p.id !== patternId));
        toast("已删除任务模式", "success");
      } else {
        toast(data.error || "删除失败", "error");
      }
    } catch {
      toast("删除失败", "error");
    }
  };

  const runAutoCheck = async () => {
    const desc = autoCheckInput.trim();
    if (!desc) {
      toast("请输入任务描述", "error");
      return;
    }
    try {
      setAutoChecking(true);
      const res = await fetch("/api/hermes/patterns/auto-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskDescription: desc, execute: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "检查失败", "error");
        return;
      }
      if (!data.matched) {
        toast("未匹配到可自动执行的任务模式", "info");
        return;
      }
      if (!data.executed) {
        toast(`匹配到模式（得分 ${data.score?.toFixed(2)}），但未执行`, "info");
        return;
      }
      const success = data.result?.success;
      toast(
        success
          ? `✅ 自动执行成功（模式：${data.patternKey}）`
          : `❌ 自动执行失败：${data.result?.error || "未知原因"}`,
        success ? "success" : "error"
      );
      // 刷新列表以更新执行次数
      fetchTaskPatterns();
    } catch {
      toast("检查失败", "error");
    } finally {
      setAutoChecking(false);
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

  // 设置面板打开时拉取任务模式列表
  useEffect(() => {
    if (settingsOpen) {
      fetchTaskPatterns();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsOpen]);

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

  /** 流式 TTS：通过 SSE 逐句接收音频，边接收边播放，首包延迟 < 300ms */
  const speak = useCallback(async (text: string, msgId?: string) => {
    stopSpeaking();
    ttsAbortRef.current = false;
    const loadingId = msgId || `tts-${Date.now()}`;
    setTtsLoadingId(loadingId);
    if (msgId) setSpeakingId(msgId);

    // 使用流式 TTS API（SSE）
    try {
      const res = await fetch("/api/ai/tts/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!res.ok || !res.body) {
        // 流式 API 失败时回退到非流式
        setTtsLoadingId(null);
        await speakFallback(text, msgId);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let firstSentenceReceived = false;
      const audioQueue: Array<{ url: string; text: string }> = [];
      let queuePlaying = false;

      // 播放队列函数
      const playQueue = async () => {
        if (queuePlaying) return;
        queuePlaying = true;
        ttsPlayingRef.current = true;
        while (!ttsAbortRef.current) {
          const item = audioQueue.shift();
          if (!item) {
            // 队列空，等待新内容
            await new Promise(r => setTimeout(r, 50));
            continue;
          }
          const audio = new Audio(item.url);
          audioRef.current = audio;
          try {
            await audio.play();
            await new Promise<void>((resolve) => {
              audio.onended = () => { URL.revokeObjectURL(item.url); resolve(); };
              audio.onerror = () => { URL.revokeObjectURL(item.url); resolve(); };
            });
          } catch {
            URL.revokeObjectURL(item.url);
          }
          audioRef.current = null;
        }
        queuePlaying = false;
        ttsPlayingRef.current = false;
        setSpeakingId(null);
      };

      // 启动播放循环
      playQueue();

      // 解析 SSE 数据
      while (true) {
        if (ttsAbortRef.current) break;
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // 按 SSE 协议解析（data: ...\n\n）
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || ""; // 保留最后未完整的块

        for (const line of lines) {
          const dataLine = line.trim();
          if (!dataLine.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(dataLine.slice(6));
            if (data.type === "sentence" && data.audioBase64) {
              // base64 → blob URL
              const byteChars = atob(data.audioBase64);
              const byteNumbers = new Uint8Array(byteChars.length);
              for (let i = 0; i < byteChars.length; i++) {
                byteNumbers[i] = byteChars.charCodeAt(i);
              }
              const blob = new Blob([byteNumbers], { type: `audio/${data.format || "wav"}` });
              const url = URL.createObjectURL(blob);
              audioQueue.push({ url, text: data.text });

              // 第一句到达后立即取消 loading 状态
              if (!firstSentenceReceived) {
                firstSentenceReceived = true;
                setTtsLoadingId(null);
              }
            } else if (data.type === "done") {
              // 标记流结束，播放循环会在队列空后自动停止
              // 给播放循环一点时间处理剩余队列
              setTimeout(() => {
                if (audioQueue.length === 0) {
                  ttsAbortRef.current = true;
                }
              }, 500);
            } else if (data.type === "error") {
              console.warn("[TTS stream] 句子合成失败:", data.message);
            }
          } catch {
            // JSON 解析失败，跳过
          }
        }
      }

      // 等待播放队列完成
      if (!firstSentenceReceived) {
        setTtsLoadingId(null);
        toast("语音合成失败", "error");
        setSpeakingId(null);
      }
    } catch (e) {
      setTtsLoadingId(null);
      // 网络错误时回退到非流式
      await speakFallback(text, msgId);
    }
  }, [stopSpeaking]);

  /** 非流式 TTS 回退方案（流式 API 不可用时使用） */
  const speakFallback = useCallback(async (text: string, msgId?: string) => {
    const sentences = splitSentences(text);
    const queue: Array<{ url: string; text: string }> = [];

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

    const firstBatch = sentences.slice(0, 2).map(s => synthesizeSentence(s));
    const firstUrls = await Promise.all(firstBatch);
    for (let i = 0; i < firstUrls.length; i++) {
      if (firstUrls[i]) queue.push({ url: firstUrls[i]!, text: sentences[i] });
    }

    if (queue.length === 0) {
      toast("语音合成失败", "error");
      setSpeakingId(null);
      return;
    }

    ttsQueueRef.current = queue;
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

    const playQueue = async () => {
      ttsPlayingRef.current = true;
      while (!ttsAbortRef.current) {
        const item = ttsQueueRef.current.shift();
        if (!item) {
          if (ttsAbortRef.current) break;
          await new Promise(r => setTimeout(r, 100));
          continue;
        }
        const audio = new Audio(item.url);
        audioRef.current = audio;
        try {
          await audio.play();
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
  }, []);

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

    // 持久化用户消息到数据库
    if (currentSessionId) {
      fetch(`/api/ai/chat/sessions/${currentSessionId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "user",
          content,
          images: attachedImages.length > 0 ? attachedImages : undefined,
        }),
      }).catch(() => {});
    }

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
      // 构建 API 消息（保留历史对话上下文，过滤错误消息和工具卡片消息）
      const apiMessages = nextMessages
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
        });

      // 调用 AI 助理模式（非流式，支持 Function Calling）
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: apiMessages,
          provider: modelConfig.provider,
          model: modelConfig.model,
          reasoningMode: modelConfig.reasoningMode,
          stream: false,
          assistantMode: true,
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

      const data = await res.json().catch(() => null);
      if (!data || typeof data !== "object") {
        const errMsg = "服务器返回数据格式异常";
        setMessages((prev) => prev.map((m) => m.id === aiMsgId ? { ...m, content: errMsg, error: true, streaming: false } : m));
        toast(errMsg, "error");
        return;
      }

      const aiContent: string = data.content || "(空回复)";
      const aiProvider: LLMProvider | undefined = data.provider;
      const aiModel: string | undefined = data.model;
      const aiUsage: TokenUsage | undefined = data.usage;
      const toolCalled: ToolCalled | null = data.toolCalled || null;
      const hermesMode: boolean | undefined = data.hermesMode === true ? true : undefined;
      const hermesFallback: boolean | undefined = data.hermesFallback === true ? true : undefined;

      setMessages((prev) =>
        prev.map((m) =>
          m.id === aiMsgId
            ? {
                ...m,
                content: aiContent,
                streaming: false,
                provider: aiProvider,
                model: aiModel,
                usage: aiUsage,
                toolCalled,
                hermesMode,
                hermesFallback,
              }
            : m
        )
      );

      // 持久化 AI 回复到数据库
      if (currentSessionId && aiContent) {
        fetch(`/api/ai/chat/sessions/${currentSessionId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            role: "assistant",
            content: aiContent,
            provider: aiProvider,
            model: aiModel,
            tokens: aiUsage?.total_tokens,
          }),
        }).catch(() => {});
        // 刷新会话列表（标题可能已自动更新）
        fetchSessions();
      }

      // 自动语音播放条件：
      // - autoSpeak 开启时总是播放
      // - voiceMode 开启且正在语音通话中时播放（非通话中不自动播放）
      const shouldAutoSpeak = settings.autoSpeak || (settings.voiceMode && voiceCallActive);
      if (shouldAutoSpeak && aiContent) {
        setTimeout(() => speak(aiContent, aiMsgId), 300);
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
    setConfirmClear(false);
    // 创建新对话会话
    createNewSession();
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

  // 优先选择 mp4（Safari），回退 webm（Chrome），再回退默认
  const createMediaRecorder = (stream: MediaStream): MediaRecorder => {
    const mimeTypes = ["audio/mp4", "audio/m4a", "audio/webm", "audio/ogg"];
    const mimeType = mimeTypes.find((t) => MediaRecorder.isTypeSupported(t)) || "";
    return mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
  };

  const transcribeAudio = async (blob: Blob): Promise<string | null> => {
    setTranscribing(true);
    try {
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
      const recorder = createMediaRecorder(stream);
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
      const recorder = createMediaRecorder(stream);
      vadRecorderRef.current = recorder;
      recorder.ondataavailable = (e) => {
        // 始终收集数据块（包括 recorder.stop() 触发的最终 flush）
        // 之前的 bug：检查 vadSpeechActiveRef 导致最后几百毫秒音频被丢弃，ASR 误识别为"透支"
        if (e.data.size > 0) {
          vadChunksRef.current.push(e.data);
        }
      };
      recorder.start(200); // 每 200ms 产生一个数据块
    } catch {
      startVoiceChunkRecordingLegacy();
      return;
    }

    // VAD 参数（阈值会通过校准自适应）
    const SPEECH_START_MS = 300; // 音量超阈值持续 300ms 判定为语音开始
    const SPEECH_END_MS = 500; // 音量低于阈值持续 500ms 判定为语音结束（降低延迟，更接近实时对话）
    const MAX_SPEECH_MS = 30000; // 单次最长 30 秒

    let highVolumeStart = 0;
    let lowVolumeStart = 0;
    const buffer = new Uint8Array(analyserRef.current!.frequencyBinCount);

    // ===== 环境噪声校准（前 1 秒采集环境噪声基线，自适应设置阈值）=====
    // 仅在首次启动或阈值未校准时执行
    if (!vadCalibratingRef.current && vadThresholdRef.current === 18) {
      vadCalibratingRef.current = true;
      const noiseSamples: number[] = [];
      const calibrationStart = Date.now();
      const calibrationInterval = setInterval(() => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(buffer);
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) sum += buffer[i] * buffer[i];
        const rms = Math.sqrt(sum / buffer.length);
        const vol = rms > 0 ? 20 * Math.log10(rms) : -100;
        noiseSamples.push(vol);
        if (Date.now() - calibrationStart >= 1000) {
          clearInterval(calibrationInterval);
          vadCalibratingRef.current = false;
          if (noiseSamples.length > 0) {
            // 取噪声样本的中位数作为基线（比均值更抗异常值）
            const sorted = [...noiseSamples].sort((a, b) => a - b);
            const median = sorted[Math.floor(sorted.length / 2)];
            // 阈值 = 噪声基线 + 12dB（经验值，确保语音明显高于噪声）
            // 限制在 [10, 35] 范围内，避免极端值
            const adaptiveThreshold = Math.max(10, Math.min(35, median + 12));
            vadThresholdRef.current = adaptiveThreshold;
            console.log(`[VAD] 环境噪声校准完成: 基线=${median.toFixed(1)}dB, 阈值=${adaptiveThreshold.toFixed(1)}dB`);
          }
        }
      }, 50);
    }

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
      // 使用自适应阈值
      const VOLUME_THRESHOLD = vadThresholdRef.current;

      if (volume > VOLUME_THRESHOLD) {
        highVolumeStart = highVolumeStart || now;
        lowVolumeStart = 0;

        // 语音开始检测
        if (!vadSpeechActiveRef.current && now - highVolumeStart > SPEECH_START_MS) {
          vadSpeechActiveRef.current = true;
          vadSpeechStartRef.current = now;
          vadChunksRef.current = [];
          setVoiceCallListening(false);
          // 全双工体验：用户开口说话时立即打断 TTS 播放
          if (ttsPlayingRef.current) {
            stopSpeaking();
          }
        }
      } else {
        lowVolumeStart = lowVolumeStart || now;
        highVolumeStart = 0;

        // 语音结束检测
        if (vadSpeechActiveRef.current && now - lowVolumeStart > SPEECH_END_MS) {
          // 收集音频并发送识别
          const speechDuration = now - vadSpeechStartRef.current;
          vadSpeechActiveRef.current = false; // 防止 VAD 重复触发

          if (speechDuration > 400) {
            // 停止当前 recorder，在 onstop 中收集所有 chunks（包括最终 flush）
            const recorder = vadRecorderRef.current;
            if (recorder && recorder.state !== "inactive") {
              recorder.onstop = async () => {
                // 在 onstop 中快照 chunks，此时 recorder.stop() 的最终 flush 已写入
                const chunks = [...vadChunksRef.current];
                vadChunksRef.current = [];
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
            // 语音太短，丢弃
            vadChunksRef.current = [];
            setVoiceCallListening(true);
          }
        }
      }

      // 超时保护：单次语音超过 30 秒强制结束
      if (vadSpeechActiveRef.current && now - vadSpeechStartRef.current > MAX_SPEECH_MS) {
        vadSpeechActiveRef.current = false;
        const recorder = vadRecorderRef.current;
        if (recorder && recorder.state !== "inactive") {
          recorder.onstop = async () => {
            const chunks = [...vadChunksRef.current];
            vadChunksRef.current = [];
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
      const recorder = createMediaRecorder(voiceCallStreamRef.current);
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
    vadThresholdRef.current = 18; // 重置阈值，下次启动重新校准
    vadCalibratingRef.current = false;
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

  // 头像文件上传
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast("头像文件过大，最大 2MB", "error");
      return;
    }
    setAvatarUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/ai/avatar-upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok && data.url) {
        setSettings((s) => ({ ...s, avatarUrl: data.url }));
        await updateSettings({ avatarUrl: data.url });
        toast("头像上传成功", "success");
      } else {
        toast(data.error || "上传失败", "error");
      }
    } catch {
      toast("上传失败", "error");
    } finally {
      setAvatarUploading(false);
      if (avatarFileRef.current) avatarFileRef.current.value = "";
    }
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

  // 加载技能列表
  const fetchSkills = async () => {
    setSkillsLoading(true);
    try {
      const res = await fetch("/api/skills");
      const data = await res.json();
      if (Array.isArray(data.skills)) {
        setSkills(data.skills);
      } else if (Array.isArray(data)) {
        setSkills(data);
      }
    } catch {
      toast("加载技能失败", "error");
    } finally {
      setSkillsLoading(false);
    }
  };

  // 执行选中的技能
  const executeSkill = async () => {
    if (!selectedSkill) return;
    // 校验必填参数
    for (const p of selectedSkill.parameters) {
      if (p.required && !skillParams[p.key]?.trim()) {
        toast(`请填写 ${p.label}`, "error");
        return;
      }
    }
    setSkillExecuting(true);
    try {
      let resultText = "";
      // Hermes 技能走 Hermes 执行 API
      if (selectedSkill.source === "hermes" && selectedSkill.originalId) {
        const res = await fetch("/api/hermes/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: Object.entries(skillParams)
              .map(([k, v]) => `${k}: ${v}`)
              .join("\n"),
            mode: "auto",
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          toast(data.error || "Hermes 执行失败", "error");
          return;
        }
        resultText = data.output || "（无输出）";
      } else {
        // 本地技能走 distill API
        const res = await fetch("/api/ai/distill", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            templateId: selectedSkill.id,
            parameters: skillParams,
            provider: modelConfig.provider === "mimo" ? "mimo" : undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          toast(data.error || "执行失败", "error");
          return;
        }
        resultText = data.result;
      }
      // 将结果作为 assistant 消息添加到对话
      const newMsg: Message = {
        id: `msg-${Date.now()}`,
        role: "assistant",
        content: `**已执行技能：${selectedSkill.name}**\n\n${resultText}`,
        time: new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, newMsg]);
      // 持久化到数据库
      if (currentSessionId) {
        fetch(`/api/ai/chat/sessions/${currentSessionId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            role: "assistant",
            content: newMsg.content,
          }),
        }).catch(() => {});
      }
      setShowSkillPanel(false);
      setSelectedSkill(null);
      setSkillParams({});
      toast("技能执行完成", "success");
    } catch (e) {
      toast("执行错误：" + (e as Error).message, "error");
    } finally {
      setSkillExecuting(false);
    }
  };

  // 打开技能面板
  const openSkillPanel = () => {
    setShowSkillPanel(true);
    setSelectedSkill(null);
    setSkillParams({});
    setSkillSearch("");
    setSkillCategory("all");
    setSkillTab("all");
    fetchSkills();
    fetchFavorites();
    fetchExecutions();
  };

  // 加载收藏列表
  const fetchFavorites = async () => {
    try {
      const res = await fetch("/api/skills/favorites");
      const data = await res.json();
      if (Array.isArray(data.favorites)) {
        setFavorites(data.favorites);
        setFavoriteIds(new Set(data.favorites.map((f: { skillId: string }) => f.skillId)));
      }
    } catch {
      // 静默失败
    }
  };

  // 加载执行历史
  const fetchExecutions = async () => {
    try {
      const res = await fetch("/api/skills/executions?limit=30");
      const data = await res.json();
      if (Array.isArray(data.executions)) {
        setExecutions(data.executions);
      }
    } catch {
      // 静默失败
    }
  };

  // 加载 Hermes 技能列表（Hermes 未运行时自动回退到数据库/文件系统）
  const fetchHermesSkills = async () => {
    setSkillsLoading(true);
    try {
      const res = await fetch("/api/hermes/skills");
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "加载 Hermes 技能失败", "error");
        setHermesSkills([]);
        return;
      }
      // 记录来源与运行状态，用于空状态提示
      setHermesSource((data.source as "hermes" | "database" | "filesystem") || "hermes");
      setHermesRunning(data.hermesRunning === true);
      if (Array.isArray(data.skills)) {
        // 转换为前端 Skill 格式（兼容 Hermes / 数据库两种参数结构）
        setHermesSkills(data.skills.map((s: { id: string; name: string; description: string; category: string; parameters?: Array<{ name?: string; key?: string; label?: string; type?: string; description?: string; required?: boolean; default?: unknown; defaultValue?: string; placeholder?: string; options?: string[] }>; tags?: string[]; usageCount?: number }) => ({
          id: `hermes-${s.id}`,
          name: s.name,
          description: s.description || "",
          category: s.category || "hermes",
          tags: s.tags || [],
          parameters: (s.parameters || []).map((p) => ({
            key: p.key || p.name || "",
            label: p.label || p.name || p.key || "",
            type: p.type === "number" ? "number" : p.type === "select" ? "select" : "text",
            required: p.required || false,
            placeholder: p.placeholder || p.description || "",
            defaultValue: typeof (p.defaultValue ?? p.default) === "string" ? ((p.defaultValue ?? p.default) as string) : "",
            options: p.options || [],
          })),
          usageCount: s.usageCount || 0,
          source: "hermes" as const,
          originalId: s.id,
        })));
      }
    } catch {
      toast("加载 Hermes 技能失败", "error");
      setHermesSkills([]);
    } finally {
      setSkillsLoading(false);
    }
  };

  // 预加载默认 Hermes 技能（6 个 LynnHub 专用技能）
  const handlePreloadHermesSkills = async () => {
    setHermesPreloading(true);
    try {
      const res = await fetch("/api/hermes/skills/preload", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.success) {
        toast(`已预加载 ${data.count} 个默认技能`, "success");
        await fetchHermesSkills();
      } else {
        toast(data.error || "预加载失败", "error");
      }
    } catch {
      toast("预加载技能失败", "error");
    } finally {
      setHermesPreloading(false);
    }
  };

  // 切换收藏
  const toggleFavorite = async (skillId: string, skillName: string, category: string, source: string = "local") => {
    const isFav = favoriteIds.has(skillId);
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (isFav) next.delete(skillId);
      else next.add(skillId);
      return next;
    });
    try {
      if (isFav) {
        await fetch(`/api/skills/favorites?skillId=${encodeURIComponent(skillId)}`, { method: "DELETE" });
        setFavorites((prev) => prev.filter((f) => f.skillId !== skillId));
      } else {
        await fetch("/api/skills/favorites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ skillId, skillName, category, source }),
        });
        setFavorites((prev) => [{ skillId, skillName, source, category }, ...prev]);
      }
    } catch {
      // 回滚
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (isFav) next.add(skillId);
        else next.delete(skillId);
        return next;
      });
    }
  };

  // 选择技能时，用 defaultValue 初始化参数
  const onSelectSkill = (skill: Skill) => {
    setSelectedSkill(skill);
    const initParams: Record<string, string> = {};
    for (const p of skill.parameters) {
      initParams[p.key] = p.defaultValue || "";
    }
    setSkillParams(initParams);
  };

  // 过滤后的技能列表
  const filteredSkills = skills.filter((s) => {
    const matchCategory = skillCategory === "all" || s.category === skillCategory;
    const q = skillSearch.trim().toLowerCase();
    const matchSearch = !q ||
      s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.tags.some((t) => t.toLowerCase().includes(q));
    return matchCategory && matchSearch;
  });

  // 技能分类列表（从已加载技能中动态提取）
  const skillCategories = Array.from(new Set(skills.map((s) => s.category).filter(Boolean)));

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      <div className="sticky top-0 z-20 shrink-0 border-b border-border bg-background/95 px-4 py-3 backdrop-blur sm:px-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-xl bg-primary text-primary-foreground shadow-sm">
              {settings.avatarUrl ? <img src={settings.avatarUrl} alt="avatar" className="h-full w-full object-cover" /> : <span className="text-base leading-none">{settings.assistantAvatar}</span>}
            </div>
            <div>
              <h1 className="text-sm font-semibold">AI 专属助理 {settings.assistantName !== "Lynn" && <span className="text-cognition">· {settings.assistantName}</span>}</h1>
              <p className="text-[10px] text-muted-foreground">基于你的记忆图谱和认知库提供个性化协助</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowSessionList((v) => !v)} title="历史对话">
              <MessageSquare className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="sm" onClick={createNewSession} title="新对话">
              <Plus className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSettingsOpen(true)} title="设置">
              <Settings className="h-3.5 w-3.5" />
            </Button>
            <ModelSwitcher value={modelConfig} onChange={setModelConfig} />
            <HelpButton contentKey="ai-assistant" />
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

      {/* 历史对话侧边栏 */}
      {showSessionList && (
        <div className="border-b border-border bg-card/50 px-4 py-3 sm:px-8">
          <div className="mx-auto max-w-2xl">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-medium text-muted-foreground">历史对话</h3>
              <button onClick={() => setShowSessionList(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            {sessions.length > 0 && (
              <SearchInput
                value={sessionQuery}
                onChange={setSessionQuery}
                placeholder="搜索对话标题..."
                className="mb-2"
              />
            )}
            <div className="max-h-64 space-y-1 overflow-y-auto">
              {sessions.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">暂无历史对话</p>
              ) : filteredSessions.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">未找到匹配的对话</p>
              ) : (
                sessionPagination.paginated.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      loadSession(s.id);
                      setShowSessionList(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs transition-colors hover:bg-muted/50",
                      currentSessionId === s.id && "bg-cognition/10 text-cognition"
                    )}
                  >
                    <MessageSquare className="h-3 w-3 shrink-0 text-muted-foreground" />
                    <span className="flex-1 truncate">{s.title}</span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">{s.messageCount}条</span>
                  </button>
                ))
              )}
            </div>
            {filteredSessions.length > 0 && (
              <div className="mt-2">
                <Pagination
                  page={sessionPagination.page}
                  pageSize={sessionPagination.pageSize}
                  total={sessionPagination.total}
                  onPageChange={sessionPagination.onPageChange}
                  onPageSizeChange={sessionPagination.onPageSizeChange}
                />
              </div>
            )}
          </div>
        </div>
      )}

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8">
        <div className="mx-auto max-w-2xl space-y-4">
          {messages.map((msg) => (
            <div key={msg.id} className={cn("flex gap-3", msg.role === "user" && "flex-row-reverse")}>
              <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-xl text-white shadow-sm",
                msg.role === "assistant"
                  ? msg.error ? "bg-destructive" : "bg-primary"
                  : "bg-northstar"
              )}>
                {msg.role === "assistant"
                  ? msg.error ? <AlertCircle className="h-4 w-4" /> : (settings.avatarUrl ? <img src={settings.avatarUrl} alt="avatar" className="h-full w-full object-cover" /> : <span className="text-base leading-none">{settings.assistantAvatar}</span>)
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

                {/* 工具调用卡片（可展开查看完整结果） */}
                {msg.role === "assistant" && !msg.error && !msg.streaming && msg.toolCalled && (
                  <div className="mt-2 max-w-[85%] rounded-xl border border-cognition/30 bg-cognition/5 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleToolExpand(msg.id)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-cognition/10"
                    >
                      <Wrench className="h-3.5 w-3.5 shrink-0 text-cognition" />
                      <span className="text-xs font-medium text-cognition">
                        工具调用：{msg.toolCalled.tool}
                      </span>
                      <span className="ml-auto text-[10px] text-muted-foreground">
                        {summarizeToolResult(msg.toolCalled.result)}
                      </span>
                      {expandedTools.has(msg.id) ? (
                        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      )}
                    </button>
                    {expandedTools.has(msg.id) && (
                      <div className="border-t border-cognition/20 px-3 py-2">
                        <div className="mb-1.5 text-[10px] text-muted-foreground">
                          参数：
                        </div>
                        <pre className="mb-2 overflow-x-auto rounded-lg bg-muted/50 p-2 text-[11px] leading-relaxed">
                          <code className="font-mono text-foreground">
                            {JSON.stringify(msg.toolCalled.args, null, 2)}
                          </code>
                        </pre>
                        <div className="mb-1.5 text-[10px] text-muted-foreground">
                          结果：
                        </div>
                        <pre className="overflow-x-auto rounded-lg bg-muted/50 p-2 text-[11px] leading-relaxed max-h-60">
                          <code className="font-mono text-foreground">
                            {JSON.stringify(msg.toolCalled.result, null, 2)}
                          </code>
                        </pre>
                      </div>
                    )}
                  </div>
                )}

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
              <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary text-primary-foreground shadow-sm">
                {settings.avatarUrl ? <img src={settings.avatarUrl} alt="avatar" className="h-full w-full object-cover" /> : <span className="text-base leading-none">{settings.assistantAvatar}</span>}
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

      <div className="shrink-0 border-t border-border px-4 py-3 sm:px-8">
        <div className="mx-auto max-w-2xl">
          {!thinking && !voiceCallActive && (
            <div className="mb-2 flex items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              <button
                onClick={openSkillPanel}
                title="选择技能执行"
                className="inline-flex shrink-0 items-center gap-1 rounded-full border border-cognition/40 bg-cognition/5 px-2.5 py-1 text-[11px] text-cognition transition-all hover:bg-cognition/10"
              >
                <Wrench className="h-3 w-3" />
                <span>技能</span>
              </button>
              {QUICK_COMMANDS.map((cmd, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setInput((prev) => prev ? `${prev}\n${cmd.message}` : cmd.message);
                    // 聚焦输入框
                    setTimeout(() => inputRef.current?.focus(), 0);
                  }}
                  title={cmd.description}
                  className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] transition-all hover:border-cognition/40 hover:bg-cognition/5"
                >
                  <span className="text-xs">{cmd.icon}</span>
                  <span>{cmd.label}</span>
                </button>
              ))}
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
                ref={inputRef}
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
          <div className="mt-2 flex items-center justify-center gap-2">
            {settings.hermesTakeover ? (
              <span
                className="inline-flex items-center gap-1 rounded-full border border-green-500/40 bg-green-500/10 px-2 py-0.5 text-[10px] font-medium text-green-600 dark:text-green-400"
                title="Hermes Agent 接管模式（模式 C）：持久化记忆 + 持续学习，失败时自动回退到 LLM"
              >
                <Sparkles className="h-2.5 w-2.5" />
                🤖 Hermes Agent 模式
              </span>
            ) : (
              <span
                className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                title="LLM 模式：直接调用大模型回复，无持久化记忆"
              >
                💬 LLM 模式
              </span>
            )}
          </div>
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
          <div className="flex max-h-[90vh] w-full max-w-md flex-col rounded-2xl bg-card shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex shrink-0 items-center justify-between border-b border-border px-6 py-4">
              <h2 className="text-lg font-semibold">助理设置</h2>
              <button onClick={() => setSettingsOpen(false)} className="rounded-full p-1 hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-4">
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

              {/* 头像 - 支持 Emoji 选择、URL 输入和文件上传 */}
              <div>
                <label className="mb-1.5 block text-xs font-medium">助理头像</label>
                {/* Emoji 头像（无 URL 时使用，与移动端同步） */}
                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                  {["🤖", "🐱", "🦊", "🐼", "🧠", "⚡", "🌟", "🎯"].map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => { setSettings((s) => ({ ...s, assistantAvatar: emoji })); updateSettings({ assistantAvatar: emoji }); }}
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-lg border text-lg transition",
                        settings.assistantAvatar === emoji
                          ? "border-cognition bg-cognition/10"
                          : "border-border bg-background hover:bg-muted"
                      )}
                    >
                      {emoji}
                    </button>
                  ))}
                  <span className="ml-1 text-[10px] text-muted-foreground">无 URL 时显示</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={settings.avatarUrl || ""}
                    onChange={(e) => setSettings((s) => ({ ...s, avatarUrl: e.target.value || null }))}
                    onBlur={() => updateSettings({ avatarUrl: settings.avatarUrl })}
                    className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-cognition"
                    placeholder="粘贴图片 URL 或点击右侧上传"
                  />
                  <input
                    ref={avatarFileRef}
                    type="file"
                    accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
                    onChange={handleAvatarUpload}
                    className="hidden"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => avatarFileRef.current?.click()}
                    disabled={avatarUploading}
                    className="shrink-0"
                  >
                    {avatarUploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <ImageIcon className="h-3 w-3" />}
                    {avatarUploading ? "上传中" : "上传"}
                  </Button>
                </div>
                {settings.avatarUrl && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-primary text-primary-foreground">
                      <img src={settings.avatarUrl} alt="preview" className="h-full w-full object-cover" />
                    </div>
                    <button
                      onClick={() => { setSettings((s) => ({ ...s, avatarUrl: null })); updateSettings({ avatarUrl: null }); }}
                      className="text-xs text-graveyard hover:underline"
                    >
                      移除头像
                    </button>
                  </div>
                )}
                <p className="mt-1 text-[10px] text-muted-foreground">支持 PNG/JPEG/GIF/WebP/SVG，最大 2MB</p>
              </div>

              {/* 聊天风格描述 */}
              <div>
                <label className="mb-1.5 block text-xs font-medium">聊天风格描述</label>
                <textarea
                  value={settings.personaStyle || ""}
                  onChange={(e) => setSettings((s) => ({ ...s, personaStyle: e.target.value || null }))}
                  onBlur={() => updateSettings({ personaStyle: settings.personaStyle })}
                  rows={3}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-cognition"
                  placeholder="如：幽默、简洁、多用emoji、像朋友一样聊天..."
                />
                <p className="mt-1 text-[10px] text-muted-foreground">描述你希望 AI 助理的聊天风格，会注入到 system prompt</p>
              </div>

              {/* 蒸馏真人聊天风格 */}
              <div className="space-y-2 rounded-xl border border-border p-4">
                <h3 className="text-sm font-medium">🎭 蒸馏真人聊天风格</h3>
                <p className="text-xs text-muted-foreground">上传一段真人聊天记录，AI 会自动提取风格特征，模仿该风格与你对话</p>
                <textarea
                  id="distill-chat-records"
                  rows={4}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs outline-none focus:border-cognition"
                  placeholder="粘贴聊天记录（至少 10 字符，最多 20000 字符）..."
                />
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={async () => {
                      const textarea = document.getElementById("distill-chat-records") as HTMLTextAreaElement;
                      const records = textarea?.value || "";
                      if (records.trim().length < 10) {
                        toast("请输入至少 10 字符的聊天记录", "error");
                        return;
                      }
                      try {
                        toast("正在蒸馏风格...", "info");
                        const res = await fetch("/api/ai/distill-style", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ chatRecords: records, preview: true }),
                        });
                        const data = await res.json();
                        if (res.ok && data.success) {
                          setSettings((s) => ({ ...s, distilledStyle: data.distilledStyle }));
                          setDistillPreviewReply(null);
                          toast("风格蒸馏成功！点击下方「保存并预览」确认效果", "success");
                        } else {
                          toast(data.error || "蒸馏失败", "error");
                        }
                      } catch {
                        toast("蒸馏失败", "error");
                      }
                    }}
                    className="gap-1.5"
                  >
                    <Sparkles className="h-3 w-3" />
                    开始蒸馏
                  </Button>
                  {settings.distilledStyle && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          try {
                            setDistillPreviewing(true);
                            setDistillPreviewReply(null);
                            const res = await fetch("/api/ai/distill-style", {
                              method: "PUT",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                distilledStyle: settings.distilledStyle,
                                testMessage: "你好，今天有什么任务需要聚焦？",
                              }),
                            });
                            const data = await res.json();
                            if (res.ok && data.success) {
                              setDistillPreviewReply(data.reply);
                            } else {
                              toast(data.error || "预览失败", "error");
                            }
                          } catch {
                            toast("预览失败", "error");
                          } finally {
                            setDistillPreviewing(false);
                          }
                        }}
                        disabled={distillPreviewing}
                        className="gap-1.5"
                      >
                        {distillPreviewing ? <Loader2 className="h-3 w-3 animate-spin" /> : <MessageSquare className="h-3 w-3" />}
                        {distillPreviewing ? "预览中" : "预览效果"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setSettings((s) => ({ ...s, distilledStyle: null }));
                          updateSettings({ distilledStyle: null });
                          setDistillPreviewReply(null);
                        }}
                        className="text-xs text-graveyard"
                      >
                        清除
                      </Button>
                    </>
                  )}
                </div>
                {settings.distilledStyle && (
                  <>
                    {/* 风格强度滑块 */}
                    <div className="rounded-lg bg-muted/30 p-3">
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="text-xs font-medium">风格强度</span>
                        <span className="text-xs text-cognition">{Math.round(settings.styleStrength * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={settings.styleStrength}
                        onChange={(e) => setSettings((s) => ({ ...s, styleStrength: parseFloat(e.target.value) }))}
                        onMouseUp={() => updateSettings({ styleStrength: settings.styleStrength })}
                        className="w-full accent-cognition"
                      />
                      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                        <span>轻微参考</span>
                        <span>适度融入</span>
                        <span>严格模仿</span>
                      </div>
                    </div>
                    {/* 蒸馏结果 */}
                    <div className="rounded-lg bg-cognition/5 p-2 text-xs text-muted-foreground">
                      <p className="mb-1 font-medium text-cognition">已蒸馏风格：</p>
                      <p className="line-clamp-3">{settings.distilledStyle}</p>
                    </div>
                    {/* 预览回复 */}
                    {distillPreviewing && (
                      <div className="rounded-lg border border-cognition/30 bg-cognition/5 p-3">
                        <p className="mb-1 text-[10px] font-medium text-cognition">AI 正在用蒸馏风格回复...</p>
                        <Loader2 className="h-3 w-3 animate-spin text-cognition" />
                      </div>
                    )}
                    {distillPreviewReply && (
                      <div className="rounded-lg border border-cognition/30 bg-cognition/5 p-3">
                        <p className="mb-1 text-[10px] font-medium text-cognition">预览回复（&ldquo;你好，今天有什么任务需要聚焦？&rdquo;）：</p>
                        <p className="text-xs leading-relaxed text-foreground">{distillPreviewReply}</p>
                      </div>
                    )}
                    {/* 保存按钮 */}
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        updateSettings({
                          distilledStyle: settings.distilledStyle,
                          styleStrength: settings.styleStrength,
                        });
                        toast("风格设置已保存", "success");
                      }}
                    >
                      保存风格设置
                    </Button>
                  </>
                )}
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

              <div className="space-y-3 rounded-xl border border-border p-4">
                <h3 className="text-sm font-medium">🤖 Hermes Agent 超级助理</h3>
                <div className={cn(
                  "rounded-lg border p-3 transition-colors",
                  settings.hermesTakeover
                    ? "border-green-500/40 bg-green-500/5"
                    : "border-border bg-muted/20"
                )}>
                  <label className="flex cursor-pointer items-center justify-between">
                    <span className="text-xs font-semibold">
                      Hermes 接管模式（模式 C）
                      {settings.hermesTakeover && (
                        <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-green-500/15 px-1.5 py-0.5 text-[9px] font-medium text-green-600 dark:text-green-400">
                          <Sparkles className="h-2 w-2" /> 已启用
                        </span>
                      )}
                    </span>
                    <input
                      type="checkbox"
                      checked={settings.hermesTakeover}
                      onChange={(e) => { setSettings((s) => ({ ...s, hermesTakeover: e.target.checked })); updateSettings({ hermesTakeover: e.target.checked }); }}
                      className="h-4 w-4 rounded accent-cognition"
                    />
                  </label>
                  <p className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground">
                    开启后 AI 助理由 Hermes Agent 驱动，拥有持久化记忆和持续学习能力。失败时自动回退到 LLM 模式。
                  </p>
                </div>
                <label className="flex cursor-pointer items-center justify-between">
                  <span className="text-xs">主动汇报（定时分析数据并推送）</span>
                  <input
                    type="checkbox"
                    checked={settings.hermesAutoReport}
                    onChange={(e) => { setSettings((s) => ({ ...s, hermesAutoReport: e.target.checked })); updateSettings({ hermesAutoReport: e.target.checked }); }}
                    className="h-4 w-4 rounded accent-cognition"
                  />
                </label>
                {settings.hermesAutoReport && (
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] text-muted-foreground">汇报 Cron 表达式（默认每天 9:00）</span>
                    <input
                      type="text"
                      value={settings.hermesReportCron}
                      onChange={(e) => { setSettings((s) => ({ ...s, hermesReportCron: e.target.value })); }}
                      onBlur={(e) => updateSettings({ hermesReportCron: e.target.value })}
                      placeholder="0 9 * * *"
                      className="rounded border border-border bg-background px-2 py-1 text-xs"
                    />
                  </label>
                )}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      try {
                        toast("正在生成主动汇报...", "info");
                        const res = await fetch("/api/hermes/proactive-report", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ type: "daily" }),
                        });
                        const data = await res.json();
                        if (data.success) {
                          toast(`汇报已生成${data.pushed ? "并推送" : ""}`, "success");
                        } else {
                          toast(data.error || "生成失败", "error");
                        }
                      } catch {
                        toast("生成汇报失败", "error");
                      }
                    }}
                    className="flex-1"
                  >
                    <Sparkles className="mr-1 h-3 w-3" /> 立即生成汇报
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      try {
                        const res = await fetch("/api/hermes/patrol-takeover", { method: "POST" });
                        const data = await res.json();
                        if (data.success) {
                          toast(`已迁移 ${data.migratedCount} 条巡检规则到 Hermes`, "success");
                        } else {
                          toast(data.error || "迁移失败", "error");
                        }
                      } catch {
                        toast("巡检接管失败", "error");
                      }
                    }}
                    className="flex-1"
                  >
                    <RefreshCw className="mr-1 h-3 w-3" /> 巡检接管
                  </Button>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    try {
                      const res = await fetch("/api/hermes/skills/preload", { method: "POST" });
                      const data = await res.json();
                      if (data.success) {
                        toast(`已预加载 ${data.count} 个默认技能`, "success");
                      } else {
                        toast(data.error || "预加载失败", "error");
                      }
                    } catch {
                      toast("预加载技能失败", "error");
                    }
                  }}
                  className="w-full"
                >
                  <Sparkles className="mr-1 h-3 w-3" /> 预加载默认技能（6 个 LynnHub 技能）
                </Button>
              </div>

              {/* 任务模式学习（Task 7：auto-work） */}
              <div className="space-y-3 rounded-xl border border-border p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">🧠 任务模式学习</h3>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={fetchTaskPatterns}
                    disabled={taskPatternsLoading}
                    className="h-7 px-2 text-xs"
                  >
                    {taskPatternsLoading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-1 h-3 w-3" />}
                    刷新
                  </Button>
                </div>
                <p className="text-[10px] leading-relaxed text-muted-foreground">
                  当你做某个任务两次以上，系统会自动学习该模式并启用自动执行。下次类似任务出现时，可直接交给 Hermes 自动完成。
                </p>

                {/* 自动执行检查器 */}
                <div className="space-y-1.5 rounded-lg border border-border bg-background p-2.5">
                  <label className="text-[10px] font-medium text-muted-foreground">检查自动执行（输入任务描述测试）</label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={autoCheckInput}
                      onChange={(e) => setAutoCheckInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && !autoChecking) runAutoCheck(); }}
                      placeholder="如：创建灵感 关于AI的笔记"
                      className="flex-1 rounded border border-border bg-background px-2 py-1 text-xs outline-none focus:border-cognition"
                    />
                    <Button
                      size="sm"
                      onClick={runAutoCheck}
                      disabled={autoChecking || !autoCheckInput.trim()}
                      className="h-7 px-2 text-xs"
                    >
                      {autoChecking ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Zap className="mr-1 h-3 w-3" />}
                      检查
                    </Button>
                  </div>
                </div>

                {/* 模式列表 */}
                {taskPatterns.length === 0 ? (
                  <div className="rounded-lg bg-muted/30 p-3 text-center text-[11px] text-muted-foreground">
                    {taskPatternsLoading ? "加载中..." : "暂无学习的任务模式。多和助理互动几次，系统会自动学习。"}
                  </div>
                ) : (
                  <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                    {taskPatterns.map((p) => (
                      <div key={p.id} className="rounded-lg border border-border bg-background p-2.5 text-xs">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate font-medium text-foreground">{p.patternKey}</span>
                              {p.autoExecute && (
                                <span className="inline-flex items-center gap-0.5 rounded-full bg-green-500/15 px-1.5 py-0.5 text-[9px] font-medium text-green-600 dark:text-green-400">
                                  <Sparkles className="h-2 w-2" /> 自动
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 line-clamp-1 text-[10px] text-muted-foreground">{p.taskTemplate}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-1 text-[9px] text-muted-foreground">
                              <span>手动 {p.executionCount} 次</span>
                              <span>·</span>
                              <span>自动 {p.autoExecutedCount} 次</span>
                              {p.lastExecutedAt && (
                                <>
                                  <span>·</span>
                                  <span>最近 {new Date(p.lastExecutedAt).toLocaleDateString("zh-CN")}</span>
                                </>
                              )}
                              {p.lastAutoResult && (
                                <>
                                  <span>·</span>
                                  <span className={p.lastAutoResult === "success" ? "text-green-600 dark:text-green-400" : "text-red-500"}>
                                    {p.lastAutoResult === "success" ? "✓" : "✗"}
                                  </span>
                                </>
                              )}
                            </div>
                            {Array.isArray(p.matchKeywords) && p.matchKeywords.length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {(p.matchKeywords as string[]).slice(0, 5).map((kw) => (
                                  <span key={kw} className="rounded bg-muted px-1 py-0.5 text-[9px] text-muted-foreground">{kw}</span>
                                ))}
                                {(p.matchKeywords as string[]).length > 5 && (
                                  <span className="text-[9px] text-muted-foreground">+{(p.matchKeywords as string[]).length - 5}</span>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1">
                            <button
                              onClick={() => togglePatternAutoExecute(p.id, !p.autoExecute)}
                              title={p.autoExecute ? "关闭自动执行" : "启用自动执行"}
                              className={cn(
                                "relative h-4 w-7 rounded-full transition-colors",
                                p.autoExecute ? "bg-cognition" : "bg-muted"
                              )}
                            >
                              <span
                                className={cn(
                                  "absolute top-0.5 h-3 w-3 rounded-full bg-white transition-transform",
                                  p.autoExecute ? "translate-x-3.5" : "translate-x-0.5"
                                )}
                              />
                            </button>
                            <button
                              onClick={() => deleteTaskPattern(p.id)}
                              title="删除模式"
                              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-red-500"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
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

      {showSkillPanel && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => {
            if (!skillExecuting) {
              setShowSkillPanel(false);
              setSelectedSkill(null);
            }
          }}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl bg-card shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 头部 */}
            <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-3">
              <div className="flex items-center gap-2">
                {selectedSkill && (
                  <button
                    onClick={() => {
                      setSelectedSkill(null);
                      setSkillParams({});
                    }}
                    className="text-muted-foreground hover:text-foreground"
                    title="返回技能列表"
                  >
                    <ChevronRight className="h-4 w-4 rotate-180" />
                  </button>
                )}
                <Wrench className="h-4 w-4 text-cognition" />
                <h2 className="text-sm font-semibold">
                  {selectedSkill ? selectedSkill.name : "选择技能"}
                </h2>
              </div>
              <button
                onClick={() => {
                  if (!skillExecuting) {
                    setShowSkillPanel(false);
                    setSelectedSkill(null);
                  }
                }}
                className="rounded-full p-1 hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* 内容区 */}
            {!selectedSkill ? (
              <div className="flex min-h-0 flex-1 flex-col">
                {/* Tab 导航 */}
                <div className="flex shrink-0 items-center gap-1 border-b border-border px-3 pt-2">
                  {([
                    { key: "all", label: "全部" },
                    { key: "favorites", label: `收藏${favorites.length > 0 ? ` (${favorites.length})` : ""}` },
                    { key: "history", label: "历史" },
                    { key: "hermes", label: "Hermes" },
                  ] as const).map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => {
                        setSkillTab(tab.key);
                        if (tab.key === "hermes" && hermesSkills.length === 0) {
                          fetchHermesSkills();
                        }
                      }}
                      className={cn(
                        "border-b-2 px-3 py-2 text-xs font-medium transition-colors",
                        skillTab === tab.key
                          ? "border-cognition text-cognition"
                          : "border-transparent text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* 全部技能 / Hermes 技能：搜索 + 分类筛选 + 列表 */}
                {(skillTab === "all" || skillTab === "hermes") && (
                  <>
                    <div className="shrink-0 space-y-2 border-b border-border px-5 py-3">
                      <input
                        type="text"
                        value={skillSearch}
                        onChange={(e) => setSkillSearch(e.target.value)}
                        placeholder="搜索技能名称、描述或标签..."
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-cognition"
                      />
                      {skillTab === "all" && skillCategories.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            onClick={() => setSkillCategory("all")}
                            className={cn(
                              "rounded-full px-2.5 py-0.5 text-[11px] transition-colors",
                              skillCategory === "all"
                                ? "bg-cognition text-white"
                                : "bg-muted text-muted-foreground hover:bg-muted/70"
                            )}
                          >
                            全部
                          </button>
                          {skillCategories.map((cat) => (
                            <button
                              key={cat}
                              onClick={() => setSkillCategory(cat)}
                              className={cn(
                                "rounded-full px-2.5 py-0.5 text-[11px] transition-colors",
                                skillCategory === cat
                                  ? "bg-cognition text-white"
                                  : "bg-muted text-muted-foreground hover:bg-muted/70"
                              )}
                            >
                              {cat}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
                      {skillTab === "hermes" && (
                        <div className="mb-3 rounded-md border border-primary/30 bg-primary/5 p-2 text-[10px] text-primary">
                          Hermes Skills Hub 提供 672+ 官方技能，需先在设置中启用 Hermes Agent。
                        </div>
                      )}
                      {skillsLoading ? (
                        <div className="flex items-center justify-center py-10 text-muted-foreground">
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          <span className="text-sm">加载中...</span>
                        </div>
                      ) : (skillTab === "all" ? filteredSkills : hermesSkills).length === 0 ? (
                        skillTab === "hermes" ? (
                          <div className="flex flex-col items-center gap-3 py-10 text-center">
                            <p className="text-sm text-muted-foreground">
                              {hermesRunning
                                ? "暂无 Hermes 技能。点击「预加载默认技能」加载 6 个 LynnHub 专用技能。"
                                : "Hermes Agent 未运行，显示已学习的技能。点击「预加载默认技能」可添加技能。"}
                            </p>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={handlePreloadHermesSkills}
                              disabled={hermesPreloading}
                            >
                              {hermesPreloading ? (
                                <>
                                  <Loader2 className="mr-1 h-3 w-3 animate-spin" /> 预加载中...
                                </>
                              ) : (
                                <>
                                  <Sparkles className="mr-1 h-3 w-3" /> 预加载默认技能
                                </>
                              )}
                            </Button>
                          </div>
                        ) : (
                          <div className="py-10 text-center text-sm text-muted-foreground">
                            {skills.length === 0 ? "暂无可用技能" : "未找到匹配的技能"}
                          </div>
                        )
                      ) : (
                        <div className="space-y-2">
                          {(skillTab === "all" ? filteredSkills : hermesSkills).map((skill) => (
                            <div
                              key={skill.id}
                              className="w-full rounded-xl border border-border bg-background p-3 transition-all hover:border-cognition/40 hover:bg-cognition/5"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <button
                                  onClick={() => onSelectSkill(skill)}
                                  className="min-w-0 flex-1 text-left"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="truncate text-sm font-medium">{skill.name}</span>
                                    {skill.category && (
                                      <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                                        {skill.category}
                                      </span>
                                    )}
                                    {skill.source === "hermes" && (
                                      <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">Hermes</span>
                                    )}
                                  </div>
                                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                                    {skill.description}
                                  </p>
                                  <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground/70">
                                    <span>{skill.parameters.length} 个参数</span>
                                    <span>·</span>
                                    <span>已使用 {skill.usageCount} 次</span>
                                  </div>
                                </button>
                                <div className="flex shrink-0 items-center gap-1">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleFavorite(skill.id, skill.name, skill.category, skill.source === "hermes" ? "hermes" : "local");
                                    }}
                                    className={cn(
                                      "rounded-md p-1 transition-colors",
                                      favoriteIds.has(skill.id)
                                        ? "text-yellow-500 hover:bg-yellow-50"
                                        : "text-muted-foreground hover:bg-muted hover:text-yellow-500"
                                    )}
                                    title={favoriteIds.has(skill.id) ? "取消收藏" : "收藏"}
                                  >
                                    <Star className={cn("h-3.5 w-3.5", favoriteIds.has(skill.id) && "fill-current")} />
                                  </button>
                                  <ChevronRight
                                    className="h-4 w-4 cursor-pointer text-muted-foreground"
                                    onClick={() => onSelectSkill(skill)}
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* 收藏列表 */}
                {skillTab === "favorites" && (
                  <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
                    {favorites.length === 0 ? (
                      <div className="py-10 text-center text-sm text-muted-foreground">
                        <Star className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
                        暂无收藏的技能
                        <div className="mt-1 text-[11px]">点击技能右侧的星标按钮即可收藏</div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {favorites.map((fav) => {
                          const skill = skills.find((s) => s.id === fav.skillId);
                          return (
                            <button
                              key={fav.skillId}
                              onClick={() => skill ? onSelectSkill(skill) : toast("技能不存在", "info")}
                              className="w-full rounded-xl border border-border bg-background p-3 text-left transition-all hover:border-cognition/40 hover:bg-cognition/5"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <Star className="h-3 w-3 shrink-0 fill-yellow-400 text-yellow-400" />
                                    <span className="truncate text-sm font-medium">{fav.skillName}</span>
                                    {fav.source === "hermes" && (
                                      <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">Hermes</span>
                                    )}
                                  </div>
                                  <div className="mt-0.5 text-[10px] text-muted-foreground">{fav.category}</div>
                                </div>
                                <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* 执行历史 */}
                {skillTab === "history" && (
                  <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
                    {executions.length === 0 ? (
                      <div className="py-10 text-center text-sm text-muted-foreground">
                        <History className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
                        暂无执行历史
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {executions.map((exec) => (
                          <div
                            key={exec.id}
                            className="rounded-xl border border-border bg-background p-3"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  {exec.success ? (
                                    <CheckCircle2 className="h-3 w-3 shrink-0 text-green-500" />
                                  ) : (
                                    <AlertCircle className="h-3 w-3 shrink-0 text-red-500" />
                                  )}
                                  <span className="truncate text-sm font-medium">{exec.skillName}</span>
                                  {exec.source === "hermes" && (
                                    <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">Hermes</span>
                                  )}
                                </div>
                                <div className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">
                                  {exec.success ? exec.result.slice(0, 100) : exec.error}
                                </div>
                                <div className="mt-1 text-[10px] text-muted-foreground/70">
                                  {new Date(exec.createdAt).toLocaleString("zh-CN")} · {exec.durationMs}ms
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col">
                {/* 技能说明 */}
                <div className="shrink-0 border-b border-border px-5 py-3">
                  <p className="text-xs text-muted-foreground">{selectedSkill.description}</p>
                  {selectedSkill.tags.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {selectedSkill.tags.map((tag, i) => (
                        <span key={i} className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* 参数表单 */}
                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                  {selectedSkill.parameters.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                      此技能无需填写参数，可直接执行。
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {selectedSkill.parameters.map((param) => (
                        <div key={param.key}>
                          <label className="mb-1 block text-xs font-medium">
                            {param.label}
                            {param.required && <span className="ml-1 text-graveyard">*</span>}
                          </label>
                          {param.type === "textarea" ? (
                            <textarea
                              value={skillParams[param.key] || ""}
                              onChange={(e) =>
                                setSkillParams((prev) => ({ ...prev, [param.key]: e.target.value }))
                              }
                              placeholder={param.placeholder}
                              rows={3}
                              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-cognition"
                            />
                          ) : param.type === "select" ? (
                            <select
                              value={skillParams[param.key] || ""}
                              onChange={(e) =>
                                setSkillParams((prev) => ({ ...prev, [param.key]: e.target.value }))
                              }
                              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-cognition"
                            >
                              <option value="">请选择...</option>
                              {(param.options || []).map((opt) => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type={param.type === "number" ? "number" : param.type === "date" ? "date" : "text"}
                              value={skillParams[param.key] || ""}
                              onChange={(e) =>
                                setSkillParams((prev) => ({ ...prev, [param.key]: e.target.value }))
                              }
                              placeholder={param.placeholder}
                              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-cognition"
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 执行按钮 */}
                <div className="shrink-0 border-t border-border px-5 py-3">
                  <Button
                    onClick={executeSkill}
                    disabled={skillExecuting}
                    className="w-full"
                  >
                    {skillExecuting ? (
                      <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> 执行中...</>
                    ) : (
                      <><Zap className="mr-1 h-3.5 w-3.5" /> 执行技能</>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

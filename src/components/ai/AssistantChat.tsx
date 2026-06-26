"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Send,
  Loader2,
  Phone,
  PhoneOff,
  Mic,
  Headphones,
  Bot,
  X,
  Wrench,
  ChevronDown,
  ChevronRight,
  MessageSquare,
} from "lucide-react";
import { LarkTaskCard, type LarkTaskCardData } from "@/components/ai/LarkTaskCard";
import { ModelSwitcher, type ModelSwitcherValue } from "@/components/ui/ModelSwitcher";
import { toast } from "@/components/ui/toast";
import { QUICK_COMMANDS, type QuickCommand } from "@/lib/ai-assistant-tools";
import { VoiceVAD } from "@/lib/voice-vad";
import { StreamASR, isStreamASRSupported } from "@/lib/voice-asr-stream";
import { StreamTTS } from "@/lib/voice-tts-stream";
import { BackchannelPlayer } from "@/lib/voice-backchannel";
import { useWorkspace } from "@/hooks/use-workspace";

/**
 * 工具调用字段：当 type === "larkTaskCard" 时渲染飞书任务卡片。
 * （旧字段，保留向后兼容）
 */
export interface ToolCall {
  type: string;
  data: unknown;
}

/** 工具调用信息（与主页面 / 后端 assistantMode 返回一致） */
export interface ToolCalled {
  tool: string;
  args: Record<string, any>;
  result: any;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  /** 旧字段：保留向后兼容（larkTaskCard） */
  toolCall?: ToolCall;
  /** 新字段：与主页面一致，承载 assistantMode 返回的工具调用 */
  toolCalled?: ToolCalled | null;
  /** 标记本条回复由 Hermes Agent 生成 */
  hermesMode?: boolean;
  /** 标记 Hermes 失败后回退到 LLM 模式 */
  hermesFallback?: boolean;
}

/** 历史会话条目（GET /api/ai/chat/sessions 返回） */
interface SessionListItem {
  id: string;
  title: string;
  updatedAt: string;
  messageCount: number;
  pinned: boolean;
}

export interface AssistantChatProps {
  /** 可选：关闭按钮回调（抽屉场景传入） */
  onClose?: () => void;
}

interface AssistantSettings {
  assistantName: string;
  assistantAvatar: string;
  avatarUrl: string | null;
}

const DEFAULT_SETTINGS: AssistantSettings = {
  assistantName: "Lynn",
  assistantAvatar: "🤖",
  avatarUrl: null,
};

type VoicePhase = "listening" | "speaking" | "thinking" | "replying";

/** AI 助理模式返回结果（与后端 /api/ai/chat assistantMode 响应一致） */
interface AssistantModeResponse {
  content: string;
  provider?: string;
  model?: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  toolCalled?: ToolCalled | null;
  hermesMode?: boolean;
  hermesFallback?: boolean;
}

/** 生成工具调用结果的简短摘要（与主页面 summarizeToolResult 一致） */
function summarizeToolResult(result: any): string {
  if (!result) return "无结果";
  if (result.error) return `失败：${String(result.error).slice(0, 30)}`;
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

/** 判断 toolCalled 是否为飞书任务卡片类型 */
function isLarkTaskCardTool(tc: ToolCalled | null | undefined): boolean {
  return !!tc && tc.tool === "createLarkTask" && tc.result?.type === "larkTaskCard" && !!tc.result?.data;
}

/**
 * 增强版 AI 助理聊天组件
 * - 顶部 header：AI 头像 + 会话标题（可切换）+ ModelSwitcher + 语音通话按钮
 * - 消息列表：可滚动，AI 消息带小头像
 * - 快捷技能：输入框上方横向滚动
 * - 输入区：固定底部
 * - 全双工语音：VAD + 流式 ASR + 流式 TTS + 后缀音 + 用户开口打断
 * - 与主页面 /ai/assistant 共享同一会话（/api/ai/chat/sessions）
 */
export function AssistantChat({ onClose }: AssistantChatProps = {}) {
  // ===== 职业工作空间（4 维度：快捷技能可见集 / system prompt / 默认模型 / 工具白名单）=====
  const { workspace, profession } = useWorkspace();
  // 过滤后的快捷技能：职业工作空间内 quickCommands 非空时只显示 label 命中项，否则显示全部
  const visibleQuickCommands: QuickCommand[] =
    workspace?.quickCommands && workspace.quickCommands.length > 0
      ? QUICK_COMMANDS.filter((cmd) =>
          workspace.quickCommands.some(
            (qc) => (qc.label || "").trim() === cmd.label
          )
        )
      : QUICK_COMMANDS;

  // ===== 消息 / 输入 / 设置 =====
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<AssistantSettings>(DEFAULT_SETTINGS);
  // 初始 model 配置：用户没选过（首次加载）时使用职业工作空间默认值
  const [modelInitialized, setModelInitialized] = useState(false);
  const [modelConfig, setModelConfig] = useState<ModelSwitcherValue>({
    provider: "deepseek",
    model: "deepseek-chat",
    reasoningMode: "standard",
  });

  // 应用职业工作空间默认 model（仅初始化一次，用户手动切换后不再覆盖）
  useEffect(() => {
    if (modelInitialized || !workspace) return;
    const provider = workspace.defaultProvider as
      | "deepseek"
      | "mimo"
      | undefined;
    if (provider === "deepseek" || provider === "mimo") {
      const allowedModes = ["fast", "standard", "deep", "thinking"] as const;
      type AllowedMode = (typeof allowedModes)[number];
      const reqMode = workspace.defaultReasoningMode as
        | AllowedMode
        | undefined;
      const newMode =
        reqMode && allowedModes.includes(reqMode) ? reqMode : null;
      setModelConfig((prev) => ({
        provider,
        model: workspace.defaultModel || prev.model,
        reasoningMode: (newMode || prev.reasoningMode) as ModelSwitcherValue["reasoningMode"],
      }));
    }
    setModelInitialized(true);
  }, [workspace, modelInitialized]);

  // ===== 会话管理 state（与主页面共享同一会话）=====
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [currentSessionTitle, setCurrentSessionTitle] = useState<string>("新对话");
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [showSessionList, setShowSessionList] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(true);
  // 工具调用卡片展开状态（按消息索引记录）
  const [expandedTools, setExpandedTools] = useState<Set<number>>(new Set());

  // ===== 全双工语音通话状态 =====
  const [voiceCallActive, setVoiceCallActive] = useState(false);
  const [voiceCallPhase, setVoiceCallPhase] = useState<VoicePhase>("listening");
  const [voiceVolume, setVoiceVolume] = useState(0);
  const [voiceStreamSupported] = useState<boolean>(
    () => typeof window !== "undefined" && isStreamASRSupported(),
  );

  // 全双工引擎实例 refs
  const voiceCallStreamRef = useRef<MediaStream | null>(null);
  const voiceVadRef = useRef<VoiceVAD | null>(null);
  const streamAsrRef = useRef<StreamASR | null>(null);
  const streamTtsRef = useRef<StreamTTS | null>(null);
  const backchannelRef = useRef<BackchannelPlayer | null>(null);
  const voiceModeActiveRef = useRef(false);
  const voiceCallPhaseRef = useRef<VoicePhase>("listening");
  const voiceSendLockRef = useRef(false);
  // 防止 stale closure：用 ref 持有最新的 sendVoice / handleSpeechEnd / sendText
  const sendVoiceRef = useRef<(text: string) => Promise<void>>(async () => {});
  const handleSpeechEndRef = useRef<() => void>(() => {});
  const sendTextRef = useRef<(text: string) => Promise<void>>(async () => {});
  // 会话 id / model / messages 的 ref：异步回调中读取最新值，避免读到旧 state
  const currentSessionIdRef = useRef<string | null>(null);
  const modelConfigRef = useRef<ModelSwitcherValue>(modelConfig);
  const messagesRef = useRef<ChatMessage[]>([]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const sessionListRef = useRef<HTMLDivElement | null>(null);

  // 同步 ref 与 state
  useEffect(() => {
    currentSessionIdRef.current = currentSessionId;
  }, [currentSessionId]);
  useEffect(() => {
    modelConfigRef.current = modelConfig;
  }, [modelConfig]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // ===== 拉取 AI 设置 =====
  useEffect(() => {
    let cancelled = false;
    fetch("/api/ai/settings")
      .then((r) => r.json())
      .then((data: { settings?: Partial<AssistantSettings> }) => {
        if (cancelled || !data.settings) return;
        setSettings({
          assistantName: data.settings.assistantName || "Lynn",
          assistantAvatar: data.settings.assistantAvatar || "🤖",
          avatarUrl: data.settings.avatarUrl || null,
        });
      })
      .catch(() => {
        /* noop */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // ===== 自动滚动到底部 =====
  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // ===== 卸载时中断未完成的请求和语音资源 =====
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      voiceModeActiveRef.current = false;
      voiceVadRef.current?.stop();
      streamAsrRef.current?.stop();
      streamTtsRef.current?.stop();
      if (voiceCallStreamRef.current) {
        voiceCallStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  /** 同步 phase state 与 ref（避免异步回调闭包读到旧值） */
  const setPhase = useCallback((p: VoicePhase) => {
    voiceCallPhaseRef.current = p;
    setVoiceCallPhase(p);
  }, []);

  // ===== 会话管理：与主页面 /api/ai/chat/sessions 共享 =====
  const fetchSessions = useCallback(async (): Promise<SessionListItem[]> => {
    try {
      const res = await fetch("/api/ai/chat/sessions?limit=10");
      const data = await res.json();
      if (data.sessions) {
        const list = data.sessions as SessionListItem[];
        setSessions(list);
        return list;
      }
    } catch {
      /* noop */
    }
    return [];
  }, []);

  const loadSession = useCallback(async (sessionId: string) => {
    try {
      const res = await fetch(`/api/ai/chat/sessions/${sessionId}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.session) {
        setCurrentSessionId(sessionId);
        currentSessionIdRef.current = sessionId;
        setCurrentSessionTitle(data.session.title || "新对话");
        const loaded: ChatMessage[] = (data.session.messages || []).map((m: any) => ({
          role: m.role as "user" | "assistant",
          content: m.content || "",
        }));
        setMessages(loaded);
        messagesRef.current = loaded;
      }
    } catch {
      /* noop */
    }
  }, []);

  const createNewSession = useCallback(async () => {
    try {
      const res = await fetch("/api/ai/chat/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "新对话",
          provider: modelConfigRef.current.provider,
          model: modelConfigRef.current.model,
        }),
      });
      const data = await res.json();
      if (data.session) {
        setCurrentSessionId(data.session.id);
        currentSessionIdRef.current = data.session.id;
        setCurrentSessionTitle("新对话");
        setMessages([]);
        messagesRef.current = [];
        void fetchSessions();
      }
    } catch {
      /* noop */
    }
  }, [fetchSessions]);

  // 初始化：加载最近会话或创建新会话（与主页面行为一致）
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await fetchSessions();
      if (cancelled) return;
      if (list.length > 0) {
        await loadSession(list[0].id);
      } else {
        await createNewSession();
      }
      if (!cancelled) setSessionLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 点击会话下拉外部时关闭
  useEffect(() => {
    if (!showSessionList) return;
    const handler = (e: MouseEvent) => {
      if (sessionListRef.current && !sessionListRef.current.contains(e.target as Node)) {
        setShowSessionList(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showSessionList]);

  const toggleToolExpand = useCallback((idx: number) => {
    setExpandedTools((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }, []);

  /** 切换到指定会话 */
  const handleSwitchSession = useCallback(
    async (sessionId: string) => {
      setShowSessionList(false);
      if (sessionId === currentSessionIdRef.current) return;
      abortRef.current?.abort();
      await loadSession(sessionId);
    },
    [loadSession],
  );

  /** 开启新对话 */
  const handleNewSession = useCallback(async () => {
    setShowSessionList(false);
    abortRef.current?.abort();
    await createNewSession();
  }, [createNewSession]);

  // ===== 文本模式发送（含快捷技能复用）=====
  const sendText = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content || sending) return;

      const userMsg: ChatMessage = { role: "user", content };
      // 构建 API 消息（读取最新 messages，避免 stale closure）
      const apiMessages = [...messagesRef.current, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      setMessages((prev) => [
        ...prev,
        userMsg,
        { role: "assistant", content: "" },
      ]);
      messagesRef.current = [...messagesRef.current, userMsg, { role: "assistant", content: "" }];
      setInput("");
      setSending(true);
      setError(null);

      // 持久化用户消息到当前会话（非阻塞）
      const sessionId = currentSessionIdRef.current;
      if (sessionId) {
        fetch(`/api/ai/chat/sessions/${sessionId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: "user", content }),
        }).catch(() => {
          /* noop */
        });
      }

      const controller = new AbortController();
      abortRef.current = controller;
      const cfg = modelConfigRef.current;

      try {
        // 调用 AI 助理模式（非流式，支持 Function Calling，与主页面一致）
        const res = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: apiMessages,
            provider: cfg.provider,
            model: cfg.model || undefined,
            reasoningMode: cfg.reasoningMode,
            stream: false,
            assistantMode: true,
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => null);
          throw new Error(errData?.error || `请求失败（${res.status}）`);
        }

        const data = (await res.json()) as AssistantModeResponse;
        const aiContent: string = data.content || "(空回复)";
        const toolCalled: ToolCalled | null = data.toolCalled || null;

        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last && last.role === "assistant") {
            next[next.length - 1] = {
              ...last,
              content: aiContent,
              toolCalled,
              hermesMode: data.hermesMode === true ? true : undefined,
              hermesFallback: data.hermesFallback === true ? true : undefined,
            };
          }
          messagesRef.current = next;
          return next;
        });

        // 持久化 AI 回复到当前会话（非阻塞），并刷新会话列表（标题可能已自动更新）
        if (sessionId && aiContent) {
          fetch(`/api/ai/chat/sessions/${sessionId}/messages`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              role: "assistant",
              content: aiContent,
              provider: data.provider,
              model: data.model,
              tokens: data.usage?.total_tokens,
            }),
          }).catch(() => {
            /* noop */
          });
          void fetchSessions().then((list) => {
            const cur = list.find((s) => s.id === sessionId);
            if (cur) setCurrentSessionTitle(cur.title);
          });
        }
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setError((e as Error).message || "发送失败，请重试");
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last && last.role === "assistant" && last.content === "") {
            next.pop();
          }
          messagesRef.current = next;
          return next;
        });
      } finally {
        setSending(false);
        abortRef.current = null;
      }
    },
    [sending, fetchSessions],
  );

  // 同步 sendText 到 ref（供快捷技能 / sendMessage 等回调使用最新闭包）
  useEffect(() => {
    sendTextRef.current = sendText;
  }, [sendText]);

  const sendMessage = useCallback(() => {
    void sendTextRef.current(input);
  }, [input]);

  // ===== 全双工语音：调用 assistantMode 非流式，拿到完整回复后 TTS 播放 =====
  const sendVoice = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content) return;

      // 停止旧 TTS，准备接收新回复
      streamTtsRef.current?.stop();
      streamTtsRef.current?.reset();

      const userMsg: ChatMessage = { role: "user", content };
      // 读取最新 messages，避免 stale closure
      const apiMessages = [...messagesRef.current, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      setMessages((prev) => [
        ...prev,
        userMsg,
        { role: "assistant", content: "" },
      ]);
      messagesRef.current = [...messagesRef.current, userMsg, { role: "assistant", content: "" }];
      setInput("");
      setSending(true);
      setError(null);
      setPhase("thinking");

      const tts = streamTtsRef.current;
      if (tts) {
        tts.reset();
        tts.onPlayStart = () => {
          if (voiceModeActiveRef.current) setPhase("replying");
        };
        tts.onComplete = () => {
          if (
            voiceModeActiveRef.current &&
            voiceCallPhaseRef.current === "replying"
          ) {
            setPhase("listening");
          }
        };
      }

      const controller = new AbortController();
      abortRef.current = controller;

      // 持久化用户消息到当前会话（非阻塞）
      const sessionId = currentSessionIdRef.current;
      if (sessionId) {
        fetch(`/api/ai/chat/sessions/${sessionId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: "user", content }),
        }).catch(() => {
          /* noop */
        });
      }

      const cfg = modelConfigRef.current;
      try {
        const res = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: apiMessages,
            provider: cfg.provider,
            model: cfg.model || undefined,
            reasoningMode: cfg.reasoningMode,
            stream: false,
            assistantMode: true,
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => null);
          throw new Error(errData?.error || `请求失败（${res.status}）`);
        }

        const data = (await res.json()) as AssistantModeResponse;
        const aiContent: string = data.content || "(空回复)";
        const toolCalled: ToolCalled | null = data.toolCalled || null;

        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last && last.role === "assistant") {
            next[next.length - 1] = {
              ...last,
              content: aiContent,
              toolCalled,
              hermesMode: data.hermesMode === true ? true : undefined,
              hermesFallback: data.hermesFallback === true ? true : undefined,
            };
          }
          messagesRef.current = next;
          return next;
        });

        // 持久化 AI 回复并刷新会话列表（非阻塞）
        if (sessionId && aiContent) {
          fetch(`/api/ai/chat/sessions/${sessionId}/messages`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              role: "assistant",
              content: aiContent,
              provider: data.provider,
              model: data.model,
              tokens: data.usage?.total_tokens,
            }),
          }).catch(() => {
            /* noop */
          });
          void fetchSessions().then((list) => {
            const cur = list.find((s) => s.id === sessionId);
            if (cur) setCurrentSessionTitle(cur.title);
          });
        }

        // 拿到完整回复后一次性喂给 TTS 播放
        if (tts && aiContent) {
          tts.feed(aiContent);
          tts.finish();
        }
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setError((e as Error).message || "发送失败，请重试");
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last && last.role === "assistant" && last.content === "") {
            next.pop();
          }
          messagesRef.current = next;
          return next;
        });
      } finally {
        setSending(false);
        abortRef.current = null;
        // TTS 仍在播放时保持 replying，否则回到聆听
        if (voiceModeActiveRef.current && !streamTtsRef.current?.isPlaying) {
          setPhase("listening");
        }
      }
    },
    [setPhase, fetchSessions],
  );

  /** VAD 检测到说话结束：取 ASR 累积文字立即提交，重置 ASR */
  const handleVoiceSpeechEnd = useCallback(() => {
    if (!voiceModeActiveRef.current || voiceSendLockRef.current) return;
    const asr = streamAsrRef.current;
    if (!asr) return;
    const text = asr.getAccumulatedText();
    asr.reset();
    setInput("");
    if (text && text.length >= 2) {
      voiceSendLockRef.current = true;
      setPhase("thinking");
      sendVoiceRef.current(text).finally(() => {
        voiceSendLockRef.current = false;
      });
    } else {
      setPhase("listening");
    }
  }, [setPhase]);

  // 通过 ref 持有最新闭包，避免 VAD 回调读到旧的 messages
  useEffect(() => {
    sendVoiceRef.current = sendVoice;
    handleSpeechEndRef.current = handleVoiceSpeechEnd;
  });

  // ===== 接通语音通话 =====
  const startVoiceCall = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        toast("当前环境不支持语音对话", "error");
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      voiceCallStreamRef.current = stream;
      voiceModeActiveRef.current = true;
      voiceSendLockRef.current = false;
      setVoiceCallActive(true);
      setVoiceVolume(0);
      setPhase("listening");
      setInput("");

      // 初始化流式 TTS（拿到完整回复后分句播放）
      const tts = new StreamTTS();
      streamTtsRef.current = tts;
      tts.onPlayStart = () => {
        if (voiceModeActiveRef.current) setPhase("replying");
      };
      tts.onComplete = () => {
        if (
          voiceModeActiveRef.current &&
          voiceCallPhaseRef.current === "replying"
        ) {
          setPhase("listening");
        }
      };

      backchannelRef.current = new BackchannelPlayer();

      if (!voiceStreamSupported) {
        // 浏览器不支持流式 ASR：回退到普通文本输入
        toast("浏览器不支持流式 ASR，请使用文本输入", "info");
        return;
      }

      // 流式 ASR：边说边出文字显示在输入框
      const asr = new StreamASR({
        onInterim: () => {
          if (!voiceModeActiveRef.current) return;
          setInput(streamAsrRef.current?.getAccumulatedText() ?? "");
        },
        onFinal: () => {
          if (!voiceModeActiveRef.current) return;
          setInput(streamAsrRef.current?.getAccumulatedText() ?? "");
        },
        onError: (err) => {
          console.warn("[Voice ASR]", err);
        },
      });
      streamAsrRef.current = asr;
      asr.start();

      // VAD：持续监听，检测说话起止
      const vad = new VoiceVAD(stream, {
        onSpeechStart: () => {
          if (!voiceModeActiveRef.current) return;
          setPhase("speaking");
          // 全双工：用户开口立即打断 TTS 播放
          if (streamTtsRef.current?.isPlaying) {
            streamTtsRef.current.stop();
          }
        },
        onShortPause: () => {
          if (!voiceModeActiveRef.current) return;
          backchannelRef.current?.play();
        },
        onSpeechEnd: () => {
          if (!voiceModeActiveRef.current) return;
          handleSpeechEndRef.current();
        },
        onVolumeChange: (v) => {
          if (voiceModeActiveRef.current) setVoiceVolume(v);
        },
      });
      voiceVadRef.current = vad;
      vad.start();

      toast("语音通话已接通，开始说话即可", "success");
    } catch (e) {
      toast("无法访问麦克风：" + (e as Error).message, "error");
      stopVoiceCall();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceStreamSupported, setPhase]);

  // ===== 挂断语音通话 =====
  const stopVoiceCall = useCallback(() => {
    voiceModeActiveRef.current = false;
    voiceVadRef.current?.stop();
    voiceVadRef.current = null;
    streamAsrRef.current?.stop();
    streamAsrRef.current = null;
    streamTtsRef.current?.stop();
    streamTtsRef.current = null;
    backchannelRef.current = null;
    if (voiceCallStreamRef.current) {
      voiceCallStreamRef.current.getTracks().forEach((t) => t.stop());
      voiceCallStreamRef.current = null;
    }
    setVoiceCallActive(false);
    setPhase("listening");
    setVoiceVolume(0);
    voiceSendLockRef.current = false;
    setInput("");
  }, [setPhase]);

  // ===== 快捷技能：点击把内容填入输入框（不发送），与主页面 /ai/assistant 一致 =====
  const handleQuickCommand = useCallback((cmd: QuickCommand) => {
    if (sending) return;
    setInput((prev) => (prev ? `${prev}\n${cmd.message}` : cmd.message));
    // 聚焦输入框（setTimeout 确保 setInput 渲染完成后再 focus）
    setTimeout(() => textareaRef.current?.focus(), 0);
  }, [sending]);

  // 受控 ref 持有 textarea DOM 节点（用于快捷技能点击后聚焦）
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  // 技能下拉菜单状态
  const [showSkillMenu, setShowSkillMenu] = useState(false);
  const skillMenuRef = useRef<HTMLDivElement | null>(null);

  // 点击外部关闭技能下拉
  useEffect(() => {
    if (!showSkillMenu) return;
    const handler = (e: MouseEvent) => {
      if (skillMenuRef.current && !skillMenuRef.current.contains(e.target as Node)) {
        setShowSkillMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showSkillMenu]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const isEmpty = messages.length === 0;
  const displayName = settings.assistantName || "Lynn";

  return (
    <div className="flex h-full flex-col bg-background">
      {/* ===== Header：AI 头像 + 会话标题（可切换）+ ModelSwitcher + 语音按钮 ===== */}
      <header className="relative flex shrink-0 items-center justify-between gap-2 border-b border-border bg-background px-3 py-2.5">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-primary-foreground">
            {settings.avatarUrl ? (
              <img
                src={settings.avatarUrl}
                alt="avatar"
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-base leading-none">
                {settings.assistantAvatar}
              </span>
            )}
          </div>
          {/* 会话标题切换器：点击展开下拉切换/新建会话 */}
          <div ref={sessionListRef} className="relative min-w-0 flex-1">
            <button
              type="button"
              onClick={() => setShowSessionList((v) => !v)}
              disabled={sessionLoading}
              aria-label="切换会话"
              title="切换会话"
              className="flex min-w-0 max-w-full items-center gap-1 rounded-md px-1 py-0.5 text-left transition-colors hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
            >
              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold text-foreground">
                  {currentSessionTitle || "新对话"}
                </h2>
                <p className="truncate text-[10px] text-muted-foreground">
                  {sessionLoading
                    ? "加载会话中..."
                    : voiceCallActive
                    ? "语音通话中"
                    : workspace
                    ? `${workspace.icon} ${workspace.displayName} · 共享会话`
                    : `${displayName} · 共享会话`}
                </p>
              </div>
              <ChevronDown
                className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${
                  showSessionList ? "rotate-180" : ""
                }`}
              />
            </button>

            {/* 会话下拉列表 */}
            {showSessionList && (
              <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-hidden rounded-lg border border-border bg-card shadow-lg">
                <div className="flex items-center justify-between border-b border-border px-2 py-1.5">
                  <span className="text-[10px] font-medium text-muted-foreground">
                    历史会话
                  </span>
                  <button
                    type="button"
                    onClick={handleNewSession}
                    disabled={sending || voiceCallActive}
                    className="rounded px-1.5 py-0.5 text-[10px] font-medium text-northstar transition-colors hover:bg-northstar/10 disabled:opacity-50"
                  >
                    + 新对话
                  </button>
                </div>
                <div className="max-h-56 overflow-y-auto">
                  {sessions.length === 0 ? (
                    <p className="py-4 text-center text-[11px] text-muted-foreground">
                      暂无历史会话
                    </p>
                  ) : (
                    sessions.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => handleSwitchSession(s.id)}
                        disabled={sending}
                        className={`flex w-full items-center gap-1.5 px-2.5 py-1.5 text-left text-[11px] transition-colors hover:bg-muted/60 disabled:opacity-50 ${
                          s.id === currentSessionId
                            ? "bg-cognition/10 text-cognition"
                            : "text-foreground"
                        }`}
                      >
                        <MessageSquare className="h-3 w-3 shrink-0 text-muted-foreground" />
                        <span className="flex-1 truncate">{s.title}</span>
                        <span className="shrink-0 text-[9px] text-muted-foreground">
                          {s.messageCount}条
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <ModelSwitcher value={modelConfig} onChange={setModelConfig} />
          <button
            type="button"
            onClick={voiceCallActive ? stopVoiceCall : startVoiceCall}
            aria-label={voiceCallActive ? "挂断" : "接通语音通话"}
            title={voiceCallActive ? "挂断" : "接通语音通话"}
            className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              voiceCallActive
                ? "bg-graveyard/10 text-graveyard hover:bg-graveyard/20"
                : "bg-primary text-primary-foreground hover:opacity-90"
            }`}
          >
            {voiceCallActive ? (
              <PhoneOff className="h-4 w-4" />
            ) : (
              <Phone className="h-4 w-4" />
            )}
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="关闭"
              title="关闭"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </header>

      {/* ===== 语音通话状态条 ===== */}
      {voiceCallActive && (
        <div className="flex shrink-0 items-center gap-2 border-b border-cognition/20 bg-cognition/5 px-3 py-1.5">
          <div
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
              voiceCallPhase === "listening"
                ? "bg-northstar animate-pulse"
                : voiceCallPhase === "speaking"
                ? "bg-cognition animate-pulse"
                : voiceCallPhase === "thinking"
                ? "bg-muted"
                : "bg-cognition/70"
            }`}
          >
            {voiceCallPhase === "listening" ? (
              <Headphones className="h-3.5 w-3.5 text-white" />
            ) : voiceCallPhase === "speaking" ? (
              <Mic className="h-3.5 w-3.5 text-white" />
            ) : voiceCallPhase === "thinking" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            ) : (
              <Bot className="h-3.5 w-3.5 text-white" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-foreground">
              {voiceCallPhase === "listening"
                ? "正在聆听..."
                : voiceCallPhase === "speaking"
                ? "正在说话..."
                : voiceCallPhase === "thinking"
                ? "AI 思考中..."
                : "AI 回复中..."}
            </p>
          </div>
          {/* 实时音量波形 */}
          <div className="flex h-4 items-center gap-0.5">
            {[0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className="w-0.5 rounded-full bg-cognition/60 transition-all"
                style={{
                  height: `${3 + Math.min(12, voiceVolume * 60 * (1 - Math.abs(i - 2) / 3))}px`,
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* ===== 消息列表（可滚动）===== */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3">
        {isEmpty ? (
          <div className="flex h-full items-center justify-center">
            <div className="flex max-w-[85%] items-end gap-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-primary-foreground">
                {settings.avatarUrl ? (
                  <img
                    src={settings.avatarUrl}
                    alt="avatar"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-sm leading-none">
                    {settings.assistantAvatar}
                  </span>
                )}
              </div>
              <p className="rounded-2xl rounded-tl-sm bg-muted px-3.5 py-2.5 text-sm text-foreground">
                {sessionLoading
                  ? "正在加载会话..."
                  : `你好，我是 ${displayName}，有什么可以帮你？`}
              </p>
            </div>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {messages.map((m, i) => {
              const isUser = m.role === "user";
              const isStreaming =
                !isUser && sending && i === messages.length - 1;
              // 飞书任务卡片：优先从 toolCalled（新主路径）提取，回退到旧 toolCall 字段
              const larkCard: LarkTaskCardData | undefined = !isUser
                ? isLarkTaskCardTool(m.toolCalled)
                  ? (m.toolCalled!.result.data as LarkTaskCardData)
                  : m.toolCall?.type === "larkTaskCard"
                  ? (m.toolCall.data as LarkTaskCardData | undefined)
                  : undefined
                : undefined;
              // 通用工具调用卡片：非飞书任务卡片的 toolCalled
              const showGenericTool =
                !isUser &&
                !isStreaming &&
                !!m.toolCalled &&
                !isLarkTaskCardTool(m.toolCalled);
              return (
                <li key={i} className="flex flex-col gap-1.5">
                  <div
                    className={`flex items-end gap-2 ${
                      isUser ? "justify-end" : "justify-start"
                    }`}
                  >
                    {!isUser && (
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-primary-foreground">
                        {settings.avatarUrl ? (
                          <img
                            src={settings.avatarUrl}
                            alt="avatar"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="text-xs leading-none">
                            {settings.assistantAvatar}
                          </span>
                        )}
                      </div>
                    )}
                    <div
                      className={`max-w-[80%] whitespace-pre-wrap break-words px-3.5 py-2 text-sm leading-relaxed ${
                        isUser
                          ? "rounded-2xl rounded-tr-sm bg-primary text-primary-foreground"
                          : "rounded-2xl rounded-tl-sm bg-muted text-foreground"
                      }`}
                    >
                      {m.content}
                      {isStreaming && (
                        <span className="ml-0.5 inline-block animate-pulse text-foreground">
                          ▋
                        </span>
                      )}
                    </div>
                  </div>
                  {/* 飞书任务卡片 */}
                  {larkCard && <LarkTaskCard {...larkCard} />}
                  {/* 通用工具调用卡片（可展开查看参数与完整结果） */}
                  {showGenericTool && m.toolCalled && (
                    <div className="ml-8 max-w-[85%] overflow-hidden rounded-xl border border-cognition/30 bg-cognition/5">
                      <button
                        type="button"
                        onClick={() => toggleToolExpand(i)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-cognition/10"
                      >
                        <Wrench className="h-3.5 w-3.5 shrink-0 text-cognition" />
                        <span className="text-xs font-medium text-cognition">
                          工具调用：{m.toolCalled.tool}
                        </span>
                        <span className="ml-auto truncate text-[10px] text-muted-foreground">
                          {summarizeToolResult(m.toolCalled.result)}
                        </span>
                        {expandedTools.has(i) ? (
                          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        )}
                      </button>
                      {expandedTools.has(i) && (
                        <div className="border-t border-cognition/20 px-3 py-2">
                          <div className="mb-1.5 text-[10px] text-muted-foreground">
                            参数：
                          </div>
                          <pre className="mb-2 overflow-x-auto rounded-lg bg-muted/50 p-2 text-[11px] leading-relaxed">
                            <code className="font-mono text-foreground">
                              {JSON.stringify(m.toolCalled.args, null, 2)}
                            </code>
                          </pre>
                          <div className="mb-1.5 text-[10px] text-muted-foreground">
                            结果：
                          </div>
                          <pre className="max-h-60 overflow-auto rounded-lg bg-muted/50 p-2 text-[11px] leading-relaxed">
                            <code className="font-mono text-foreground">
                              {JSON.stringify(m.toolCalled.result, null, 2)}
                            </code>
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* ===== 错误提示 ===== */}
      {error && (
        <div className="shrink-0 px-3 pb-1 text-xs text-graveyard">{error}</div>
      )}

      {/* ===== 快捷技能区（输入框上方，横向滚动）===== */}
      {!voiceCallActive && (
        <div className="shrink-0 border-t border-border bg-background px-2 py-2">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {/* 「技能」下拉：点击展开所有 6 个快捷技能，选中后填入输入框 */}
            <div ref={skillMenuRef} className="relative shrink-0">
              <button
                type="button"
                onClick={() => setShowSkillMenu((v) => !v)}
                disabled={sending}
                title="选择技能填入输入框"
                aria-label="选择技能"
                className="inline-flex items-center gap-1 rounded-full border border-cognition/40 bg-cognition/5 px-2 py-1 text-[11px] font-medium text-cognition transition-all hover:bg-cognition/10 disabled:opacity-50"
              >
                <Wrench className="h-3 w-3" />
                <span>技能</span>
                <ChevronDown
                  className={`h-3 w-3 transition-transform ${showSkillMenu ? "rotate-180" : ""}`}
                />
              </button>
              {showSkillMenu && (
                <div className="absolute bottom-full left-0 z-50 mb-1 w-56 max-h-72 overflow-hidden rounded-lg border border-border bg-card shadow-lg">
                  <div className="border-b border-border px-2 py-1.5">
                    <span className="text-[10px] font-medium text-muted-foreground">
                      选择技能（点击填入输入框）
                    </span>
                  </div>
                  <div className="max-h-56 overflow-y-auto">
                    {QUICK_COMMANDS.map((cmd, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          setShowSkillMenu(false);
                          handleQuickCommand(cmd);
                        }}
                        disabled={sending}
                        title={cmd.description}
                        className="flex w-full items-start gap-2 px-2.5 py-1.5 text-left text-[11px] text-foreground transition-colors hover:bg-muted/60 disabled:opacity-50"
                      >
                        <span className="text-sm leading-none">{cmd.icon}</span>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium">{cmd.label}</div>
                          <div className="mt-0.5 truncate text-[10px] text-muted-foreground">
                            {cmd.description}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {visibleQuickCommands.map((cmd, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleQuickCommand(cmd)}
                disabled={sending}
                title={cmd.description}
                className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-card px-2 py-1 text-[11px] text-foreground transition-all hover:border-cognition/40 hover:bg-cognition/5 disabled:opacity-50"
              >
                <span className="text-xs">{cmd.icon}</span>
                <span>{cmd.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ===== 输入区（固定底部）===== */}
      <div className="shrink-0 border-t border-border bg-background px-3 py-2.5">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={sending || voiceCallActive}
            rows={1}
            placeholder={
              voiceCallActive
                ? voiceStreamSupported
                  ? "说话即可，文字将自动显示..."
                  : "语音模式（当前浏览器不支持流式 ASR）"
                : sending
                ? "AI 思考中..."
                : "输入消息，Enter 发送，Shift+Enter 换行"
            }
            className="max-h-32 min-h-[40px] flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-70"
          />
          <button
            type="button"
            onClick={sendMessage}
            disabled={sending || !input.trim() || voiceCallActive}
            aria-label="发送"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

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
} from "lucide-react";
import { LarkTaskCard, type LarkTaskCardData } from "@/components/ai/LarkTaskCard";
import { ModelSwitcher, type ModelSwitcherValue } from "@/components/ui/ModelSwitcher";
import { toast } from "@/components/ui/toast";
import { QUICK_COMMANDS, type QuickCommand } from "@/lib/ai-assistant-tools";
import { VoiceVAD } from "@/lib/voice-vad";
import { StreamASR, isStreamASRSupported } from "@/lib/voice-asr-stream";
import { StreamTTS } from "@/lib/voice-tts-stream";
import { BackchannelPlayer } from "@/lib/voice-backchannel";

/**
 * 工具调用字段：当 type === "larkTaskCard" 时渲染飞书任务卡片。
 */
export interface ToolCall {
  type: string;
  data: unknown;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  /** 预留：后续用于渲染工具调用卡片（如飞书任务） */
  toolCall?: ToolCall;
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

/**
 * 读取 /api/ai/chat SSE 流，逐 delta 回调。
 * 抽出为模块级函数，避免 sendMessage / sendVoice 重复代码。
 */
async function readChatStream(
  res: Response,
  onDelta: (chunk: string) => void,
): Promise<void> {
  if (!res.ok || !res.body) {
    throw new Error(`HTTP ${res.status}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() || "";
    for (const part of parts) {
      for (const line of part.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const data = trimmed.slice(5).trim();
        if (!data) continue;
        let evt: { type: string; content?: string; message?: string };
        try {
          evt = JSON.parse(data);
        } catch {
          continue;
        }
        if (evt.type === "delta" && typeof evt.content === "string") {
          onDelta(evt.content);
        } else if (evt.type === "error") {
          throw new Error(evt.message || "流式响应异常");
        }
      }
    }
  }
}

/**
 * 增强版 AI 助理聊天组件
 * - 顶部 header：AI 头像 + 名称 + ModelSwitcher + 语音通话按钮
 * - 消息列表：可滚动，AI 消息带小头像
 * - 快捷技能：输入框上方横向滚动
 * - 输入区：固定底部
 * - 全双工语音：VAD + 流式 ASR + 流式 TTS + 后缀音 + 用户开口打断
 */
export function AssistantChat({ onClose }: AssistantChatProps = {}) {
  // ===== 消息 / 输入 / 设置 =====
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<AssistantSettings>(DEFAULT_SETTINGS);
  const [modelConfig, setModelConfig] = useState<ModelSwitcherValue>({
    provider: "deepseek",
    model: "deepseek-chat",
    reasoningMode: "standard",
  });

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
  // 防止 stale closure：用 ref 持有最新的 sendVoice / handleSpeechEnd
  const sendVoiceRef = useRef<(text: string) => Promise<void>>(async () => {});
  const handleSpeechEndRef = useRef<() => void>(() => {});

  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

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

  // ===== 卸载时中断未完成的流和语音资源 =====
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

  // ===== 文本模式发送（含快捷技能复用）=====
  const sendText = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content || sending) return;

      const userMsg: ChatMessage = { role: "user", content };
      const history = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      setMessages((prev) => [
        ...prev,
        userMsg,
        { role: "assistant", content: "" },
      ]);
      setInput("");
      setSending(true);
      setError(null);

      const controller = new AbortController();
      abortRef.current = controller;

      let acc = "";
      try {
        const res = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: history,
            stream: true,
            provider: modelConfig.provider,
            model: modelConfig.model || undefined,
            reasoningMode: modelConfig.reasoningMode,
          }),
          signal: controller.signal,
        });
        await readChatStream(res, (chunk) => {
          acc += chunk;
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last && last.role === "assistant") {
              next[next.length - 1] = { ...last, content: acc };
            }
            return next;
          });
        });
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setError("发送失败，请重试");
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last && last.role === "assistant" && last.content === "") {
            next.pop();
          }
          return next;
        });
      } finally {
        setSending(false);
        abortRef.current = null;
      }
    },
    [sending, messages, modelConfig],
  );

  const sendMessage = useCallback(() => {
    void sendText(input);
  }, [input, sendText]);

  // ===== 全双工语音：流式发送给 LLM，边生成边 TTS 播放 =====
  const sendVoice = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content) return;

      // 停止旧 TTS，准备接收新回复
      streamTtsRef.current?.stop();
      streamTtsRef.current?.reset();

      const userMsg: ChatMessage = { role: "user", content };
      const history = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      setMessages((prev) => [
        ...prev,
        userMsg,
        { role: "assistant", content: "" },
      ]);
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

      let acc = "";
      try {
        const res = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: history,
            stream: true,
            provider: modelConfig.provider,
            model: modelConfig.model || undefined,
            reasoningMode: modelConfig.reasoningMode,
          }),
          signal: controller.signal,
        });
        await readChatStream(res, (chunk) => {
          acc += chunk;
          tts?.feed(chunk);
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last && last.role === "assistant") {
              next[next.length - 1] = { ...last, content: acc };
            }
            return next;
          });
        });
        tts?.finish();
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setError("发送失败，请重试");
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last && last.role === "assistant" && last.content === "") {
            next.pop();
          }
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
    [messages, modelConfig, setPhase],
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

      // 初始化流式 TTS（边生成边播）
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

  // ===== 快捷技能：点击直接发送 =====
  const handleQuickCommand = useCallback(
    (cmd: QuickCommand) => {
      if (sending) return;
      void sendText(cmd.message);
    },
    [sending, sendText],
  );

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
      {/* ===== Header：AI 头像 + 名称 + ModelSwitcher + 语音按钮 ===== */}
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-background px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
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
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-foreground">
              AI 助理 · {displayName}
            </h2>
            <p className="truncate text-[10px] text-muted-foreground">
              {voiceCallActive ? "语音通话中" : "随时帮你处理事项"}
            </p>
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
                你好，我是 {displayName}，有什么可以帮你？
              </p>
            </div>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {messages.map((m, i) => {
              const isUser = m.role === "user";
              const isStreaming =
                !isUser && sending && i === messages.length - 1;
              const larkCard =
                !isUser && m.toolCall?.type === "larkTaskCard"
                  ? (m.toolCall.data as LarkTaskCardData | undefined)
                  : undefined;
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
                  {larkCard && <LarkTaskCard {...larkCard} />}
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
            <span
              className="inline-flex shrink-0 items-center gap-1 rounded-full border border-cognition/40 bg-cognition/5 px-2 py-1 text-[11px] font-medium text-cognition"
              title="快捷技能"
            >
              <Wrench className="h-3 w-3" />
              <span>技能</span>
            </span>
            {QUICK_COMMANDS.map((cmd, i) => (
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

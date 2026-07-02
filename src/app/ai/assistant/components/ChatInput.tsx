"use client";

import {
  Send, Mic, Square, Loader2, Image as ImageIcon, X, Phone, PhoneOff,
  Sparkles, Wrench, ShieldCheck, ShieldAlert, ShieldOff,
} from "lucide-react";
import { Button } from "@/components/layout/PageHeader";
import { QUICK_COMMANDS } from "@/lib/ai-assistant-tools";
import type { ModelSwitcherValue } from "@/components/ui/ModelSwitcher";
import type { AISettings, VoicePhase } from "../types";

interface ChatInputProps {
  thinking: boolean;
  voiceCallActive: boolean;
  voiceCallPhase: VoicePhase;
  asrInterimText: string;
  settings: AISettings;
  modelConfig: ModelSwitcherValue;
  isMultimodal: boolean;
  recording: boolean;
  transcribing: boolean;
  attachedImages: string[];
  input: string;
  setInput: React.Dispatch<React.SetStateAction<string>>;
  send: (text?: string) => Promise<void>;
  stopGeneration: () => void;
  inputRef: React.RefObject<HTMLInputElement>;
  fileInputRef: React.RefObject<HTMLInputElement>;
  handleImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  removeImage: (index: number) => void;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  startVoiceCall: () => Promise<void>;
  stopVoiceCall: () => void;
  openSkillPanel: () => void;
  desktopMode: boolean;
  authMode: "approve" | "once" | "free";
  wsConnected: boolean;
  handleAuthModeChange: (mode: "approve" | "once" | "free") => Promise<void>;
}

export function ChatInput(props: ChatInputProps) {
  const {
    thinking, voiceCallActive, voiceCallPhase, asrInterimText, settings,
    modelConfig, isMultimodal, recording, transcribing, attachedImages,
    input, setInput, send, stopGeneration, inputRef, fileInputRef,
    handleImageUpload, removeImage, startRecording, stopRecording,
    startVoiceCall, stopVoiceCall, openSkillPanel, desktopMode, authMode,
    wsConnected, handleAuthModeChange,
  } = props;

  return (
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
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img} alt={`附件 ${i + 1}`} className="h-16 w-16 rounded-lg border border-border object-cover" />
                <button onClick={() => removeImage(i)} className="absolute -right-1 -top-1 rounded-full bg-destructive p-0.5 text-destructive-foreground shadow-sm" title="移除图片">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" />

        {/* 桌面端：三档授权模式切换器（仿 Codex） */}
        {desktopMode && !voiceCallActive && (
          <div className="mb-2 flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground">授权模式：</span>
            <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/30 p-0.5">
              {([
                { value: "approve", label: "审批", icon: <ShieldCheck className="h-2.5 w-2.5" />, title: "每次操作弹窗确认（最安全）" },
                { value: "once", label: "一次", icon: <ShieldAlert className="h-2.5 w-2.5" />, title: "同类操作首次授权后会话内不再询问" },
                { value: "free", label: "免审批", icon: <ShieldOff className="h-2.5 w-2.5" />, title: "仅记录日志不弹窗（效率最高）" },
              ] as const).map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => handleAuthModeChange(m.value)}
                  title={m.title}
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors ${
                    authMode === m.value
                      ? m.value === "approve"
                        ? "bg-task/15 text-task"
                        : m.value === "once"
                        ? "bg-campaign/15 text-campaign"
                        : "bg-graveyard/15 text-graveyard"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {m.icon}
                  {m.label}
                </button>
              ))}
            </div>
            {wsConnected ? (
              <span className="inline-flex items-center gap-1 text-[10px] text-task">
                <span className="h-1.5 w-1.5 rounded-full bg-task" /> 云端已连接
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" /> 云端未连接
              </span>
            )}
          </div>
        )}

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
              <Button variant="primary" size="md" onClick={startVoiceCall} title="接通语音通话">
                <Phone className="h-3.5 w-3.5" /> 接通
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
          <div className="flex items-center gap-2 py-2">
            <div className="flex-1 truncate rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-muted-foreground">
              {voiceCallPhase === "speaking" ? (asrInterimText || "正在说话...")
                : voiceCallPhase === "thinking" ? "AI 思考中..."
                : voiceCallPhase === "replying" ? "AI 正在回复..."
                : "正在聆听，说完即可..."}
            </div>
            <Button variant="danger" onClick={stopVoiceCall} title="挂断">
              <PhoneOff className="h-4 w-4" /> 挂断
            </Button>
          </div>
        )}
        <div className="mt-2 flex items-center justify-center gap-2">
          {settings.hermesTakeover ? (
            <span
              className="inline-flex items-center gap-1 rounded-full border border-green-500/40 bg-green-500/10 px-2 py-0.5 text-[10px] font-medium text-green-600 dark:text-green-400"
              title="Lynx Agent 接管模式（模式 C）：持久化记忆 + 持续学习，失败时自动回退到 LLM"
            >
              <Sparkles className="h-2.5 w-2.5" />
              🤖 Lynx Agent 模式
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
  );
}

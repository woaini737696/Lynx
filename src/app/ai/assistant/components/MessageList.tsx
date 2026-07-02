"use client";

import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/toast";
import { LarkTaskCard } from "@/components/ai/LarkTaskCard";
import {
  AlertCircle, UserCircle, Copy, Check, ChevronDown, ChevronRight, Wrench,
  Loader2, Volume2, ThumbsUp, ThumbsDown, Flag,
} from "lucide-react";
import { renderMarkdown, isPersistedMessage, summarizeToolResult } from "../utils";
import { SUGGESTIONS, type Message, type AISettings } from "../types";

interface MessageListProps {
  messages: Message[];
  settings: AISettings;
  thinking: boolean;
  scrollRef: React.RefObject<HTMLDivElement>;
  speakingId: string | null;
  ttsLoadingId: string | null;
  speak: (text: string, msgId?: string) => Promise<void>;
  stopSpeaking: () => void;
  copiedId: string | null;
  copyMessage: (msg: Message) => void;
  expandedTools: Set<string>;
  toggleToolExpand: (msgId: string) => void;
  handleFeedback: (msgId: string, feedback: "good" | "bad" | null, reason?: string) => Promise<void>;
  annotatingMsgId: string | null;
  setAnnotatingMsgId: React.Dispatch<React.SetStateAction<string | null>>;
  annotationReason: string;
  setAnnotationReason: React.Dispatch<React.SetStateAction<string>>;
  submittingFeedback: string | null;
  send: (text?: string) => Promise<void>;
}

export function MessageList(props: MessageListProps) {
  const { messages, settings, thinking, scrollRef, speakingId, ttsLoadingId, speak, stopSpeaking, copiedId, copyMessage, expandedTools, toggleToolExpand, handleFeedback, annotatingMsgId, setAnnotatingMsgId, annotationReason, setAnnotationReason, submittingFeedback, send } = props;
  return (
    <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-2xl space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className={cn("flex gap-3", msg.role === "user" && "flex-row-reverse")}>
            <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-xl text-white shadow-sm",
              msg.role === "assistant" ? (msg.error ? "bg-destructive" : "bg-primary") : "bg-northstar"
            )}>
              {msg.role === "assistant"
                ? msg.error ? <AlertCircle className="h-4 w-4" /> : (settings.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={settings.avatarUrl} alt="avatar" className="h-full w-full object-cover" />
                ) : <span className="text-base leading-none">{settings.assistantAvatar}</span>)
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
                          // eslint-disable-next-line @next/next/no-img-element
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

              {msg.role === "assistant" && !msg.error && !msg.streaming &&
                msg.toolCalled && msg.toolCalled.tool === "createLarkTask" &&
                msg.toolCalled.result?.type === "larkTaskCard" &&
                msg.toolCalled.result.data && (
                <LarkTaskCard {...msg.toolCalled.result.data} />
              )}

              {msg.role === "assistant" && !msg.error && !msg.streaming && msg.toolCalled &&
                !(msg.toolCalled.tool === "createLarkTask" && msg.toolCalled.result?.type === "larkTaskCard") && (
                <div className="mt-2 max-w-[85%] rounded-xl border border-cognition/30 bg-cognition/5 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleToolExpand(msg.id)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-cognition/10"
                  >
                    <Wrench className="h-3.5 w-3.5 shrink-0 text-cognition" />
                    <span className="text-xs font-medium text-cognition">工具调用：{msg.toolCalled.tool}</span>
                    <span className="ml-auto text-[10px] text-muted-foreground">{summarizeToolResult(msg.toolCalled.result)}</span>
                    {expandedTools.has(msg.id) ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                  </button>
                  {expandedTools.has(msg.id) && (
                    <div className="border-t border-cognition/20 px-3 py-2">
                      <div className="mb-1.5 text-[10px] text-muted-foreground">参数：</div>
                      <pre className="mb-2 overflow-x-auto rounded-lg bg-muted/50 p-2 text-[11px] leading-relaxed">
                        <code className="font-mono text-foreground">{JSON.stringify(msg.toolCalled.args, null, 2)}</code>
                      </pre>
                      <div className="mb-1.5 text-[10px] text-muted-foreground">结果：</div>
                      <pre className="overflow-x-auto rounded-lg bg-muted/50 p-2 text-[11px] leading-relaxed max-h-60">
                        <code className="font-mono text-foreground">{JSON.stringify(msg.toolCalled.result, null, 2)}</code>
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
                      {msg.usage.total_tokens} 词元
                      {msg.usage.prompt_tokens != null && msg.usage.completion_tokens != null && (
                        <span className="text-muted-foreground/50"> (↑{msg.usage.prompt_tokens} ↓{msg.usage.completion_tokens})</span>
                      )}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => { if (speakingId === msg.id) stopSpeaking(); else speak(msg.content, msg.id); }}
                    title={speakingId === msg.id ? "停止播报" : "语音播报"}
                    className="inline-flex items-center gap-1 rounded-md px-1 py-0.5 transition-colors hover:bg-primary/10 hover:text-foreground"
                  >
                    {ttsLoadingId === msg.id ? <Loader2 className="h-3 w-3 animate-spin" />
                      : <Volume2 className={cn("h-3 w-3", speakingId === msg.id && "text-cognition")} />}
                    {speakingId === msg.id && <span>停止</span>}
                  </button>
                </div>
              )}

              {msg.role === "assistant" && !msg.error && !msg.streaming && (
                <div className="mt-1 ml-1 flex flex-wrap items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleFeedback(msg.id, msg.feedback === "good" ? null : "good")}
                    disabled={submittingFeedback === msg.id || !isPersistedMessage(msg.id)}
                    title={isPersistedMessage(msg.id) ? (msg.feedback === "good" ? "取消标注" : "好回复") : "消息尚未持久化，暂不可标注"}
                    className={cn(
                      "inline-flex h-6 w-6 items-center justify-center rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                      msg.feedback === "good" ? "bg-task/15 text-task" : "text-muted-foreground/60 hover:bg-primary/10 hover:text-foreground"
                    )}
                  >
                    {submittingFeedback === msg.id && msg.feedback !== "good" ? <Loader2 className="h-3 w-3 animate-spin" /> : <ThumbsUp className="h-3 w-3" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!isPersistedMessage(msg.id)) { toast("消息尚未持久化，暂不可标注", "info"); return; }
                      if (msg.feedback === "bad") { handleFeedback(msg.id, null); }
                      else { setAnnotatingMsgId(msg.id); setAnnotationReason(msg.feedbackReason || ""); }
                    }}
                    disabled={submittingFeedback === msg.id}
                    title={isPersistedMessage(msg.id) ? (msg.feedback === "bad" ? "取消标注" : "不满意，标注原因") : "消息尚未持久化，暂不可标注"}
                    className={cn(
                      "inline-flex h-6 w-6 items-center justify-center rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                      msg.feedback === "bad" ? "bg-graveyard/15 text-graveyard" : "text-muted-foreground/60 hover:bg-primary/10 hover:text-foreground"
                    )}
                  >
                    {submittingFeedback === msg.id && msg.feedback !== "bad" ? <Loader2 className="h-3 w-3 animate-spin" /> : <ThumbsDown className="h-3 w-3" />}
                  </button>
                  {msg.feedback && (
                    <span className={cn("text-[10px]", msg.feedback === "good" ? "text-task/80" : "text-graveyard/80")}>
                      {msg.feedback === "good" ? "已标注：有帮助" : "已标注：待改进"}
                    </span>
                  )}
                </div>
              )}

              {annotatingMsgId === msg.id && msg.role === "assistant" && (
                <div className="mt-2 ml-1 max-w-[85%] rounded-xl border border-graveyard/30 bg-graveyard/5 p-2.5">
                  <div className="mb-1.5 flex items-center gap-1 text-[10px] font-medium text-graveyard">
                    <Flag className="h-3 w-3" />
                    <span>请说明不满意的原因（将用于帮助 AI 改进）</span>
                  </div>
                  <textarea
                    value={annotationReason}
                    onChange={(e) => setAnnotationReason(e.target.value)}
                    placeholder="如：回答不相关、信息有误、缺少关键内容、格式混乱..."
                    rows={2}
                    className="w-full resize-y rounded-lg border border-border bg-background px-2 py-1.5 text-[11px] leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus:border-graveyard/40 focus:outline-none focus:ring-2 focus:ring-graveyard/20"
                  />
                  <div className="mt-1.5 flex items-center justify-end gap-1.5">
                    <button type="button" onClick={() => { setAnnotatingMsgId(null); setAnnotationReason(""); }} disabled={submittingFeedback === msg.id} className="rounded-md px-2 py-1 text-[10px] text-muted-foreground transition-colors hover:bg-primary/10 disabled:opacity-50">取消</button>
                    <button type="button" onClick={() => handleFeedback(msg.id, "bad", annotationReason)} disabled={submittingFeedback === msg.id || !annotationReason.trim()} className="inline-flex items-center gap-1 rounded-md bg-graveyard/90 px-2 py-1 text-[10px] font-medium text-white transition-colors hover:bg-graveyard disabled:cursor-not-allowed disabled:opacity-50">
                      {submittingFeedback === msg.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Flag className="h-3 w-3" />}
                      提交标注
                    </button>
                  </div>
                </div>
              )}

              {msg.role === "assistant" && msg.feedback === "bad" && msg.feedbackReason && annotatingMsgId !== msg.id && (
                <div className="mt-1 ml-1 max-w-[85%] rounded-md bg-graveyard/5 px-2 py-1 text-[10px] text-graveyard/80">
                  原因：{msg.feedbackReason}
                </div>
              )}
            </div>
          </div>
        ))}

        {thinking && messages[messages.length - 1]?.streaming && messages[messages.length - 1]?.content === "" && (
          <div className="flex gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary text-primary-foreground shadow-sm">
              {settings.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={settings.avatarUrl} alt="avatar" className="h-full w-full object-cover" />
              ) : (
                <span className="text-base leading-none">{settings.assistantAvatar}</span>
              )}
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
  );
}

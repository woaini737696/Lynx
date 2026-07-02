"use client";

import { cn } from "@/lib/utils";
import { Headphones, Mic, Loader2, Bot } from "lucide-react";
import type { VoicePhase } from "../types";

interface VoiceCallBarProps {
  voiceCallPhase: VoicePhase;
  asrInterimText: string;
  voiceVolume: number;
}

export function VoiceCallBar({ voiceCallPhase, asrInterimText, voiceVolume }: VoiceCallBarProps) {
  return (
    <div className="border-b border-cognition/20 bg-cognition/5 px-4 py-2 sm:px-8">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
            voiceCallPhase === "listening" ? "bg-northstar animate-pulse"
              : voiceCallPhase === "speaking" ? "bg-cognition animate-pulse"
              : voiceCallPhase === "thinking" ? "bg-muted"
              : "bg-cognition/70"
          )}>
            {voiceCallPhase === "listening" ? <Headphones className="h-5 w-5 text-white" />
              : voiceCallPhase === "speaking" ? <Mic className="h-5 w-5 text-white" />
              : voiceCallPhase === "thinking" ? <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
              : <Bot className="h-5 w-5 text-white" />}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium">语音通话中</p>
            <p className="truncate text-[10px] text-muted-foreground">
              {voiceCallPhase === "listening" ? "正在聆听..."
                : voiceCallPhase === "speaking" ? (asrInterimText || "正在说话...")
                : voiceCallPhase === "thinking" ? "AI 思考中..."
                : "AI 正在回复..."}
            </p>
          </div>
          <div className="ml-1 flex h-5 items-center gap-0.5">
            {[0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className="w-1 rounded-full bg-cognition/60 transition-all"
                style={{ height: `${4 + Math.min(16, voiceVolume * 80 * (1 - Math.abs(i - 2) / 3))}px` }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

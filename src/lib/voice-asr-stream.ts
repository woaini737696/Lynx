"use client";

// 全双工语音通话：流式 ASR 封装（Web Speech API SpeechRecognition）
// continuous + interimResults 模式：边说边输出中间文字，说完一句输出最终结果。
// 注意：SpeechRecognition 在部分浏览器（Firefox / 非 Chromium）不支持，需调用方做 fallback。

export interface AsrCallbacks {
  /** 实时中间结果（边说边输出） */
  onInterim?: (text: string) => void;
  /** 最终结果（一句话说完） */
  onFinal?: (text: string) => void;
  onError?: (err: string) => void;
}

// ===== Web Speech API 最小类型声明（TypeScript 无内置声明）=====
interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}
interface SpeechRecognitionResult {
  readonly length: number;
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternative;
}
interface SpeechRecognitionResultList {
  readonly length: number;
  [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}
interface SpeechRecognitionInstance extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((this: SpeechRecognitionInstance, ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((this: SpeechRecognitionInstance, ev: SpeechRecognitionErrorEvent) => void) | null;
  onend: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
  onstart: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

/** 当前浏览器是否支持流式 ASR（SpeechRecognition） */
export function isStreamASRSupported(): boolean {
  return getSpeechRecognitionCtor() !== null;
}

export class StreamASR {
  private callbacks: AsrCallbacks;
  private recognition: SpeechRecognitionInstance | null = null;
  private accumulated = "";
  private lastInterim = "";
  private running = false;
  private wantStart = false;

  constructor(callbacks: AsrCallbacks) {
    this.callbacks = callbacks;
  }

  start(): void {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      this.callbacks.onError?.("浏览器不支持 SpeechRecognition");
      return;
    }
    if (this.running) return;
    const rec = new Ctor();
    rec.lang = "zh-CN";
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        const txt = res[0]?.transcript || "";
        if (res.isFinal) {
          this.accumulated = (this.accumulated ? this.accumulated : "") + txt;
          this.lastInterim = "";
          this.callbacks.onFinal?.(txt);
        } else {
          interim += txt;
        }
      }
      if (interim) {
        this.lastInterim = interim;
        this.callbacks.onInterim?.(interim);
      }
    };
    rec.onerror = (e) => {
      // no-speech / aborted 是正常情况，忽略
      if (e.error === "no-speech" || e.error === "aborted") return;
      this.callbacks.onError?.(e.error || "识别错误");
    };
    rec.onend = () => {
      this.running = false;
      // continuous 模式下浏览器可能自动停止，需重启以保持持续监听
      if (this.wantStart) {
        try {
          rec.start();
          this.running = true;
        } catch {
          // 重启失败则放弃
        }
      }
    };

    try {
      rec.start();
      this.running = true;
      this.wantStart = true;
      this.recognition = rec;
    } catch (e) {
      this.callbacks.onError?.((e as Error).message);
    }
  }

  stop(): void {
    this.wantStart = false;
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {
        /* noop */
      }
      this.recognition = null;
    }
    this.running = false;
  }

  /** 获取累积的完整文字（已确认 final + 当前未确认 interim） */
  getAccumulatedText(): string {
    const text = (this.accumulated ? this.accumulated : "") + (this.lastInterim ? this.lastInterim : "");
    return text.trim();
  }

  /** 重置累积文字（提交给 LLM 后调用） */
  reset(): void {
    this.accumulated = "";
    this.lastInterim = "";
  }
}

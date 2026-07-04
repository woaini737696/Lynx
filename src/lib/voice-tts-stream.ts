"use client";

// 全双工语音通话：流式 TTS 播放
// 接收 AI 流式响应的文本块（feed），按句分割，达到一句立即调用 /api/ai/tts 合成并播放，
// 实现"边生成边播"，首字延迟 < 500ms。stop() 可立即打断（用户开口时调用）。
// 复用现有 /api/ai/tts 端点（返回 WAV 音频）。

import { clientLog } from "@/lib/client-logger";

export class StreamTTS {
  /** 全部播放完成回调 */
  onComplete?: () => void;
  /** 首句开始播放回调 */
  onPlayStart?: () => void;
  /** P0 修复：合成失败回调（用于在 UI 上提示用户"语音合成失败"原因） */
  onSynthesizeError?: (reason: string) => void;

  private buffer = "";
  private queue: Array<() => Promise<void>> = [];
  private playing = false;
  private aborted = false;
  private started = false;
  private streamEnded = false;
  private currentAudio: HTMLAudioElement | null = null;
  /** 累计失败次数（用于判断是否需要主动通知用户） */
  private consecutiveFailures = 0;

  /** 接收 AI 流式响应文本块，按句分割后入队播放 */
  feed(textChunk: string): void {
    if (this.aborted) return;
    this.buffer += textChunk;
    this.flushSentences(false);
  }

  /** 标记 LLM 流结束，处理 buffer 中剩余内容 */
  finish(): void {
    if (this.aborted) return;
    this.streamEnded = true;
    this.flushSentences(true);
  }

  /** 立即停止播放（用户开口打断时调用） */
  stop(): void {
    this.aborted = true;
    this.buffer = "";
    this.queue = [];
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
      } catch {
        /* noop */
      }
      this.currentAudio = null;
    }
    this.playing = false;
  }

  /** 重置状态（下一条 AI 回复复用实例前调用） */
  reset(): void {
    this.aborted = false;
    this.buffer = "";
    this.queue = [];
    this.playing = false;
    this.started = false;
    this.streamEnded = false;
    this.currentAudio = null;
    this.consecutiveFailures = 0;
  }

  /** 当前是否正在播放 */
  get isPlaying(): boolean {
    return this.playing;
  }

  private flushSentences(final: boolean): void {
    const sep = /([。！？；\n.!?;])/;
    while (true) {
      const m = this.buffer.match(sep);
      if (!m || m.index === undefined) break;
      const endIdx = m.index + m[0].length;
      const sentence = this.buffer.slice(0, endIdx).trim();
      this.buffer = this.buffer.slice(endIdx);
      if (sentence) this.enqueueSentence(sentence);
    }
    if (final && this.buffer.trim()) {
      const sentence = this.buffer.trim();
      this.buffer = "";
      this.enqueueSentence(sentence);
    }
  }

  private enqueueSentence(sentence: string): void {
    this.queue.push(async () => {
      if (this.aborted) return;
      const audio = await this.synthesize(sentence);
      if (this.aborted || !audio) return;
      this.currentAudio = audio;
      if (!this.started) {
        this.started = true;
        this.onPlayStart?.();
      }
      try {
        await audio.play();
        await new Promise<void>((resolve) => {
          audio.onended = () => resolve();
          audio.onerror = () => resolve();
        });
      } catch {
        /* noop */
      }
      this.currentAudio = null;
    });
    if (!this.playing) this.playNext();
  }

  private async playNext(): Promise<void> {
    if (this.aborted) return;
    const task = this.queue.shift();
    if (!task) {
      this.playing = false;
      if (this.streamEnded && !this.aborted) {
        this.streamEnded = false;
        this.onComplete?.();
      }
      return;
    }
    this.playing = true;
    await task();
    if (this.aborted) return;
    await this.playNext();
  }

  private async synthesize(sentence: string): Promise<HTMLAudioElement | null> {
    try {
      const res = await fetch("/api/ai/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: sentence }),
      });
      if (!res.ok) {
        // P0 修复：解析错误响应，提取可读错误信息
        let reason = `HTTP ${res.status}`;
        try {
          const errJson = await res.json().catch(() => null);
          if (errJson?.error) reason = String(errJson.error).slice(0, 120);
        } catch {
          /* noop */
        }
        this.consecutiveFailures += 1;
        clientLog.voiceError("stream-tts-synthesize-failed", {
          status: res.status,
          reason,
          sentencePreview: sentence.slice(0, 50),
          consecutiveFailures: this.consecutiveFailures,
        });
        // 累计失败 2 次以上才主动通知用户（避免单次偶发失败打扰）
        if (this.consecutiveFailures >= 2 && this.onSynthesizeError) {
          this.onSynthesizeError(reason);
        }
        return null;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => URL.revokeObjectURL(url);
      audio.onerror = () => URL.revokeObjectURL(url);
      // 合成成功，重置失败计数
      this.consecutiveFailures = 0;
      return audio;
    } catch (e) {
      this.consecutiveFailures += 1;
      clientLog.voiceError("stream-tts-synthesize-exception", {
        error: e instanceof Error ? e.message : String(e),
        sentencePreview: sentence.slice(0, 50),
        consecutiveFailures: this.consecutiveFailures,
      });
      if (this.consecutiveFailures >= 2 && this.onSynthesizeError) {
        this.onSynthesizeError(e instanceof Error ? e.message : "网络错误");
      }
      return null;
    }
  }
}

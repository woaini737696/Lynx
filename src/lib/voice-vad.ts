"use client";

// 全双工语音通话 VAD（语音活动检测）引擎
// 基于 Web Audio API AnalyserNode 实时分析频谱音量，检测说话起止与短停顿。
// - 音量 > SPEECH_THRESHOLD 且持续 > SPEECH_START_MS → onSpeechStart
// - 说话中静音 > SHORT_PAUSE_MS（一次性）→ onShortPause（触发 AI 后缀音"嗯"）
// - 说话中静音 > SILENCE_DURATION_MS → onSpeechEnd（说完判定）
// - 单次说话 > MAX_SPEECH_MS → onSpeechEnd（AI 主动打断）
// 使用 requestAnimationFrame 循环分析，实时回调音量用于 UI 波形。

export interface VadCallbacks {
  /** 检测到说话开始 */
  onSpeechStart?: () => void;
  /** 检测到说话结束（长静音 >1.5s 或超时主动打断） */
  onSpeechEnd?: () => void;
  /** 短停顿（<1.5s），触发 AI 回"嗯"后缀音 */
  onShortPause?: () => void;
  /** 实时音量（归一化 RMS 0~1），用于 UI 波形 */
  onVolumeChange?: (volume: number) => void;
}

/** 音量阈值（归一化 RMS 0~1），高于此值视为有语音 */
const SPEECH_THRESHOLD = 0.05;
/** 连续静音超过此值 → 判定说话结束 */
const SILENCE_DURATION_MS = 1500;
/** 静音超过此值 → 触发短停顿后缀音（每段说话仅触发一次） */
const SHORT_PAUSE_MS = 200;
/** 音量超阈值持续此值 → 判定语音开始（防瞬时噪声误触） */
const SPEECH_START_MS = 250;
/** 单次说话超过此值 → AI 主动打断 */
const MAX_SPEECH_MS = 15000;

export class VoiceVAD {
  private stream: MediaStream;
  private callbacks: VadCallbacks;

  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private freqBuf: Uint8Array<ArrayBuffer> | null = null;
  private rafId: number | null = null;
  private running = false;

  // 状态
  private speechActive = false;
  private speechStartTs = 0;
  private highVolStartTs = 0;
  private lowVolStartTs = 0;
  private shortPauseFired = false;
  private interrupted = false;

  constructor(stream: MediaStream, callbacks: VadCallbacks) {
    this.stream = stream;
    this.callbacks = callbacks;
  }

  start(): void {
    if (this.running) return;
    try {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx = new Ctx();
      this.source = this.audioCtx.createMediaStreamSource(this.stream);
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.6;
      this.source.connect(this.analyser);
      this.freqBuf = new Uint8Array(this.analyser.frequencyBinCount);
    } catch {
      this.audioCtx = null;
      this.analyser = null;
      return;
    }
    this.running = true;
    this.speechActive = false;
    this.shortPauseFired = false;
    this.interrupted = false;
    this.highVolStartTs = 0;
    this.lowVolStartTs = 0;
    this.rafId = requestAnimationFrame(this.tick);
  }

  stop(): void {
    this.running = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    try {
      this.source?.disconnect();
    } catch {
      /* noop */
    }
    try {
      this.analyser?.disconnect();
    } catch {
      /* noop */
    }
    if (this.audioCtx && this.audioCtx.state !== "closed") {
      this.audioCtx.close().catch(() => {
        /* noop */
      });
    }
    this.audioCtx = null;
    this.analyser = null;
    this.source = null;
    this.freqBuf = null;
    this.speechActive = false;
  }

  /** 当前是否正在说话 */
  get isSpeaking(): boolean {
    return this.speechActive;
  }

  private tick = (): void => {
    if (!this.running || !this.analyser || !this.freqBuf) return;
    const analyser = this.analyser;
    const buf = this.freqBuf;
    analyser.getByteFrequencyData(buf);

    // 计算归一化 RMS（0~1）
    let sum = 0;
    for (let i = 0; i < buf.length; i++) {
      const v = buf[i] / 255;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / buf.length);
    this.callbacks.onVolumeChange?.(rms);

    const now = performance.now();
    const speaking = rms > SPEECH_THRESHOLD;

    if (speaking) {
      this.highVolStartTs = this.highVolStartTs || now;
      this.lowVolStartTs = 0;
      if (!this.speechActive && now - this.highVolStartTs > SPEECH_START_MS) {
        this.speechActive = true;
        this.speechStartTs = this.highVolStartTs;
        this.shortPauseFired = false;
        this.interrupted = false;
        this.callbacks.onSpeechStart?.();
      }
    } else {
      this.lowVolStartTs = this.lowVolStartTs || now;
      this.highVolStartTs = 0;
      if (this.speechActive) {
        const silenceMs = now - this.lowVolStartTs;
        if (silenceMs > SHORT_PAUSE_MS && !this.shortPauseFired) {
          this.shortPauseFired = true;
          this.callbacks.onShortPause?.();
        }
        if (silenceMs > SILENCE_DURATION_MS) {
          this.speechActive = false;
          this.lowVolStartTs = 0;
          this.shortPauseFired = false;
          this.callbacks.onSpeechEnd?.();
        }
      }
    }

    // AI 主动打断：单次说话超时
    if (this.speechActive && !this.interrupted && now - this.speechStartTs > MAX_SPEECH_MS) {
      this.interrupted = true;
      this.speechActive = false;
      this.lowVolStartTs = 0;
      this.shortPauseFired = false;
      this.callbacks.onSpeechEnd?.();
    }

    this.rafId = requestAnimationFrame(this.tick);
  };
}

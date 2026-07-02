// VAD（语音端点检测）接口 - 平台适配
// Web 端：Web Audio API AnalyserNode（现有 voice-vad.ts）
// RN 端：原生音频分析模块
// Tauri 端：Rust 音频分析或 webview Web Audio

// VAD 状态机常量（从 voice-vad.ts 抽离，三端共享）
export const VAD_CONSTANTS = {
  /** 语音能量阈值（0-255，超过此值认为有语音） */
  SPEECH_THRESHOLD: 30,
  /** 静默持续时间（毫秒），超过此时间认为语音结束 */
  SILENCE_DURATION_MS: 1200,
  /** 短暂停顿时间（毫秒），用于分段 */
  SHORT_PAUSE_MS: 300,
  /** 语音最短持续时间（毫秒），短于此认为是噪声 */
  SPEECH_START_MS: 200,
  /** 语音最长持续时间（毫秒），超过强制截断 */
  MAX_SPEECH_MS: 30_000,
} as const;

/** VAD 状态 */
export type VADState = "idle" | "listening" | "speaking" | "silence";

/** VAD 事件回调 */
export interface VADCallbacks {
  /** 检测到语音开始 */
  onSpeechStart?: () => void;
  /** 检测到语音结束（携带完整音频数据） */
  onSpeechEnd?: (audio: ArrayBuffer) => void;
  /** 音量级别变化（0.0 ~ 1.0） */
  onVolumeChange?: (volume: number) => void;
  /** 状态变化 */
  onStateChange?: (state: VADState) => void;
}

/** VAD Provider 接口 */
export interface IVADProvider {
  /** 启动 VAD 检测 */
  start(callbacks: VADCallbacks): Promise<void>;

  /** 停止 VAD 检测 */
  stop(): void;

  /** 当前状态 */
  readonly state: VADState;
}

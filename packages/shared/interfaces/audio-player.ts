// 音频播放器接口 - 平台适配
// Web 端：HTMLAudioElement
// RN 短：expo-av / react-native-sound
// Tauri 端：Rust 音频库或 webview <audio>

/** 可播放的音频资源（各端不同） */
export type AudioPlayable =
  | { type: "url"; url: string }           // URL（Web/Tauri）
  | { type: "base64"; data: string; format: string }  // Base64（RN）
  | { type: "blob"; blob: Blob }           // Blob（Web only）
  | { type: "arraybuffer"; buffer: ArrayBuffer };     // ArrayBuffer（通用）

/** 音频播放器接口 */
export interface IAudioPlayer {
  /** 播放音频（返回 Promise，播放完成后 resolve） */
  play(audio: AudioPlayable): Promise<void>;

  /** 停止当前播放 */
  stop(): void;

  /** 设置音量（0.0 ~ 1.0） */
  setVolume(volume: number): void;

  /** 是否正在播放 */
  readonly isPlaying: boolean;

  /** 播放结束回调 */
  onEnded?: () => void;

  /** 播放错误回调 */
  onError?: (error: Error) => void;
}

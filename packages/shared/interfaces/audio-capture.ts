// 音频采集接口 - 平台适配
// Web 端：navigator.mediaDevices.getUserMedia + MediaRecorder
// RN 端：expo-av Audio.Recording
// Tauri 端：Rust 音频采集或 webview getUserMedia

/** 音频采集配置 */
export interface AudioCaptureConfig {
  /** 采样率（如 16000） */
  sampleRate: number;
  /** 声道数（1=mono） */
  channelCount: number;
  /** 位深度（通常 16） */
  bitsPerSample: number;
}

/** 采集到的音频帧回调 */
export type AudioFrameCallback = (frame: ArrayBuffer) => void;

/** 音频采集器接口 */
export interface IAudioCapture {
  /** 开始采集 */
  start(config: AudioCaptureConfig): Promise<void>;

  /** 停止采集，返回完整录音 */
  stop(): Promise<ArrayBuffer>;

  /** 注册实时音频帧回调（用于 VAD/流式 ASR） */
  onFrame(cb: AudioFrameCallback): void;

  /** 获取当前音量级别（0.0 ~ 1.0），用于 UI 波形显示 */
  getVolumeLevel(): number;

  /** 是否正在采集 */
  readonly isCapturing: boolean;
}

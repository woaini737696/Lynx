// ASR（语音识别）接口 - 平台适配
// Web 端：Web Speech API / 服务端流式 ASR（WebSocket 传音频帧）
// RN 端：原生 ASR SDK 或服务端流式 ASR
// Tauri 端：系统语音识别或服务端 ASR

/** ASR 识别结果 */
export interface ASRResult {
  /** 识别文本 */
  text: string;
  /** 是否为最终结果（false=中间结果，true=最终结果） */
  isFinal: boolean;
  /** 置信度（0.0 ~ 1.0） */
  confidence?: number;
}

/** ASR 事件回调 */
export interface ASRCallbacks {
  /** 识别到部分文本 */
  onPartial?: (text: string) => void;
  /** 识别到最终文本 */
  onFinal?: (result: ASRResult) => void;
  /** 识别错误 */
  onError?: (error: Error) => void;
}

/** ASR Provider 接口 */
export interface IASRProvider {
  /** 开始识别 */
  start(callbacks: ASRCallbacks): Promise<void>;

  /** 喂入音频帧（流式 ASR 用） */
  feed(audioFrame: ArrayBuffer): void;

  /** 停止识别，返回最终结果 */
  stop(): Promise<ASRResult | null>;

  /** 是否正在识别 */
  readonly isRecognizing: boolean;
}

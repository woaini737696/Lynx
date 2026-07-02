// TTS（语音合成）接口 - 平台适配
// Web 端：服务端流式 TTS（SSE 返回 base64 音频）+ Audio 播放
// RN 端：服务端流式 TTS + expo-av 播放
// Tauri 端：服务端流式 TTS + Rust 音频播放

import type { AudioPlayable } from "./audio-player";

/** TTS 合成请求 */
export interface TTSRequest {
  /** 要合成的文本 */
  text: string;
  /** 语音模型 ID */
  model?: string;
  /** 音色 ID（voice clone 用） */
  voiceId?: string;
  /** 语速（0.5 ~ 2.0，默认 1.0） */
  speed?: number;
  /** 音调（0.5 ~ 2.0，默认 1.0） */
  pitch?: number;
}

/** TTS 合成结果 */
export interface TTSResult {
  /** 音频数据（格式由实现决定） */
  audio: AudioPlayable;
  /** 音频时长（秒） */
  duration?: number;
}

/** TTS Provider 接口 */
export interface ITTSProvider {
  /**
   * 流式合成语音（边合成边播放）
   * 文本会被自动分割为句子，逐句合成播放
   */
  streamSynthesize(
    text: string,
    options?: Omit<TTSRequest, "text">
  ): Promise<void>;

  /** 非流式合成（整段合成后返回） */
  synthesize(request: TTSRequest): Promise<TTSResult>;

  /** 停止当前合成和播放 */
  stop(): void;

  /** 是否正在合成 */
  readonly isSynthesizing: boolean;
}

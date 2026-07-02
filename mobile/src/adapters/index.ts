// ============ 平台适配器（React Native 端） ============
// 实现 @lynnhub/shared 中定义的平台无关接口，通过依赖注入供 shared-react hooks 使用。
// - RNAudioPlayer：基于 expo-av Audio.Sound
// - RNAudioCapture：基于 expo-av Audio.Recording
// - RNVisibilityProvider：基于 AppState

import { Audio } from 'expo-av';
import { AppState, type AppStateStatus } from 'react-native';
import type {
  IAudioPlayer,
  IAudioCapture,
  IVisibilityProvider,
  AudioPlayable,
  AudioCaptureConfig,
  AudioFrameCallback,
  VisibilityState,
} from '@lynnhub/shared';

// ============ 工具函数 ============

/** Base64 字符串 → ArrayBuffer（RN 全局提供 atob） */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

/** ArrayBuffer → Base64 字符串（RN 全局提供 btoa） */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000; // 避免 fromCharCode 参数过多栈溢出
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(binary);
}

/**
 * 读取本地文件 URI 为 ArrayBuffer。
 * 优先使用 expo-file-system（expo 项目自带，但可能未在 package.json 显式声明）；
 * 失败则回退到 fetch（部分 RN 环境支持 file://）。
 */
async function readFileAsArrayBuffer(uri: string): Promise<ArrayBuffer> {
  try {
    // @ts-ignore - expo-file-system 由 expo 自动安装，TS 可能找不到类型声明
    const FS = await import('expo-file-system');
    const base64 = await FS.readAsStringAsync(uri, {
      encoding: FS.EncodingType.Base64,
    });
    return base64ToArrayBuffer(base64);
  } catch {
    const resp = await fetch(uri);
    if (resp.arrayBuffer) return await resp.arrayBuffer();
    throw new Error('无法读取录音文件：缺少 expo-file-system 且 fetch 不支持 file://');
  }
}

// ============ 音频播放器 ============

/** RN 音频播放器（基于 expo-av Audio.Sound） */
export class RNAudioPlayer implements IAudioPlayer {
  private _sound: Audio.Sound | null = null;
  private _isPlaying = false;
  private _volume = 1.0;

  get isPlaying(): boolean {
    return this._isPlaying;
  }

  onEnded?: () => void;
  onError?: (error: Error) => void;

  /** 将 AudioPlayable 转为 expo-av 播放源（{uri} / {base64}） */
  private toSoundSource(audio: AudioPlayable): { uri: string } | { base64: string } {
    switch (audio.type) {
      case 'url':
        return { uri: audio.url };
      case 'base64':
        return { base64: audio.data };
      case 'arraybuffer':
        // expo-av 不直接支持 ArrayBuffer，转 base64
        return { base64: arrayBufferToBase64(audio.buffer) };
      case 'blob':
        // RN 无 Blob 概念
        throw new Error('RNAudioPlayer 不支持 Blob 类型音频');
      default:
        throw new Error(`不支持的音频类型: ${(audio as { type: string }).type}`);
    }
  }

  async play(audio: AudioPlayable): Promise<void> {
    // 先卸载旧的 Sound
    await this.unload();
    try {
      // 引用 createAsync 实际入参类型，避免类型名跨版本差异（AVPlaybackSource / SoundSource）
      const source = this.toSoundSource(audio) as Parameters<typeof Audio.Sound.createAsync>[0];
      const { sound } = await Audio.Sound.createAsync(source, {
        shouldPlay: true,
        volume: this._volume,
      });
      this._sound = sound;
      this._isPlaying = true;

      sound.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded) {
          if (status.error) {
            this.onError?.(new Error(status.error));
          }
          return;
        }
        this._isPlaying = status.isPlaying;
        if (status.didJustFinish) {
          this._isPlaying = false;
          this.onEnded?.();
        }
      });
    } catch (e) {
      this._isPlaying = false;
      const err = e instanceof Error ? e : new Error(String(e));
      this.onError?.(err);
      throw err;
    }
  }

  stop(): void {
    const sound = this._sound;
    if (sound) {
      sound.stopAsync().catch(() => {});
    }
    this._isPlaying = false;
    // 卸载异步进行，不阻塞调用方
    this.unload();
  }

  setVolume(volume: number): void {
    this._volume = Math.max(0, Math.min(1, volume));
    this._sound?.setVolumeAsync(this._volume).catch(() => {});
  }

  /** 卸载当前 Sound 实例并释放资源 */
  private async unload(): Promise<void> {
    if (this._sound) {
      const sound = this._sound;
      this._sound = null;
      try {
        await sound.unloadAsync();
      } catch {
        // 忽略卸载错误
      }
    }
  }
}

// ============ 音频采集器 ============

/** RN 音频采集器（基于 expo-av Audio.Recording） */
export class RNAudioCapture implements IAudioCapture {
  private _recording: Audio.Recording | null = null;
  private _isCapturing = false;
  private _volumeLevel = 0;
  private _frameCb: AudioFrameCallback | null = null;
  private _meteringTimer: ReturnType<typeof setInterval> | null = null;

  get isCapturing(): boolean {
    return this._isCapturing;
  }

  /** 根据采集配置构造 expo-av 录音选项 */
  private toRecordingOptions(config: AudioCaptureConfig): Audio.RecordingOptions {
    return {
      isMeteringEnabled: true,
      android: {
        // Android MediaRecorder 不支持直接输出 WAV/PCM，使用 AAC 容器
        extension: '.m4a',
        outputFormat: Audio.AndroidOutputFormat.MPEG_4,
        audioEncoder: Audio.AndroidAudioEncoder.AAC,
        sampleRate: config.sampleRate,
        numberOfChannels: config.channelCount,
        bitRate: 128000,
      },
      ios: {
        // iOS 使用线性 PCM，文件扩展名 .wav 可写出 WAV 容器
        extension: '.wav',
        outputFormat: Audio.IOSOutputFormat.LINEARPCM,
        audioQuality: Audio.IOSAudioQuality.HIGH,
        sampleRate: config.sampleRate,
        numberOfChannels: config.channelCount,
        bitRate: 128000,
        linearPCMBitDepth: config.bitsPerSample,
        linearPCMIsBigEndian: false,
        linearPCMIsFloat: false,
      },
      web: {
        mimeType: 'audio/wav',
        bitsPerSecond: 128000,
      },
    };
  }

  async start(config: AudioCaptureConfig): Promise<void> {
    if (this._isCapturing) {
      throw new Error('已在采集中，请先调用 stop()');
    }
    await this.cleanup();

    // 设置录音模式
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });

    const recording = new Audio.Recording();
    await recording.prepareToRecordAsync(this.toRecordingOptions(config));
    await recording.startAsync();

    this._recording = recording;
    this._isCapturing = true;
    this._volumeLevel = 0;
    this.startMetering();
  }

  async stop(): Promise<ArrayBuffer> {
    const recording = this._recording;
    if (!recording) {
      return new ArrayBuffer(0);
    }
    this.stopMetering();
    try {
      await recording.stopAndUnloadAsync();
      this._isCapturing = false;
      const uri = recording.getURI();
      if (!uri) return new ArrayBuffer(0);
      return await readFileAsArrayBuffer(uri);
    } catch (e) {
      this._isCapturing = false;
      throw e;
    } finally {
      await this.cleanup();
    }
  }

  onFrame(cb: AudioFrameCallback): void {
    this._frameCb = cb;
  }

  getVolumeLevel(): number {
    return this._volumeLevel;
  }

  /** 启动音量轮询：周期性读取 metering 并触发帧回调（用于 VAD） */
  private startMetering(): void {
    this.stopMetering();
    this._meteringTimer = setInterval(async () => {
      const rec = this._recording;
      if (!rec || !this._isCapturing) return;
      try {
        const status = await rec.getStatusAsync();
        if (status.isRecording && status.metering != null) {
          // metering 为 dBFS（-160 静音 ~ 0 最大），转换为 0.0 ~ 1.0 线性音量
          const db = status.metering;
          const level = db <= -160 ? 0 : Math.min(1, Math.pow(10, db / 20));
          this._volumeLevel = level;
          // 帧回调：发送 4 字节 Float32 表示当前能量（VAD 主要依赖能量）
          if (this._frameCb) {
            const buf = new ArrayBuffer(4);
            new DataView(buf).setFloat32(0, level, true);
            this._frameCb(buf);
          }
        }
      } catch {
        // 忽略单次采样错误
      }
    }, 100);
  }

  private stopMetering(): void {
    if (this._meteringTimer) {
      clearInterval(this._meteringTimer);
      this._meteringTimer = null;
    }
  }

  /** 停止录音后清理资源并恢复播放模式 */
  private async cleanup(): Promise<void> {
    this.stopMetering();
    if (this._recording) {
      try {
        await this._recording.stopAndUnloadAsync();
      } catch {
        // 忽略未启动 / 已停止错误
      }
      this._recording = null;
    }
    // 恢复为播放模式
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: false,
      });
    } catch {
      // 忽略
    }
  }
}

// ============ 可见性检测 ============

/** RN 可见性检测器（基于 AppState） */
export class RNVisibilityProvider implements IVisibilityProvider {
  private _state: VisibilityState;

  constructor() {
    this._state = this.mapStatus(AppState.currentState);
  }

  get isVisible(): boolean {
    return this._state === 'visible';
  }

  get state(): VisibilityState {
    return this._state;
  }

  /** 将 AppStateStatus 映射为 VisibilityState */
  private mapStatus(status: AppStateStatus | null): VisibilityState {
    switch (status) {
      case 'active':
        return 'visible';
      case 'background':
        return 'background';
      default:
        // inactive / unknown / null
        return 'hidden';
    }
  }

  onChange(cb: (state: VisibilityState) => void): () => void {
    const subscription = AppState.addEventListener('change', (next) => {
      const mapped = this.mapStatus(next);
      if (mapped !== this._state) {
        this._state = mapped;
        cb(mapped);
      }
    });
    return () => {
      subscription.remove();
    };
  }
}

// ============ 适配器集合（供依赖注入使用） ============

export interface RNAdapters {
  audioPlayer: IAudioPlayer;
  audioCapture: IAudioCapture;
  visibilityProvider: IVisibilityProvider;
}

/** RN 端适配器单例 */
export const rnAdapters: RNAdapters = {
  audioPlayer: new RNAudioPlayer(),
  audioCapture: new RNAudioCapture(),
  visibilityProvider: new RNVisibilityProvider(),
};

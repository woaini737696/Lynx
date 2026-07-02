// ============ 全双工语音通话页面 ============
// 模态页面：录音 → ASR → AI 回复 → TTS → 播放 → 下一轮录音
// 支持 VAD 端点检测（能量阈值法）与中途打断（用户说话时停止 TTS）
// 通话状态机：idle → listening → thinking → speaking → listening → ... → idle（挂断）
// 深邃星空蓝深色主题（对齐 Kotlin 端，背景 Void，状态色用 Primary/Think/Agent）

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PhoneOff, Mic, Volume2, AlertCircle } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Audio } from 'expo-av';
import { API_BASE_URL } from '@/config/env';
import { getToken } from '@/lib/auth';
import { encodeWav } from '@lynnhub/shared';
import type { AssistantStackParamList } from '@/navigation/AssistantStack';
import {
  Void,
  Primary,
  Think,
  Agent,
  Danger,
  TextPrimary,
  TextMuted,
  Liquid2,
  LiquidBorder,
} from '@/theme/colors';

// ============ 类型定义 ============

/** 通话状态机 */
type CallState = 'idle' | 'listening' | 'thinking' | 'speaking';

/** API 消息格式 */
interface ApiMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** ASR 响应 */
interface AsrResponse {
  text: string;
}

/** Chat（非流式）响应 */
interface ChatResponse {
  content: string;
  provider?: string;
  model?: string;
}

// ============ 常量 ============

/** 采样率（16kHz，与 ASR 模型匹配） */
const SAMPLE_RATE = 16000;

/** VAD 检查间隔（毫秒） */
const VAD_CHECK_INTERVAL_MS = 100;

/** VAD 静音阈值（dB，低于此值视为静默。典型范围 -50 ~ -25） */
const VAD_SILENCE_THRESHOLD_DB = -35;

/** VAD 连续静默时长（毫秒），达到则认为说话结束 */
const VAD_SILENCE_DURATION_MS = 1200;

/** 录音最短时长（毫秒），低于此值认为误触发，丢弃 */
const MIN_RECORDING_DURATION_MS = 400;

/** 中途打断：音量高于此阈值（dB）视为用户开始说话 */
const INTERRUPT_THRESHOLD_DB = -28;

/** 中途打断：连续检测到说话的时长（毫秒），达到则触发打断 */
const INTERRUPT_DURATION_MS = 300;

/** 最大对话历史轮次（避免上下文过长） */
const MAX_HISTORY_ROUNDS = 8;

/** 录音配置（16kHz / 16bit / mono / WAV） */
const RECORDING_OPTIONS: Audio.RecordingOptions = {
  isMeteringEnabled: true,
  android: {
    extension: '.wav',
    outputFormat: Audio.AndroidOutputFormat.DEFAULT,
    audioEncoder: Audio.AndroidAudioEncoder.DEFAULT,
    sampleRate: SAMPLE_RATE,
    numberOfChannels: 1,
    bitRate: 256000,
  },
  ios: {
    extension: '.wav',
    outputFormat: Audio.IOSOutputFormat.LINEARPCM,
    audioQuality: Audio.IOSAudioQuality.HIGH,
    sampleRate: SAMPLE_RATE,
    numberOfChannels: 1,
    bitRate: 256000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {
    mimeType: 'audio/wav',
    bitsPerSecond: 256000,
  },
};

/** 波形条数 */
const WAVE_BAR_COUNT = 7;

// ============ 工具函数 ============

/** 手动 Base64 编码（RN 中 btoa 可能不可用，提供兜底实现） */
function manualBase64Encode(str: string): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  for (let i = 0; i < str.length; i += 3) {
    const b1 = str.charCodeAt(i);
    const b2 = i + 1 < str.length ? str.charCodeAt(i + 1) : -1;
    const b3 = i + 2 < str.length ? str.charCodeAt(i + 2) : -1;
    result += chars[b1 >> 2];
    result += chars[((b1 & 3) << 4) | (b2 >= 0 ? b2 >> 4 : 0)];
    result += b2 >= 0 ? chars[((b2 & 15) << 2) | (b3 >= 0 ? b3 >> 6 : 0)] : '=';
    result += b3 >= 0 ? chars[b3 & 63] : '=';
  }
  return result;
}

/** ArrayBuffer 转 Base64 字符串（分块处理避免栈溢出） */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000; // 32KB
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  // 优先使用平台 btoa，不可用时回退到手动实现
  const btoaFn = (globalThis as { btoa?: (s: string) => string }).btoa;
  return btoaFn ? btoaFn(binary) : manualBase64Encode(binary);
}

/**
 * 将原始 PCM Float32 样本编码为 WAV 格式 Base64 字符串。
 * 使用 @lynnhub/shared 的 encodeWav 编码。
 * （当录音器返回原始 PCM 帧时使用此函数；expo-av 文件模式下直接读取文件）
 */
export function encodePcmToWavBase64(
  samples: Float32Array,
  sampleRate: number = SAMPLE_RATE
): string {
  const wavBuffer = encodeWav(samples, sampleRate);
  return arrayBufferToBase64(wavBuffer);
}

/** 读取录音文件为 ArrayBuffer */
async function readRecordingFile(uri: string): Promise<ArrayBuffer> {
  const response = await fetch(uri);
  return await response.arrayBuffer();
}

/** dB 转音量级别（0.0 ~ 1.0，用于波形显示） */
function dbToVolume(db: number): number {
  // metering 范围通常 -160 ~ 0，映射到 0 ~ 1
  if (db <= -60) return 0;
  if (db >= 0) return 1;
  return (db + 60) / 60;
}

// ============ API 调用 ============

/** 调用 ASR：POST /api/ai/asr-base64，返回识别文本 */
async function callAsr(audioBase64: string): Promise<string> {
  const token = await getToken();
  const res = await fetch(`${API_BASE_URL}/api/ai/asr-base64`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      audio: audioBase64,
      mimeType: 'audio/wav',
    }),
  });

  if (!res.ok) {
    let msg = `ASR 请求失败（${res.status}）`;
    try {
      const data = await res.json();
      if (data?.error) {
        msg = typeof data.error === 'string' ? data.error : data.error.message || msg;
      }
    } catch {
      // 非 JSON
    }
    throw new Error(msg);
  }

  const data: AsrResponse = await res.json();
  return data.text || '';
}

/** 调用 Chat（非流式）：POST /api/ai/chat，返回完整回复 */
async function callChat(messages: ApiMessage[]): Promise<string> {
  const token = await getToken();
  const res = await fetch(`${API_BASE_URL}/api/ai/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      messages,
      stream: false,
      assistantMode: true,
    }),
  });

  if (!res.ok) {
    let msg = `Chat 请求失败（${res.status}）`;
    try {
      const data = await res.json();
      if (data?.error) {
        msg = typeof data.error === 'string' ? data.error : data.error.message || msg;
      }
    } catch {
      // 非 JSON
    }
    throw new Error(msg);
  }

  const data: ChatResponse = await res.json();
  return data.content || '';
}

/** 调用 TTS：POST /api/ai/tts，返回 WAV 格式 Base64 音频 */
async function callTts(text: string): Promise<string> {
  const token = await getToken();
  const res = await fetch(`${API_BASE_URL}/api/ai/tts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ text }),
  });

  if (!res.ok) {
    let msg = `TTS 请求失败（${res.status}）`;
    try {
      const data = await res.json();
      if (data?.error) {
        msg = typeof data.error === 'string' ? data.error : data.error.message || msg;
      }
    } catch {
      // 非 JSON
    }
    throw new Error(msg);
  }

  // TTS 返回 WAV 二进制数据，转为 Base64
  const arrayBuffer = await res.arrayBuffer();
  return arrayBufferToBase64(arrayBuffer);
}

// ============ 波形动画组件 ============

function Waveform({ volume, active, color }: { volume: number; active: boolean; color: string }) {
  // 每根条的 Animated.Value（只初始化一次）
  const barsRef = useRef<Animated.Value[]>(
    Array.from({ length: WAVE_BAR_COUNT }, () => new Animated.Value(0.2))
  );

  // 当 volume 或 active 变化时，触发波形动画
  useEffect(() => {
    const bars = barsRef.current;
    if (!active) {
      // 非活跃状态：所有条归位到最小高度
      Animated.parallel(
        bars.map((bar) =>
          Animated.timing(bar, {
            toValue: 0.15,
            duration: 300,
            easing: Easing.out(Easing.ease),
            useNativeDriver: false,
          })
        )
      ).start();
      return;
    }

    // 活跃状态：根据 volume 设置每根条的高度（中心高，两侧递减）
    Animated.parallel(
      bars.map((bar, i) => {
        const centerOffset =
          1 - Math.abs(i - (WAVE_BAR_COUNT - 1) / 2) / ((WAVE_BAR_COUNT - 1) / 2);
        const targetHeight = Math.max(0.15, volume * (0.4 + centerOffset * 0.6));
        return Animated.timing(bar, {
          toValue: targetHeight,
          duration: 120,
          easing: Easing.out(Easing.ease),
          useNativeDriver: false,
        });
      })
    ).start();
  }, [volume, active]);

  return (
    <View style={styles.waveContainer}>
      {barsRef.current.map((bar, i) => (
        <Animated.View
          key={i}
          style={[
            styles.waveBar,
            {
              height: bar.interpolate({
                inputRange: [0, 1],
                outputRange: ['15%', '100%'],
              }),
              backgroundColor: color,
              opacity: active ? 1 : 0.3,
            },
          ]}
        />
      ))}
    </View>
  );
}

// ============ 辅助：状态颜色 ============

function stateColor(state: CallState): string {
  switch (state) {
    case 'listening':
      return '#0F62FE'; // 深海宇宙蓝
    case 'thinking':
      return '#F59E0B'; // 琥珀金
    case 'speaking':
      return '#10B981'; // 翡翠绿
    default:
      return '#6B7280';
  }
}

// ============ 主组件 ============

type NavProp = NativeStackNavigationProp<AssistantStackParamList, 'VoiceCall'>;

export function VoiceCallScreen() {
  const navigation = useNavigation<NavProp>();

  const [callState, setCallState] = useState<CallState>('idle');
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string>('');

  // refs（同步读取，避免闭包过期）
  const recordingRef = useRef<Audio.Recording | null>(null);
  const monitorRecordingRef = useRef<Audio.Recording | null>(null); // 播放期间监听打断
  const soundRef = useRef<Audio.Sound | null>(null);
  const vadTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const interruptTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const silenceStartRef = useRef<number | null>(null);
  const interruptStartRef = useRef<number | null>(null);
  const recordingStartRef = useRef<number>(0);
  const stateRef = useRef<CallState>('idle');
  const conversationRef = useRef<ApiMessage[]>([]);
  const isMountedRef = useRef(true);
  const isHangingUpRef = useRef(false);

  /**
   * 方法引用容器：打破函数间循环依赖。
   * 所有跨函数调用通过 methodsRef.current.xxx() 进行，避免 useCallback 闭包过期
   * 和 TypeScript 前向引用错误。
   */
  const methodsRef = useRef<{
    startListening: () => Promise<void>;
    processAudioRound: () => Promise<void>;
    playTtsAndMonitor: (audioBase64: string) => Promise<void>;
    startInterruptMonitor: () => Promise<void>;
    handleInterrupt: () => Promise<void>;
  }>({
    startListening: async () => {},
    processAudioRound: async () => {},
    playTtsAndMonitor: async () => {},
    startInterruptMonitor: async () => {},
    handleInterrupt: async () => {},
  });

  // 同步更新状态（ref + state）
  const updateState = (next: CallState) => {
    if (!isMountedRef.current) return;
    stateRef.current = next;
    setCallState(next);
  };

  // ============ 清理函数 ============
  const cleanupRecording = async () => {
    if (vadTimerRef.current) {
      clearInterval(vadTimerRef.current);
      vadTimerRef.current = null;
    }
    silenceStartRef.current = null;
    if (recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync();
      } catch {
        // 忽略未开始/已停止错误
      }
      recordingRef.current = null;
    }
  };

  const cleanupMonitor = async () => {
    if (interruptTimerRef.current) {
      clearInterval(interruptTimerRef.current);
      interruptTimerRef.current = null;
    }
    interruptStartRef.current = null;
    if (monitorRecordingRef.current) {
      try {
        await monitorRecordingRef.current.stopAndUnloadAsync();
      } catch {
        // 忽略
      }
      monitorRecordingRef.current = null;
    }
  };

  const cleanupSound = async () => {
    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
      } catch {
        // 忽略
      }
      soundRef.current = null;
    }
  };

  const cleanupAll = async () => {
    await cleanupRecording();
    await cleanupMonitor();
    await cleanupSound();
  };

  // ============ 挂断 ============
  const hangup = async () => {
    if (isHangingUpRef.current) return;
    isHangingUpRef.current = true;
    updateState('idle');
    await cleanupAll();
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      (navigation as unknown as {
        reset: (s: { index: number; routes: Array<{ name: string }> }) => void;
      }).reset({
        index: 0,
        routes: [{ name: 'Assistant' }],
      });
    }
  };

  // ============ Listening：开始录音 + VAD ============
  const startListening = async () => {
    if (isHangingUpRef.current || !isMountedRef.current) return;
    setError(null);
    updateState('listening');
    setVolumeLevel(0);
    silenceStartRef.current = null;
    recordingStartRef.current = Date.now();

    try {
      await cleanupRecording(); // 确保上一次录音已清理
      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(RECORDING_OPTIONS);
      await recording.startAsync();
      recordingRef.current = recording;

      // VAD 定时器：每 100ms 检查音量
      vadTimerRef.current = setInterval(async () => {
        if (!recordingRef.current || stateRef.current !== 'listening') {
          return;
        }
        try {
          const status = await recordingRef.current.getStatusAsync();
          const metering = status.metering ?? -160;
          const vol = dbToVolume(metering);
          if (isMountedRef.current) setVolumeLevel(vol);

          // VAD：检测静默
          if (metering < VAD_SILENCE_THRESHOLD_DB) {
            if (silenceStartRef.current === null) {
              silenceStartRef.current = Date.now();
            } else if (Date.now() - silenceStartRef.current >= VAD_SILENCE_DURATION_MS) {
              // 静默持续足够长，认为说话结束
              const recordingDuration = Date.now() - recordingStartRef.current;
              // 清除 VAD 定时器，避免重复触发
              if (vadTimerRef.current) {
                clearInterval(vadTimerRef.current);
                vadTimerRef.current = null;
              }
              if (recordingDuration < MIN_RECORDING_DURATION_MS) {
                // 录音过短，视为误触发，重新开始
                silenceStartRef.current = null;
                methodsRef.current.startListening();
              } else {
                // 触发处理流程
                methodsRef.current.processAudioRound();
              }
            }
          } else {
            // 检测到声音，重置静默计时
            silenceStartRef.current = null;
          }
        } catch {
          // 读取状态失败，忽略
        }
      }, VAD_CHECK_INTERVAL_MS);
    } catch (e) {
      setError('录音启动失败：' + (e as Error).message);
      updateState('idle');
    }
  };

  // ============ 处理一轮语音：ASR → Chat → TTS → 播放 ============
  const processAudioRound = async () => {
    if (isHangingUpRef.current || !isMountedRef.current) return;
    updateState('thinking');
    setVolumeLevel(0);

    let audioUri: string | null = null;
    try {
      // 停止录音并获取文件
      const recording = recordingRef.current;
      if (!recording) {
        methodsRef.current.startListening();
        return;
      }
      await recording.stopAndUnloadAsync();
      audioUri = recording.getURI();
      recordingRef.current = null;

      if (!audioUri) {
        setError('录音文件获取失败');
        methodsRef.current.startListening();
        return;
      }

      // 1. ASR：读取文件 → Base64 → /api/ai/asr-base64
      const audioBuffer = await readRecordingFile(audioUri);
      const audioBase64 = arrayBufferToBase64(audioBuffer);
      const userText = await callAsr(audioBase64);

      if (!userText.trim()) {
        // ASR 返回空文本，直接重新开始监听
        methodsRef.current.startListening();
        return;
      }

      if (isHangingUpRef.current || !isMountedRef.current) return;
      setTranscript(userText);

      // 加入对话历史
      conversationRef.current.push({ role: 'user', content: userText });
      // 限制历史长度
      if (conversationRef.current.length > MAX_HISTORY_ROUNDS * 2) {
        conversationRef.current = conversationRef.current.slice(-MAX_HISTORY_ROUNDS * 2);
      }

      // 2. Chat（非流式）
      const aiReply = await callChat([...conversationRef.current]);
      if (isHangingUpRef.current || !isMountedRef.current) return;

      conversationRef.current.push({ role: 'assistant', content: aiReply });

      // 3. TTS
      const audioBase64Tts = await callTts(aiReply);
      if (isHangingUpRef.current || !isMountedRef.current) return;

      // 4. 播放 TTS 音频
      await methodsRef.current.playTtsAndMonitor(audioBase64Tts);
    } catch (e) {
      if (isHangingUpRef.current || !isMountedRef.current) return;
      const msg = (e as Error).message || '处理失败';
      setError(msg);
      // 出错后稍等再重新开始监听
      setTimeout(() => {
        if (!isHangingUpRef.current && isMountedRef.current) {
          methodsRef.current.startListening();
        }
      }, 1500);
    }
  };

  // ============ 播放 TTS + 监听打断 ============
  const playTtsAndMonitor = async (audioBase64: string) => {
    if (isHangingUpRef.current || !isMountedRef.current) return;
    updateState('speaking');
    setVolumeLevel(0.3);

    try {
      await cleanupSound();
      // 从 Base64 创建 Sound（data URI 方式，iOS 完全支持，Android 短音频可用）
      const source = { uri: `data:audio/wav;base64,${audioBase64}` };
      const { sound } = await Audio.Sound.createAsync(source, {
        shouldPlay: true,
        volume: 1.0,
        progressUpdateIntervalMillis: 100,
      });
      soundRef.current = sound;

      // 设置播放完成回调
      sound.setOnPlaybackStatusUpdate((status) => {
        if (
          status.isLoaded &&
          status.didJustFinish &&
          !isHangingUpRef.current &&
          isMountedRef.current
        ) {
          // 播放完成，清理监听并开始下一轮录音
          cleanupMonitor().then(() => {
            methodsRef.current.startListening();
          });
        }
      });

      // 启动监听录音（用于中途打断检测）
      methodsRef.current.startInterruptMonitor();
    } catch {
      if (isHangingUpRef.current || !isMountedRef.current) return;
      // 播放失败（可能是 data URI 在 Android 不支持），跳过播放直接进入下一轮
      await cleanupMonitor();
      methodsRef.current.startListening();
    }
  };

  // ============ 中途打断监听 ============
  const startInterruptMonitor = async () => {
    if (isHangingUpRef.current || !isMountedRef.current) return;
    try {
      await cleanupMonitor();
      const monitor = new Audio.Recording();
      await monitor.prepareToRecordAsync(RECORDING_OPTIONS);
      await monitor.startAsync();
      monitorRecordingRef.current = monitor;

      interruptStartRef.current = null;
      interruptTimerRef.current = setInterval(async () => {
        if (!monitorRecordingRef.current || stateRef.current !== 'speaking') {
          return;
        }
        try {
          const status = await monitorRecordingRef.current.getStatusAsync();
          const metering = status.metering ?? -160;
          const vol = dbToVolume(metering);
          if (isMountedRef.current) setVolumeLevel(Math.max(vol, 0.2));

          // 检测到用户说话
          if (metering > INTERRUPT_THRESHOLD_DB) {
            if (interruptStartRef.current === null) {
              interruptStartRef.current = Date.now();
            } else if (Date.now() - interruptStartRef.current >= INTERRUPT_DURATION_MS) {
              // 确认用户打断，停止 TTS 播放
              if (interruptTimerRef.current) {
                clearInterval(interruptTimerRef.current);
                interruptTimerRef.current = null;
              }
              methodsRef.current.handleInterrupt();
            }
          } else {
            interruptStartRef.current = null;
          }
        } catch {
          // 忽略
        }
      }, VAD_CHECK_INTERVAL_MS);
    } catch {
      // 监听录音启动失败（可能是设备不支持录音+播放同时进行），忽略，不启用打断检测
    }
  };

  // ============ 处理中途打断 ============
  const handleInterrupt = async () => {
    if (isHangingUpRef.current || !isMountedRef.current) return;
    // 停止 TTS 播放
    await cleanupSound();
    // 停止监听录音
    await cleanupMonitor();
    // 重新开始监听
    methodsRef.current.startListening();
  };

  // 更新方法引用容器（每次渲染都更新，确保闭包捕获最新状态）
  methodsRef.current.startListening = startListening;
  methodsRef.current.processAudioRound = processAudioRound;
  methodsRef.current.playTtsAndMonitor = playTtsAndMonitor;
  methodsRef.current.startInterruptMonitor = startInterruptMonitor;
  methodsRef.current.handleInterrupt = handleInterrupt;

  // ============ 音频模式初始化 ============
  useEffect(() => {
    isMountedRef.current = true;
    (async () => {
      try {
        // 请求麦克风权限
        const { status } = await Audio.requestPermissionsAsync();
        if (status !== 'granted') {
          setError('需要麦克风权限才能进行语音通话');
          updateState('idle');
          return;
        }
        // 设置音频模式：允许录音 + 静音模式下播放
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
        });
        // 开始通话
        methodsRef.current.startListening();
      } catch (e) {
        setError('音频初始化失败：' + (e as Error).message);
        updateState('idle');
      }
    })();

    return () => {
      isMountedRef.current = false;
      cleanupAll();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ============ 状态文案 ============
  const statusText = (() => {
    switch (callState) {
      case 'listening':
        return '正在聆听…';
      case 'thinking':
        return '思考中…';
      case 'speaking':
        return '回复中…';
      default:
        return '准备中…';
    }
  })();

  // ============ 渲染 ============
  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* ============ 顶部状态栏 ============ */}
      <View style={styles.topBar}>
        <View style={styles.statusPill}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: stateColor(callState) },
            ]}
          />
          <Text style={styles.statusText}>{statusText}</Text>
        </View>
      </View>

      {/* ============ 中部波形 ============ */}
      <View style={styles.waveArea}>
        <Waveform
          volume={volumeLevel}
          active={callState === 'listening' || callState === 'speaking'}
          color={stateColor(callState)}
        />

        {/* 实时识别文本（如果有） */}
        {transcript ? (
          <View style={styles.transcriptBox}>
            <Text style={styles.transcriptText} numberOfLines={3}>
              {transcript}
            </Text>
          </View>
        ) : null}

        {/* 错误提示 */}
        {error ? (
          <View style={styles.errorBox}>
            <AlertCircle size={14} color={Danger} />
            <Text style={styles.errorText} numberOfLines={2}>
              {error}
            </Text>
          </View>
        ) : null}
      </View>

      {/* ============ 底部挂断按钮 ============ */}
      <View style={styles.bottomBar}>
        {/* 状态图标 */}
        <View style={styles.stateIconWrap}>
          {callState === 'listening' ? (
            <Mic size={20} color="#0F62FE" />
          ) : callState === 'speaking' ? (
            <Volume2 size={20} color="#10B981" />
          ) : (
            <View style={styles.thinkingDot} />
          )}
        </View>

        {/* 挂断按钮 */}
        <TouchableOpacity style={styles.hangupBtn} onPress={hangup} activeOpacity={0.85}>
          <PhoneOff size={28} color="#FFFFFF" />
        </TouchableOpacity>

        {/* 占位（对称） */}
        <View style={styles.stateIconWrap} />
      </View>
    </SafeAreaView>
  );
}

// ============ 样式（深邃星空蓝深色主题，背景 Void） ============

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Void, // 最深背景
  },
  // 顶部状态栏
  topBar: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 12,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: Liquid2, // 二级玻璃
    borderRadius: 20,
    borderWidth: 1,
    borderColor: LiquidBorder,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: TextPrimary,
    letterSpacing: 0.5,
  },
  // 中部波形区
  waveArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  waveContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 160,
    gap: 8,
    width: '100%',
  },
  waveBar: {
    width: 6,
    borderRadius: 3,
    minHeight: 8,
  },
  // 识别文本
  transcriptBox: {
    marginTop: 32,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: Liquid2,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: LiquidBorder,
    maxWidth: '90%',
  },
  transcriptText: {
    fontSize: 14,
    lineHeight: 20,
    color: TextPrimary,
    textAlign: 'center',
  },
  // 错误提示
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 90, 90, 0.12)', // Danger 低透明度
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 90, 90, 0.2)',
    maxWidth: '90%',
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    color: Danger,
  },
  // 底部栏
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 32,
    paddingVertical: 24,
    paddingBottom: 36,
  },
  stateIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Liquid2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: LiquidBorder,
  },
  thinkingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Think,
  },
  // 挂断按钮（Danger 圆形）
  hangupBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Danger,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Danger,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 2,
    borderColor: LiquidBorder,
  },
});

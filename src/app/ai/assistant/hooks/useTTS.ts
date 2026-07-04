"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { toast } from "@/components/ui/toast";
import { clientLog } from "@/lib/client-logger";
import { splitSentences } from "../utils";

/** 单条消息语音播报（文本模式 / 消息列表播放按钮）队列，与全双工 StreamTTS 独立 */
export function useTTS() {
  const ttsQueueRef = useRef<Array<{ url: string; text: string }>>([]);
  const ttsPlayingRef = useRef(false);
  const ttsAbortRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [ttsLoadingId, setTtsLoadingId] = useState<string | null>(null);

  // 避免 speak 与 speakFallback 互相依赖导致 hook 依赖数组循环
  const speakFallbackRef = useRef(async (_text: string, _msgId?: string) => {});

  const stopSpeaking = useCallback(() => {
    ttsAbortRef.current = true;
    ttsQueueRef.current = [];
    ttsPlayingRef.current = false;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setSpeakingId(null);
  }, []);

  /** 流式 TTS：通过 SSE 逐句接收音频，边接收边播放，首包延迟 < 300ms */
  const speak = useCallback(async (text: string, msgId?: string) => {
    stopSpeaking();
    ttsAbortRef.current = false;
    const loadingId = msgId || `tts-${Date.now()}`;
    setTtsLoadingId(loadingId);
    if (msgId) setSpeakingId(msgId);

    // 使用流式 TTS API（SSE）
    try {
      const res = await fetch("/api/ai/tts/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!res.ok || !res.body) {
        // 流式 API 失败时回退到非流式
        clientLog.voiceWarn("tts-stream-api-failed-fallback", {
          status: res.status,
          msgId,
          textLen: text.length,
        });
        setTtsLoadingId(null);
        await speakFallbackRef.current(text, msgId);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let firstSentenceReceived = false;
      const audioQueue: Array<{ url: string; text: string }> = [];
      let queuePlaying = false;

      // 播放队列函数
      const playQueue = async () => {
        if (queuePlaying) return;
        queuePlaying = true;
        ttsPlayingRef.current = true;
        while (!ttsAbortRef.current) {
          const item = audioQueue.shift();
          if (!item) {
            // 队列空，等待新内容
            await new Promise(r => setTimeout(r, 50));
            continue;
          }
          const audio = new Audio(item.url);
          audioRef.current = audio;
          try {
            await audio.play();
            await new Promise<void>((resolve) => {
              audio.onended = () => { URL.revokeObjectURL(item.url); resolve(); };
              audio.onerror = () => { URL.revokeObjectURL(item.url); resolve(); };
            });
          } catch {
            URL.revokeObjectURL(item.url);
          }
          audioRef.current = null;
        }
        queuePlaying = false;
        ttsPlayingRef.current = false;
        setSpeakingId(null);
      };

      // 启动播放循环
      playQueue();

      // 解析 SSE 数据
      while (true) {
        if (ttsAbortRef.current) break;
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // 按 SSE 协议解析（data: ...\n\n）
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || ""; // 保留最后未完整的块

        for (const line of lines) {
          const dataLine = line.trim();
          if (!dataLine.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(dataLine.slice(6));
            if (data.type === "sentence" && data.audioBase64) {
              // base64 → blob URL
              const byteChars = atob(data.audioBase64);
              const byteNumbers = new Uint8Array(byteChars.length);
              for (let i = 0; i < byteChars.length; i++) {
                byteNumbers[i] = byteChars.charCodeAt(i);
              }
              const blob = new Blob([byteNumbers], { type: `audio/${data.format || "wav"}` });
              const url = URL.createObjectURL(blob);
              audioQueue.push({ url, text: data.text });

              // 第一句到达后立即取消 loading 状态
              if (!firstSentenceReceived) {
                firstSentenceReceived = true;
                setTtsLoadingId(null);
              }
            } else if (data.type === "done") {
              // 标记流结束，播放循环会在队列空后自动停止
              // 给播放循环一点时间处理剩余队列
              setTimeout(() => {
                if (audioQueue.length === 0) {
                  ttsAbortRef.current = true;
                }
              }, 500);
            } else if (data.type === "error") {
              clientLog.voiceWarn("tts-stream-sentence-error", {
                index: data.index,
                message: data.message,
              });
            }
          } catch {
            // JSON 解析失败，跳过
          }
        }
      }

      // 等待播放队列完成
      if (!firstSentenceReceived) {
        setTtsLoadingId(null);
        clientLog.voiceError("tts-stream-no-sentence-received", {
          msgId,
          textLen: text.length,
          textPreview: text.slice(0, 80),
        });
        toast("语音合成失败：服务端未返回任何音频，请检查日志", "error");
        setSpeakingId(null);
      }
    } catch (e) {
      setTtsLoadingId(null);
      clientLog.voiceError("tts-stream-network-error-fallback", {
        msgId,
        error: e instanceof Error ? e.message : String(e),
      });
      // 网络错误时回退到非流式
      await speakFallbackRef.current(text, msgId);
    }
  }, [stopSpeaking]);

  /** 非流式 TTS 回退方案（流式 API 不可用时使用） */
  const speakFallback = useCallback(async (text: string, msgId?: string) => {
    const sentences = splitSentences(text);
    const queue: Array<{ url: string; text: string }> = [];

    const synthesizeSentence = async (sentence: string): Promise<string | null> => {
      try {
        const res = await fetch("/api/ai/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: sentence }),
        });
        if (!res.ok) {
          let reason = `HTTP ${res.status}`;
          try {
            const errJson = await res.json().catch(() => null);
            if (errJson?.error) reason = String(errJson.error).slice(0, 120);
          } catch { /* noop */ }
          clientLog.voiceWarn("tts-fallback-sentence-failed", {
            status: res.status,
            reason,
            sentencePreview: sentence.slice(0, 50),
          });
          return null;
        }
        const blob = await res.blob();
        return URL.createObjectURL(blob);
      } catch (e) {
        clientLog.voiceError("tts-fallback-sentence-exception", {
          error: e instanceof Error ? e.message : String(e),
          sentencePreview: sentence.slice(0, 50),
        });
        return null;
      }
    };

    const firstBatch = sentences.slice(0, 2).map(s => synthesizeSentence(s));
    const firstUrls = await Promise.all(firstBatch);
    for (let i = 0; i < firstUrls.length; i++) {
      if (firstUrls[i]) queue.push({ url: firstUrls[i]!, text: sentences[i] });
    }

    if (queue.length === 0) {
      clientLog.voiceError("tts-fallback-all-failed", {
        msgId,
        sentenceCount: sentences.length,
      });
      toast("语音合成失败：所有句子均失败，请检查服务端 TTS 配置", "error");
      setSpeakingId(null);
      return;
    }

    ttsQueueRef.current = queue;
    const synthesizeRest = async () => {
      for (let i = 2; i < sentences.length; i++) {
        if (ttsAbortRef.current) return;
        const url = await synthesizeSentence(sentences[i]);
        if (url && !ttsAbortRef.current) {
          ttsQueueRef.current.push({ url, text: sentences[i] });
        }
      }
    };
    synthesizeRest();

    const playQueue = async () => {
      ttsPlayingRef.current = true;
      while (!ttsAbortRef.current) {
        const item = ttsQueueRef.current.shift();
        if (!item) {
          if (ttsAbortRef.current) break;
          await new Promise(r => setTimeout(r, 100));
          continue;
        }
        const audio = new Audio(item.url);
        audioRef.current = audio;
        try {
          await audio.play();
          await new Promise<void>((resolve) => {
            audio.onended = () => { URL.revokeObjectURL(item.url); resolve(); };
            audio.onerror = () => { URL.revokeObjectURL(item.url); resolve(); };
          });
        } catch {
          URL.revokeObjectURL(item.url);
        }
        audioRef.current = null;
      }
      ttsPlayingRef.current = false;
      setSpeakingId(null);
    };
    playQueue();
  }, []);
  speakFallbackRef.current = speakFallback;

  // 组件卸载时清理音频资源
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  return {
    audioRef,
    speakingId,
    ttsLoadingId,
    stopSpeaking,
    speak,
  };
}

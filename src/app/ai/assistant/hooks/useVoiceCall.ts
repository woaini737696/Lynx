"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { toast } from "@/components/ui/toast";
import { VoiceVAD } from "@/lib/voice-vad";
import { StreamASR, isStreamASRSupported } from "@/lib/voice-asr-stream";
import { StreamTTS } from "@/lib/voice-tts-stream";
import { BackchannelPlayer } from "@/lib/voice-backchannel";
import { createMediaRecorder } from "../utils";
import type { Message, VoicePhase } from "../types";
import type { ModelSwitcherValue } from "@/components/ui/ModelSwitcher";

interface UseVoiceCallParams {
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setThinking: React.Dispatch<React.SetStateAction<boolean>>;
  abortRef: React.MutableRefObject<AbortController | null>;
  modelConfig: ModelSwitcherValue;
  currentSessionId: string | null;
  fetchSessions: () => Promise<any>;
  stopSpeaking: () => void;
  transcribeAudioRef: React.MutableRefObject<(blob: Blob) => Promise<string | null>>;
}

/** 全双工语音通话：流式 ASR + VAD + StreamTTS 边生成边播 */
export function useVoiceCall(params: UseVoiceCallParams) {
  const { messages, setMessages, setThinking, abortRef, modelConfig, currentSessionId, fetchSessions, stopSpeaking, transcribeAudioRef } = params;
  const [voiceCallActive, setVoiceCallActive] = useState(false);
  const [voiceCallPhase, setVoiceCallPhase] = useState<VoicePhase>("listening");
  const voiceCallPhaseRef = useRef<VoicePhase>("listening");
  const [asrInterimText, setAsrInterimText] = useState("");
  const [voiceVolume, setVoiceVolume] = useState(0);
  const [voiceStreamSupported] = useState<boolean>(() => typeof window !== "undefined" && isStreamASRSupported());
  const voiceModeActiveRef = useRef(false);
  const voiceCallStreamRef = useRef<MediaStream | null>(null);
  const voiceCallRecorderRef = useRef<MediaRecorder | null>(null);
  const voiceCallSilenceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const voiceVadRef = useRef<VoiceVAD | null>(null);
  const streamAsrRef = useRef<StreamASR | null>(null);
  const streamTtsRef = useRef<StreamTTS | null>(null);
  const backchannelRef = useRef<BackchannelPlayer | null>(null);
  const voiceSendLockRef = useRef(false);
  const sendVoiceRef = useRef<(text: string) => Promise<void>>(async () => {});
  const handleVoiceSpeechEndRef = useRef<() => void>(() => {});

  const setPhase = useCallback((p: VoicePhase) => {
    voiceCallPhaseRef.current = p;
    setVoiceCallPhase(p);
  }, []);

  /** 全双工语音：流式发送给 LLM，边生成边喂 StreamTTS 播放（不走 assistantMode，最低延迟） */
  const sendVoice = async (text: string) => {
    const content = text.trim();
    if (!content) return;
    streamTtsRef.current?.stop();
    streamTtsRef.current?.reset();
    stopSpeaking();
    const userMsg: Message = { id: `u-${Date.now()}`, role: "user", content, time: "刚刚" };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setThinking(true);
    setPhase("thinking");
    if (currentSessionId) {
      fetch(`/api/ai/chat/sessions/${currentSessionId}/messages`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "user", content }),
      }).catch(() => {});
    }
    const aiMsgId = `a-${Date.now()}`;
    setMessages((prev) => [...prev, { id: aiMsgId, role: "assistant", content: "", time: "刚刚", streaming: true }]);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const apiMessages = nextMessages.filter((m) => !m.error).map((m) => ({ role: m.role, content: m.content }));
    const tts = streamTtsRef.current;
    if (tts) {
      tts.reset();
      tts.onPlayStart = () => { if (voiceModeActiveRef.current) setPhase("replying"); };
      tts.onComplete = () => { if (voiceModeActiveRef.current && voiceCallPhaseRef.current === "replying") setPhase("listening"); };
    }
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages, provider: modelConfig.provider, model: modelConfig.model, reasoningMode: modelConfig.reasoningMode, stream: true }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null);
        const errMsg = data?.error || `请求失败（${res.status}）`;
        setMessages((prev) => prev.map((m) => (m.id === aiMsgId ? { ...m, content: errMsg, error: true, streaming: false } : m)));
        toast(errMsg, "error");
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let aiContent = "";
      let sseBuffer = "";
      let voiceRafScheduled = false;
      let voiceRafId: number | null = null;
      let voiceStreamEnded = false;
      const flushVoiceDelta = () => {
        voiceRafScheduled = false;
        voiceRafId = null;
        if (voiceStreamEnded) return;
        setMessages((prev) => prev.map((m) => (m.id === aiMsgId ? { ...m, content: aiContent } : m)));
      };
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        sseBuffer += decoder.decode(value, { stream: true });
        const lines = sseBuffer.split("\n");
        sseBuffer = lines.pop() || "";
        for (const line of lines) {
          const t = line.trim();
          if (!t.startsWith("data:")) continue;
          const payload = t.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          try {
            const obj = JSON.parse(payload);
            if (obj.type === "delta" && typeof obj.content === "string") {
              aiContent += obj.content;
              tts?.feed(obj.content);
              if (!voiceRafScheduled && !voiceStreamEnded) {
                voiceRafScheduled = true;
                if (typeof requestAnimationFrame === "function") {
                  voiceRafId = requestAnimationFrame(flushVoiceDelta);
                } else {
                  setTimeout(flushVoiceDelta, 0);
                }
              }
            } else if (obj.type === "error") {
              console.warn("[Voice LLM stream]", obj.message);
            }
          } catch { /* ignore SSE parse error */ }
        }
      }
      voiceStreamEnded = true;
      if (voiceRafId !== null && typeof cancelAnimationFrame === "function") {
        cancelAnimationFrame(voiceRafId);
      }
      tts?.finish();
      setMessages((prev) => prev.map((m) => (m.id === aiMsgId ? { ...m, content: aiContent, streaming: false } : m)));
      if (currentSessionId && aiContent) {
        fetch(`/api/ai/chat/sessions/${currentSessionId}/messages`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: "assistant", content: aiContent, provider: modelConfig.provider, model: modelConfig.model }),
        }).then((r) => r.json()).then((data) => {
          if (data.message?.id) {
            setMessages((prev) => prev.map((m) => (m.id === aiMsgId ? { ...m, id: data.message.id } : m)));
          }
        }).catch(() => {});
        fetchSessions();
      }
    } catch (e) {
      const err = e as Error;
      if (err.name === "AbortError") {
        setMessages((prev) => prev.map((m) => (m.id === aiMsgId ? { ...m, streaming: false } : m)));
      } else {
        setMessages((prev) => prev.map((m) => (m.id === aiMsgId ? { ...m, content: "网络错误：" + err.message, error: true, streaming: false } : m)));
        toast("网络错误：" + err.message, "error");
      }
    } finally {
      setThinking(false);
      abortRef.current = null;
      if (voiceModeActiveRef.current && !streamTtsRef.current?.isPlaying) {
        setPhase("listening");
      }
    }
  };

  /** VAD 检测到说话结束：获取 ASR 累积文字，立即提交，重置 ASR */
  const handleVoiceSpeechEnd = () => {
    if (!voiceModeActiveRef.current || voiceSendLockRef.current) return;
    const asr = streamAsrRef.current;
    if (!asr) return;
    const text = asr.getAccumulatedText();
    asr.reset();
    setAsrInterimText("");
    if (text && text.length >= 2) {
      voiceSendLockRef.current = true;
      setPhase("thinking");
      sendVoice(text).finally(() => { voiceSendLockRef.current = false; });
    } else {
      setPhase("listening");
    }
  };

  /** 录音 fallback：浏览器不支持流式 ASR 时，用 MediaRecorder 周期录音 + ASR 转写 + sendVoice */
  const startVoiceFallbackRecording = () => {
    const stream = voiceCallStreamRef.current;
    if (!stream || !voiceModeActiveRef.current) return;
    try {
      const recorder = createMediaRecorder(stream);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = async () => {
        if (!voiceModeActiveRef.current) return;
        if (chunks.length === 0 || voiceSendLockRef.current) {
          if (voiceModeActiveRef.current) startVoiceFallbackRecording();
          return;
        }
        const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        if (blob.size < 2000) {
          if (voiceModeActiveRef.current) startVoiceFallbackRecording();
          return;
        }
        voiceSendLockRef.current = true;
        setPhase("thinking");
        const text = await transcribeAudioRef.current(blob);
        if (text && voiceModeActiveRef.current) {
          await sendVoiceRef.current(text);
        }
        voiceSendLockRef.current = false;
        if (voiceModeActiveRef.current) {
          setPhase("listening");
          startVoiceFallbackRecording();
        }
      };
      recorder.start();
      voiceCallRecorderRef.current = recorder;
      if (voiceCallSilenceRef.current) clearTimeout(voiceCallSilenceRef.current);
      voiceCallSilenceRef.current = setTimeout(() => {
        if (recorder.state !== "inactive") recorder.stop();
      }, 3000);
    } catch { /* noop */ }
  };

  const startVoiceCall = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        toast("当前环境不支持语音对话", "error");
        return;
      }
      stopSpeaking();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      voiceCallStreamRef.current = stream;
      voiceModeActiveRef.current = true;
      voiceSendLockRef.current = false;
      setVoiceCallActive(true);
      setAsrInterimText("");
      setVoiceVolume(0);
      setPhase("listening");
      const tts = new StreamTTS();
      streamTtsRef.current = tts;
      tts.onPlayStart = () => { if (voiceModeActiveRef.current) setPhase("replying"); };
      tts.onComplete = () => { if (voiceModeActiveRef.current && voiceCallPhaseRef.current === "replying") setPhase("listening"); };
      backchannelRef.current = new BackchannelPlayer();
      if (!voiceStreamSupported) {
        toast("浏览器不支持流式 ASR，已回退到录音模式", "info");
        startVoiceFallbackRecording();
        return;
      }
      const asr = new StreamASR({
        onInterim: (text) => { if (voiceModeActiveRef.current) setAsrInterimText(text); },
        onFinal: () => { if (voiceModeActiveRef.current) setAsrInterimText(""); },
        onError: (err) => { console.warn("[Voice ASR]", err); },
      });
      streamAsrRef.current = asr;
      asr.start();
      const vad = new VoiceVAD(stream, {
        onSpeechStart: () => {
          if (!voiceModeActiveRef.current) return;
          setPhase("speaking");
          if (streamTtsRef.current?.isPlaying) streamTtsRef.current.stop();
        },
        onShortPause: () => { if (!voiceModeActiveRef.current) return; backchannelRef.current?.play(); },
        onSpeechEnd: () => { if (!voiceModeActiveRef.current) return; handleVoiceSpeechEnd(); },
        onVolumeChange: (v) => { if (voiceModeActiveRef.current) setVoiceVolume(v); },
      });
      voiceVadRef.current = vad;
      vad.start();
      toast("语音通话已接通，开始说话即可", "success");
    } catch (e) {
      toast("无法访问麦克风：" + (e as Error).message, "error");
      stopVoiceCall();
    }
  };

  const stopVoiceCall = () => {
    voiceModeActiveRef.current = false;
    voiceVadRef.current?.stop();
    voiceVadRef.current = null;
    streamAsrRef.current?.stop();
    streamAsrRef.current = null;
    streamTtsRef.current?.stop();
    streamTtsRef.current = null;
    backchannelRef.current = null;
    if (voiceCallSilenceRef.current) { clearTimeout(voiceCallSilenceRef.current); voiceCallSilenceRef.current = null; }
    if (voiceCallRecorderRef.current && voiceCallRecorderRef.current.state !== "inactive") {
      voiceCallRecorderRef.current.stop();
    }
    voiceCallRecorderRef.current = null;
    if (voiceCallStreamRef.current) {
      voiceCallStreamRef.current.getTracks().forEach((t) => t.stop());
      voiceCallStreamRef.current = null;
    }
    setVoiceCallActive(false);
    setPhase("listening");
    setAsrInterimText("");
    setVoiceVolume(0);
    voiceSendLockRef.current = false;
    stopSpeaking();
  };

  // 组件卸载时清理全双工资源
  useEffect(() => {
    return () => {
      voiceModeActiveRef.current = false;
      voiceVadRef.current?.stop();
      streamAsrRef.current?.stop();
      streamTtsRef.current?.stop();
      if (voiceCallStreamRef.current) {
        voiceCallStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 通过 ref 持有最新 sendVoice/handleVoiceSpeechEnd，避免 VAD/fallback 闭包读到旧 messages
  useEffect(() => {
    sendVoiceRef.current = sendVoice;
    handleVoiceSpeechEndRef.current = handleVoiceSpeechEnd;
  });

  return {
    voiceCallActive,
    voiceCallPhase,
    asrInterimText,
    voiceVolume,
    voiceStreamSupported,
    voiceModeActiveRef,
    startVoiceCall,
    stopVoiceCall,
  };
}

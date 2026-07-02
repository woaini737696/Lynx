"use client";

import { useState, useRef } from "react";
import { toast } from "@/components/ui/toast";
import { webmToWav } from "@/lib/audio-utils";
import { createMediaRecorder } from "../utils";

interface UseRecordingParams {
  voiceModeActiveRef: React.MutableRefObject<boolean>;
  voiceCallActive: boolean;
  send: (text?: string) => Promise<void>;
  setInput: React.Dispatch<React.SetStateAction<string>>;
}

/** 单条消息录音 + ASR 转写（非全双工模式） */
export function useRecording(params: UseRecordingParams) {
  const { voiceModeActiveRef, voiceCallActive, send, setInput } = params;
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const transcribeAudio = async (blob: Blob): Promise<string | null> => {
    setTranscribing(true);
    try {
      // 将 webm/mp4 转为 wav（MiMo ASR 只支持 wav/mp3/flac/m4a/ogg）
      let wavBlob: Blob;
      let convertError: Error | null = null;
      try {
        wavBlob = await webmToWav(blob);
      } catch (e) {
        convertError = e as Error;
        // 转换失败：只有原始格式本身就是 ASR 支持的格式时才直接发送
        const rawType = blob.type || "";
        if (rawType.includes("mp4") || rawType.includes("m4a") || rawType.includes("ogg")) {
          wavBlob = blob;
        } else {
          console.error("[ASR] webmToWav 转换失败:", convertError);
          toast("音频格式转换失败，请重试", "error");
          return null;
        }
      }
      const form = new FormData();
      const ext = wavBlob.type.includes("wav") ? "wav" : wavBlob.type.includes("mp4") ? "m4a" : "wav";
      form.append("file", wavBlob, `audio.${ext}`);
      const res = await fetch("/api/ai/asr", { method: "POST", body: form });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        toast(data?.error || `语音识别失败（${res.status}）`, "error");
        return null;
      }
      const text = (data as { text?: string }).text?.trim();
      return text || null;
    } catch (e) {
      toast("语音识别错误：" + (e as Error).message, "error");
      return null;
    } finally {
      setTranscribing(false);
    }
  };

  const startRecording = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        toast("当前环境不支持录音（需 HTTPS 或 localhost）", "error");
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = createMediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        const text = await transcribeAudio(blob);
        if (text) {
          if (voiceModeActiveRef.current && voiceCallActive) {
            send(text);
          } else {
            setInput((prev) => (prev ? `${prev} ${text}` : text));
            toast("语音识别完成", "info");
          }
        }
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
    } catch (e) {
      toast("录音启动失败：" + (e as Error).message, "error");
    }
  };

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    setRecording(false);
  };

  return {
    recording,
    transcribing,
    transcribeAudio,
    startRecording,
    stopRecording,
  };
}

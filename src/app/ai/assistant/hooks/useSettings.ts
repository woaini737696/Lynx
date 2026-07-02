"use client";

import { useState, useRef } from "react";
import { toast } from "@/components/ui/toast";
import type { AISettings } from "../types";
import { DEFAULT_SETTINGS } from "../types";

/** AI 助理设置管理（含头像、音色复刻、飞书通知） */
export function useSettings(speak: (text: string, msgId?: string) => Promise<void>) {
  const [settings, setSettings] = useState<AISettings>(DEFAULT_SETTINGS);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [cloneUploading, setCloneUploading] = useState(false);
  const [cloneTesting, setCloneTesting] = useState(false);
  const cloneFileRef = useRef<HTMLInputElement>(null);

  // 头像上传
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarFileRef = useRef<HTMLInputElement>(null);

  // 风格蒸馏增强
  const [distillPreviewing, setDistillPreviewing] = useState(false);
  const [distillPreviewReply, setDistillPreviewReply] = useState<string | null>(null);

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/ai/settings");
      const data = await res.json();
      if (data.settings) {
        setSettings({
          assistantName: data.settings.assistantName || "Lynn",
          assistantAvatar: data.settings.assistantAvatar || "🤖",
          avatarUrl: data.settings.avatarUrl || null,
          personaStyle: data.settings.personaStyle || null,
          distilledStyle: data.settings.distilledStyle || null,
          styleStrength: data.settings.styleStrength ?? 0.7,
          clonedVoiceId: data.settings.clonedVoiceId || null,
          clonedVoiceName: data.settings.clonedVoiceName || null,
          clonedAt: data.settings.clonedAt || null,
          defaultVoice: data.settings.defaultVoice || "mimo_default",
          autoSpeak: data.settings.autoSpeak ?? false,
          voiceMode: data.settings.voiceMode ?? false,
          feishuNotify: data.settings.feishuNotify ?? false,
          hermesTakeover: data.settings.hermesTakeover ?? false,
          hermesAutoReport: data.settings.hermesAutoReport ?? false,
          hermesReportCron: data.settings.hermesReportCron || "0 9 * * *",
        });
      }
    } catch {}
  };

  const updateSettings = async (partial: Partial<AISettings>) => {
    try {
      const res = await fetch("/api/ai/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(partial),
      });
      const data = await res.json();
      if (data.settings) {
        setSettings({
          assistantName: data.settings.assistantName || "Lynn",
          assistantAvatar: data.settings.assistantAvatar || "🤖",
          avatarUrl: data.settings.avatarUrl || null,
          personaStyle: data.settings.personaStyle || null,
          distilledStyle: data.settings.distilledStyle || null,
          styleStrength: data.settings.styleStrength ?? 0.7,
          clonedVoiceId: data.settings.clonedVoiceId || null,
          clonedVoiceName: data.settings.clonedVoiceName || null,
          clonedAt: data.settings.clonedAt || null,
          defaultVoice: data.settings.defaultVoice || "mimo_default",
          autoSpeak: data.settings.autoSpeak ?? false,
          voiceMode: data.settings.voiceMode ?? false,
          feishuNotify: data.settings.feishuNotify ?? false,
          hermesTakeover: data.settings.hermesTakeover ?? false,
          hermesAutoReport: data.settings.hermesAutoReport ?? false,
          hermesReportCron: data.settings.hermesReportCron || "0 9 * * *",
        });
      }
    } catch (e) {
      toast("保存设置失败", "error");
    }
  };

  // 头像文件上传
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast("头像文件过大，最大 2MB", "error");
      return;
    }
    setAvatarUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/ai/avatar-upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok && data.url) {
        setSettings((s) => ({ ...s, avatarUrl: data.url }));
        await updateSettings({ avatarUrl: data.url });
        toast("头像上传成功", "success");
      } else {
        toast(data.error || "上传失败", "error");
      }
    } catch {
      toast("上传失败", "error");
    } finally {
      setAvatarUploading(false);
      if (avatarFileRef.current) avatarFileRef.current.value = "";
    }
  };

  const handleVoiceCloneUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast("音频文件不能超过 10MB（60秒以内）", "error");
      e.target.value = "";
      return;
    }
    setCloneUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("name", `${settings.assistantName}的音色`);
      const res = await fetch("/api/ai/voice-clone", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "音色复刻失败", "error");
      } else {
        toast(data.message || "音色复刻成功！", "success");
        await fetchSettings();
      }
    } catch (e) {
      toast("音色复刻错误：" + (e as Error).message, "error");
    } finally {
      setCloneUploading(false);
      e.target.value = "";
    }
  };

  const testClonedVoice = async () => {
    if (!settings.clonedVoiceId) return;
    setCloneTesting(true);
    await speak(`你好，我是${settings.assistantName}，这是我的复刻声音。`);
    setCloneTesting(false);
  };

  const deleteClonedVoice = async () => {
    try {
      await fetch("/api/ai/voice-clone", { method: "DELETE" });
      toast("已清除复刻音色", "info");
      await fetchSettings();
    } catch {
      toast("清除失败", "error");
    }
  };

  const sendFeishuTest = async () => {
    try {
      const res = await fetch("/api/ai/notify-feishu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: `这是来自${settings.assistantName}的测试通知，飞书紧急通知功能已正常开启。`, urgent: false }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "发送失败", "error");
      } else {
        toast("测试消息已发送到飞书", "success");
      }
    } catch (e) {
      toast("发送错误：" + (e as Error).message, "error");
    }
  };

  return {
    settings,
    setSettings,
    settingsOpen,
    setSettingsOpen,
    fetchSettings,
    updateSettings,
    avatarUploading,
    avatarFileRef,
    handleAvatarUpload,
    cloneUploading,
    cloneTesting,
    cloneFileRef,
    handleVoiceCloneUpload,
    testClonedVoice,
    deleteClonedVoice,
    sendFeishuTest,
    distillPreviewing,
    setDistillPreviewing,
    distillPreviewReply,
    setDistillPreviewReply,
  };
}

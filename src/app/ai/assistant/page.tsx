"use client";

import { useState, useRef, useCallback } from "react";
import { toast } from "@/components/ui/toast";
import type { Message } from "./types";
import { isPersistedMessage } from "./utils";

import { useTTS } from "./hooks/useTTS";
import { useDesktopApproval } from "./hooks/useDesktopApproval";
import { useTaskPatterns } from "./hooks/useTaskPatterns";
import { useSettings } from "./hooks/useSettings";
import { useChat } from "./hooks/useChat";
import { useSessions } from "./hooks/useSessions";
import { useRecording } from "./hooks/useRecording";
import { useVoiceCall } from "./hooks/useVoiceCall";
import { useSkills } from "./hooks/useSkills";

import { Header } from "./components/Header";
import { VoiceCallBar } from "./components/VoiceCallBar";
import { SessionList } from "./components/SessionList";
import { MessageList } from "./components/MessageList";
import { ChatInput } from "./components/ChatInput";
import { SettingsModal } from "./components/SettingsModal";
import { SkillPanel } from "./components/SkillPanel";
import { ApprovalModal } from "./components/ApprovalModal";

export default function AIAssistantPage() {
  // 1. 独立 hooks（无依赖）
  const tts = useTTS();
  const desktopApproval = useDesktopApproval();
  const taskPatterns = useTaskPatterns();
  const settingsHook = useSettings(tts.speak);

  // 2. Refs 用于打破 hooks 间循环依赖
  const fetchSessionsRef = useRef<() => Promise<any>>(async () => []);
  const loadSessionRef = useRef<(id: string) => Promise<void>>(async () => {});
  const createNewSessionRef = useRef<() => Promise<void>>(async () => {});
  const currentSessionIdRef = useRef<string | null>(null);
  const voiceCallActiveRef = useRef(false);
  const transcribeAudioRef = useRef<(blob: Blob) => Promise<string | null>>(async () => null);

  // 3. useChat（通过 ref 获取 session 函数，避免循环依赖）
  const chat = useChat({
    settings: settingsHook.settings,
    speak: tts.speak,
    stopSpeaking: tts.stopSpeaking,
    voiceCallActive: voiceCallActiveRef.current,
    currentSessionId: currentSessionIdRef.current,
    fetchSessions: () => fetchSessionsRef.current(),
    loadSession: (id) => loadSessionRef.current(id),
    createNewSession: () => createNewSessionRef.current(),
    fetchSettings: settingsHook.fetchSettings,
  });

  // 4. useSessions（需要 useChat 的 setMessages 和 modelConfig）
  const sessions = useSessions(settingsHook.settings.assistantName, chat.modelConfig, chat.setMessages);
  fetchSessionsRef.current = sessions.fetchSessions;
  loadSessionRef.current = sessions.loadSession;
  createNewSessionRef.current = sessions.createNewSession;
  currentSessionIdRef.current = sessions.currentSessionId;

  // 5. useVoiceCall（需要 useChat 的 messages/setMessages/abortRef；transcribeAudioRef 由 useRecording 注入）
  const voiceCall = useVoiceCall({
    messages: chat.messages,
    setMessages: chat.setMessages,
    setThinking: chat.setThinking,
    abortRef: chat.abortRef,
    modelConfig: chat.modelConfig,
    currentSessionId: sessions.currentSessionId,
    fetchSessions: sessions.fetchSessions,
    stopSpeaking: tts.stopSpeaking,
    transcribeAudioRef,
  });
  voiceCallActiveRef.current = voiceCall.voiceCallActive;

  // 6. useRecording（需要 useVoiceCall 的 voiceModeActiveRef/voiceCallActive；useChat 的 send/setInput）
  const recording = useRecording({
    voiceModeActiveRef: voiceCall.voiceModeActiveRef,
    voiceCallActive: voiceCall.voiceCallActive,
    send: chat.send,
    setInput: chat.setInput,
  });
  transcribeAudioRef.current = recording.transcribeAudio;

  // 7. useSkills（需要 useChat 的 modelConfig/setMessages；useSessions 的 currentSessionId）
  const skills = useSkills({
    modelConfig: chat.modelConfig,
    setMessages: chat.setMessages,
    currentSessionId: sessions.currentSessionId,
  });

  // ===== 页面级状态 =====
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());
  const [annotatingMsgId, setAnnotatingMsgId] = useState<string | null>(null);
  const [annotationReason, setAnnotationReason] = useState("");
  const [submittingFeedback, setSubmittingFeedback] = useState<string | null>(null);

  // ===== 页面级函数 =====
  const toggleToolExpand = useCallback((msgId: string) => {
    setExpandedTools((prev) => {
      const next = new Set(prev);
      if (next.has(msgId)) next.delete(msgId); else next.add(msgId);
      return next;
    });
  }, []);

  const handleFeedback = useCallback(async (msgId: string, feedback: "good" | "bad" | null, reason?: string) => {
    if (!isPersistedMessage(msgId)) { toast("该消息尚未持久化，暂不可标注", "info"); return; }
    setSubmittingFeedback(msgId);
    try {
      const res = await fetch(`/api/ai/chat/messages/${msgId}/feedback`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedback, reason: feedback === "bad" ? reason || undefined : undefined }),
      });
      const data = await res.json();
      if (res.ok) {
        chat.setMessages((prev) => prev.map((m) => m.id === msgId ? { ...m, feedback, feedbackReason: feedback === "bad" ? reason || null : null } : m));
        if (feedback === "good") toast("感谢反馈，已标记为有帮助", "success");
        else if (feedback === "bad") toast("已记录，将帮助 AI 改进", "success");
        else toast("已取消标注", "info");
        setAnnotatingMsgId(null); setAnnotationReason("");
      } else { toast(data.error || "标注失败", "error"); }
    } catch (e) { toast("网络错误：" + (e as Error).message, "error"); }
    finally { setSubmittingFeedback(null); }
  }, [chat.setMessages]);

  const clearConversation = () => {
    if (!confirmClear) { setConfirmClear(true); setTimeout(() => setConfirmClear(false), 3000); return; }
    tts.stopSpeaking(); chat.abortRef.current?.abort(); setConfirmClear(false);
    sessions.createNewSession(); toast("已开启新对话", "info");
  };

  const copyMessage = async (msg: Message) => {
    try {
      await navigator.clipboard.writeText(msg.content);
      setCopiedId(msg.id); toast("已复制到剪贴板", "success");
      setTimeout(() => setCopiedId(null), 2000);
    } catch { toast("复制失败", "error"); }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const maxImages = 4;
    const remaining = maxImages - chat.attachedImages.length;
    if (remaining <= 0) { toast(`最多上传 ${maxImages} 张图片`, "error"); return; }
    for (const file of Array.from(files).slice(0, remaining)) {
      if (!file.type.startsWith("image/")) { toast("仅支持图片文件", "error"); continue; }
      if (file.size > 10 * 1024 * 1024) { toast("图片大小不能超过 10MB", "error"); continue; }
      const reader = new FileReader();
      reader.onload = () => { if (typeof reader.result === "string") chat.setAttachedImages((prev) => [...prev, reader.result as string]); };
      reader.onerror = () => toast("图片读取失败", "error");
      reader.readAsDataURL(file);
    }
    e.target.value = "";
  };

  const removeImage = (index: number) => chat.setAttachedImages((prev) => prev.filter((_, i) => i !== index));

  // ===== SettingsModal 内联处理器（从组件移至页面层以控制行数） =====
  const distillStyle = async () => {
    const textarea = document.getElementById("distill-chat-records") as HTMLTextAreaElement;
    const records = textarea?.value || "";
    if (records.trim().length < 10) { toast("请输入至少 10 字符的聊天记录", "error"); return; }
    try {
      toast("正在蒸馏风格...", "info");
      const res = await fetch("/api/ai/distill-style", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chatRecords: records, preview: true }) });
      const data = await res.json();
      if (res.ok && data.success) {
        settingsHook.setSettings((s) => ({ ...s, distilledStyle: data.distilledStyle }));
        settingsHook.setDistillPreviewReply(null);
        toast("风格蒸馏成功！点击下方「保存并预览」确认效果", "success");
      } else { toast(data.error || "蒸馏失败", "error"); }
    } catch { toast("蒸馏失败", "error"); }
  };

  const previewDistill = async () => {
    try {
      settingsHook.setDistillPreviewing(true); settingsHook.setDistillPreviewReply(null);
      const res = await fetch("/api/ai/distill-style", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ distilledStyle: settingsHook.settings.distilledStyle, testMessage: "你好，今天有什么任务需要聚焦？" }) });
      const data = await res.json();
      if (res.ok && data.success) settingsHook.setDistillPreviewReply(data.reply);
      else toast(data.error || "预览失败", "error");
    } catch { toast("预览失败", "error"); }
    finally { settingsHook.setDistillPreviewing(false); }
  };

  const generateReport = async () => {
    try {
      toast("正在生成主动汇报...", "info");
      const res = await fetch("/api/hermes/proactive-report", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "daily" }) });
      const data = await res.json();
      if (data.success) toast(`汇报已生成${data.pushed ? "并推送" : ""}`, "success");
      else toast(data.error || "生成失败", "error");
    } catch { toast("生成汇报失败", "error"); }
  };

  const patrolTakeover = async () => {
    try {
      const res = await fetch("/api/hermes/patrol-takeover", { method: "POST" });
      const data = await res.json();
      if (data.success) toast(`已迁移 ${data.migratedCount} 条巡检规则到 Hermes`, "success");
      else toast(data.error || "迁移失败", "error");
    } catch { toast("巡检接管失败", "error"); }
  };

  const preloadSkills = async () => {
    try {
      const res = await fetch("/api/hermes/skills/preload", { method: "POST" });
      const data = await res.json();
      if (data.success) toast(`已预加载 ${data.count} 个默认技能`, "success");
      else toast(data.error || "预加载失败", "error");
    } catch { toast("预加载技能失败", "error"); }
  };

  // ===== 渲染 =====
  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      <Header
        settings={settingsHook.settings}
        showSessionList={sessions.showSessionList}
        setShowSessionList={sessions.setShowSessionList}
        createNewSession={sessions.createNewSession}
        setSettingsOpen={settingsHook.setSettingsOpen}
        modelConfig={chat.modelConfig}
        setModelConfig={chat.setModelConfig}
        confirmClear={confirmClear}
        clearConversation={clearConversation}
      />
      {voiceCall.voiceCallActive && (
        <VoiceCallBar
          voiceCallPhase={voiceCall.voiceCallPhase}
          asrInterimText={voiceCall.asrInterimText}
          voiceVolume={voiceCall.voiceVolume}
        />
      )}
      {sessions.showSessionList && (
        <SessionList
          sessions={sessions.sessions}
          sessionQuery={sessions.sessionQuery}
          setSessionQuery={sessions.setSessionQuery}
          filteredSessions={sessions.filteredSessions}
          sessionPagination={sessions.sessionPagination}
          currentSessionId={sessions.currentSessionId}
          loadSession={sessions.loadSession}
          setShowSessionList={sessions.setShowSessionList}
        />
      )}
      <MessageList
        messages={chat.messages}
        settings={settingsHook.settings}
        thinking={chat.thinking}
        scrollRef={chat.scrollRef}
        speakingId={tts.speakingId}
        ttsLoadingId={tts.ttsLoadingId}
        speak={tts.speak}
        stopSpeaking={tts.stopSpeaking}
        copiedId={copiedId}
        copyMessage={copyMessage}
        expandedTools={expandedTools}
        toggleToolExpand={toggleToolExpand}
        handleFeedback={handleFeedback}
        annotatingMsgId={annotatingMsgId}
        setAnnotatingMsgId={setAnnotatingMsgId}
        annotationReason={annotationReason}
        setAnnotationReason={setAnnotationReason}
        submittingFeedback={submittingFeedback}
        send={chat.send}
      />
      <ChatInput
        thinking={chat.thinking}
        voiceCallActive={voiceCall.voiceCallActive}
        voiceCallPhase={voiceCall.voiceCallPhase}
        asrInterimText={voiceCall.asrInterimText}
        settings={settingsHook.settings}
        modelConfig={chat.modelConfig}
        isMultimodal={chat.isMultimodal}
        recording={recording.recording}
        transcribing={recording.transcribing}
        attachedImages={chat.attachedImages}
        input={chat.input}
        setInput={chat.setInput}
        send={chat.send}
        stopGeneration={chat.stopGeneration}
        inputRef={chat.inputRef}
        fileInputRef={chat.fileInputRef}
        handleImageUpload={handleImageUpload}
        removeImage={removeImage}
        startRecording={recording.startRecording}
        stopRecording={recording.stopRecording}
        startVoiceCall={voiceCall.startVoiceCall}
        stopVoiceCall={voiceCall.stopVoiceCall}
        openSkillPanel={skills.openSkillPanel}
        desktopMode={desktopApproval.desktopMode}
        authMode={desktopApproval.authMode}
        wsConnected={desktopApproval.wsConnected}
        handleAuthModeChange={desktopApproval.handleAuthModeChange}
      />
      <SettingsModal
        settingsOpen={settingsHook.settingsOpen}
        setSettingsOpen={settingsHook.setSettingsOpen}
        settings={settingsHook.settings}
        setSettings={settingsHook.setSettings}
        updateSettings={settingsHook.updateSettings}
        avatarUploading={settingsHook.avatarUploading}
        avatarFileRef={settingsHook.avatarFileRef}
        handleAvatarUpload={settingsHook.handleAvatarUpload}
        cloneUploading={settingsHook.cloneUploading}
        cloneTesting={settingsHook.cloneTesting}
        cloneFileRef={settingsHook.cloneFileRef}
        handleVoiceCloneUpload={settingsHook.handleVoiceCloneUpload}
        testClonedVoice={settingsHook.testClonedVoice}
        deleteClonedVoice={settingsHook.deleteClonedVoice}
        sendFeishuTest={settingsHook.sendFeishuTest}
        distillPreviewing={settingsHook.distillPreviewing}
        setDistillPreviewing={settingsHook.setDistillPreviewing}
        distillPreviewReply={settingsHook.distillPreviewReply}
        setDistillPreviewReply={settingsHook.setDistillPreviewReply}
        distillStyle={distillStyle}
        previewDistill={previewDistill}
        generateReport={generateReport}
        patrolTakeover={patrolTakeover}
        preloadSkills={preloadSkills}
        taskPatterns={taskPatterns.taskPatterns}
        taskPatternsLoading={taskPatterns.taskPatternsLoading}
        autoCheckInput={taskPatterns.autoCheckInput}
        setAutoCheckInput={taskPatterns.setAutoCheckInput}
        autoChecking={taskPatterns.autoChecking}
        fetchTaskPatterns={taskPatterns.fetchTaskPatterns}
        togglePatternAutoExecute={taskPatterns.togglePatternAutoExecute}
        deleteTaskPattern={taskPatterns.deleteTaskPattern}
        runAutoCheck={taskPatterns.runAutoCheck}
      />
      <SkillPanel
        showSkillPanel={skills.showSkillPanel}
        setShowSkillPanel={skills.setShowSkillPanel}
        selectedSkill={skills.selectedSkill}
        setSelectedSkill={skills.setSelectedSkill}
        skillParams={skills.skillParams}
        setSkillParams={skills.setSkillParams}
        skillExecuting={skills.skillExecuting}
        skillSearch={skills.skillSearch}
        setSkillSearch={skills.setSkillSearch}
        skillCategory={skills.skillCategory}
        setSkillCategory={skills.setSkillCategory}
        skillsLoading={skills.skillsLoading}
        skillTab={skills.skillTab}
        setSkillTab={skills.setSkillTab}
        skills={skills.skills}
        favorites={skills.favorites}
        executions={skills.executions}
        hermesSkills={skills.hermesSkills}
        hermesRunning={skills.hermesRunning}
        hermesPreloading={skills.hermesPreloading}
        favoriteIds={skills.favoriteIds}
        filteredSkills={skills.filteredSkills}
        skillCategories={skills.skillCategories}
        executeSkill={skills.executeSkill}
        fetchHermesSkills={skills.fetchHermesSkills}
        handlePreloadHermesSkills={skills.handlePreloadHermesSkills}
        toggleFavorite={skills.toggleFavorite}
        onSelectSkill={skills.onSelectSkill}
      />
      <ApprovalModal
        desktopMode={desktopApproval.desktopMode}
        showApproval={desktopApproval.showApproval}
        currentApproval={desktopApproval.currentApproval}
        handleApprovalResponse={desktopApproval.handleApprovalResponse}
      />
    </div>
  );
}

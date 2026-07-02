"use client";

import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/layout/PageHeader";
import {
  X, Loader2, Image as ImageIcon, Sparkles, MessageSquare, Mic2, Volume2,
  Trash2, RefreshCw, Zap,
} from "lucide-react";
import type { AISettings, TaskPatternItem } from "../types";

interface SettingsModalProps {
  settingsOpen: boolean; setSettingsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  settings: AISettings; setSettings: React.Dispatch<React.SetStateAction<AISettings>>;
  updateSettings: (partial: Partial<AISettings>) => Promise<void>;
  avatarUploading: boolean; avatarFileRef: React.RefObject<HTMLInputElement>;
  handleAvatarUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  cloneUploading: boolean; cloneTesting: boolean; cloneFileRef: React.RefObject<HTMLInputElement>;
  handleVoiceCloneUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  testClonedVoice: () => Promise<void>; deleteClonedVoice: () => Promise<void>;
  sendFeishuTest: () => Promise<void>;
  distillPreviewing: boolean; setDistillPreviewing: React.Dispatch<React.SetStateAction<boolean>>;
  distillPreviewReply: string | null; setDistillPreviewReply: React.Dispatch<React.SetStateAction<string | null>>;
  distillStyle: () => Promise<void>; previewDistill: () => Promise<void>;
  generateReport: () => Promise<void>; patrolTakeover: () => Promise<void>; preloadSkills: () => Promise<void>;
  taskPatterns: TaskPatternItem[]; taskPatternsLoading: boolean;
  autoCheckInput: string; setAutoCheckInput: React.Dispatch<React.SetStateAction<string>>;
  autoChecking: boolean; fetchTaskPatterns: () => Promise<void>;
  togglePatternAutoExecute: (patternId: string, next: boolean) => Promise<void>;
  deleteTaskPattern: (patternId: string) => Promise<void>; runAutoCheck: () => Promise<void>;
}

export function SettingsModal(props: SettingsModalProps) {
  const {
    settingsOpen, setSettingsOpen, settings, setSettings, updateSettings,
    avatarUploading, avatarFileRef, handleAvatarUpload, cloneUploading,
    cloneTesting, cloneFileRef, handleVoiceCloneUpload, testClonedVoice,
    deleteClonedVoice, sendFeishuTest, distillPreviewing, setDistillPreviewing,
    distillPreviewReply, setDistillPreviewReply, distillStyle, previewDistill,
    generateReport, patrolTakeover, preloadSkills, taskPatterns, taskPatternsLoading,
    autoCheckInput, setAutoCheckInput, autoChecking, fetchTaskPatterns,
    togglePatternAutoExecute, deleteTaskPattern, runAutoCheck,
  } = props;

  if (!settingsOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setSettingsOpen(false)}>
      <div className="flex max-h-[90vh] w-full max-w-md flex-col rounded-2xl glass-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex shrink-0 items-center justify-between bg-background/95 px-6 py-4 backdrop-blur-xl">
          <h2 className="text-lg font-semibold text-foreground">助理设置</h2>
          <button onClick={() => setSettingsOpen(false)} className="rounded-full p-1 text-muted-foreground transition hover:bg-primary/10 hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-4">
          {/* 助理名称 */}
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">助理名称</label>
            <input type="text" value={settings.assistantName}
              onChange={(e) => setSettings((s) => ({ ...s, assistantName: e.target.value }))}
              onBlur={() => updateSettings({ assistantName: settings.assistantName })}
              maxLength={20} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-cognition"
              placeholder="给你的AI助理取个名字" />
          </div>

          {/* 头像 */}
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">助理头像</label>
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              {["🦊", "🐱", "🤖", "🐼", "🧠", "⚡", "🌟", "🎯"].map((emoji) => (
                <button key={emoji}
                  onClick={() => { setSettings((s) => ({ ...s, assistantAvatar: emoji })); updateSettings({ assistantAvatar: emoji }); }}
                  className={cn("flex h-9 w-9 items-center justify-center rounded-lg border text-lg transition",
                    settings.assistantAvatar === emoji ? "border-cognition bg-cognition/10" : "border-border bg-background hover:bg-primary/10")}>
                  {emoji}
                </button>
              ))}
              <span className="ml-1 text-xs text-muted-foreground">无 URL 时显示</span>
            </div>
            <div className="flex items-center gap-2">
              <input type="text" value={settings.avatarUrl || ""}
                onChange={(e) => setSettings((s) => ({ ...s, avatarUrl: e.target.value || null }))}
                onBlur={() => updateSettings({ avatarUrl: settings.avatarUrl })}
                className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-cognition"
                placeholder="粘贴图片 URL 或点击右侧上传" />
              <input ref={avatarFileRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml" onChange={handleAvatarUpload} className="hidden" />
              <Button size="sm" variant="outline" onClick={() => avatarFileRef.current?.click()} disabled={avatarUploading} className="shrink-0">
                {avatarUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageIcon className="h-3.5 w-3.5" />}
                {avatarUploading ? "上传中" : "上传"}
              </Button>
            </div>
            {settings.avatarUrl && (
              <div className="mt-2 flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-primary text-primary-foreground">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={settings.avatarUrl} alt="preview" className="h-full w-full object-cover" />
                </div>
                <button onClick={() => { setSettings((s) => ({ ...s, avatarUrl: null })); updateSettings({ avatarUrl: null }); }} className="text-xs text-graveyard hover:underline">移除头像</button>
              </div>
            )}
            <p className="mt-1 text-xs text-muted-foreground">支持 PNG/JPEG/GIF/WebP/SVG，最大 2MB</p>
          </div>

          {/* 聊天风格描述 */}
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">聊天风格描述</label>
            <textarea value={settings.personaStyle || ""}
              onChange={(e) => setSettings((s) => ({ ...s, personaStyle: e.target.value || null }))}
              onBlur={() => updateSettings({ personaStyle: settings.personaStyle })}
              rows={3} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-cognition"
              placeholder="如：幽默、简洁、多用emoji、像朋友一样聊天..." />
            <p className="mt-1 text-xs text-muted-foreground">描述你希望 AI 助理的聊天风格，会注入到 system prompt</p>
          </div>

          {/* 蒸馏真人聊天风格 */}
          <div className="space-y-2 rounded-xl border border-border p-4">
            <h3 className="text-sm font-medium">🎭 蒸馏真人聊天风格</h3>
            <p className="text-xs text-muted-foreground">上传一段真人聊天记录，AI 会自动提取风格特征，模仿该风格与你对话</p>
            <textarea id="distill-chat-records" rows={4}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs outline-none focus:border-cognition"
              placeholder="粘贴聊天记录（至少 10 字符，最多 20000 字符）..." />
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={distillStyle} className="gap-1.5">
                <Sparkles className="h-3 w-3" /> 开始蒸馏
              </Button>
              {settings.distilledStyle && (
                <>
                  <Button size="sm" variant="outline" onClick={previewDistill} disabled={distillPreviewing} className="gap-1.5">
                    {distillPreviewing ? <Loader2 className="h-3 w-3 animate-spin" /> : <MessageSquare className="h-3 w-3" />}
                    {distillPreviewing ? "预览中" : "预览效果"}
                  </Button>
                  <Button size="sm" variant="ghost"
                    onClick={() => { setSettings((s) => ({ ...s, distilledStyle: null })); updateSettings({ distilledStyle: null }); setDistillPreviewReply(null); }}
                    className="text-xs text-graveyard">清除</Button>
                </>
              )}
            </div>
            {settings.distilledStyle && (
              <>
                <div className="rounded-lg bg-muted/30 p-3">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-xs font-medium">风格强度</span>
                    <span className="text-xs text-cognition">{Math.round(settings.styleStrength * 100)}%</span>
                  </div>
                  <input type="range" min="0" max="1" step="0.1" value={settings.styleStrength}
                    onChange={(e) => setSettings((s) => ({ ...s, styleStrength: parseFloat(e.target.value) }))}
                    onMouseUp={() => updateSettings({ styleStrength: settings.styleStrength })} className="w-full accent-cognition" />
                  <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                    <span>轻微参考</span><span>适度融入</span><span>严格模仿</span>
                  </div>
                </div>
                <div className="rounded-lg bg-cognition/5 p-2 text-xs text-muted-foreground">
                  <p className="mb-1 font-medium text-cognition">已蒸馏风格：</p>
                  <p className="line-clamp-3">{settings.distilledStyle}</p>
                </div>
                {distillPreviewing && (
                  <div className="rounded-lg border border-cognition/30 bg-cognition/5 p-3">
                    <p className="mb-1 text-[10px] font-medium text-cognition">AI 正在用蒸馏风格回复...</p>
                    <Loader2 className="h-3 w-3 animate-spin text-cognition" />
                  </div>
                )}
                {distillPreviewReply && (
                  <div className="rounded-lg border border-cognition/30 bg-cognition/5 p-3">
                    <p className="mb-1 text-[10px] font-medium text-cognition">预览回复（&ldquo;你好，今天有什么任务需要聚焦？&rdquo;）：</p>
                    <p className="text-xs leading-relaxed text-foreground">{distillPreviewReply}</p>
                  </div>
                )}
                <Button size="sm" className="w-full"
                  onClick={() => { updateSettings({ distilledStyle: settings.distilledStyle, styleStrength: settings.styleStrength }); toast("风格设置已保存", "success"); }}>
                  保存风格设置
                </Button>
              </>
            )}
          </div>

          {/* 语音设置 */}
          <div className="space-y-3 rounded-xl border border-border p-4">
            <h3 className="text-sm font-medium">🔊 语音设置</h3>
            <div>
              <p className="mb-2 text-xs text-muted-foreground">音色复刻：上传60秒内的说话录音，让AI用你的声音说话</p>
              {settings.clonedVoiceId ? (
                <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
                  <div>
                    <p className="text-xs font-medium">{settings.clonedVoiceName || "自定义音色"}</p>
                    <p className="text-[10px] text-muted-foreground">{settings.clonedAt ? new Date(settings.clonedAt).toLocaleString("zh-CN") : "已复刻"}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={testClonedVoice} disabled={cloneTesting}>
                      {cloneTesting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Volume2 className="h-3 w-3" />}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={deleteClonedVoice} title="删除复刻音色">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <input ref={cloneFileRef} type="file" accept="audio/*" onChange={handleVoiceCloneUpload} className="hidden" />
                  <Button variant="outline" size="sm" onClick={() => cloneFileRef.current?.click()} disabled={cloneUploading} className="w-full">
                    {cloneUploading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Mic2 className="mr-1 h-3 w-3" />}
                    {cloneUploading ? "复刻中..." : "上传录音复刻音色"}
                  </Button>
                </>
              )}
            </div>
            <label className="flex cursor-pointer items-center justify-between">
              <span className="text-xs">AI回复后自动语音播报</span>
              <input type="checkbox" checked={settings.autoSpeak}
                onChange={(e) => { setSettings((s) => ({ ...s, autoSpeak: e.target.checked })); updateSettings({ autoSpeak: e.target.checked }); }}
                className="h-4 w-4 rounded accent-cognition" />
            </label>
            <label className="flex cursor-pointer items-center justify-between">
              <span className="text-xs">开启全双工语音对话模式</span>
              <input type="checkbox" checked={settings.voiceMode}
                onChange={(e) => { setSettings((s) => ({ ...s, voiceMode: e.target.checked })); updateSettings({ voiceMode: e.target.checked }); }}
                className="h-4 w-4 rounded accent-cognition" />
            </label>
          </div>

          {/* 飞书通知 */}
          <div className="space-y-3 rounded-xl border border-border p-4">
            <h3 className="text-sm font-medium">🔔 飞书通知</h3>
            <label className="flex cursor-pointer items-center justify-between">
              <span className="text-xs">紧急事项通过飞书机器人通知我</span>
              <input type="checkbox" checked={settings.feishuNotify}
                onChange={(e) => { setSettings((s) => ({ ...s, feishuNotify: e.target.checked })); updateSettings({ feishuNotify: e.target.checked }); }}
                className="h-4 w-4 rounded accent-cognition" />
            </label>
            {settings.feishuNotify && (
              <Button size="sm" variant="outline" onClick={sendFeishuTest} className="w-full">
                <RefreshCw className="mr-1 h-3 w-3" /> 发送测试通知
              </Button>
            )}
          </div>

          {/* Lynx Agent 超级助理 */}
          <div className="space-y-3 rounded-xl border border-border p-4">
            <h3 className="text-sm font-medium">🤖 Lynx Agent 超级助理</h3>
            <div className={cn("rounded-lg border p-3 transition-colors",
              settings.hermesTakeover ? "border-green-500/40 bg-green-500/5" : "border-border bg-muted/20")}>
              <label className="flex cursor-pointer items-center justify-between">
                <span className="text-xs font-semibold">
                  Hermes 接管模式（模式 C）
                  {settings.hermesTakeover && (
                    <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-green-500/15 px-1.5 py-0.5 text-[9px] font-medium text-green-600 dark:text-green-400">
                      <Sparkles className="h-2 w-2" /> 已启用
                    </span>
                  )}
                </span>
                <input type="checkbox" checked={settings.hermesTakeover}
                  onChange={(e) => { setSettings((s) => ({ ...s, hermesTakeover: e.target.checked })); updateSettings({ hermesTakeover: e.target.checked }); }}
                  className="h-4 w-4 rounded accent-cognition" />
              </label>
              <p className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground">
                开启后 AI 助理由 Lynx Agent 驱动，拥有持久化记忆和持续学习能力。失败时自动回退到 LLM 模式。
              </p>
            </div>
            <label className="flex cursor-pointer items-center justify-between">
              <span className="text-xs">主动汇报（定时分析数据并推送）</span>
              <input type="checkbox" checked={settings.hermesAutoReport}
                onChange={(e) => { setSettings((s) => ({ ...s, hermesAutoReport: e.target.checked })); updateSettings({ hermesAutoReport: e.target.checked }); }}
                className="h-4 w-4 rounded accent-cognition" />
            </label>
            {settings.hermesAutoReport && (
              <label className="flex flex-col gap-1">
                <span className="text-[10px] text-muted-foreground">汇报 Cron 表达式（默认每天 9:00）</span>
                <input type="text" value={settings.hermesReportCron}
                  onChange={(e) => setSettings((s) => ({ ...s, hermesReportCron: e.target.value }))}
                  onBlur={(e) => updateSettings({ hermesReportCron: e.target.value })}
                  placeholder="0 9 * * *" className="rounded border border-border bg-background px-2 py-1 text-xs" />
              </label>
            )}
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={generateReport} className="flex-1">
                <Sparkles className="mr-1 h-3 w-3" /> 立即生成汇报
              </Button>
              <Button size="sm" variant="outline" onClick={patrolTakeover} className="flex-1">
                <RefreshCw className="mr-1 h-3 w-3" /> 巡检接管
              </Button>
            </div>
            <Button size="sm" variant="outline" onClick={preloadSkills} className="w-full">
              <Sparkles className="mr-1 h-3 w-3" /> 预加载默认技能（6 个 Lynx 技能）
            </Button>
          </div>

          {/* 任务模式学习 */}
          <div className="space-y-3 rounded-xl border border-border p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">🧠 任务模式学习</h3>
              <Button size="sm" variant="ghost" onClick={fetchTaskPatterns} disabled={taskPatternsLoading} className="h-7 px-2 text-xs">
                {taskPatternsLoading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-1 h-3 w-3" />} 刷新
              </Button>
            </div>
            <p className="text-[10px] leading-relaxed text-muted-foreground">
              当你做某个任务两次以上，系统会自动学习该模式并启用自动执行。下次类似任务出现时，可直接交给 Hermes 自动完成。
            </p>
            <div className="space-y-1.5 rounded-lg border border-border bg-background p-2.5">
              <label className="text-[10px] font-medium text-muted-foreground">检查自动执行（输入任务描述测试）</label>
              <div className="flex gap-1.5">
                <input type="text" value={autoCheckInput}
                  onChange={(e) => setAutoCheckInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !autoChecking) runAutoCheck(); }}
                  placeholder="如：创建灵感 关于AI的笔记"
                  className="flex-1 rounded border border-border bg-background px-2 py-1 text-xs outline-none focus:border-cognition" />
                <Button size="sm" onClick={runAutoCheck} disabled={autoChecking || !autoCheckInput.trim()} className="h-7 px-2 text-xs">
                  {autoChecking ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Zap className="mr-1 h-3 w-3" />} 检查
                </Button>
              </div>
            </div>
            {taskPatterns.length === 0 ? (
              <div className="rounded-lg bg-muted/30 p-3 text-center text-[11px] text-muted-foreground">
                {taskPatternsLoading ? "加载中..." : "暂无学习的任务模式。多和助理互动几次，系统会自动学习。"}
              </div>
            ) : (
              <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                {taskPatterns.map((p) => (
                  <div key={p.id} className="rounded-lg border border-border bg-background p-2.5 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate font-medium text-foreground">{p.patternKey}</span>
                          {p.autoExecute && (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-green-500/15 px-1.5 py-0.5 text-[9px] font-medium text-green-600 dark:text-green-400">
                              <Sparkles className="h-2 w-2" /> 自动
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 line-clamp-1 text-[10px] text-muted-foreground">{p.taskTemplate}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-1 text-[9px] text-muted-foreground">
                          <span>手动 {p.executionCount} 次</span><span>·</span>
                          <span>自动 {p.autoExecutedCount} 次</span>
                          {p.lastExecutedAt && (<><span>·</span><span>最近 {new Date(p.lastExecutedAt).toLocaleDateString("zh-CN")}</span></>)}
                          {p.lastAutoResult && (
                            <>
                              <span>·</span>
                              <span className={p.lastAutoResult === "success" ? "text-green-600 dark:text-green-400" : "text-red-500"}>
                                {p.lastAutoResult === "success" ? "✓" : "✗"}
                              </span>
                            </>
                          )}
                        </div>
                        {Array.isArray(p.matchKeywords) && p.matchKeywords.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {(p.matchKeywords as string[]).slice(0, 5).map((kw) => (
                              <span key={kw} className="rounded bg-muted px-1 py-0.5 text-[9px] text-muted-foreground">{kw}</span>
                            ))}
                            {(p.matchKeywords as string[]).length > 5 && (
                              <span className="text-[9px] text-muted-foreground">+{(p.matchKeywords as string[]).length - 5}</span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <button onClick={() => togglePatternAutoExecute(p.id, !p.autoExecute)}
                          title={p.autoExecute ? "关闭自动执行" : "启用自动执行"}
                          className={cn("relative h-4 w-7 rounded-full transition-colors", p.autoExecute ? "bg-cognition" : "bg-muted")}>
                          <span className={cn("absolute top-0.5 h-3 w-3 rounded-full bg-white transition-transform",
                            p.autoExecute ? "translate-x-3.5" : "translate-x-0.5")} />
                        </button>
                        <button onClick={() => deleteTaskPattern(p.id)} title="删除模式"
                          className="rounded p-1 text-muted-foreground hover:bg-primary/10 hover:text-red-500">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl bg-muted/30 p-3">
            <p className="text-[10px] text-muted-foreground">
              MiMo API Key 状态：<span className="text-northstar">已配置</span><br />
              TTS模型：mimo-v2.5-tts · 音色复刻：mimo-v2.5-tts-voiceclone
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

<template>
  <view class="page" :class="{ dark: isDark, 'voice-mode': voiceCallActive }">
    <!-- 顶部栏 -->
    <view class="top-bar">
      <view class="session-btn" @click="showSessionList = true">
        <text class="session-icon">☰</text>
      </view>
      <view class="top-title">
        <text class="top-avatar">{{ assistantAvatar }}</text>
        <text class="top-name">{{ assistantName }}</text>
      </view>
      <view class="top-actions">
        <view
          v-for="p in providers"
          :key="p.key"
          class="model-chip"
          :class="{ active: currentProvider === p.key }"
          @click="switchProvider(p.key)"
        >
          <text class="chip-label">{{ p.icon }}</text>
        </view>
        <view class="icon-btn" @click="showSettings = true">
          <text class="icon-text">⚙️</text>
        </view>
      </view>
    </view>

    <!-- 会话列表底部弹窗 -->
    <view v-if="showSessionList" class="sheet-mask" @click="showSessionList = false">
      <view class="sheet" @click.stop>
        <view class="sheet-handle"></view>
        <view class="sheet-header">
          <text class="sheet-title">对话历史</text>
          <view class="new-session-btn" @click="createNewSession">
            <text class="new-session-icon">+</text>
            <text class="new-session-text">新对话</text>
          </view>
        </view>
        <scroll-view scroll-y class="session-list">
          <view
            v-for="s in sessions"
            :key="s.id"
            class="session-item"
            :class="{ active: s.id === currentSessionId }"
            @click="switchSession(s.id)"
          >
            <view class="session-item-icon">
              <text class="session-emoji">💬</text>
            </view>
            <view class="session-item-info">
              <text class="session-item-title">{{ s.title || "新对话" }}</text>
              <text class="session-item-meta">{{ formatSessionTime(s.updatedAt) }} · {{ s.messageCount }}条</text>
            </view>
            <view class="session-item-del" @click.stop="deleteSession(s.id)">
              <text class="del-icon">🗑</text>
            </view>
          </view>
          <view v-if="sessions.length === 0" class="session-empty">
            <text class="empty-emoji">💬</text>
            <text class="empty-text">暂无历史对话</text>
            <text class="empty-hint">点击"新对话"开始</text>
          </view>
        </scroll-view>
      </view>
    </view>

    <!-- AI助理设置弹窗 -->
    <view v-if="showSettings" class="sheet-mask" @click="showSettings = false">
      <view class="sheet" @click.stop>
        <view class="sheet-handle"></view>
        <view class="sheet-header">
          <text class="sheet-title">助理设置</text>
        </view>
        <view class="settings-body">
          <view class="setting-row">
            <text class="setting-label">助理名称</text>
            <input v-model="editName" class="setting-input" placeholder="给助理起个名字" maxlength="20" />
          </view>
          <view class="setting-row">
            <text class="setting-label">助理头像</text>
            <view class="avatar-picker">
              <view
                v-for="emoji in avatarOptions"
                :key="emoji"
                class="avatar-option"
                :class="{ active: editAvatar === emoji }"
                @click="editAvatar = emoji"
              >
                <text class="avatar-option-icon">{{ emoji }}</text>
              </view>
            </view>
          </view>
          <view class="setting-row">
            <text class="setting-label">自动语音播报</text>
            <view class="switch-track" :class="{ on: editAutoSpeak }" @click="editAutoSpeak = !editAutoSpeak">
              <view class="switch-thumb"></view>
            </view>
          </view>
        </view>
        <view class="settings-footer">
          <view class="settings-save-btn" @click="saveSettings">
            <text class="save-btn-text">保存</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 消息列表 -->
    <scroll-view scroll-y class="msg-list" :scroll-top="scrollTop" :scroll-with-animation="true">
      <!-- 空状态欢迎 -->
      <view v-if="messages.length === 0" class="welcome">
        <view class="welcome-avatar" :class="{ 'voice-pulse': voiceCallActive }">
          <text class="avatar-icon">{{ assistantAvatar }}</text>
        </view>
        <text class="welcome-title">你好，我是 {{ assistantName }}</text>
        <text class="welcome-desc">你的个人认知助手 · 能搜索、创建、执行操作</text>
      </view>

      <!-- 消息列表 -->
      <view
        v-for="msg in messages"
        :key="msg.id"
        class="msg-row"
        :class="msg.role"
      >
        <view v-if="msg.role === 'assistant'" class="msg-avatar">
          <text class="msg-avatar-icon">{{ assistantAvatar }}</text>
        </view>
        <view class="msg-content">
          <view class="msg-bubble" @longpress="copyMessage(msg)">
            <text v-if="msg.role === 'user'" class="msg-text">{{ msg.content }}</text>
            <MarkdownView v-else :content="msg.content || ''" />
          </view>

          <!-- 工具调用可读性卡片 -->
          <view
            v-if="msg.role === 'assistant' && msg.toolCalled"
            class="tool-summary-card"
            @click="toggleToolExpand(msg.id)"
          >
            <view class="tool-summary-header">
              <text class="tool-summary-icon">{{ formatToolSummary(msg.toolCalled).icon }}</text>
              <view class="tool-summary-info">
                <text class="tool-summary-action">{{ formatToolSummary(msg.toolCalled).verb }}</text>
                <text class="tool-summary-result">{{ formatToolSummary(msg.toolCalled).resultStr }}</text>
              </view>
              <text class="tool-summary-expand">{{ expandedTools.has(msg.id) ? '▾' : '▸' }}</text>
            </view>
            <view v-if="expandedTools.has(msg.id)" class="tool-detail">
              <view class="tool-detail-row">
                <text class="detail-key">工具</text>
                <text class="detail-val">{{ msg.toolCalled.tool }}</text>
              </view>
              <view class="tool-detail-row">
                <text class="detail-key">参数</text>
                <text class="detail-val">{{ formatArgsReadable(msg.toolCalled.args) }}</text>
              </view>
              <view class="tool-detail-row">
                <text class="detail-key">结果</text>
                <text class="detail-val">{{ formatResultReadable(msg.toolCalled.tool, msg.toolCalled.result) }}</text>
              </view>
            </view>
          </view>

          <!-- 工具调用引导 -->
          <view
            v-if="msg.role === 'assistant' && !msg.toolCalled && !msg.error && msg.showHint"
            class="tool-hint"
            @click="focusInput"
          >
            <text class="hint-icon">💡</text>
            <text class="hint-text">试试下方的快捷操作，让 {{ assistantName }} 帮你做事</text>
          </view>
        </view>
      </view>

      <!-- 加载中动画 -->
      <view v-if="loading" class="msg-row assistant">
        <view class="msg-avatar">
          <text class="msg-avatar-icon">{{ assistantAvatar }}</text>
        </view>
        <view class="msg-bubble loading-bubble">
          <view class="typing-indicator">
            <view class="typing-dot" v-for="i in 3" :key="i"></view>
          </view>
          <text class="typing-hint">{{ loadingHint }}</text>
        </view>
      </view>
    </scroll-view>

    <!-- 快捷操作栏（输入框上方） -->
    <view class="quick-bar">
      <scroll-view scroll-x class="quick-scroll" :show-scrollbar="false">
        <view class="quick-items">
          <view
            v-for="cmd in quickCommands"
            :key="cmd.label"
            class="quick-chip"
            @click="sendQuickCommand(cmd.message)"
          >
            <text class="quick-chip-icon">{{ cmd.icon }}</text>
            <text class="quick-chip-text">{{ cmd.label }}</text>
          </view>
        </view>
      </scroll-view>
    </view>

    <!-- 输入栏 -->
    <view class="input-bar">
      <view
        class="call-btn"
        :class="{ active: voiceCallActive }"
        @click="toggleVoiceCall"
      >
        <text class="call-icon">{{ voiceCallActive ? "📞" : "🎙" }}</text>
      </view>

      <template v-if="!isRecording">
        <input
          ref="inputRef"
          v-model="input"
          class="input"
          :placeholder="`跟 ${assistantName} 说点什么...`"
          placeholder-class="placeholder"
          confirm-type="send"
          :cursor-spacing="20"
          :adjust-position="true"
          @confirm="send"
        />
      </template>
      <template v-else>
        <view class="recording-bar">
          <view class="recording-wave">
            <view class="wave-bar" v-for="i in 5" :key="i" :style="{ animationDelay: (i * 0.1) + 's' }"></view>
          </view>
          <text class="recording-text">松开发送 · {{ recordingSecs }}s</text>
        </view>
      </template>

      <view
        v-if="!input.trim() && !loading && !isRecording"
        class="voice-btn"
        @click="toggleVoiceMessage"
      >
        <text class="voice-icon">🎤</text>
      </view>

      <view
        v-if="isRecording"
        class="send-btn"
        @click="stopRecording"
      >
        <text class="send-text">⏹</text>
      </view>

      <view
        v-if="input.trim() && !loading && !isRecording"
        class="send-btn"
        @click="send"
      >
        <text class="send-text">➤</text>
      </view>

      <view
        v-if="loading"
        class="send-btn loading-btn"
        @click="stopLoading"
      >
        <text class="send-text">⏹</text>
      </view>
    </view>

    <!-- 语音通话浮层（深度优化） -->
    <view v-if="voiceCallActive" class="voice-call-overlay">
      <view class="call-bg-gradient"></view>
      <view class="call-content">
        <!-- 顶部状态 -->
        <view class="call-top">
          <text class="call-duration">{{ callDuration }}</text>
          <text class="call-status-text">{{ callStatusText }}</text>
        </view>

        <!-- 中间头像 + 波形 -->
        <view class="call-center">
          <view class="call-avatar-wrap">
            <view class="call-ring ring-1"></view>
            <view class="call-ring ring-2"></view>
            <view class="call-ring ring-3"></view>
            <view class="call-avatar" :class="{ speaking: isSpeaking, listening: !isSpeaking && !loading }">
              <text class="call-avatar-icon">{{ assistantAvatar }}</text>
            </view>
          </view>
          <text class="call-name">{{ assistantName }}</text>

          <!-- 实时波形 -->
          <view class="call-waveform">
            <view
              v-for="i in 24"
              :key="i"
              class="wave-column"
              :class="{ active: !isSpeaking && !loading }"
              :style="{ animationDelay: (i * 0.05) + 's', height: getWaveHeight(i) }"
            ></view>
          </view>
        </view>

        <!-- 最近对话预览 -->
        <view class="call-transcript">
          <text v-if="lastUserText" class="transcript-user">我：{{ lastUserText }}</text>
          <text v-if="lastAiText" class="transcript-ai">{{ assistantName }}：{{ lastAiText }}</text>
        </view>

        <!-- 底部操作 -->
        <view class="call-bottom">
          <view class="call-end-btn" @click="toggleVoiceCall">
            <text class="call-end-icon">📵</text>
            <text class="call-end-text">挂断</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 底部导航 -->
    <TabBar :current="2" />
  </view>
</template>

<script setup>
import { ref, computed, nextTick, onMounted, onUnmounted } from "vue";
import { onShow, onHide } from "@dcloudio/uni-app";
import { chat, chatStream, AI_PROVIDERS, summarizeToolResult } from "@/api/ai.js";
import {
  getChatSessions,
  createChatSession,
  getChatMessages,
} from "@/api/ai.js";
import {
  transcribeAudio,
  streamTTS,
  getAISettings,
} from "@/api/voice.js";
import { webmToWav } from "@/utils/audio-utils.js";
import { useSettingsStore } from "@/store/settings.js";
import MarkdownView from "@/components/MarkdownView.vue";
import TabBar from "@/components/TabBar.vue";

const settingsStore = useSettingsStore();
const isDark = computed(() => settingsStore.theme === "dark");

const providers = AI_PROVIDERS;
const currentProvider = ref(uni.getStorageSync("ai_provider") || "deepseek");

// ===== AI助理自定义 =====
const assistantName = ref(uni.getStorageSync("ai_assistant_name") || "Lynn");
const assistantAvatar = ref(uni.getStorageSync("ai_assistant_avatar") || "🤖");
const autoSpeak = ref(uni.getStorageSync("ai_auto_speak") === "true");
const showSettings = ref(false);
const editName = ref(assistantName.value);
const editAvatar = ref(assistantAvatar.value);
const editAutoSpeak = ref(autoSpeak.value);
const avatarOptions = ["🤖", "🐱", "🦊", "🐼", "🧠", "⚡", "🌟", "🎯"];

// ===== 会话管理 =====
const sessions = ref([]);
const currentSessionId = ref(null);
const showSessionList = ref(false);

// ===== 消息 =====
const messages = ref([]);
const input = ref("");
const loading = ref(false);
const scrollTop = ref(0);
const expandedTools = ref(new Set());
const inputRef = ref(null);

// ===== 语音录音 =====
const isRecording = ref(false);
const recordingSecs = ref(0);
let mediaRecorder = null;
let recordedChunks = [];
let recordingTimer = null;

// ===== 全双工语音通话 =====
const voiceCallActive = ref(false);
const callStatusText = ref("聆听中...");
const callDuration = ref("00:00");
const isSpeaking = ref(false);
const lastUserText = ref("");
const lastAiText = ref("");
let audioContext = null;
let analyser = null;
let vadInterval = null;
let vadStream = null;
let vadRecorder = null;
let vadChunks = [];
let vadSpeechActive = false;
let vadSilenceStart = 0;
let vadSpeechStart = 0;
let vadThreshold = 18;
let callStartTime = 0;
let callTimer = null;

// ===== AI 设置 =====
const aiSettings = ref({ autoSpeak: false, voiceMode: false });

// ===== 加载提示 =====
const loadingHints = ["正在思考...", "调用工具中...", "分析数据...", "生成回复..."];
const loadingHint = ref("正在思考...");
let hintTimer = null;

// 快捷命令（同步 Web 端 QUICK_COMMANDS）
const quickCommands = [
  { icon: "📋", label: "今日概览", description: "灵感、任务、记忆统计", message: "给我一个今日概览：今天有多少灵感、看板任务进度、最近记忆" },
  { icon: "💡", label: "创建灵感", description: "快速记录新灵感", message: "帮我创建一个灵感：" },
  { icon: "📊", label: "看板状态", description: "决策看板统计", message: "看板状态如何？本周完成了多少任务？" },
  { icon: "🔍", label: "搜索记忆", description: "语义搜索记忆图谱", message: "帮我搜索记忆：" },
  { icon: "🛡️", label: "执行巡检", description: "AI 巡检检查", message: "跑一下AI巡检，看看有什么需要关注的" },
  { icon: "⚡", label: "执行技能", description: "运行技能模板", message: "列出可用技能，我想执行一个" },
];

// ===== 工具信息映射 =====
const TOOL_INFO = {
  searchIdeas: { icon: "🔍", name: "搜索灵感", verb: "搜索了灵感库" },
  createIdea: { icon: "💡", name: "创建灵感", verb: "创建了新灵感" },
  searchTasks: { icon: "📋", name: "搜索任务", verb: "搜索了任务库" },
  searchCognitions: { icon: "🧠", name: "搜索记忆", verb: "搜索了记忆库" },
  executeSkill: { icon: "⚡", name: "执行技能", verb: "执行了技能" },
  runPatrol: { icon: "🛡️", name: "AI巡检", verb: "执行了巡检" },
  createTask: { icon: "✅", name: "创建任务", verb: "创建了任务" },
  updateTask: { icon: "✏️", name: "更新任务", verb: "更新了任务" },
  getBoardStatus: { icon: "📊", name: "看板状态", verb: "查看了看板" },
  searchMemory: { icon: "🔎", name: "搜索记忆", verb: "搜索了记忆" },
  listSkills: { icon: "📚", name: "列出技能", verb: "查看了技能列表" },
  listFlows: { icon: "🌊", name: "工作流", verb: "查看了工作流" },
  createCognition: { icon: "🧠", name: "创建认知", verb: "提取了认知" },
  getFocus: { icon: "🎯", name: "今日聚焦", verb: "查看了今日聚焦" },
};

function formatToolSummary(toolCalled) {
  if (!toolCalled) return { icon: "🔧", verb: "执行了操作", resultStr: "" };
  const info = TOOL_INFO[toolCalled.tool] || { icon: "🔧", name: toolCalled.tool, verb: "执行了操作" };
  const resultStr = formatResultReadable(toolCalled.tool, toolCalled.result);
  return { ...info, resultStr };
}

function formatResultReadable(tool, result) {
  if (!result) return "无返回数据";
  if (result.error) return `失败：${String(result.error).slice(0, 50)}`;
  if (typeof result === "string") return result.slice(0, 100);

  const parts = [];
  if (typeof result.total === "number") parts.push(`共 ${result.total} 项`);
  if (Array.isArray(result.ideas)) parts.push(`${result.ideas.length} 条灵感`);
  if (Array.isArray(result.tasks)) parts.push(`${result.tasks.length} 条任务`);
  if (Array.isArray(result.cognitions)) parts.push(`${result.cognitions.length} 条认知`);
  if (Array.isArray(result.skills)) parts.push(`${result.skills.length} 个技能`);
  if (Array.isArray(result.flows)) parts.push(`${result.flows.length} 个工作流`);
  if (Array.isArray(result.rules)) parts.push(`${result.rules.length} 条规则`);
  if (Array.isArray(result.logs)) parts.push(`${result.logs.length} 条日志`);
  if (typeof result.sentCount === "number") parts.push(`发送 ${result.sentCount} 条`);
  if (typeof result.cognitionCount === "number") parts.push(`提取 ${result.cognitionCount} 条认知`);
  if (result.totalCompleted != null && result.totalActive != null) {
    parts.push(`${result.totalCompleted} 已完成、${result.totalActive} 进行中`);
  }
  if (result.success === true && parts.length === 0) return "执行成功";
  if (result.output) return String(result.output).slice(0, 80);
  return parts.length ? parts.join("、") : "执行完成";
}

function formatArgsReadable(args) {
  if (!args) return "无";
  if (typeof args === "string") return args.slice(0, 80);
  const parts = [];
  for (const [k, v] of Object.entries(args)) {
    if (v == null || v === "") continue;
    const val = typeof v === "string" ? v.slice(0, 50) : JSON.stringify(v).slice(0, 50);
    parts.push(`${k}: ${val}`);
  }
  return parts.length ? parts.join("、") : "无";
}

onMounted(async () => {
  await loadSessions();
  await loadAISettings();
  if (sessions.value.length === 0) {
    await createNewSession();
  } else {
    await switchSession(sessions.value[0].id);
  }
});

onShow(() => {
  scrollToBottom();
});

onHide(() => {
  if (voiceCallActive.value) stopVoiceCall();
  if (isRecording.value) stopRecording();
});

// ===== AI助理设置 =====
function saveSettings() {
  assistantName.value = editName.value.trim() || "Lynn";
  assistantAvatar.value = editAvatar.value;
  autoSpeak.value = editAutoSpeak.value;
  uni.setStorageSync("ai_assistant_name", assistantName.value);
  uni.setStorageSync("ai_assistant_avatar", assistantAvatar.value);
  uni.setStorageSync("ai_auto_speak", autoSpeak.value ? "true" : "false");
  showSettings.value = false;
  uni.showToast({ title: "已保存", icon: "success" });
}

// ===== 会话管理 =====
async function loadSessions() {
  try {
    const res = await getChatSessions();
    sessions.value = res.sessions || [];
  } catch (e) {
    console.error("加载会话列表失败:", e);
  }
}

async function createNewSession() {
  try {
    const res = await createChatSession({ provider: currentProvider.value });
    sessions.value.unshift(res.session);
    currentSessionId.value = res.session.id;
    messages.value = [];
    showSessionList.value = false;
    await scrollToBottom();
    uni.showToast({ title: "新对话已创建", icon: "none", duration: 800 });
  } catch (e) {
    uni.showToast({ title: "创建会话失败", icon: "none" });
  }
}

async function switchSession(sessionId) {
  if (currentSessionId.value === sessionId && messages.value.length > 0) {
    showSessionList.value = false;
    return;
  }
  try {
    uni.showLoading({ title: "加载中..." });
    const res = await getChatMessages(sessionId);
    currentSessionId.value = sessionId;
    messages.value = (res.session.messages || []).map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      provider: m.provider,
      model: m.model,
      usage: m.tokens ? { total_tokens: m.tokens } : null,
      toolCalled: null,
      showHint: false,
    }));
    showSessionList.value = false;
    uni.hideLoading();
    await scrollToBottom();
  } catch (e) {
    uni.hideLoading();
    uni.showToast({ title: "加载会话失败", icon: "none" });
  }
}

async function deleteSession(sessionId) {
  uni.showModal({
    title: "删除对话",
    content: "确定删除这个对话吗？",
    success: async (res) => {
      if (res.confirm) {
        try {
          const { getBaseUrl, getToken } = await import("@/api/request.js");
          await fetch(`${getBaseUrl()}/api/ai/chat/sessions/${sessionId}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${getToken()}` },
          });
          sessions.value = sessions.value.filter((s) => s.id !== sessionId);
          if (currentSessionId.value === sessionId) {
            if (sessions.value.length > 0) {
              await switchSession(sessions.value[0].id);
            } else {
              await createNewSession();
            }
          }
          uni.showToast({ title: "已删除", icon: "none" });
        } catch (e) {
          uni.showToast({ title: "删除失败", icon: "none" });
        }
      }
    },
  });
}

function formatSessionTime(d) {
  if (!d) return "";
  const date = new Date(d);
  const now = new Date();
  const diff = now - date;
  if (diff < 60000) return "刚刚";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

// ===== AI 设置 =====
async function loadAISettings() {
  try {
    const res = await getAISettings();
    aiSettings.value = res.settings || { autoSpeak: false, voiceMode: false };
  } catch (e) {
    // 静默失败
  }
}

// ===== 发送消息 =====
function switchProvider(key) {
  currentProvider.value = key;
  uni.setStorageSync("ai_provider", key);
  uni.showToast({
    title: `已切换 ${providers.find((p) => p.key === key).label}`,
    icon: "none",
    duration: 1000,
  });
}

function sendQuickCommand(msg) {
  input.value = msg;
  send();
}

function focusInput() {
  // 聚焦输入框
  if (inputRef.value && inputRef.value.focus) {
    inputRef.value.focus();
  }
}

function toggleToolExpand(msgId) {
  const set = new Set(expandedTools.value);
  if (set.has(msgId)) set.delete(msgId);
  else set.add(msgId);
  expandedTools.value = set;
}

function copyMessage(msg) {
  uni.setClipboardData({
    data: msg.content,
    success: () => {
      uni.showToast({ title: "已复制", icon: "none", duration: 800 });
    },
  });
}

function startLoadingHints() {
  let idx = 0;
  loadingHint.value = loadingHints[0];
  hintTimer = setInterval(() => {
    idx = (idx + 1) % loadingHints.length;
    loadingHint.value = loadingHints[idx];
  }, 2500);
}

function stopLoadingHints() {
  if (hintTimer) {
    clearInterval(hintTimer);
    hintTimer = null;
  }
}

async function send(text) {
  const content = (text || input.value).trim();
  if (!content || loading.value) return;

  messages.value.push({ id: Date.now(), role: "user", content });
  lastUserText.value = content;
  input.value = "";
  loading.value = true;
  startLoadingHints();
  await scrollToBottom();

  if (currentSessionId.value) {
    saveMessage(currentSessionId.value, "user", content);
  }

  const history = messages.value
    .slice(-10)
    .map((m) => ({ role: m.role, content: m.content }));

  try {
    const res = await chat(content, currentProvider.value, history.slice(0, -1));
    const aiMsg = {
      id: Date.now() + 1,
      role: "assistant",
      content: res.content || "（无回复，请检查 AI 配置）",
      provider: res.provider,
      model: res.model,
      usage: res.usage,
      toolCalled: res.toolCalled || null,
      showHint: !res.toolCalled && !content.includes("你好") && messages.value.length <= 2,
    };
    messages.value.push(aiMsg);
    lastAiText.value = (res.content || "").slice(0, 100);

    if (currentSessionId.value) {
      saveMessage(currentSessionId.value, "assistant", res.content, {
        provider: res.provider,
        model: res.model,
        tokens: res.usage?.total_tokens,
      });
      loadSessions();
    }

    if ((voiceCallActive.value || autoSpeak.value || aiSettings.value.autoSpeak) && res.content) {
      await speak(res.content);
    }
  } catch (e) {
    try {
      let reply = "";
      reply = await chatStream(content, currentProvider.value, history.slice(0, -1), () => {});
      messages.value.push({
        id: Date.now() + 1,
        role: "assistant",
        content: reply || `⚠️ ${e.message || "请求失败"}`,
        showHint: false,
      });
      lastAiText.value = (reply || "").slice(0, 100);
      if (currentSessionId.value) {
        saveMessage(currentSessionId.value, "assistant", reply);
      }
    } catch (e2) {
      messages.value.push({
        id: Date.now() + 1,
        role: "assistant",
        content: `⚠️ ${e2.message || e.message || "请求失败"}`,
        error: true,
        showHint: false,
      });
    }
  } finally {
    stopLoadingHints();
    loading.value = false;
    await scrollToBottom();
    if (voiceCallActive.value) {
      setTimeout(() => restartVad(), 500);
    }
  }
}

async function saveMessage(sessionId, role, content, extra = {}) {
  try {
    const { getBaseUrl, getToken } = await import("@/api/request.js");
    await fetch(`${getBaseUrl()}/api/ai/chat/sessions/${sessionId}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify({ role, content, ...extra }),
    });
  } catch (e) {
    // 持久化失败不影响主流程
  }
}

// ===== 语音录音（发送语音消息） =====
function toggleVoiceMessage() {
  if (isRecording.value) {
    stopRecording();
  } else {
    startRecording();
  }
}

function stopLoading() {
  // 停止加载状态（中止当前请求）
  loading.value = false;
  stopLoadingHints();
  uni.showToast({ title: "已停止", icon: "none", duration: 800 });
}

async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recordedChunks = [];
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunks.push(e.data);
    };
    mediaRecorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      await handleRecordingStop();
    };
    mediaRecorder.start();
    isRecording.value = true;
    recordingSecs.value = 0;
    recordingTimer = setInterval(() => {
      recordingSecs.value++;
      if (recordingSecs.value >= 60) stopRecording();
    }, 1000);
  } catch (e) {
    uni.showToast({ title: "麦克风权限 denied", icon: "none" });
  }
}

async function stopRecording() {
  if (!isRecording.value) return;
  if (recordingTimer) {
    clearInterval(recordingTimer);
    recordingTimer = null;
  }
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
  }
  isRecording.value = false;
}

async function handleRecordingStop() {
  if (recordedChunks.length === 0) return;
  const blob = new Blob(recordedChunks, { type: "audio/webm" });
  if (blob.size < 1000) return;

  uni.showLoading({ title: "识别中..." });
  try {
    let wavBlob;
    try {
      wavBlob = await webmToWav(blob);
    } catch {
      wavBlob = blob;
    }
    const text = await transcribeAudio(wavBlob);
    if (text && text.trim()) {
      send(text.trim());
    } else {
      uni.showToast({ title: "未识别到语音内容", icon: "none" });
    }
  } catch (e) {
    uni.showToast({ title: e.message || "语音识别失败", icon: "none" });
  } finally {
    uni.hideLoading();
  }
}

// ===== 全双工语音通话 =====
async function toggleVoiceCall() {
  if (voiceCallActive.value) {
    stopVoiceCall();
  } else {
    await startVoiceCall();
  }
}

async function startVoiceCall() {
  try {
    vadStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;
    const source = audioContext.createMediaStreamSource(vadStream);
    source.connect(analyser);

    voiceCallActive.value = true;
    callStatusText.value = "校准环境噪声...";
    callStartTime = Date.now();
    callDuration.value = "00:00";
    callTimer = setInterval(() => {
      const secs = Math.floor((Date.now() - callStartTime) / 1000);
      const m = String(Math.floor(secs / 60)).padStart(2, "0");
      const s = String(secs % 60).padStart(2, "0");
      callDuration.value = `${m}:${s}`;
    }, 1000);

    setTimeout(() => {
      calibrateVadThreshold();
      callStatusText.value = "聆听中...";
      startVadLoop();
    }, 1000);
  } catch (e) {
    uni.showToast({ title: "无法访问麦克风", icon: "none" });
    voiceCallActive.value = false;
  }
}

function calibrateVadThreshold() {
  const data = new Uint8Array(analyser.frequencyBinCount);
  const volumes = [];
  const sampleStart = Date.now();
  while (Date.now() - sampleStart < 500) {
    analyser.getByteFrequencyData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
    const rms = Math.sqrt(sum / data.length);
    const db = 20 * Math.log10(rms || 1);
    volumes.push(db);
  }
  volumes.sort((a, b) => a - b);
  const median = volumes[Math.floor(volumes.length / 2)] || -30;
  vadThreshold = Math.max(10, Math.min(35, median + 12));
}

function startVadLoop() {
  if (!voiceCallActive.value) return;
  const data = new Uint8Array(analyser.frequencyBinCount);
  const SPEECH_START_MS = 300;
  const SPEECH_END_MS = 800;
  const MAX_SPEECH_MS = 30000;

  startVadRecording();

  vadInterval = setInterval(() => {
    if (!voiceCallActive.value || isSpeaking.value || loading.value) return;

    analyser.getByteFrequencyData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
    const rms = Math.sqrt(sum / data.length);
    const db = 20 * Math.log10(rms || 1);
    const now = Date.now();

    if (db > vadThreshold) {
      if (!vadSpeechActive) {
        if (vadSpeechStart === 0) vadSpeechStart = now;
        if (now - vadSpeechStart >= SPEECH_START_MS) {
          vadSpeechActive = true;
          vadSilenceStart = 0;
          callStatusText.value = "聆听中...";
        }
      } else {
        vadSilenceStart = 0;
      }
    } else {
      if (vadSpeechActive) {
        if (vadSilenceStart === 0) vadSilenceStart = now;
        if (now - vadSilenceStart >= SPEECH_END_MS || now - vadSpeechStart >= MAX_SPEECH_MS) {
          vadSpeechActive = false;
          vadSpeechStart = 0;
          vadSilenceStart = 0;
          stopVadRecordingAndProcess();
        }
      }
    }
  }, 100);
}

async function startVadRecording() {
  vadChunks = [];
  try {
    vadRecorder = new MediaRecorder(vadStream);
    vadRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) vadChunks.push(e.data);
    };
    vadRecorder.start();
  } catch (e) {
    // 忽略
  }
}

async function stopVadRecordingAndProcess() {
  if (!vadRecorder || vadRecorder.state === "inactive") return;
  if (vadInterval) {
    clearInterval(vadInterval);
    vadInterval = null;
  }

  await new Promise((resolve) => {
    vadRecorder.onstop = () => resolve();
    vadRecorder.stop();
  });

  if (vadChunks.length === 0) {
    if (voiceCallActive.value) setTimeout(() => startVadLoop(), 200);
    return;
  }

  const blob = new Blob(vadChunks, { type: "audio/webm" });
  if (blob.size < 2000) {
    if (voiceCallActive.value) setTimeout(() => startVadLoop(), 200);
    return;
  }

  callStatusText.value = "识别中...";
  try {
    let wavBlob;
    try {
      wavBlob = await webmToWav(blob);
    } catch {
      wavBlob = blob;
    }
    const text = await transcribeAudio(wavBlob);
    if (text && text.trim()) {
      callStatusText.value = "思考中...";
      await send(text.trim());
    } else {
      if (voiceCallActive.value) setTimeout(() => startVadLoop(), 200);
    }
  } catch (e) {
    uni.showToast({ title: "语音识别失败", icon: "none" });
    if (voiceCallActive.value) setTimeout(() => startVadLoop(), 500);
  }
}

function restartVad() {
  if (voiceCallActive.value && !vadInterval) {
    startVadLoop();
  }
}

function stopVoiceCall() {
  voiceCallActive.value = false;
  if (vadInterval) {
    clearInterval(vadInterval);
    vadInterval = null;
  }
  if (callTimer) {
    clearInterval(callTimer);
    callTimer = null;
  }
  if (vadRecorder && vadRecorder.state !== "inactive") {
    try { vadRecorder.stop(); } catch {}
  }
  if (vadStream) {
    vadStream.getTracks().forEach((t) => t.stop());
    vadStream = null;
  }
  if (audioContext) {
    try { audioContext.close(); } catch {}
    audioContext = null;
  }
  analyser = null;
  vadSpeechActive = false;
  isSpeaking.value = false;
  uni.showToast({ title: "通话已结束", icon: "none", duration: 1000 });
}

// ===== TTS 播报 =====
async function speak(text) {
  if (!text) return;
  isSpeaking.value = true;
  callStatusText.value = "播报中...";
  try {
    await streamTTS(text, null, async (sentenceText, audioBlob) => {
      await playAudioBlob(audioBlob);
    });
  } catch (e) {
    try {
      const { synthesizeTTS } = await import("@/api/voice.js");
      const blob = await synthesizeTTS(text);
      await playAudioBlob(blob);
    } catch (e2) {
      // 静默失败
    }
  } finally {
    isSpeaking.value = false;
    if (voiceCallActive.value) callStatusText.value = "聆听中...";
  }
}

function playAudioBlob(blob) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.onended = () => {
      URL.revokeObjectURL(url);
      resolve();
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      resolve();
    };
    audio.play().catch(() => resolve());
  });
}

function getWaveHeight(i) {
  // 给波形列一个基础高度变化
  const heights = [20, 35, 50, 30, 45, 60, 25, 40, 55, 35, 50, 65, 30, 45, 55, 40, 50, 60, 35, 45, 55, 30, 40, 50];
  return `${heights[(i - 1) % heights.length]}rpx`;
}

async function scrollToBottom() {
  await nextTick();
  scrollTop.value = scrollTop.value === 99998 ? 99999 : 99998;
}

onUnmounted(() => {
  if (voiceCallActive.value) stopVoiceCall();
  if (isRecording.value) stopRecording();
});
</script>

<style scoped>
/* ===== 页面容器：固定布局，防止整体滚动 ===== */
.page {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #f5f5f7;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.page.dark {
  background-color: #0a0a0c;
}
.page.voice-mode {
  background-color: #0a0a0c;
}

/* ===== 顶部栏：固定悬浮 ===== */
.top-bar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 16rpx 24rpx;
  padding-top: calc(16rpx + env(safe-area-inset-top));
  background-color: #ffffff;
  border-bottom: 1rpx solid #e5e5ea;
  z-index: 10;
}
.dark .top-bar {
  background-color: #1c1c1e;
  border-bottom-color: #38383a;
}
.session-btn {
  width: 56rpx;
  height: 56rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background-color: #f2f2f7;
}
.dark .session-btn { background-color: #2c2c2e; }
.session-icon { font-size: 28rpx; }
.top-title {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8rpx;
}
.top-avatar { font-size: 36rpx; }
.top-name {
  font-size: 30rpx;
  font-weight: 600;
  color: #1d1d1f;
}
.dark .top-name { color: #f5f5f7; }
.top-actions {
  display: flex;
  align-items: center;
  gap: 8rpx;
}
.model-chip {
  width: 56rpx;
  height: 56rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background-color: #f2f2f7;
  transition: all 0.2s;
}
.dark .model-chip { background-color: #2c2c2e; }
.model-chip.active {
  background: linear-gradient(135deg, #f59e0b, #f97316);
  box-shadow: 0 4rpx 12rpx rgba(245, 158, 11, 0.25);
}
.chip-label { font-size: 28rpx; }
.icon-btn {
  width: 56rpx;
  height: 56rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background-color: #f2f2f7;
}
.dark .icon-btn { background-color: #2c2c2e; }
.icon-text { font-size: 28rpx; }

/* 底部弹窗通用 */
.sheet-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 300;
  display: flex;
  align-items: flex-end;
}
.sheet {
  width: 100%;
  max-height: 80vh;
  background-color: #ffffff;
  border-radius: 32rpx 32rpx 0 0;
  display: flex;
  flex-direction: column;
}
.dark .sheet { background-color: #1c1c1e; }
.sheet-handle {
  width: 64rpx;
  height: 8rpx;
  border-radius: 4rpx;
  background-color: #e5e5ea;
  margin: 16rpx auto 0;
}
.dark .sheet-handle { background-color: #48484a; }
.sheet-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24rpx 32rpx;
  border-bottom: 1rpx solid #f2f2f7;
}
.dark .sheet-header { border-bottom-color: #38383a; }
.sheet-title {
  font-size: 32rpx;
  font-weight: 700;
  color: #1d1d1f;
}
.dark .sheet-title { color: #f5f5f7; }
.new-session-btn {
  display: flex;
  align-items: center;
  gap: 6rpx;
  background: linear-gradient(135deg, #f59e0b, #f97316);
  border-radius: 28rpx;
  padding: 10rpx 24rpx;
}
.new-session-icon { color: #ffffff; font-size: 28rpx; font-weight: 700; }
.new-session-text { color: #ffffff; font-size: 24rpx; font-weight: 600; }

.session-list {
  flex: 1;
  padding: 16rpx 24rpx;
  max-height: 60vh;
}
.session-item {
  display: flex;
  align-items: center;
  padding: 20rpx 16rpx;
  border-radius: 16rpx;
  margin-bottom: 8rpx;
  gap: 16rpx;
}
.session-item.active { background-color: rgba(245, 158, 11, 0.08); }
.session-item-icon {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  background-color: #f2f2f7;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.dark .session-item-icon { background-color: #2c2c2e; }
.session-emoji { font-size: 28rpx; }
.session-item-info { flex: 1; min-width: 0; }
.session-item-title {
  display: block;
  font-size: 28rpx;
  color: #1d1d1f;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dark .session-item-title { color: #f5f5f7; }
.session-item-meta { display: block; font-size: 20rpx; color: #aeaeb2; margin-top: 4rpx; }
.session-item-del { width: 56rpx; height: 56rpx; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.del-icon { font-size: 28rpx; opacity: 0.6; }
.session-empty { padding: 80rpx 0; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 8rpx; }
.empty-emoji { font-size: 64rpx; }
.empty-text { color: #86868b; font-size: 28rpx; }
.empty-hint { color: #aeaeb2; font-size: 22rpx; }

/* 设置弹窗 */
.settings-body { padding: 24rpx 32rpx; }
.setting-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24rpx 0;
  border-bottom: 1rpx solid #f2f2f7;
  gap: 16rpx;
}
.dark .setting-row { border-bottom-color: #38383a; }
.setting-row:last-child { border-bottom: none; }
.setting-label {
  font-size: 28rpx;
  color: #1d1d1f;
  font-weight: 500;
  flex-shrink: 0;
}
.dark .setting-label { color: #f5f5f7; }
.setting-input {
  flex: 1;
  text-align: right;
  font-size: 28rpx;
  color: #1d1d1f;
}
.dark .setting-input { color: #f5f5f7; }
.avatar-picker {
  display: flex;
  gap: 12rpx;
  flex-wrap: wrap;
  justify-content: flex-end;
  max-width: 400rpx;
}
.avatar-option {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  background-color: #f2f2f7;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 3rpx solid transparent;
}
.dark .avatar-option { background-color: #2c2c2e; }
.avatar-option.active {
  border-color: #f59e0b;
  background-color: rgba(245, 158, 11, 0.12);
}
.avatar-option-icon { font-size: 32rpx; }
.switch-track {
  width: 88rpx;
  height: 52rpx;
  border-radius: 26rpx;
  background-color: #e5e5ea;
  position: relative;
  transition: background-color 0.3s;
}
.switch-track.on {
  background: linear-gradient(135deg, #f59e0b, #f97316);
}
.switch-thumb {
  position: absolute;
  top: 4rpx;
  left: 4rpx;
  width: 44rpx;
  height: 44rpx;
  border-radius: 50%;
  background-color: #ffffff;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.15);
  transition: transform 0.3s;
}
.switch-track.on .switch-thumb { transform: translateX(36rpx); }
.settings-footer { padding: 24rpx 32rpx; padding-bottom: calc(24rpx + env(safe-area-inset-bottom)); }
.settings-save-btn {
  background: linear-gradient(135deg, #f59e0b, #f97316);
  border-radius: 16rpx;
  height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}
.save-btn-text { color: #ffffff; font-size: 30rpx; font-weight: 600; }

/* 消息列表：可滚动区域 */
.msg-list {
  flex: 1;
  padding: 24rpx;
  padding-bottom: 0;
  box-sizing: border-box;
  overflow: hidden;
}

/* 欢迎页 */
.welcome {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 80rpx 0 40rpx;
}
.welcome-avatar {
  width: 120rpx;
  height: 120rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, #f59e0b, #f97316);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 24rpx;
  box-shadow: 0 8rpx 24rpx rgba(245, 158, 11, 0.3);
}
.welcome-avatar.voice-pulse { animation: voicePulse 1.5s infinite; }
@keyframes voicePulse {
  0%, 100% { transform: scale(1); box-shadow: 0 8rpx 24rpx rgba(245, 158, 11, 0.3); }
  50% { transform: scale(1.08); box-shadow: 0 12rpx 32rpx rgba(245, 158, 11, 0.5); }
}
.avatar-icon { font-size: 56rpx; }
.welcome-title { font-size: 40rpx; font-weight: 700; color: #1d1d1f; margin-bottom: 8rpx; }
.dark .welcome-title { color: #f5f5f7; }
.welcome-desc { font-size: 24rpx; color: #86868b; }

/* 消息气泡 */
.msg-row { display: flex; margin-bottom: 24rpx; align-items: flex-start; }
.msg-row.user { justify-content: flex-end; }
.msg-row.assistant { justify-content: flex-start; }
.msg-avatar {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, #f59e0b, #f97316);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 16rpx;
  flex-shrink: 0;
  box-shadow: 0 2rpx 8rpx rgba(245, 158, 11, 0.2);
}
.msg-avatar-icon { font-size: 32rpx; }
.msg-content { max-width: 78%; }
.msg-row.user .msg-content { max-width: 80%; }
.msg-bubble { padding: 20rpx 28rpx; border-radius: 24rpx; }
.msg-row.user .msg-bubble {
  background: linear-gradient(135deg, #f59e0b, #f97316);
  box-shadow: 0 4rpx 16rpx rgba(245, 158, 11, 0.2);
}
.msg-row.user .msg-text { color: #ffffff; font-size: 30rpx; line-height: 1.7; white-space: pre-wrap; word-break: break-word; }
.msg-row.assistant .msg-bubble {
  background-color: #ffffff;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.06);
}
.dark .msg-row.assistant .msg-bubble {
  background-color: #1c1c1e;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.3);
}

/* 工具调用可读性卡片 */
.tool-summary-card {
  margin-top: 12rpx;
  border: 1rpx solid rgba(139, 92, 246, 0.15);
  border-radius: 16rpx;
  background-color: rgba(139, 92, 246, 0.04);
  overflow: hidden;
}
.tool-summary-header {
  display: flex;
  align-items: center;
  padding: 16rpx 20rpx;
  gap: 12rpx;
}
.tool-summary-icon { font-size: 32rpx; flex-shrink: 0; }
.tool-summary-info { flex: 1; min-width: 0; }
.tool-summary-action {
  display: block;
  font-size: 26rpx;
  font-weight: 600;
  color: #8b5cf6;
}
.tool-summary-result {
  display: block;
  font-size: 22rpx;
  color: #86868b;
  margin-top: 4rpx;
}
.tool-summary-expand { font-size: 24rpx; color: #c7c7cc; flex-shrink: 0; }
.tool-detail {
  padding: 16rpx 20rpx;
  border-top: 1rpx solid rgba(139, 92, 246, 0.1);
}
.tool-detail-row {
  display: flex;
  gap: 12rpx;
  padding: 8rpx 0;
}
.detail-key {
  font-size: 22rpx;
  color: #aeaeb2;
  flex-shrink: 0;
  width: 80rpx;
}
.detail-val {
  font-size: 22rpx;
  color: #1d1d1f;
  flex: 1;
  word-break: break-all;
}
.dark .detail-val { color: #f5f5f7; }

/* 工具调用引导 */
.tool-hint {
  display: flex;
  align-items: center;
  margin-top: 12rpx;
  padding: 12rpx 20rpx;
  background-color: rgba(245, 158, 11, 0.08);
  border-radius: 12rpx;
  gap: 8rpx;
}
.hint-icon { font-size: 24rpx; }
.hint-text { flex: 1; font-size: 22rpx; color: #f59e0b; }

/* 加载动画 */
.loading-bubble {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}
.typing-indicator {
  display: flex;
  gap: 8rpx;
  align-items: center;
}
.typing-dot {
  width: 14rpx;
  height: 14rpx;
  border-radius: 50%;
  background-color: #f59e0b;
  animation: typingBounce 1.4s infinite ease-in-out both;
}
.typing-dot:nth-child(1) { animation-delay: -0.32s; }
.typing-dot:nth-child(2) { animation-delay: -0.16s; }
.typing-dot:nth-child(3) { animation-delay: 0s; }
@keyframes typingBounce {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
  40% { transform: scale(1); opacity: 1; }
}
.typing-hint { font-size: 22rpx; color: #aeaeb2; }

/* 快捷操作栏：固定在输入栏上方 */
.quick-bar {
  flex-shrink: 0;
  padding: 12rpx 24rpx;
  background-color: #ffffff;
  border-top: 1rpx solid #f2f2f7;
  z-index: 10;
}
.dark .quick-bar {
  background-color: #1c1c1e;
  border-top-color: #38383a;
}
.quick-scroll { white-space: nowrap; }
.quick-items {
  display: inline-flex;
  gap: 12rpx;
  padding-right: 24rpx;
}
.quick-chip {
  display: inline-flex;
  align-items: center;
  gap: 6rpx;
  padding: 10rpx 20rpx;
  border-radius: 32rpx;
  background-color: #f2f2f7;
  flex-shrink: 0;
  transition: transform 0.15s;
}
.dark .quick-chip { background-color: #2c2c2e; }
.quick-chip:active { transform: scale(0.95); }
.quick-chip-icon { font-size: 24rpx; }
.quick-chip-text { font-size: 24rpx; color: #1d1d1f; font-weight: 500; }
.dark .quick-chip-text { color: #f5f5f7; }

/* 输入栏：固定悬浮在底部 */
.input-bar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  padding: 16rpx 24rpx;
  padding-bottom: calc(16rpx + env(safe-area-inset-bottom) + 100rpx);
  background-color: #ffffff;
  border-top: 1rpx solid #e5e5ea;
  gap: 12rpx;
  z-index: 10;
}
.dark .input-bar {
  background-color: #1c1c1e;
  border-top-color: #38383a;
}
.call-btn {
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  background-color: #f2f2f7;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.2s;
}
.dark .call-btn { background-color: #2c2c2e; }
.call-btn.active {
  background-color: #34d399;
  animation: callPulse 1.5s infinite;
}
@keyframes callPulse {
  0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(52, 211, 153, 0.4); }
  50% { transform: scale(1.05); box-shadow: 0 0 0 12rpx rgba(52, 211, 153, 0); }
}
.call-icon { font-size: 32rpx; }
.input {
  flex: 1;
  height: 72rpx;
  background-color: #f2f2f7;
  border: none;
  border-radius: 36rpx;
  padding: 0 28rpx;
  color: #1d1d1f;
  font-size: 28rpx;
}
.dark .input { background-color: #2c2c2e; color: #f5f5f7; }
.placeholder { color: #aeaeb2; }
.voice-btn {
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, #f59e0b, #f97316);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 4rpx 12rpx rgba(245, 158, 11, 0.3);
}
.voice-icon { color: #ffffff; font-size: 32rpx; }
.send-btn {
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, #f59e0b, #f97316);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 4rpx 12rpx rgba(245, 158, 11, 0.3);
  transition: transform 0.15s;
}
.send-btn:active { transform: scale(0.92); }
.send-btn.disabled { opacity: 0.4; }
.send-btn.loading-btn {
  background: linear-gradient(135deg, #ef4444, #dc2626);
  animation: pulse 1.5s infinite;
}
.send-text { color: #ffffff; font-size: 32rpx; }

/* 录音中 */
.recording-bar {
  flex: 1;
  height: 72rpx;
  background-color: #fef2f2;
  border-radius: 36rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16rpx;
}
.recording-wave { display: flex; gap: 4rpx; align-items: center; }
.wave-bar {
  width: 6rpx;
  height: 24rpx;
  background-color: #ef4444;
  border-radius: 3rpx;
  animation: wave 0.8s infinite ease-in-out;
}
@keyframes wave {
  0%, 100% { height: 12rpx; }
  50% { height: 36rpx; }
}
.recording-text { font-size: 24rpx; color: #ef4444; font-weight: 600; }

/* 语音通话浮层（深度优化） */
.voice-call-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 500;
  overflow: hidden;
}
.call-bg-gradient {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
}
.call-content {
  position: relative;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 80rpx 40rpx;
  padding-top: calc(80rpx + env(safe-area-inset-top));
  padding-bottom: calc(80rpx + env(safe-area-inset-bottom));
}
.call-top {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
  margin-bottom: 60rpx;
}
.call-duration {
  font-size: 56rpx;
  font-weight: 300;
  color: #ffffff;
  font-family: "SF Mono", monospace;
  letter-spacing: 4rpx;
}
.call-status-text {
  font-size: 26rpx;
  color: #aeaeb2;
}
.call-center {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 32rpx;
}
.call-avatar-wrap {
  position: relative;
  width: 240rpx;
  height: 240rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}
.call-ring {
  position: absolute;
  border-radius: 50%;
  border: 2rpx solid rgba(245, 158, 11, 0.3);
  animation: ringExpand 3s infinite ease-out;
}
.ring-1 { width: 240rpx; height: 240rpx; animation-delay: 0s; }
.ring-2 { width: 240rpx; height: 240rpx; animation-delay: 1s; }
.ring-3 { width: 240rpx; height: 240rpx; animation-delay: 2s; }
@keyframes ringExpand {
  0% { transform: scale(0.8); opacity: 0.8; }
  100% { transform: scale(1.6); opacity: 0; }
}
.call-avatar {
  width: 160rpx;
  height: 160rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, #f59e0b, #f97316);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 12rpx 40rpx rgba(245, 158, 11, 0.4);
  z-index: 1;
}
.call-avatar.speaking {
  animation: avatarSpeak 0.8s infinite ease-in-out;
}
.call-avatar.listening {
  animation: avatarListen 2s infinite ease-in-out;
}
@keyframes avatarSpeak {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.08); }
}
@keyframes avatarListen {
  0%, 100% { transform: scale(1); box-shadow: 0 12rpx 40rpx rgba(245, 158, 11, 0.4); }
  50% { transform: scale(1.04); box-shadow: 0 12rpx 50rpx rgba(245, 158, 11, 0.6); }
}
.call-avatar-icon { font-size: 72rpx; }
.call-name {
  font-size: 36rpx;
  font-weight: 600;
  color: #ffffff;
}

/* 通话波形 */
.call-waveform {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4rpx;
  height: 80rpx;
}
.wave-column {
  width: 6rpx;
  border-radius: 3rpx;
  background-color: rgba(245, 158, 11, 0.3);
  transition: height 0.2s;
}
.wave-column.active {
  background-color: #f59e0b;
  animation: waveColumnAnim 1s infinite ease-in-out;
}
@keyframes waveColumnAnim {
  0%, 100% { transform: scaleY(0.4); }
  50% { transform: scaleY(1); }
}

/* 通话预览 */
.call-transcript {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  padding: 24rpx;
  background-color: rgba(255, 255, 255, 0.05);
  border-radius: 16rpx;
  margin-bottom: 40rpx;
  min-height: 80rpx;
}
.transcript-user {
  font-size: 24rpx;
  color: #f5f5f7;
  line-height: 1.5;
}
.transcript-ai {
  font-size: 24rpx;
  color: #f59e0b;
  line-height: 1.5;
}

/* 通话底部 */
.call-bottom {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 60rpx;
}
.call-end-btn {
  width: 120rpx;
  height: 120rpx;
  border-radius: 50%;
  background-color: #ef4444;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8rpx 24rpx rgba(239, 68, 68, 0.4);
  transition: transform 0.15s;
}
.call-end-btn:active { transform: scale(0.92); }
.call-end-icon { font-size: 40rpx; }
.call-end-text { color: #ffffff; font-size: 20rpx; margin-top: 4rpx; }
</style>

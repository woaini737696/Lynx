<template>
  <view class="page">
    <!-- 顶部模型切换栏 + 清空按钮 -->
    <view class="model-bar">
      <view
        v-for="p in providers"
        :key="p.key"
        class="model-chip"
        :class="{ active: currentProvider === p.key }"
        @click="switchProvider(p.key)"
      >
        <text class="chip-label">{{ p.icon }} {{ p.label }}</text>
      </view>
      <view class="model-info">
        <text class="info-text">{{ currentProviderDesc }}</text>
      </view>
      <view v-if="messages.length > 0" class="clear-btn" @click="clearChat">
        <text class="clear-icon">🗑</text>
      </view>
    </view>

    <scroll-view scroll-y class="msg-list" :scroll-top="scrollTop" :scroll-with-animation="true">
      <!-- 空状态：欢迎 + 快捷命令 -->
      <view v-if="messages.length === 0" class="welcome">
        <view class="welcome-header">
          <view class="welcome-avatar">
            <text class="avatar-icon">🤖</text>
          </view>
          <text class="welcome-title">你好，我是 Lynn</text>
          <text class="welcome-desc">你的个人认知助手 · 能搜索、创建、执行操作</text>
        </view>

        <view class="quick-commands">
          <view
            v-for="cmd in quickCommands"
            :key="cmd.label"
            class="cmd-card"
            @click="sendQuickCommand(cmd.message)"
          >
            <text class="cmd-icon">{{ cmd.icon }}</text>
            <view class="cmd-info">
              <text class="cmd-label">{{ cmd.label }}</text>
              <text class="cmd-desc">{{ cmd.description }}</text>
            </view>
            <text class="cmd-arrow">›</text>
          </view>
        </view>

        <view class="suggestions">
          <text class="suggestions-title">💡 你可以这样问</text>
          <view
            v-for="s in suggestions"
            :key="s"
            class="suggestion-item"
            @click="sendQuickCommand(s)"
          >
            <text class="suggestion-text">{{ s }}</text>
            <text class="suggestion-arrow">›</text>
          </view>
        </view>
      </view>

      <!-- 消息列表 -->
      <view
        v-for="msg in messages"
        :key="msg.id"
        class="msg-row"
        :class="msg.role"
      >
        <view v-if="msg.role === 'assistant'" class="msg-avatar">
          <text class="msg-avatar-icon">🤖</text>
        </view>
        <view class="msg-content">
          <view class="msg-bubble" @longpress="copyMessage(msg)">
            <text class="msg-text" :class="{ 'msg-error': msg.error }">{{ msg.content }}</text>
          </view>

          <!-- 工具调用卡片 -->
          <view
            v-if="msg.role === 'assistant' && msg.toolCalled"
            class="tool-card"
            @click="toggleToolExpand(msg.id)"
          >
            <view class="tool-header">
              <text class="tool-icon">🔧</text>
              <text class="tool-name">{{ msg.toolCalled.tool }}</text>
              <text class="tool-summary">{{ summarizeToolResult(msg.toolCalled.result) }}</text>
              <text class="tool-expand">{{ expandedTools.has(msg.id) ? '▾' : '▸' }}</text>
            </view>
            <view v-if="expandedTools.has(msg.id)" class="tool-detail">
              <text class="detail-label">参数</text>
              <text class="detail-json">{{ JSON.stringify(msg.toolCalled.args, null, 2) }}</text>
              <text class="detail-label">结果</text>
              <scroll-view scroll-x class="detail-scroll">
                <text class="detail-json">{{ JSON.stringify(msg.toolCalled.result, null, 2) }}</text>
              </scroll-view>
            </view>
          </view>

          <!-- 消息元信息 -->
          <view v-if="msg.role === 'assistant' && (msg.provider || msg.model)" class="msg-meta">
            <text class="meta-text">{{ msg.provider || "" }} {{ msg.model || "" }}</text>
            <text v-if="msg.usage" class="meta-tokens">{{ msg.usage.total_tokens || 0 }} tokens</text>
          </view>
        </view>
      </view>

      <!-- 加载中 -->
      <view v-if="loading" class="msg-row assistant">
        <view class="msg-avatar">
          <text class="msg-avatar-icon">🤖</text>
        </view>
        <view class="msg-bubble">
          <view class="typing-dots">
            <view class="dot"></view>
            <view class="dot"></view>
            <view class="dot"></view>
          </view>
          <text class="typing-hint">{{ loadingHint }}</text>
        </view>
      </view>
    </scroll-view>

    <view class="input-bar">
      <input
        v-model="input"
        class="input"
        placeholder="输入消息，AI 能搜索、创建、执行操作..."
        placeholder-class="placeholder"
        confirm-type="send"
        :cursor-spacing="20"
        :adjust-position="true"
        @confirm="send"
      />
      <view
        class="send-btn"
        :class="{ disabled: !input.trim() || loading }"
        @click="send"
      >
        <text class="send-text">{{ loading ? "⏸" : "➤" }}</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, nextTick } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { chat, chatStream, AI_PROVIDERS, summarizeToolResult } from "@/api/ai.js";

const providers = AI_PROVIDERS;
const currentProvider = ref(uni.getStorageSync("ai_provider") || "deepseek");
const currentProviderDesc = computed(() => {
  const p = providers.find((x) => x.key === currentProvider.value);
  return p ? p.desc : "";
});

// 快捷命令（同步 Web 端 QUICK_COMMANDS）
const quickCommands = [
  { icon: "📋", label: "今日概览", description: "灵感、任务、记忆统计", message: "给我一个今日概览：今天有多少灵感、看板任务进度、最近记忆" },
  { icon: "💡", label: "创建灵感", description: "快速记录新灵感", message: "帮我创建一个灵感：" },
  { icon: "📊", label: "看板状态", description: "决策看板统计", message: "看板状态如何？本周完成了多少任务？" },
  { icon: "🔍", label: "搜索记忆", description: "语义搜索记忆图谱", message: "帮我搜索记忆：" },
  { icon: "🛡️", label: "执行巡检", description: "AI 巡检检查", message: "跑一下AI巡检，看看有什么需要关注的" },
  { icon: "⚡", label: "执行技能", description: "运行技能模板", message: "列出可用技能，我想执行一个" },
];

// 建议提示（同步 Web 端 SUGGESTIONS）
const suggestions = [
  "今天有哪些任务需要聚焦？",
  "帮我分析最近的灵感趋势",
  "从认知库中找一条方法论",
  "快速捕获一条灵感",
];

const messages = ref([]);
const input = ref("");
const loading = ref(false);
const scrollTop = ref(0);
const expandedTools = ref(new Set());

// 加载提示语（轮换）
const loadingHints = ["正在思考...", "调用工具中...", "分析数据...", "生成回复..."];
const loadingHint = ref("正在思考...");
let hintTimer = null;

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

function clearChat() {
  uni.showModal({
    title: "清空对话",
    content: "确定清空所有对话记录吗？",
    success: (res) => {
      if (res.confirm) {
        messages.value = [];
        expandedTools.value = new Set();
        uni.showToast({ title: "已清空", icon: "none", duration: 800 });
      }
    },
  });
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
  }, 2000);
}

function stopLoadingHints() {
  if (hintTimer) {
    clearInterval(hintTimer);
    hintTimer = null;
  }
}

async function send() {
  const content = input.value.trim();
  if (!content || loading.value) return;

  messages.value.push({ id: Date.now(), role: "user", content });
  input.value = "";
  loading.value = true;
  startLoadingHints();
  await scrollToBottom();

  const history = messages.value
    .slice(-10)
    .map((m) => ({ role: m.role, content: m.content }));

  try {
    // 主路径：非流式 + assistantMode（支持工具调用，同步 Web 端能力）
    const res = await chat(content, currentProvider.value, history.slice(0, -1));
    messages.value.push({
      id: Date.now() + 1,
      role: "assistant",
      content: res.content || "（无回复，请检查 AI 配置）",
      provider: res.provider,
      model: res.model,
      usage: res.usage,
      toolCalled: res.toolCalled || null,
    });
  } catch (e) {
    // 降级：流式模式（无工具调用，但能回复）
    try {
      let reply = "";
      reply = await chatStream(content, currentProvider.value, history.slice(0, -1), () => {});
      messages.value.push({
        id: Date.now() + 1,
        role: "assistant",
        content: reply || `⚠️ ${e.message || "请求失败"}`,
      });
    } catch (e2) {
      messages.value.push({
        id: Date.now() + 1,
        role: "assistant",
        content: `⚠️ ${e2.message || e.message || "请求失败"}`,
        error: true,
      });
    }
  } finally {
    stopLoadingHints();
    loading.value = false;
    await scrollToBottom();
  }
}

async function scrollToBottom() {
  await nextTick();
  scrollTop.value = scrollTop.value === 99998 ? 99999 : 99998;
}

onShow(() => {
  scrollToBottom();
});
</script>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: #f5f5f7;
}

/* 模型切换栏 */
.model-bar {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 16rpx 24rpx;
  background-color: #ffffff;
  border-bottom: 1rpx solid #e5e5ea;
}
.model-chip {
  padding: 10rpx 24rpx;
  border-radius: 28rpx;
  background-color: #f2f2f7;
  transition: all 0.2s;
}
.model-chip.active {
  background: linear-gradient(135deg, #f59e0b, #f97316);
  box-shadow: 0 4rpx 12rpx rgba(245, 158, 11, 0.25);
}
.chip-label {
  font-size: 24rpx;
  color: #86868b;
  font-weight: 600;
}
.model-chip.active .chip-label {
  color: #ffffff;
}
.model-info {
  flex: 1;
  text-align: right;
}
.info-text {
  font-size: 20rpx;
  color: #aeaeb2;
}
.clear-btn {
  width: 56rpx;
  height: 56rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background-color: #f2f2f7;
}
.clear-icon {
  font-size: 28rpx;
}

/* 消息列表 */
.msg-list {
  flex: 1;
  padding: 24rpx;
  box-sizing: border-box;
}

/* 欢迎页 */
.welcome {
  padding: 40rpx 0;
}
.welcome-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 48rpx;
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
.avatar-icon {
  font-size: 56rpx;
}
.welcome-title {
  font-size: 40rpx;
  font-weight: 700;
  color: #1d1d1f;
  margin-bottom: 8rpx;
}
.welcome-desc {
  font-size: 24rpx;
  color: #86868b;
}

/* 快捷命令 */
.quick-commands {
  margin-bottom: 40rpx;
}
.cmd-card {
  display: flex;
  align-items: center;
  background-color: #ffffff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 12rpx;
  gap: 16rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);
  transition: transform 0.15s;
}
.cmd-card:active {
  transform: scale(0.98);
}
.cmd-icon {
  font-size: 40rpx;
  flex-shrink: 0;
}
.cmd-info {
  flex: 1;
}
.cmd-label {
  display: block;
  font-size: 28rpx;
  font-weight: 600;
  color: #1d1d1f;
  margin-bottom: 4rpx;
}
.cmd-desc {
  display: block;
  font-size: 22rpx;
  color: #86868b;
}
.cmd-arrow {
  color: #c7c7cc;
  font-size: 36rpx;
  font-weight: 300;
}

/* 建议 */
.suggestions {
  background-color: #ffffff;
  border-radius: 16rpx;
  padding: 24rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);
}
.suggestions-title {
  display: block;
  font-size: 24rpx;
  color: #86868b;
  margin-bottom: 16rpx;
  font-weight: 600;
}
.suggestion-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20rpx 0;
  border-bottom: 1rpx solid #f2f2f7;
}
.suggestion-item:last-child {
  border-bottom: none;
}
.suggestion-text {
  flex: 1;
  font-size: 28rpx;
  color: #1d1d1f;
}
.suggestion-arrow {
  color: #c7c7cc;
  font-size: 32rpx;
}

/* 消息气泡 */
.msg-row {
  display: flex;
  margin-bottom: 24rpx;
  align-items: flex-start;
}
.msg-row.user {
  justify-content: flex-end;
}
.msg-row.assistant {
  justify-content: flex-start;
}
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
}
.msg-avatar-icon {
  font-size: 32rpx;
}
.msg-content {
  max-width: 78%;
}
.msg-row.user .msg-content {
  max-width: 80%;
}
.msg-bubble {
  padding: 20rpx 28rpx;
  border-radius: 24rpx;
}
.msg-row.user .msg-bubble {
  background: linear-gradient(135deg, #f59e0b, #f97316);
  box-shadow: 0 4rpx 16rpx rgba(245, 158, 11, 0.2);
}
.msg-row.user .msg-text {
  color: #ffffff;
}
.msg-row.assistant .msg-bubble {
  background-color: #ffffff;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.06);
}
.msg-row.assistant .msg-text {
  color: #1d1d1f;
}
.msg-text {
  font-size: 30rpx;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
}
.msg-error {
  color: #ef4444 !important;
}

/* 工具调用卡片 */
.tool-card {
  margin-top: 12rpx;
  border: 1rpx solid rgba(139, 92, 246, 0.2);
  border-radius: 16rpx;
  background-color: rgba(139, 92, 246, 0.04);
  overflow: hidden;
}
.tool-header {
  display: flex;
  align-items: center;
  padding: 16rpx 20rpx;
  gap: 8rpx;
}
.tool-icon {
  font-size: 24rpx;
  flex-shrink: 0;
}
.tool-name {
  font-size: 24rpx;
  font-weight: 600;
  color: #8b5cf6;
  flex-shrink: 0;
}
.tool-summary {
  flex: 1;
  font-size: 22rpx;
  color: #86868b;
  margin-left: 8rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tool-expand {
  font-size: 24rpx;
  color: #c7c7cc;
  flex-shrink: 0;
}
.tool-detail {
  padding: 16rpx 20rpx;
  border-top: 1rpx solid rgba(139, 92, 246, 0.15);
}
.detail-label {
  display: block;
  font-size: 20rpx;
  color: #aeaeb2;
  margin-bottom: 8rpx;
  margin-top: 8rpx;
}
.detail-label:first-child {
  margin-top: 0;
}
.detail-json {
  display: block;
  font-size: 20rpx;
  color: #1d1d1f;
  background-color: #f5f5f7;
  border-radius: 8rpx;
  padding: 12rpx;
  line-height: 1.5;
  word-break: break-all;
}
.detail-scroll {
  white-space: nowrap;
}

/* 消息元信息 */
.msg-meta {
  display: flex;
  gap: 12rpx;
  margin-top: 8rpx;
  margin-left: 4rpx;
}
.meta-text {
  font-size: 20rpx;
  color: #aeaeb2;
}
.meta-tokens {
  font-size: 20rpx;
  color: #aeaeb2;
}

/* 打字动画 */
.typing-dots {
  display: flex;
  gap: 8rpx;
  margin-bottom: 8rpx;
}
.dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  background-color: #f59e0b;
  animation: bounce 1.4s infinite ease-in-out;
}
.dot:nth-child(2) { animation-delay: 0.2s; }
.dot:nth-child(3) { animation-delay: 0.4s; }
@keyframes bounce {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
  40% { transform: scale(1); opacity: 1; }
}
.typing-hint {
  font-size: 22rpx;
  color: #aeaeb2;
}

/* 输入栏 */
.input-bar {
  display: flex;
  align-items: center;
  padding: 16rpx 24rpx;
  padding-bottom: calc(16rpx + env(safe-area-inset-bottom));
  background-color: #ffffff;
  border-top: 1rpx solid #e5e5ea;
  gap: 16rpx;
}
.input {
  flex: 1;
  height: 80rpx;
  background-color: #f2f2f7;
  border: none;
  border-radius: 40rpx;
  padding: 0 28rpx;
  color: #1d1d1f;
  font-size: 30rpx;
}
.placeholder {
  color: #aeaeb2;
}
.send-btn {
  width: 80rpx;
  height: 80rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, #f59e0b, #f97316);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 4rpx 16rpx rgba(245, 158, 11, 0.3);
  transition: transform 0.15s;
}
.send-btn:active {
  transform: scale(0.92);
}
.send-btn.disabled {
  opacity: 0.4;
}
.send-text {
  color: #ffffff;
  font-size: 32rpx;
}
</style>

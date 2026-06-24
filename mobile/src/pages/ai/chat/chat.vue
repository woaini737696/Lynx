<template>
  <view class="page">
    <scroll-view scroll-y class="msg-list" :scroll-top="scrollTop" :scroll-with-animation="true">
      <view v-if="messages.length === 0" class="empty">
        <text class="empty-icon">💬</text>
        <text class="empty-text">和 Lynn 聊点什么</text>
        <text class="empty-hint">支持流式输出，实时响应</text>
      </view>

      <view
        v-for="msg in messages"
        :key="msg.id"
        class="msg-row"
        :class="msg.role"
      >
        <view class="msg-bubble">
          <text class="msg-text">{{ msg.content }}</text>
        </view>
      </view>

      <view v-if="loading" class="msg-row assistant">
        <view class="msg-bubble">
          <text class="msg-text typing">{{ streamingText || "Lynn 正在思考..." }}</text>
        </view>
      </view>
    </scroll-view>

    <view class="input-bar">
      <input
        v-model="input"
        class="input"
        placeholder="输入消息..."
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
        <text class="send-text">发送</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, nextTick } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { chatStream } from "@/api/ai.js";

const messages = ref([]);
const input = ref("");
const loading = ref(false);
const scrollTop = ref(0);
const streamingText = ref("");

async function send() {
  const content = input.value.trim();
  if (!content || loading.value) return;

  messages.value.push({ id: Date.now(), role: "user", content });
  input.value = "";
  loading.value = true;
  streamingText.value = "";
  await scrollToBottom();

  // 构建历史消息（最近 10 条）
  const history = messages.value
    .slice(-10)
    .map((m) => ({ role: m.role, content: m.content }));

  try {
    // 优先使用流式（H5），App 端 fetch 流式不可用时回退
    let reply = "";
    try {
      reply = await chatStream(content, undefined, history.slice(0, -1), (chunk) => {
        streamingText.value += chunk;
        scrollToBottom();
      });
    } catch (streamErr) {
      // 流式失败，回退到非流式
      const { chat } = await import("@/api/ai.js");
      const res = await chat(content, undefined, history.slice(0, -1));
      reply = res.content || "（无回复）";
    }

    if (!reply && streamingText.value) reply = streamingText.value;
    messages.value.push({
      id: Date.now() + 1,
      role: "assistant",
      content: reply || "（无回复）",
    });
  } catch (e) {
    messages.value.push({
      id: Date.now() + 1,
      role: "assistant",
      content: `⚠️ ${e.message || "请求失败"}`,
    });
  } finally {
    streamingText.value = "";
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
}
.msg-list {
  flex: 1;
  padding: 24rpx;
  box-sizing: border-box;
}
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 160rpx 0;
}
.empty-icon {
  font-size: 80rpx;
  margin-bottom: 24rpx;
}
.empty-text {
  color: #1d1d1f;
  font-size: 32rpx;
  font-weight: 600;
  margin-bottom: 8rpx;
}
.empty-hint {
  color: #86868b;
  font-size: 24rpx;
}

.msg-row {
  display: flex;
  margin-bottom: 24rpx;
}
.msg-row.user {
  justify-content: flex-end;
}
.msg-row.assistant {
  justify-content: flex-start;
}
.msg-bubble {
  max-width: 75%;
  padding: 20rpx 28rpx;
  border-radius: 24rpx;
}
.msg-row.user .msg-bubble {
  background: linear-gradient(135deg, #f59e0b, #f97316);
}
.msg-row.user .msg-text {
  color: #ffffff;
}
.msg-row.assistant .msg-bubble {
  background-color: #ffffff;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);
}
.msg-row.assistant .msg-text {
  color: #1d1d1f;
}
.msg-text {
  font-size: 30rpx;
  line-height: 1.6;
}
.typing {
  color: #86868b;
}

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
  background: linear-gradient(135deg, #f59e0b, #f97316);
  border-radius: 40rpx;
  padding: 0 36rpx;
  height: 80rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 4rpx 12rpx rgba(245, 158, 11, 0.2);
}
.send-btn.disabled {
  opacity: 0.4;
}
.send-text {
  color: #ffffff;
  font-size: 28rpx;
  font-weight: 600;
}
</style>

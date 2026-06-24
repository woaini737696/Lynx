<template>
  <view class="page">
    <scroll-view scroll-y class="msg-list" :scroll-top="scrollTop" :scroll-with-animation="true">
      <view v-if="messages.length === 0" class="empty">
        <text class="empty-icon">💬</text>
        <text class="empty-text">和 Lynn 聊点什么</text>
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
          <text class="msg-text typing">Lynn 正在思考...</text>
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
        @confirm="send"
      />
      <button class="send-btn" :disabled="!input.trim() || loading" @click="send">发送</button>
    </view>
  </view>
</template>

<script setup>
import { ref, nextTick } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { chat } from "@/api/ai.js";

const messages = ref([]);
const input = ref("");
const loading = ref(false);
const scrollTop = ref(0);

async function send() {
  const content = input.value.trim();
  if (!content || loading.value) return;

  messages.value.push({ id: Date.now(), role: "user", content });
  input.value = "";
  loading.value = true;
  await scrollToBottom();

  try {
    const res = await chat(content);
    const reply =
      res.reply || res.content || res.message || JSON.stringify(res);
    messages.value.push({ id: Date.now() + 1, role: "assistant", content: reply });
  } catch (e) {
    messages.value.push({
      id: Date.now() + 1,
      role: "assistant",
      content: `⚠️ ${e.message || "请求失败"}`,
    });
  } finally {
    loading.value = false;
    await scrollToBottom();
  }
}

async function scrollToBottom() {
  await nextTick();
  scrollTop.value = 99999;
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
  color: #525252;
  font-size: 28rpx;
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
  border-radius: 20rpx;
}
.msg-row.user .msg-bubble {
  background-color: #f6ad55;
}
.msg-row.user .msg-text {
  color: #0a0a0a;
}
.msg-row.assistant .msg-bubble {
  background-color: #171717;
}
.msg-row.assistant .msg-text {
  color: #f5f5f5;
}
.msg-text {
  font-size: 30rpx;
  line-height: 1.6;
}
.typing {
  color: #737373;
}

.input-bar {
  display: flex;
  align-items: center;
  padding: 16rpx 24rpx;
  padding-bottom: calc(16rpx + env(safe-area-inset-bottom));
  background-color: #0a0a0a;
  border-top: 1rpx solid #262626;
  gap: 16rpx;
}
.input {
  flex: 1;
  height: 80rpx;
  background-color: #171717;
  border: 1rpx solid #262626;
  border-radius: 40rpx;
  padding: 0 28rpx;
  color: #f5f5f5;
  font-size: 28rpx;
}
.placeholder {
  color: #525252;
}
.send-btn {
  background-color: #f6ad55;
  color: #0a0a0a;
  font-size: 28rpx;
  font-weight: 600;
  border-radius: 40rpx;
  padding: 0 32rpx;
  height: 80rpx;
  line-height: 80rpx;
  border: none;
  flex-shrink: 0;
}
.send-btn[disabled] {
  opacity: 0.4;
}
</style>

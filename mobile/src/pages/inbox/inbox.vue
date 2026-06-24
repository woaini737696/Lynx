<template>
  <view class="page">
    <view class="header">
      <text class="header-title">灵感收件箱</text>
      <text class="header-count">{{ ideas.length }} 条</text>
    </view>

    <view v-if="loading && ideas.length === 0" class="loading">
      <text class="text-secondary">加载中...</text>
    </view>

    <view v-else-if="ideas.length === 0" class="empty">
      <text class="empty-icon">💡</text>
      <text class="empty-text">收件箱空空如也</text>
      <text class="empty-hint">点击右下角 ⚡ 捕获灵感</text>
    </view>

    <scroll-view v-else scroll-y class="idea-list">
      <view v-for="idea in ideas" :key="idea.id" class="idea-card">
        <text class="idea-content">{{ idea.content }}</text>
        <view class="idea-footer">
          <text class="idea-time">{{ formatTime(idea.createdAt) }}</text>
          <view class="idea-actions">
            <text class="action" @click="moveToBoard(idea)">→看板</text>
            <text class="action danger" @click="abandon(idea)">放弃</text>
          </view>
        </view>
      </view>
    </scroll-view>

    <capture-bar @saved="loadIdeas" />
  </view>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { getInboxIdeas } from "@/api/ideas.js";
import { updateTask } from "@/api/tasks.js";
import CaptureBar from "@/components/CaptureBar.vue";

const ideas = ref([]);
const loading = ref(false);

async function loadIdeas() {
  loading.value = true;
  try {
    const res = await getInboxIdeas();
    ideas.value = res.ideas || [];
  } catch (e) {
    uni.showToast({ title: e.message || "加载失败", icon: "none" });
  } finally {
    loading.value = false;
  }
}

function moveToBoard(idea) {
  uni.showActionSheet({
    itemList: ["北极星", "战役", "任务"],
    success: async (res) => {
      const cols = ["northstar", "campaign", "task"];
      const column = cols[res.tapIndex];
      try {
        const { createTask } = await import("@/api/tasks.js");
        await createTask({ content: idea.content, column });
        // 灵感状态改为 board
        const { put } = await import("@/api/request.js");
        await put(`/api/ideas/${idea.id}`, { status: "board" });
        uni.showToast({ title: "已移入看板", icon: "success" });
        loadIdeas();
      } catch (e) {
        uni.showToast({ title: e.message || "操作失败", icon: "none" });
      }
    },
  });
}

async function abandon(idea) {
  uni.showModal({
    title: "放弃这个灵感？",
    content: idea.content,
    editable: true,
    placeholderText: "请输入放弃原因（必填）",
    success: async (res) => {
      if (res.confirm && res.content) {
        try {
          const { post } = await import("@/api/request.js");
          await post(`/api/ideas/${idea.id}/revive-check`, {
            reason: res.content,
          });
          uni.showToast({ title: "已放入墓地", icon: "success" });
          loadIdeas();
        } catch (e) {
          uni.showToast({ title: e.message || "操作失败", icon: "none" });
        }
      }
    },
  });
}

function formatTime(d) {
  if (!d) return "";
  const date = new Date(d);
  return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

onMounted(loadIdeas);
onShow(loadIdeas);
</script>

<style scoped>
.page {
  min-height: 100vh;
  padding: 32rpx;
  box-sizing: border-box;
}
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32rpx;
}
.header-title {
  font-size: 48rpx;
  font-weight: 700;
  color: #f5f5f5;
}
.header-count {
  font-size: 26rpx;
  color: #737373;
}

.loading,
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 120rpx 0;
}
.empty-icon {
  font-size: 80rpx;
  margin-bottom: 24rpx;
}
.empty-text {
  color: #a3a3a3;
  font-size: 30rpx;
  margin-bottom: 8rpx;
}
.empty-hint {
  color: #525252;
  font-size: 24rpx;
}

.idea-list {
  height: calc(100vh - 200rpx);
}
.idea-card {
  background-color: #171717;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
}
.idea-content {
  color: #f5f5f5;
  font-size: 30rpx;
  line-height: 1.6;
}
.idea-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 16rpx;
}
.idea-time {
  font-size: 22rpx;
  color: #525252;
}
.idea-actions {
  display: flex;
  gap: 24rpx;
}
.action {
  font-size: 24rpx;
  color: #f6ad55;
  padding: 4rpx 12rpx;
}
.action.danger {
  color: #ef4444;
}
</style>

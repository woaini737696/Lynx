<template>
  <view class="page">
    <view class="header">
      <text class="header-title">灵感收件箱</text>
      <text class="header-count">{{ ideas.length }} 条</text>
    </view>

    <view v-if="cacheInfo" class="offline-banner">
      <text class="offline-icon">📡</text>
      <text class="offline-text">离线浏览 · 缓存于 {{ formatCacheTime(cacheInfo.cachedAt) }}</text>
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
            <view class="action-btn board-btn" @click="moveToBoard(idea)">
              <text class="action-text">→看板</text>
            </view>
            <view class="action-btn danger-btn" @click="abandon(idea)">
              <text class="action-text danger-text">放弃</text>
            </view>
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
import { getInboxIdeas, moveIdeaToBoard, abandonIdea } from "@/api/ideas.js";
import CaptureBar from "@/components/CaptureBar.vue";
import { setCache, getCache, formatCacheTime } from "@/utils/cache.js";

const ideas = ref([]);
const loading = ref(false);
const cacheInfo = ref(null);

async function loadIdeas() {
  loading.value = true;
  try {
    const res = await getInboxIdeas();
    ideas.value = res.ideas || [];
    setCache("inbox_ideas", res.ideas || []);
    cacheInfo.value = null;
  } catch (e) {
    // 离线回退
    const cache = getCache("inbox_ideas");
    if (cache && cache.data) {
      ideas.value = cache.data;
      cacheInfo.value = cache;
      uni.showToast({
        title: `离线浏览（${formatCacheTime(cache.cachedAt)}）`,
        icon: "none",
        duration: 2000,
      });
    } else {
      uni.showToast({ title: e.message || "加载失败", icon: "none" });
    }
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
        await moveIdeaToBoard(idea.id, column);
        uni.showToast({ title: "已移入看板", icon: "success" });
        loadIdeas();
      } catch (e) {
        uni.showToast({ title: e.message || "操作失败", icon: "none" });
      }
    },
  });
}

function abandon(idea) {
  uni.showModal({
    title: "放弃这个灵感？",
    editable: true,
    placeholderText: "请输入放弃原因（必填）",
    confirmColor: "#ef4444",
    success: async (res) => {
      if (res.confirm && res.content) {
        try {
          // reviveCondition 必填，默认简单条件
          await abandonIdea(idea.id, res.content, "再次出现类似想法时复活");
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
  color: #1d1d1f;
}
.header-count {
  font-size: 26rpx;
  color: #86868b;
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
  color: #86868b;
  font-size: 30rpx;
  margin-bottom: 8rpx;
}
.empty-hint {
  color: #aeaeb2;
  font-size: 24rpx;
}

.offline-banner {
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding: 12rpx 24rpx;
  background-color: rgba(59, 130, 246, 0.08);
  border-radius: 12rpx;
  margin-bottom: 16rpx;
}
.offline-icon {
  font-size: 24rpx;
}
.offline-text {
  font-size: 24rpx;
  color: #3b82f6;
}

.idea-list {
  height: calc(100vh - 200rpx);
}
.idea-card {
  background-color: #ffffff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);
}
.idea-content {
  color: #1d1d1f;
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
  color: #aeaeb2;
}
.idea-actions {
  display: flex;
  gap: 16rpx;
}
.action-btn {
  border-radius: 20rpx;
  padding: 8rpx 20rpx;
}
.board-btn {
  background-color: rgba(245, 158, 11, 0.12);
}
.danger-btn {
  background-color: rgba(239, 68, 68, 0.1);
}
.action-text {
  font-size: 24rpx;
  color: #f59e0b;
  font-weight: 600;
}
.danger-text {
  color: #ef4444;
}
</style>

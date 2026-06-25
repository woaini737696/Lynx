<template>
  <view class="page">
    <view class="header">
      <text class="header-title">灵感收件箱</text>
      <view class="header-right">
        <text class="header-count">{{ ideas.length }} 条</text>
        <view
          v-if="!multiSelectMode && ideas.length > 0"
          class="batch-btn"
          @click="enterMultiSelect"
        >
          <text class="batch-btn-text">批量</text>
        </view>
        <view
          v-if="multiSelectMode"
          class="batch-btn cancel-btn"
          @click="exitMultiSelect"
        >
          <text class="batch-btn-text">取消</text>
        </view>
      </view>
    </view>

    <view v-if="cacheInfo" class="offline-banner">
      <text class="offline-icon">📡</text>
      <text class="offline-text">离线浏览 · 缓存于 {{ formatCacheTime(cacheInfo.cachedAt) }}</text>
    </view>

    <!-- 批量操作栏 -->
    <view v-if="multiSelectMode" class="batch-bar">
      <view class="batch-bar-btn" @click="selectAll">
        <text class="batch-bar-text">全选</text>
      </view>
      <view class="batch-bar-btn" @click="clearSelection">
        <text class="batch-bar-text">清空</text>
      </view>
      <text class="batch-count">已选 {{ selectedIds.size }} 条</text>
      <view
        class="batch-delete-btn"
        :class="{ disabled: selectedIds.size === 0 || batchDeleting }"
        @click="batchDelete"
      >
        <text class="batch-delete-text">{{ batchDeleting ? "删除中..." : "删除" }}</text>
      </view>
    </view>

    <view v-if="loading && ideas.length === 0" class="loading">
      <text class="text-secondary">加载中...</text>
    </view>

    <view v-else-if="ideas.length === 0" class="empty">
      <text class="empty-icon">💡</text>
      <text class="empty-text">收件箱空空如也</text>
      <text class="empty-hint">点击右下角 ⚡ 捕获灵感</text>
    </view>

    <scroll-view v-else scroll-y class="idea-list" :class="{ 'multi-list': multiSelectMode }">
      <view
        v-for="idea in ideas"
        :key="idea.id"
        class="idea-card"
        :class="{ 'multi-card': multiSelectMode, 'selected-card': multiSelectMode && selectedIds.has(idea.id) }"
        @click="multiSelectMode ? toggleSelect(idea.id) : null"
      >
        <view
          v-if="multiSelectMode"
          class="checkbox"
          :class="{ checked: selectedIds.has(idea.id) }"
        >
          <text v-if="selectedIds.has(idea.id)" class="checkbox-icon">✓</text>
        </view>
        <view class="idea-main">
          <text class="idea-content">{{ idea.content }}</text>
          <view class="idea-footer">
            <text class="idea-time">{{ formatTime(idea.createdAt) }}</text>
            <view v-if="!multiSelectMode" class="idea-actions">
              <view class="action-btn board-btn" @click.stop="moveToBoard(idea)">
                <text class="action-text">→看板</text>
              </view>
              <view class="action-btn danger-btn" @click.stop="abandon(idea)">
                <text class="action-text danger-text">放弃</text>
              </view>
            </view>
          </view>
        </view>
      </view>
    </scroll-view>

    <capture-bar v-if="!multiSelectMode" @saved="loadIdeas" />
  </view>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { getInboxIdeas, moveIdeaToBoard, abandonIdea, batchDeleteIdeas } from "@/api/ideas.js";
import CaptureBar from "@/components/CaptureBar.vue";
import { setCache, getCache, formatCacheTime } from "@/utils/cache.js";

const ideas = ref([]);
const loading = ref(false);
const cacheInfo = ref(null);

// ===== 多选模式 =====
const multiSelectMode = ref(false);
const selectedIds = ref(new Set());
const batchDeleting = ref(false);

function enterMultiSelect() {
  multiSelectMode.value = true;
  selectedIds.value = new Set();
}

function exitMultiSelect() {
  multiSelectMode.value = false;
  selectedIds.value = new Set();
}

function toggleSelect(id) {
  const next = new Set(selectedIds.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  selectedIds.value = next;
}

function selectAll() {
  selectedIds.value = new Set(ideas.value.map((i) => i.id));
}

function clearSelection() {
  selectedIds.value = new Set();
}

async function batchDelete() {
  if (selectedIds.value.size === 0 || batchDeleting.value) return;
  uni.showModal({
    title: "批量删除",
    content: `确定删除选中的 ${selectedIds.value.size} 条灵感吗？此操作不可恢复。`,
    confirmColor: "#ef4444",
    success: async (res) => {
      if (!res.confirm) return;
      batchDeleting.value = true;
      try {
        const ids = Array.from(selectedIds.value);
        const result = await batchDeleteIdeas(ids);
        uni.showToast({
          title: `已删除 ${result.deleted || ids.length} 条`,
          icon: "success",
        });
        exitMultiSelect();
        await loadIdeas();
      } catch (e) {
        uni.showToast({ title: e.message || "删除失败", icon: "none" });
      } finally {
        batchDeleting.value = false;
      }
    },
  });
}

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
.header-right {
  display: flex;
  align-items: center;
  gap: 16rpx;
}
.header-count {
  font-size: 26rpx;
  color: #86868b;
}
.batch-btn {
  background-color: rgba(245, 158, 11, 0.12);
  border-radius: 24rpx;
  padding: 8rpx 20rpx;
}
.batch-btn-text {
  font-size: 24rpx;
  color: #f59e0b;
  font-weight: 600;
}
.cancel-btn {
  background-color: #f2f2f7;
}
.cancel-btn .batch-btn-text {
  color: #86868b;
}

/* 批量操作栏 */
.batch-bar {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 16rpx 20rpx;
  background-color: #ffffff;
  border-radius: 16rpx;
  margin-bottom: 16rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);
}
.batch-bar-btn {
  background-color: #f2f2f7;
  border-radius: 20rpx;
  padding: 8rpx 20rpx;
}
.batch-bar-text {
  font-size: 24rpx;
  color: #1d1d1f;
  font-weight: 600;
}
.batch-count {
  flex: 1;
  font-size: 24rpx;
  color: #86868b;
  text-align: center;
}
.batch-delete-btn {
  background-color: rgba(239, 68, 68, 0.1);
  border-radius: 20rpx;
  padding: 8rpx 24rpx;
}
.batch-delete-btn.disabled {
  opacity: 0.4;
}
.batch-delete-text {
  font-size: 24rpx;
  color: #ef4444;
  font-weight: 600;
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
.idea-list.multi-list {
  height: calc(100vh - 300rpx);
}
.idea-card {
  background-color: #ffffff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);
}
.idea-card.multi-card {
  display: flex;
  align-items: flex-start;
  gap: 16rpx;
  border: 2rpx solid transparent;
  transition: border-color 0.2s;
}
.idea-card.selected-card {
  border-color: #f59e0b;
  background-color: rgba(245, 158, 11, 0.04);
}
.checkbox {
  width: 40rpx;
  height: 40rpx;
  border-radius: 50%;
  border: 3rpx solid #d1d1d6;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 4rpx;
  transition: all 0.2s;
}
.checkbox.checked {
  background: linear-gradient(135deg, #f59e0b, #f97316);
  border-color: #f59e0b;
}
.checkbox-icon {
  color: #ffffff;
  font-size: 24rpx;
  font-weight: 700;
}
.idea-main {
  flex: 1;
  min-width: 0;
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

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
      <Icon name="wifiOff" :size="28" color="#f59e0b" />
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
        <view class="batch-delete-inner">
          <Icon name="trash" :size="26" color="#ffffff" />
          <text class="batch-delete-text">{{ batchDeleting ? "删除中..." : "删除" }}</text>
        </view>
      </view>
    </view>

    <view v-if="loading && ideas.length === 0" class="loading">
      <text class="text-secondary">加载中...</text>
    </view>

    <view v-else-if="ideas.length === 0" class="empty">
      <Icon name="bulb" :size="80" :color="isDark ? '#48484a' : '#d1d1d6'" />
      <text class="empty-text">收件箱空空如也</text>
      <text class="empty-hint">点击右下角闪电按钮捕获灵感</text>
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
          <Icon v-if="selectedIds.has(idea.id)" name="check" :size="24" color="#ffffff" />
        </view>
        <view class="idea-main">
          <text class="idea-content">{{ idea.content }}</text>
          <!-- 图片附件 -->
          <view v-if="idea.attachments && idea.attachments.length" class="idea-images">
            <view
              v-for="(att, idx) in idea.attachments.filter((a) => a.type === 'image')"
              :key="idx"
              class="idea-image-wrap"
              @click.stop="previewAttachment(idea.attachments, idx)"
            >
              <image :src="resolveMediaUrl(att.url)" class="idea-image" mode="aspectFill" />
            </view>
          </view>
          <view class="idea-footer">
            <text class="idea-time">{{ formatTime(idea.createdAt) }}</text>
            <view v-if="!multiSelectMode" class="idea-actions">
              <view class="action-btn board-btn" @click.stop="moveToBoard(idea)">
                <Icon name="arrowUp" :size="22" color="#f59e0b" />
                <text class="action-text">看板</text>
              </view>
              <view class="action-btn danger-btn" @click.stop="abandon(idea)">
                <Icon name="trash" :size="22" color="#ef4444" />
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
import { ref, onMounted, computed } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { getInboxIdeas, moveIdeaToBoard, abandonIdea, batchDeleteIdeas } from "@/api/ideas.js";
import CaptureBar from "@/components/CaptureBar.vue";
import Icon from "@/components/Icon.vue";
import { setCache, getCache, formatCacheTime } from "@/utils/cache.js";
import { resolveMediaUrl } from "@/utils/url.js";
import { useSettingsStore } from "@/store/settings.js";

const settingsStore = useSettingsStore();
const isDark = computed(() => settingsStore.theme === "dark");

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

function previewAttachment(attachments, idx) {
  const imageUrls = attachments
    .filter((a) => a.type === "image")
    .map((a) => resolveMediaUrl(a.url));
  uni.previewImage({
    current: imageUrls[idx],
    urls: imageUrls,
    indicator: "number",
  });
}

onMounted(loadIdeas);
onShow(loadIdeas);
</script>

<style scoped>
.page {
  min-height: 100vh;
  background-color: var(--bg-page);
  padding: 32rpx;
  padding-bottom: calc(140rpx + env(safe-area-inset-bottom));
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
  color: var(--text-primary);
  letter-spacing: 0.5rpx;
}
.header-right {
  display: flex;
  align-items: center;
  gap: 16rpx;
}
.header-count {
  font-size: 26rpx;
  color: var(--text-secondary);
}
.batch-btn {
  background-color: var(--accent-soft);
  border-radius: var(--radius-pill);
  padding: 10rpx 24rpx;
  transition: transform 0.15s, opacity 0.15s;
}
.batch-btn:active {
  transform: scale(0.96);
  opacity: 0.85;
}
.batch-btn-text {
  font-size: 24rpx;
  color: var(--accent);
  font-weight: 600;
}
.cancel-btn {
  background-color: var(--bg-input);
}
.cancel-btn .batch-btn-text {
  color: var(--text-secondary);
}

/* 批量操作栏 */
.batch-bar {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 16rpx 20rpx;
  background-color: var(--bg-card);
  border-radius: var(--radius-lg);
  margin-bottom: 20rpx;
  box-shadow: var(--shadow-card);
}
.batch-bar-btn {
  background-color: var(--bg-input);
  border-radius: var(--radius-pill);
  padding: 10rpx 24rpx;
  transition: transform 0.15s;
}
.batch-bar-btn:active {
  transform: scale(0.96);
}
.batch-bar-text {
  font-size: 24rpx;
  color: var(--text-primary);
  font-weight: 600;
}
.batch-count {
  flex: 1;
  font-size: 24rpx;
  color: var(--text-secondary);
  text-align: center;
}
.batch-delete-btn {
  background-color: rgba(239, 68, 68, 0.1);
  border-radius: var(--radius-pill);
  padding: 10rpx 28rpx;
  transition: transform 0.15s, opacity 0.15s;
}
.batch-delete-btn:active {
  transform: scale(0.96);
}
.batch-delete-btn.disabled {
  opacity: 0.4;
  pointer-events: none;
}
.batch-delete-inner {
  display: flex;
  align-items: center;
  gap: 8rpx;
}
.batch-delete-text {
  font-size: 24rpx;
  color: var(--red);
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
  color: var(--text-tertiary);
}
.empty-text {
  color: var(--text-secondary);
  font-size: 30rpx;
  margin-bottom: 8rpx;
  font-weight: 500;
}
.empty-hint {
  color: var(--text-tertiary);
  font-size: 24rpx;
}

.offline-banner {
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding: 12rpx 24rpx;
  background-color: var(--blue-soft);
  border-radius: var(--radius-md);
  margin-bottom: 20rpx;
}
.offline-icon {
  font-size: 24rpx;
}
.offline-text {
  font-size: 24rpx;
  color: var(--blue);
}

.idea-list {
  height: calc(100vh - 200rpx - env(safe-area-inset-bottom));
}
.idea-list.multi-list {
  height: calc(100vh - 300rpx - env(safe-area-inset-bottom));
}
.idea-card {
  background-color: var(--bg-card);
  border-radius: var(--radius-lg);
  padding: 28rpx;
  margin-bottom: 20rpx;
  box-shadow: var(--shadow-card);
  transition: transform 0.15s, box-shadow 0.15s;
}
.idea-card:active {
  transform: scale(0.99);
  box-shadow: var(--shadow-elevated);
}
.idea-card.multi-card {
  display: flex;
  align-items: flex-start;
  gap: 16rpx;
  border: 2rpx solid transparent;
  transition: border-color 0.2s, transform 0.15s, box-shadow 0.15s;
}
.idea-card.selected-card {
  border-color: var(--accent);
  background-color: var(--accent-soft);
}
.checkbox {
  width: 44rpx;
  height: 44rpx;
  border-radius: 50%;
  border: 3rpx solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 4rpx;
  transition: all 0.2s;
}
.checkbox.checked {
  background: var(--accent-gradient);
  border-color: var(--accent);
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
  color: var(--text-primary);
  font-size: 30rpx;
  line-height: 1.6;
}
.idea-images {
  display: flex;
  flex-wrap: nowrap;
  gap: 16rpx;
  margin-top: 20rpx;
  overflow-x: auto;
}
.idea-image-wrap {
  flex-shrink: 0;
  border-radius: 16rpx;
  overflow: hidden;
  transition: transform 0.15s;
}
.idea-image-wrap:active {
  transform: scale(0.96);
}
.idea-image {
  width: 180rpx;
  height: 180rpx;
  border-radius: 16rpx;
  display: block;
}
.idea-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 20rpx;
}
.idea-time {
  font-size: 22rpx;
  color: var(--text-tertiary);
}
.idea-actions {
  display: flex;
  gap: 16rpx;
}
.action-btn {
  display: flex;
  align-items: center;
  gap: 6rpx;
  border-radius: var(--radius-pill);
  padding: 10rpx 24rpx;
  transition: transform 0.15s, opacity 0.15s;
}
.action-btn:active {
  transform: scale(0.94);
  opacity: 0.85;
}
.board-btn {
  background-color: var(--accent-soft);
}
.danger-btn {
  background-color: rgba(239, 68, 68, 0.1);
}
.action-text {
  font-size: 24rpx;
  color: var(--accent);
  font-weight: 600;
}
.danger-text {
  color: var(--red);
}
</style>

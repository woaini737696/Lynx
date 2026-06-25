<template>
  <view class="page">
    <view class="header">
      <text class="header-title">记忆认知</text>
      <text v-if="stats" class="header-stats">{{ stats.total }} 节点 · {{ stats.edges }} 连边</text>
    </view>

    <view class="search-bar">
      <view class="search-icon-wrap">
        <Icon name="search" :size="28" :color="isDark ? '#98989d' : '#86868b'" />
      </view>
      <input
        v-model="query"
        class="search-input"
        placeholder="语义搜索记忆..."
        placeholder-class="placeholder"
        confirm-type="search"
        :cursor-spacing="20"
        :adjust-position="true"
        @confirm="search"
      />
      <view class="search-btn" @click="search">
        <text class="search-btn-text">搜索</text>
      </view>
    </view>

    <view v-if="loading" class="loading">
      <text class="text-secondary">{{ searched ? "搜索中..." : "加载中..." }}</text>
    </view>

    <!-- 搜索结果 -->
    <view v-else-if="searched && results.length > 0" class="result-list">
      <view v-for="item in results" :key="item.id" class="result-card">
        <view class="result-header">
          <text class="result-type" :class="`type-${item.type}`">{{ typeLabel(item.type) }}</text>
          <text v-if="item.score" class="result-score">{{ (item.score * 100).toFixed(0) }}%</text>
        </view>
        <text class="result-content">{{ item.label }}</text>
      </view>
    </view>

    <view v-else-if="searched" class="empty">
      <Icon name="search" :size="80" :color="isDark ? '#48484a' : '#d1d1d6'" />
      <text class="empty-text">未找到相关记忆</text>
    </view>

    <!-- 记忆节点列表（未搜索时） -->
    <view v-else-if="memories.length > 0" class="result-list">
      <view v-for="node in memories" :key="node.id" class="result-card">
        <view class="result-header">
          <text class="result-type" :class="`type-${node.type}`">{{ typeLabel(node.type) }}</text>
          <view v-if="node.strength" class="result-score-row">
            <Icon name="bolt" :size="22" color="#f59e0b" />
            <text class="result-score">{{ node.strength }}</text>
          </view>
        </view>
        <text class="result-content">{{ node.label }}</text>
        <text v-if="node.fullContent && node.fullContent !== node.label" class="result-full">{{ node.fullContent }}</text>
      </view>
    </view>

    <view v-else class="empty">
      <Icon name="brain" :size="80" :color="isDark ? '#48484a' : '#d1d1d6'" />
      <text class="empty-text">搜索你的记忆图谱</text>
      <text class="empty-hint">输入关键词进行语义检索</text>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { searchMemory, getMemoryGraph } from "@/api/memory.js";
import Icon from "@/components/Icon.vue";
import { useSettingsStore } from "@/store/settings.js";

const settingsStore = useSettingsStore();
const isDark = computed(() => settingsStore.theme === "dark");

const query = ref("");
const results = ref([]);
const memories = ref([]);
const stats = ref(null);
const loading = ref(false);
const searched = ref(false);

async function loadMemories() {
  if (searched.value) return;
  loading.value = true;
  try {
    const res = await getMemoryGraph();
    memories.value = res.nodes || [];
    stats.value = res.stats || null;
  } catch (e) {
    // 静默失败，不影响搜索功能
  } finally {
    loading.value = false;
  }
}

async function search() {
  if (!query.value.trim()) return;
  loading.value = true;
  searched.value = true;
  try {
    const res = await searchMemory(query.value.trim());
    results.value = res.results || res.memories || [];
  } catch (e) {
    uni.showToast({ title: e.message || "搜索失败", icon: "none" });
  } finally {
    loading.value = false;
  }
}

const TYPE_LABELS = {
  idea: "灵感",
  conversation: "对话",
  cognition: "认知",
};
function typeLabel(t) {
  return TYPE_LABELS[t] || t;
}

onShow(loadMemories);
</script>

<style scoped>
.page {
  min-height: 100vh;
  padding: 32rpx;
  padding-bottom: calc(32rpx + env(safe-area-inset-bottom) + 140rpx);
  box-sizing: border-box;
  background-color: var(--bg-page);
}
.header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 32rpx;
}
.header-title {
  font-size: 48rpx;
  font-weight: 700;
  color: var(--text-primary);
}
.header-stats {
  font-size: 24rpx;
  color: var(--text-secondary);
}

.search-bar {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-bottom: 32rpx;
  background-color: var(--bg-card);
  border: 1rpx solid var(--border-color);
  border-radius: var(--radius-pill);
  padding: 8rpx 8rpx 8rpx 20rpx;
  box-shadow: var(--shadow-card);
}
.search-icon-wrap {
  width: 48rpx;
  height: 48rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
}
.search-input {
  flex: 1;
  height: 72rpx;
  background-color: transparent;
  border: none;
  border-radius: 0;
  padding: 0 12rpx;
  color: var(--text-primary);
  font-size: 28rpx;
}
.placeholder {
  color: var(--text-tertiary);
}
.search-btn {
  background: var(--accent-gradient);
  border-radius: var(--radius-pill);
  padding: 0 32rpx;
  height: 72rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow-fab);
}
.search-btn-text {
  color: #ffffff;
  font-size: 28rpx;
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
  color: var(--text-secondary);
  font-size: 30rpx;
  margin-bottom: 8rpx;
}
.empty-hint {
  color: var(--text-tertiary);
  font-size: 24rpx;
}

.result-card {
  background-color: var(--bg-card);
  border-radius: var(--radius-lg);
  padding: 28rpx;
  margin-bottom: 20rpx;
  box-shadow: var(--shadow-card);
}
.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
}
.result-type {
  font-size: 22rpx;
  padding: 6rpx 18rpx;
  border-radius: var(--radius-pill);
  font-weight: 500;
}
.type-idea {
  background-color: var(--accent-soft);
  color: var(--accent);
}
.type-conversation {
  background-color: var(--blue-soft);
  color: var(--blue);
}
.type-cognition {
  background-color: rgba(34, 197, 94, 0.12);
  color: var(--green);
}
.result-score-row {
  display: flex;
  align-items: center;
  gap: 4rpx;
}
.result-score {
  font-size: 22rpx;
  color: var(--text-tertiary);
}
.result-content {
  color: var(--text-primary);
  font-size: 28rpx;
  line-height: 1.6;
}
.result-full {
  color: var(--text-secondary);
  font-size: 24rpx;
  line-height: 1.5;
  margin-top: 8rpx;
}
</style>

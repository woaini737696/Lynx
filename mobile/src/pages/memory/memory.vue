<template>
  <view class="page">
    <view class="header">
      <text class="header-title">记忆认知</text>
      <text v-if="stats" class="header-stats">{{ stats.total }} 节点 · {{ stats.edges }} 连边</text>
    </view>

    <view class="search-bar">
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
      <text class="empty-icon">🔍</text>
      <text class="empty-text">未找到相关记忆</text>
    </view>

    <!-- 记忆节点列表（未搜索时） -->
    <view v-else-if="memories.length > 0" class="result-list">
      <view v-for="node in memories" :key="node.id" class="result-card">
        <view class="result-header">
          <text class="result-type" :class="`type-${node.type}`">{{ typeLabel(node.type) }}</text>
          <text v-if="node.strength" class="result-score">⚡ {{ node.strength }}</text>
        </view>
        <text class="result-content">{{ node.label }}</text>
        <text v-if="node.fullContent && node.fullContent !== node.label" class="result-full">{{ node.fullContent }}</text>
      </view>
    </view>

    <view v-else class="empty">
      <text class="empty-icon">🧠</text>
      <text class="empty-text">搜索你的记忆图谱</text>
      <text class="empty-hint">输入关键词进行语义检索</text>
    </view>
  </view>
</template>

<script setup>
import { ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { searchMemory, getMemoryGraph } from "@/api/memory.js";

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
  box-sizing: border-box;
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
  color: #1d1d1f;
}
.header-stats {
  font-size: 24rpx;
  color: #86868b;
}

.search-bar {
  display: flex;
  gap: 16rpx;
  margin-bottom: 32rpx;
}
.search-input {
  flex: 1;
  height: 80rpx;
  background-color: #ffffff;
  border: 2rpx solid #e5e5ea;
  border-radius: 40rpx;
  padding: 0 28rpx;
  color: #1d1d1f;
  font-size: 28rpx;
}
.placeholder {
  color: #aeaeb2;
}
.search-btn {
  background: linear-gradient(135deg, #f59e0b, #f97316);
  border-radius: 40rpx;
  padding: 0 32rpx;
  height: 80rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4rpx 12rpx rgba(245, 158, 11, 0.2);
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
  color: #86868b;
  font-size: 30rpx;
  margin-bottom: 8rpx;
}
.empty-hint {
  color: #aeaeb2;
  font-size: 24rpx;
}

.result-card {
  background-color: #ffffff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);
}
.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12rpx;
}
.result-type {
  font-size: 22rpx;
  padding: 4rpx 16rpx;
  border-radius: 8rpx;
}
.type-idea {
  background-color: rgba(245, 158, 11, 0.12);
  color: #f59e0b;
}
.type-conversation {
  background-color: rgba(59, 130, 246, 0.12);
  color: #3b82f6;
}
.type-cognition {
  background-color: rgba(16, 185, 129, 0.12);
  color: #10b981;
}
.result-score {
  font-size: 22rpx;
  color: #86868b;
}
.result-content {
  color: #1d1d1f;
  font-size: 28rpx;
  line-height: 1.6;
}
.result-full {
  color: #86868b;
  font-size: 24rpx;
  line-height: 1.5;
  margin-top: 8rpx;
}
</style>

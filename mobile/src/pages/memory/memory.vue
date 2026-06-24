<template>
  <view class="page">
    <view class="header">
      <text class="header-title">记忆认知</text>
    </view>

    <view class="search-bar">
      <input
        v-model="query"
        class="search-input"
        placeholder="语义搜索记忆..."
        placeholder-class="placeholder"
        confirm-type="search"
        @confirm="search"
      />
      <text class="search-btn" @click="search">搜索</text>
    </view>

    <view v-if="loading" class="loading">
      <text class="text-secondary">搜索中...</text>
    </view>

    <view v-else-if="results.length > 0" class="result-list">
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

    <view v-else class="empty">
      <text class="empty-icon">🧠</text>
      <text class="empty-text">搜索你的记忆图谱</text>
      <text class="empty-hint">输入关键词进行语义检索</text>
    </view>
  </view>
</template>

<script setup>
import { ref } from "vue";
import { searchMemory } from "@/api/memory.js";

const query = ref("");
const results = ref([]);
const loading = ref(false);
const searched = ref(false);

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
</script>

<style scoped>
.page {
  min-height: 100vh;
  padding: 32rpx;
  box-sizing: border-box;
}
.header {
  margin-bottom: 32rpx;
}
.header-title {
  font-size: 48rpx;
  font-weight: 700;
  color: #f5f5f5;
}

.search-bar {
  display: flex;
  gap: 16rpx;
  margin-bottom: 32rpx;
}
.search-input {
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
.search-btn {
  background-color: #f6ad55;
  color: #0a0a0a;
  font-size: 28rpx;
  font-weight: 600;
  border-radius: 40rpx;
  padding: 0 32rpx;
  line-height: 80rpx;
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

.result-card {
  background-color: #171717;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
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
  background-color: rgba(246, 173, 85, 0.15);
  color: #f6ad55;
}
.type-conversation {
  background-color: rgba(99, 179, 237, 0.15);
  color: #63b3ed;
}
.type-cognition {
  background-color: rgba(104, 211, 145, 0.15);
  color: #68d391;
}
.result-score {
  font-size: 22rpx;
  color: #737373;
}
.result-content {
  color: #d4d4d4;
  font-size: 28rpx;
  line-height: 1.6;
}
</style>

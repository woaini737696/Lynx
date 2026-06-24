<template>
  <view class="page">
    <view class="header">
      <text class="header-title">今日聚焦</text>
      <text class="header-date">{{ todayStr }}</text>
    </view>

    <view v-if="loading && !focus" class="loading">
      <text class="text-secondary">加载中...</text>
    </view>

    <view v-else-if="!focus || !focus.items || focus.items.length === 0" class="empty">
      <text class="empty-icon">🎯</text>
      <text class="empty-text">今天还没有聚焦任务</text>
      <text class="empty-hint">去决策看板添加任务，系统会自动生成今日聚焦</text>
    </view>

    <view v-else class="cards">
      <view
        v-for="(item, idx) in focus.items"
        :key="item.id"
        class="focus-card"
        :class="{ completed: item.completed }"
        @click="toggle(item)"
      >
        <view class="card-check" :class="{ checked: item.completed }">
          <text v-if="item.completed" class="check-icon">✓</text>
        </view>
        <view class="card-body">
          <text class="card-index">{{ idx + 1 }}</text>
          <text class="card-content">{{ item.task.content }}</text>
        </view>
        <view class="card-tag" :class="`tag-${item.task.column}`">
          {{ columnLabel(item.task.column) }}
        </view>
      </view>
    </view>

    <view v-if="focus && focus.items && focus.items.length > 0" class="progress-bar">
      <view class="progress-track">
        <view class="progress-fill" :style="{ width: progressPercent + '%' }"></view>
      </view>
      <text class="progress-text">{{ completedCount }}/{{ focus.items.length }} 已完成</text>
    </view>

    <capture-bar @saved="loadFocus" />
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { getTodayFocus, toggleFocusItem } from "@/api/focus.js";
import CaptureBar from "@/components/CaptureBar.vue";

const loading = ref(false);
const focus = ref(null);

const todayStr = computed(() => {
  const d = new Date();
  return `${d.getMonth() + 1}月${d.getDate()}日`;
});

const completedCount = computed(() => {
  if (!focus.value?.items) return 0;
  return focus.value.items.filter((i) => i.completed).length;
});

const progressPercent = computed(() => {
  if (!focus.value?.items?.length) return 0;
  return Math.round((completedCount.value / focus.value.items.length) * 100);
});

const COLUMN_LABELS = { northstar: "北极星", campaign: "战役", task: "任务" };
function columnLabel(col) {
  return COLUMN_LABELS[col] || col;
}

async function loadFocus() {
  loading.value = true;
  try {
    const res = await getTodayFocus();
    focus.value = res.dailyFocus;
  } catch (e) {
    uni.showToast({ title: e.message || "加载失败", icon: "none" });
  } finally {
    loading.value = false;
  }
}

async function toggle(item) {
  try {
    await toggleFocusItem(item.id, !item.completed);
    item.completed = !item.completed;
    if (completedCount.value === focus.value.items.length) {
      uni.showToast({ title: "全部完成！🎉", icon: "none" });
    }
  } catch (e) {
    uni.showToast({ title: e.message || "操作失败", icon: "none" });
  }
}

onMounted(loadFocus);
onShow(loadFocus);
</script>

<style scoped>
.page {
  min-height: 100vh;
  padding: 32rpx;
  box-sizing: border-box;
}
.header {
  margin-bottom: 40rpx;
}
.header-title {
  display: block;
  font-size: 48rpx;
  font-weight: 700;
  color: #1d1d1f;
}
.header-date {
  display: block;
  font-size: 26rpx;
  color: #86868b;
  margin-top: 8rpx;
}

.loading,
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 120rpx 0;
}
.empty-icon {
  font-size: 80rpx;
  margin-bottom: 24rpx;
}
.empty-text {
  font-size: 32rpx;
  color: #86868b;
  margin-bottom: 12rpx;
}
.empty-hint {
  font-size: 24rpx;
  color: #aeaeb2;
  text-align: center;
  padding: 0 60rpx;
}

.cards {
  margin-bottom: 40rpx;
}
.focus-card {
  display: flex;
  align-items: center;
  background-color: #ffffff;
  border-radius: 20rpx;
  padding: 32rpx;
  margin-bottom: 20rpx;
  border-left: 8rpx solid #f59e0b;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
}
.focus-card.completed {
  opacity: 0.55;
  border-left-color: #10b981;
}
.card-check {
  width: 48rpx;
  height: 48rpx;
  border-radius: 50%;
  border: 3rpx solid #d1d1d6;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 24rpx;
  flex-shrink: 0;
  transition: all 0.2s;
}
.card-check.checked {
  background-color: #10b981;
  border-color: #10b981;
}
.check-icon {
  color: #ffffff;
  font-size: 28rpx;
  font-weight: 700;
}
.card-body {
  flex: 1;
  display: flex;
  align-items: flex-start;
}
.card-index {
  color: #f59e0b;
  font-size: 28rpx;
  font-weight: 700;
  margin-right: 16rpx;
  flex-shrink: 0;
}
.card-content {
  color: #1d1d1f;
  font-size: 30rpx;
  line-height: 1.5;
}
.card-tag {
  font-size: 22rpx;
  padding: 6rpx 16rpx;
  border-radius: 8rpx;
  margin-left: 16rpx;
  flex-shrink: 0;
}
.tag-northstar {
  background-color: rgba(245, 158, 11, 0.12);
  color: #f59e0b;
}
.tag-campaign {
  background-color: rgba(59, 130, 246, 0.12);
  color: #3b82f6;
}
.tag-task {
  background-color: rgba(16, 185, 129, 0.12);
  color: #10b981;
}

.progress-bar {
  display: flex;
  align-items: center;
  padding: 0 8rpx;
}
.progress-track {
  flex: 1;
  height: 16rpx;
  background-color: #e5e5ea;
  border-radius: 8rpx;
  overflow: hidden;
  margin-right: 20rpx;
}
.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #10b981, #34d399);
  border-radius: 8rpx;
  transition: width 0.3s;
}
.progress-text {
  font-size: 24rpx;
  color: #86868b;
}
</style>

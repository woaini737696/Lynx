<template>
  <view class="page">
    <view class="header">
      <view class="header-left">
        <text class="header-greeting">{{ greeting }}</text>
        <text class="header-title">今日聚焦</text>
      </view>
      <view class="header-date">
        <text class="date-day">{{ todayDay }}</text>
        <text class="date-month">{{ todayMonth }}</text>
      </view>
    </view>

    <view v-if="loading && !focus" class="loading">
      <view class="loading-dot"></view>
      <text class="loading-text">加载中...</text>
    </view>

    <view v-else-if="!focus || !focus.items || focus.items.length === 0" class="empty">
      <view class="empty-circle">
        <text class="empty-icon">🎯</text>
      </view>
      <text class="empty-text">今天还没有聚焦任务</text>
      <text class="empty-hint">去决策看板添加任务，系统会自动生成今日聚焦</text>
      <view class="empty-btn" @click="goBoard">
        <text class="empty-btn-text">去添加任务</text>
      </view>
    </view>

    <view v-else class="cards">
      <view class="progress-section">
        <view class="progress-info">
          <text class="progress-label">今日进度</text>
          <text class="progress-num">{{ completedCount }}/{{ focus.items.length }}</text>
        </view>
        <view class="progress-track">
          <view class="progress-fill" :style="{ width: progressPercent + '%' }"></view>
        </view>
        <text class="progress-percent">{{ progressPercent }}%</text>
      </view>

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
          <view class="card-header">
            <text class="card-index">#{{ idx + 1 }}</text>
            <view class="card-tag" :class="`tag-${item.task.column}`">
              {{ columnLabel(item.task.column) }}
            </view>
          </view>
          <text class="card-content">{{ item.task.content }}</text>
        </view>
      </view>
    </view>

    <capture-bar @saved="loadFocus" />

    <!-- 底部导航 -->
    <TabBar :current="0" />
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { getTodayFocus, toggleFocusItem } from "@/api/focus.js";
import CaptureBar from "@/components/CaptureBar.vue";
import TabBar from "@/components/TabBar.vue";

const loading = ref(false);
const focus = ref(null);

const greeting = computed(() => {
  const h = new Date().getHours();
  if (h < 6) return "夜深了";
  if (h < 12) return "早上好";
  if (h < 18) return "下午好";
  return "晚上好";
});

const todayDay = computed(() => new Date().getDate());
const todayMonth = computed(() => {
  const m = new Date().getMonth() + 1;
  return `${m}月`;
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

function goBoard() {
  uni.switchTab({ url: "/pages/board/board" });
}

onMounted(loadFocus);
onShow(loadFocus);
</script>

<style scoped>
.page {
  min-height: 100vh;
  padding: 32rpx;
  padding-bottom: calc(32rpx + env(safe-area-inset-bottom) + 120rpx);
  box-sizing: border-box;
}

/* 头部 */
.header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 40rpx;
}
.header-greeting {
  display: block;
  font-size: 26rpx;
  color: #86868b;
  margin-bottom: 4rpx;
}
.header-title {
  display: block;
  font-size: 52rpx;
  font-weight: 800;
  color: #1d1d1f;
  letter-spacing: 1rpx;
}
.header-date {
  display: flex;
  flex-direction: column;
  align-items: center;
  background-color: #ffffff;
  border-radius: 16rpx;
  padding: 12rpx 24rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);
}
.date-day {
  font-size: 40rpx;
  font-weight: 700;
  color: #f59e0b;
  line-height: 1;
}
.date-month {
  font-size: 20rpx;
  color: #86868b;
  margin-top: 4rpx;
}

/* 加载 */
.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 120rpx 0;
}
.loading-dot {
  width: 24rpx;
  height: 24rpx;
  border-radius: 50%;
  background-color: #f59e0b;
  animation: pulse 1.2s infinite;
  margin-bottom: 16rpx;
}
@keyframes pulse {
  0%, 100% { transform: scale(0.8); opacity: 0.5; }
  50% { transform: scale(1.2); opacity: 1; }
}
.loading-text {
  color: #86868b;
  font-size: 26rpx;
}

/* 空状态 */
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 100rpx 0;
}
.empty-circle {
  width: 160rpx;
  height: 160rpx;
  border-radius: 50%;
  background-color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 32rpx;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.06);
}
.empty-icon {
  font-size: 72rpx;
}
.empty-text {
  font-size: 32rpx;
  color: #1d1d1f;
  font-weight: 600;
  margin-bottom: 12rpx;
}
.empty-hint {
  font-size: 24rpx;
  color: #aeaeb2;
  text-align: center;
  padding: 0 60rpx;
  margin-bottom: 32rpx;
}
.empty-btn {
  background: linear-gradient(135deg, #f59e0b, #f97316);
  border-radius: 32rpx;
  padding: 16rpx 48rpx;
  box-shadow: 0 4rpx 16rpx rgba(245, 158, 11, 0.3);
}
.empty-btn-text {
  color: #ffffff;
  font-size: 28rpx;
  font-weight: 600;
}

/* 进度条 */
.progress-section {
  display: flex;
  align-items: center;
  background-color: #ffffff;
  border-radius: 20rpx;
  padding: 24rpx 28rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
}
.progress-info {
  flex-shrink: 0;
  margin-right: 24rpx;
}
.progress-label {
  display: block;
  font-size: 22rpx;
  color: #86868b;
}
.progress-num {
  display: block;
  font-size: 32rpx;
  font-weight: 700;
  color: #1d1d1f;
}
.progress-track {
  flex: 1;
  height: 12rpx;
  background-color: #f2f2f7;
  border-radius: 6rpx;
  overflow: hidden;
  margin-right: 16rpx;
}
.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #10b981, #34d399);
  border-radius: 6rpx;
  transition: width 0.4s ease;
}
.progress-percent {
  font-size: 26rpx;
  font-weight: 700;
  color: #10b981;
  width: 80rpx;
  text-align: right;
}

/* 聚焦卡片 */
.cards {
  margin-bottom: 40rpx;
}
.focus-card {
  display: flex;
  align-items: flex-start;
  background-color: #ffffff;
  border-radius: 20rpx;
  padding: 28rpx;
  margin-bottom: 16rpx;
  border-left: 6rpx solid #f59e0b;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
  transition: transform 0.15s;
}
.focus-card:active {
  transform: scale(0.98);
}
.focus-card.completed {
  opacity: 0.55;
  border-left-color: #10b981;
}
.card-check {
  width: 44rpx;
  height: 44rpx;
  border-radius: 50%;
  border: 3rpx solid #d1d1d6;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 20rpx;
  flex-shrink: 0;
  margin-top: 4rpx;
  transition: all 0.2s;
}
.card-check.checked {
  background-color: #10b981;
  border-color: #10b981;
}
.check-icon {
  color: #ffffff;
  font-size: 24rpx;
  font-weight: 700;
}
.card-body {
  flex: 1;
}
.card-header {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 8rpx;
}
.card-index {
  color: #aeaeb2;
  font-size: 22rpx;
  font-weight: 600;
}
.card-tag {
  font-size: 20rpx;
  padding: 4rpx 12rpx;
  border-radius: 6rpx;
  font-weight: 600;
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
.card-content {
  color: #1d1d1f;
  font-size: 30rpx;
  line-height: 1.5;
}
</style>

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
        <Icon name="target" :size="80" color="#f59e0b" />
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
          <Icon v-if="item.completed" name="check" :size="28" color="#ffffff" />
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
import Icon from "@/components/Icon.vue";

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
      uni.showToast({ title: "全部完成！", icon: "success" });
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
  padding-bottom: calc(32rpx + env(safe-area-inset-bottom) + 140rpx);
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
  color: var(--text-secondary);
  margin-bottom: 8rpx;
}
.header-title {
  display: block;
  font-size: 52rpx;
  font-weight: 800;
  color: var(--text-primary);
  letter-spacing: 0.5rpx;
}
.header-date {
  display: flex;
  flex-direction: column;
  align-items: center;
  background-color: var(--bg-card);
  border-radius: var(--radius-md);
  padding: 14rpx 26rpx;
  box-shadow: var(--shadow-card);
}
.date-day {
  font-size: 40rpx;
  font-weight: 800;
  color: var(--accent);
  line-height: 1;
}
.date-month {
  font-size: 20rpx;
  color: var(--text-secondary);
  margin-top: 6rpx;
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
  background-color: var(--accent);
  animation: pulse 1.2s infinite;
  margin-bottom: 16rpx;
}
@keyframes pulse {
  0%, 100% { transform: scale(0.8); opacity: 0.5; }
  50% { transform: scale(1.2); opacity: 1; }
}
.loading-text {
  color: var(--text-secondary);
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
  width: 180rpx;
  height: 180rpx;
  border-radius: 50%;
  background-color: var(--accent-soft);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 36rpx;
}
.empty-text {
  font-size: 34rpx;
  color: var(--text-primary);
  font-weight: 700;
  margin-bottom: 12rpx;
}
.empty-hint {
  font-size: 26rpx;
  color: var(--text-tertiary);
  text-align: center;
  padding: 0 60rpx;
  margin-bottom: 36rpx;
  line-height: 1.5;
}
.empty-btn {
  background: var(--accent-gradient);
  border-radius: var(--radius-pill);
  padding: 22rpx 56rpx;
  box-shadow: var(--shadow-fab);
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
  background-color: var(--bg-card);
  border-radius: var(--radius-lg);
  padding: 28rpx 32rpx;
  margin-bottom: 28rpx;
  box-shadow: var(--shadow-card);
}
.progress-info {
  flex-shrink: 0;
  margin-right: 28rpx;
}
.progress-label {
  display: block;
  font-size: 22rpx;
  color: var(--text-secondary);
}
.progress-num {
  display: block;
  font-size: 34rpx;
  font-weight: 800;
  color: var(--text-primary);
}
.progress-track {
  flex: 1;
  height: 12rpx;
  background-color: var(--bg-input);
  border-radius: var(--radius-pill);
  overflow: hidden;
  margin-right: 16rpx;
}
.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #22c55e, #34d399);
  border-radius: var(--radius-pill);
  transition: width 0.4s ease;
}
.progress-percent {
  font-size: 26rpx;
  font-weight: 800;
  color: var(--green);
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
  background-color: var(--bg-card);
  border-radius: var(--radius-lg);
  padding: 30rpx;
  margin-bottom: 20rpx;
  box-shadow: var(--shadow-card);
  transition: transform 0.15s, box-shadow 0.15s;
  position: relative;
  overflow: hidden;
}
.focus-card::before {
  content: "";
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 6rpx;
  background-color: var(--accent);
}
.focus-card:active {
  transform: scale(0.985);
  box-shadow: var(--shadow-elevated);
}
.focus-card.completed {
  opacity: 0.55;
}
.focus-card.completed::before {
  background-color: var(--green);
}
.card-check {
  width: 48rpx;
  height: 48rpx;
  border-radius: 50%;
  border: 3rpx solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 24rpx;
  flex-shrink: 0;
  margin-top: 2rpx;
  transition: all 0.2s;
  background-color: var(--bg-card);
}
.card-check.checked {
  background-color: var(--green);
  border-color: var(--green);
}
.card-body {
  flex: 1;
}
.card-header {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 10rpx;
}
.card-index {
  color: var(--text-tertiary);
  font-size: 22rpx;
  font-weight: 600;
}
.card-tag {
  font-size: 20rpx;
  padding: 6rpx 14rpx;
  border-radius: var(--radius-pill);
  font-weight: 600;
}
.tag-northstar {
  background-color: #fff7ed;
  color: #f59e0b;
}
.tag-campaign {
  background-color: #eff6ff;
  color: #3b82f6;
}
.tag-task {
  background-color: #f0fdf4;
  color: #22c55e;
}
.card-content {
  color: var(--text-primary);
  font-size: 30rpx;
  line-height: 1.55;
  font-weight: 500;
}
</style>

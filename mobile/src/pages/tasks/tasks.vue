<template>
  <view class="page">
    <view class="header">
      <text class="header-title">飞书任务</text>
      <text class="sync-btn" @click="sync">{{ syncing ? "同步中..." : "↻ 同步" }}</text>
    </view>

    <view v-if="loading && tasks.length === 0" class="loading">
      <text class="text-secondary">加载中...</text>
    </view>

    <view v-else-if="tasks.length === 0" class="empty">
      <text class="empty-icon">📋</text>
      <text class="empty-text">暂无飞书任务</text>
    </view>

    <scroll-view v-else scroll-y class="task-list">
      <view
        v-for="task in tasks"
        :key="task.guid"
        class="task-item"
        :class="{ done: task.completed }"
      >
        <view class="task-check" :class="{ checked: task.completed }" @click="toggleTask(task)">
          <text v-if="task.completed" class="check-icon">✓</text>
        </view>
        <view class="task-info">
          <text class="task-summary">{{ task.summary }}</text>
          <view class="task-meta">
            <text v-if="task.dueAt" class="meta-due">📅 {{ formatDate(task.dueAt) }}</text>
            <text v-if="task.parentTaskGuid" class="meta-sub">子任务</text>
          </view>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { getLarkTasks, refreshLarkTasks, toggleLarkTask } from "@/api/lark-tasks.js";

const tasks = ref([]);
const loading = ref(false);
const syncing = ref(false);

async function loadTasks() {
  loading.value = true;
  try {
    const res = await getLarkTasks();
    tasks.value = res.tasks || res.data || [];
  } catch (e) {
    uni.showToast({ title: e.message || "加载失败", icon: "none" });
  } finally {
    loading.value = false;
  }
}

async function sync() {
  if (syncing.value) return;
  syncing.value = true;
  try {
    await refreshLarkTasks();
    uni.showToast({ title: "同步完成", icon: "success" });
    await loadTasks();
  } catch (e) {
    uni.showToast({ title: e.message || "同步失败", icon: "none" });
  } finally {
    syncing.value = false;
  }
}

async function toggleTask(task) {
  const newCompleted = !task.completed;
  // 乐观更新
  task.completed = newCompleted;
  try {
    await toggleLarkTask(task.guid, newCompleted);
    uni.showToast({
      title: newCompleted ? "已完成" : "已重开",
      icon: "success",
      duration: 1000,
    });
  } catch (e) {
    // 失败回滚
    task.completed = !newCompleted;
    uni.showToast({ title: e.message || "操作失败", icon: "none" });
  }
}

function formatDate(d) {
  if (!d) return "";
  const date = new Date(d);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

onMounted(loadTasks);
onShow(loadTasks);
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
.sync-btn {
  color: #f6ad55;
  font-size: 28rpx;
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
  color: #525252;
  font-size: 28rpx;
}

.task-list {
  height: calc(100vh - 200rpx);
}
.task-item {
  display: flex;
  align-items: flex-start;
  background-color: #171717;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
}
.task-item.done {
  opacity: 0.5;
}
.task-check {
  width: 44rpx;
  height: 44rpx;
  border-radius: 8rpx;
  border: 3rpx solid #525252;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 20rpx;
  flex-shrink: 0;
  margin-top: 4rpx;
}
.task-check.checked {
  background-color: #68d391;
  border-color: #68d391;
}
.check-icon {
  color: #0a0a0a;
  font-size: 24rpx;
  font-weight: 700;
}
.task-info {
  flex: 1;
}
.task-summary {
  color: #f5f5f5;
  font-size: 28rpx;
  line-height: 1.5;
}
.task-meta {
  display: flex;
  gap: 16rpx;
  margin-top: 12rpx;
}
.meta-due,
.meta-sub {
  font-size: 22rpx;
  color: #737373;
}
.meta-sub {
  color: #63b3ed;
}
</style>

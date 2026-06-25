<template>
  <view class="page">
    <view class="header">
      <view class="header-left">
        <text class="header-title">飞书任务</text>
        <view class="sync-status" @click="manualSync">
          <text v-if="syncing" class="sync-text syncing">同步中...</text>
          <template v-else>
            <text class="sync-dot" :class="syncDotClass"></text>
            <text class="sync-text">{{ syncLabel }}</text>
          </template>
          <view class="sync-refresh-icon">
            <Icon name="refresh" :size="24" :color="isDark ? '#f5f5f7' : '#1d1d1f'" />
          </view>
        </view>
      </view>
      <text class="header-count">{{ tasks.length }} 项</text>
    </view>

    <!-- 分类标签 -->
    <view class="tabs">
      <view
        v-for="tab in tabs"
        :key="tab.key"
        class="tab"
        :class="{ active: currentTab === tab.key }"
        @click="switchTab(tab.key)"
      >
        <text class="tab-label">{{ tab.label }}</text>
        <text class="tab-count">{{ tab.count }}</text>
      </view>
    </view>

    <view v-if="cacheInfo" class="offline-banner">
      <Icon name="wifiOff" :size="28" color="#f59e0b" />
      <text class="offline-text">离线浏览 · 缓存于 {{ formatCacheTime(cacheInfo.cachedAt) }}</text>
    </view>

    <view v-if="loading && filteredTasks.length === 0" class="loading">
      <text class="text-secondary">加载中...</text>
    </view>

    <view v-else-if="filteredTasks.length === 0" class="empty">
      <Icon name="list" :size="80" :color="isDark ? '#48484a' : '#d1d1d6'" />
      <text class="empty-text">暂无任务</text>
      <text v-if="!isOnline" class="empty-hint">网络未连接，显示缓存数据</text>
    </view>

    <scroll-view v-else scroll-y class="task-list">
      <view
        v-for="task in filteredTasks"
        :key="task.guid"
        class="task-item"
        :class="{ done: task.completed }"
        @click="showDetail(task)"
      >
        <view class="task-check" :class="{ checked: task.completed }" @click.stop="toggleTask(task)">
          <Icon v-if="task.completed" name="check" :size="24" color="#ffffff" />
        </view>
        <view class="task-info">
          <text class="task-summary">{{ task.summary }}</text>
          <view class="task-meta">
            <view v-if="task.dueAt" class="meta-due-row">
              <Icon name="clock" :size="22" :color="isDark ? '#98989d' : '#86868b'" />
              <text class="meta-due">{{ formatDate(task.dueAt) }}</text>
            </view>
            <text v-if="task.parentTaskGuid" class="meta-sub">子任务</text>
            <text v-if="task.tasklistName" class="meta-list">{{ task.tasklistName }}</text>
          </view>
        </view>
        <view class="task-arrow">
          <Icon name="chevronRight" :size="28" :color="isDark ? '#48484a' : '#d1d1d6'" />
        </view>
      </view>
    </scroll-view>

    <!-- 任务详情弹窗 -->
    <view v-if="detailVisible" class="detail-mask" @click="closeDetail">
      <view class="detail-popup" @click.stop>
        <view class="detail-header">
          <text class="detail-title">任务详情</text>
          <view class="detail-close" @click="closeDetail">
            <Icon name="close" :size="32" :color="isDark ? '#f5f5f7' : '#1d1d1f'" />
          </view>
        </view>

        <scroll-view scroll-y class="detail-body">
          <view v-if="detailTask" class="detail-content">
            <text class="detail-summary">{{ detailTask.summary }}</text>

            <view v-if="detailTask.description" class="detail-section">
              <text class="section-label">描述</text>
              <text class="section-text">{{ detailTask.description }}</text>
            </view>

            <view class="detail-grid">
              <view class="detail-field">
                <text class="field-label">状态</text>
                <text class="field-value" :class="detailTask.completed ? 'status-done' : 'status-active'">
                  {{ detailTask.completed ? "已完成" : "进行中" }}
                </text>
              </view>
              <view v-if="detailTask.dueAt" class="detail-field">
                <text class="field-label">截止时间</text>
                <text class="field-value">{{ formatDateTime(detailTask.dueAt) }}</text>
              </view>
              <view v-if="detailTask.startAt" class="detail-field">
                <text class="field-label">开始时间</text>
                <text class="field-value">{{ formatDateTime(detailTask.startAt) }}</text>
              </view>
              <view v-if="detailTask.tasklistName" class="detail-field">
                <text class="field-label">任务清单</text>
                <text class="field-value">{{ detailTask.tasklistName }}</text>
              </view>
              <view v-if="detailTask.assignees && detailTask.assignees.length" class="detail-field">
                <text class="field-label">负责人</text>
                <text class="field-value">{{ detailTask.assignees.join(", ") }}</text>
              </view>
            </view>
          </view>
        </scroll-view>

        <view class="detail-actions">
          <view
            v-if="detailTask"
            class="detail-btn"
            :class="detailTask.completed ? 'btn-restore' : 'btn-complete'"
            @click="toggleTask(detailTask)"
          >
            <view class="detail-btn-inner">
              <Icon :name="detailTask.completed ? 'refresh' : 'check'" :size="28" color="#ffffff" />
              <text class="detail-btn-text">
                {{ detailTask.completed ? "重新打开" : "标记完成" }}
              </text>
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- 底部导航 -->
    <TabBar :current="3" />
  </view>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import { onShow, onPullDownRefresh } from "@dcloudio/uni-app";
import { getLarkTasks, toggleLarkTask, getLarkTask, getSyncState, triggerSync } from "@/api/lark-tasks.js";
import { setCache, getCache, formatCacheTime } from "@/utils/cache.js";
import { useSettingsStore } from "@/store/settings.js";
import TabBar from "@/components/TabBar.vue";
import Icon from "@/components/Icon.vue";

const settingsStore = useSettingsStore();
const isDark = computed(() => settingsStore.theme === "dark");

const tasks = ref([]);
const loading = ref(false);
const currentTab = ref("active");

const detailVisible = ref(false);
const detailTask = ref(null);

// 同步状态
const syncState = ref({ lastSyncAt: null, lastError: null, taskCount: 0 });
const syncing = ref(false);
const isOnline = ref(true);
const cacheInfo = ref(null); // { cachedAt } 离线缓存信息
let syncTimer = null;

const tabs = computed(() => [
  { key: "active", label: "进行中", count: tasks.value.filter((t) => !t.completed).length },
  { key: "done", label: "已完成", count: tasks.value.filter((t) => t.completed).length },
  { key: "all", label: "全部", count: tasks.value.length },
]);

const filteredTasks = computed(() => {
  if (currentTab.value === "active") return tasks.value.filter((t) => !t.completed);
  if (currentTab.value === "done") return tasks.value.filter((t) => t.completed);
  return tasks.value;
});

const syncDotClass = computed(() => {
  if (syncState.value.lastError) return "dot-error";
  if (!syncState.value.lastSyncAt) return "dot-never";
  return "dot-ok";
});

const syncLabel = computed(() => {
  if (!syncState.value.lastSyncAt) {
    return syncState.value.lastError ? "同步失败" : "未同步";
  }
  return `最后同步 ${formatRelative(syncState.value.lastSyncAt)}`;
});

function switchTab(key) {
  currentTab.value = key;
}

async function loadTasks() {
  loading.value = true;
  try {
    // 拉取全部任务（complete 不传 = 全部）
    const res = await getLarkTasks("my", null);
    tasks.value = res.tasks || [];
    // 写入离线缓存
    setCache("lark_tasks", res.tasks || []);
    cacheInfo.value = null;
  } catch (e) {
    // 网络失败时尝试读取离线缓存
    const cache = getCache("lark_tasks");
    if (cache && cache.data) {
      tasks.value = cache.data;
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

async function loadSyncState() {
  try {
    const res = await getSyncState();
    if (res.state) syncState.value = res.state;
  } catch (e) {
    // 静默失败
  }
}

/** 自动后台同步：页面加载时静默触发，不显示 loading */
async function autoSync() {
  try {
    const res = await triggerSync();
    if (res.state) syncState.value = res.state;
    if (res.success) {
      // 同步成功后静默刷新任务列表
      await loadTasks();
    }
  } catch (e) {
    // 静默失败，不影响用户体验
  }
}

async function manualSync() {
  if (syncing.value) return;
  syncing.value = true;
  try {
    const res = await triggerSync();
    if (res.state) syncState.value = res.state;
    uni.showToast({
      title: res.success ? "同步完成" : "同步失败",
      icon: res.success ? "success" : "none",
      duration: 1000,
    });
    if (res.success) await loadTasks();
  } catch (e) {
    uni.showToast({ title: e.message || "同步失败", icon: "none" });
  } finally {
    syncing.value = false;
  }
}

async function toggleTask(task) {
  const newCompleted = !task.completed;
  task.completed = newCompleted;
  // 同步详情弹窗中的任务
  if (detailTask.value && detailTask.value.guid === task.guid) {
    detailTask.value.completed = newCompleted;
  }
  try {
    await toggleLarkTask(task.guid, newCompleted);
    uni.showToast({
      title: newCompleted ? "已完成" : "已重开",
      icon: "success",
      duration: 1000,
    });
  } catch (e) {
    task.completed = !newCompleted;
    if (detailTask.value && detailTask.value.guid === task.guid) {
      detailTask.value.completed = !newCompleted;
    }
    uni.showToast({ title: e.message || "操作失败", icon: "none" });
  }
}

async function showDetail(task) {
  detailTask.value = task;
  detailVisible.value = true;
  // 后台拉取最新详情
  try {
    const res = await getLarkTask(task.guid);
    if (res.task) {
      // 合并最新详情到列表和当前详情
      Object.assign(task, res.task);
      detailTask.value = { ...task, ...res.task };
    }
  } catch (e) {
    // 静默失败，使用列表数据
  }
}

function closeDetail() {
  detailVisible.value = false;
  detailTask.value = null;
}

function formatDate(d) {
  if (!d) return "";
  const date = new Date(d);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function formatDateTime(d) {
  if (!d) return "";
  const date = new Date(d);
  return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

/** 相对时间格式化：刚刚 / X分钟前 / X小时前 / X天前 */
function formatRelative(d) {
  if (!d) return "";
  const date = new Date(d);
  const diff = Date.now() - date.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "刚刚";
  if (min < 60) return `${min}分钟前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}小时前`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}天前`;
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

// 下拉刷新
onPullDownRefresh(async () => {
  try {
    await Promise.all([loadTasks(), loadSyncState()]);
  } finally {
    uni.stopPullDownRefresh();
  }
});

// 网络状态监听：恢复后自动刷新
function onNetworkStatusChange(res) {
  isOnline.value = res.isConnected;
  if (res.isConnected) {
    // 网络恢复，自动刷新数据
    loadTasks();
    loadSyncState();
  }
}

onMounted(() => {
  loadTasks();
  loadSyncState();
  // 自动后台同步：页面加载时静默触发一次
  autoSync();
  // 每 60 秒刷新一次同步状态 + 自动同步
  syncTimer = setInterval(() => {
    loadSyncState();
    autoSync();
  }, 60 * 1000);
  // 监听网络状态
  uni.onNetworkStatusChange(onNetworkStatusChange);
  // 初始网络状态
  uni.getNetworkType({
    success: (res) => {
      isOnline.value = res.networkType !== "none";
    },
  });
});

onUnmounted(() => {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
  }
});

onShow(() => {
  loadTasks();
  loadSyncState();
  // 页面重新显示时静默自动同步
  autoSync();
});
</script>

<style scoped>
.page {
  min-height: 100vh;
  padding: 32rpx;
  padding-bottom: calc(32rpx + env(safe-area-inset-bottom) + 120rpx);
  box-sizing: border-box;
}
.header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24rpx;
}
.header-left {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}
.header-title {
  font-size: 48rpx;
  font-weight: 700;
  color: #1d1d1f;
}
.header-count {
  font-size: 26rpx;
  color: #86868b;
  margin-top: 8rpx;
}

.sync-status {
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding: 6rpx 16rpx;
  background-color: rgba(245, 158, 11, 0.08);
  border-radius: 20rpx;
  align-self: flex-start;
}
.sync-dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
}
.dot-ok {
  background-color: #10b981;
}
.dot-error {
  background-color: #ef4444;
}
.dot-never {
  background-color: #aeaeb2;
}
.sync-text {
  font-size: 22rpx;
  color: #86868b;
}
.sync-text.syncing {
  color: #f59e0b;
}
.sync-refresh {
  font-size: 24rpx;
  color: #f59e0b;
  margin-left: 4rpx;
}

.tabs {
  display: flex;
  gap: 16rpx;
  margin-bottom: 24rpx;
}
.tab {
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding: 12rpx 24rpx;
  border-radius: 32rpx;
  background-color: #ffffff;
  border: 2rpx solid #e5e5ea;
}
.tab.active {
  background: linear-gradient(135deg, #f59e0b, #f97316);
  border-color: transparent;
}
.tab-label {
  font-size: 26rpx;
  color: #1d1d1f;
  font-weight: 600;
}
.tab.active .tab-label {
  color: #ffffff;
}
.tab-count {
  font-size: 22rpx;
  color: #86868b;
  background-color: #f2f2f7;
  padding: 2rpx 12rpx;
  border-radius: 16rpx;
}
.tab.active .tab-count {
  color: #ffffff;
  background-color: rgba(255, 255, 255, 0.25);
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
  font-size: 28rpx;
}
.empty-hint {
  color: #aeaeb2;
  font-size: 22rpx;
  margin-top: 8rpx;
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

.task-list {
  height: calc(100vh - 360rpx);
}
.task-item {
  display: flex;
  align-items: center;
  background-color: #ffffff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);
}
.task-item.done {
  opacity: 0.5;
}
.task-check {
  width: 44rpx;
  height: 44rpx;
  border-radius: 10rpx;
  border: 3rpx solid #d1d1d6;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 20rpx;
  flex-shrink: 0;
  transition: all 0.2s;
}
.task-check.checked {
  background-color: #10b981;
  border-color: #10b981;
}
.check-icon {
  color: #ffffff;
  font-size: 24rpx;
  font-weight: 700;
}
.task-info {
  flex: 1;
}
.task-summary {
  color: #1d1d1f;
  font-size: 28rpx;
  line-height: 1.5;
}
.task-meta {
  display: flex;
  gap: 16rpx;
  margin-top: 8rpx;
  flex-wrap: wrap;
}
.meta-due,
.meta-sub,
.meta-list {
  font-size: 22rpx;
  color: #86868b;
}
.meta-sub {
  color: #3b82f6;
}
.task-arrow {
  color: #c7c7cc;
  font-size: 36rpx;
  margin-left: 12rpx;
}

/* 详情弹窗 */
.detail-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.4);
  z-index: 200;
  display: flex;
  align-items: flex-end;
}
.detail-popup {
  width: 100%;
  max-height: 80vh;
  background-color: #ffffff;
  border-radius: 32rpx 32rpx 0 0;
  display: flex;
  flex-direction: column;
}
.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 32rpx;
  border-bottom: 1rpx solid #e5e5ea;
}
.detail-title {
  font-size: 32rpx;
  font-weight: 600;
  color: #1d1d1f;
}
.detail-close {
  padding: 8rpx 16rpx;
}
.close-icon {
  font-size: 48rpx;
  color: #86868b;
}
.detail-body {
  padding: 32rpx;
  max-height: 60vh;
}
.detail-content {
  display: flex;
  flex-direction: column;
}
.detail-summary {
  font-size: 34rpx;
  font-weight: 600;
  color: #1d1d1f;
  line-height: 1.5;
  margin-bottom: 24rpx;
}
.detail-section {
  margin-bottom: 24rpx;
}
.section-label {
  display: block;
  font-size: 24rpx;
  color: #86868b;
  margin-bottom: 8rpx;
}
.section-text {
  color: #1d1d1f;
  font-size: 28rpx;
  line-height: 1.6;
}
.detail-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 24rpx;
}
.detail-field {
  width: 45%;
}
.field-label {
  display: block;
  font-size: 22rpx;
  color: #86868b;
  margin-bottom: 4rpx;
}
.field-value {
  font-size: 26rpx;
  color: #1d1d1f;
}
.status-done {
  color: #10b981;
}
.status-active {
  color: #f59e0b;
}
.detail-actions {
  padding: 24rpx 32rpx;
  padding-bottom: calc(24rpx + env(safe-area-inset-bottom));
  border-top: 1rpx solid #e5e5ea;
}
.detail-btn {
  height: 88rpx;
  border-radius: 16rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}
.btn-complete {
  background-color: rgba(16, 185, 129, 0.12);
}
.btn-restore {
  background-color: rgba(245, 158, 11, 0.12);
}
.detail-btn-text {
  font-size: 30rpx;
  font-weight: 600;
}
.btn-complete .detail-btn-text {
  color: #10b981;
}
.btn-restore .detail-btn-text {
  color: #f59e0b;
}
</style>

<template>
  <view class="page">
    <view class="header">
      <view class="header-row">
        <view>
          <text class="header-title">决策看板</text>
          <text class="header-hint">做减法 · 强制优先级</text>
        </view>
        <view class="sort-toggle" :class="{ active: sortMode }" @click="toggleSortMode">
          <text class="sort-toggle-icon">{{ sortMode ? "✓" : "⇅" }}</text>
          <text class="sort-toggle-text">{{ sortMode ? "完成" : "排序" }}</text>
        </view>
      </view>
      <view v-if="cacheInfo" class="offline-banner">
        <text class="offline-icon">📡</text>
        <text class="offline-text">离线浏览 · 缓存于 {{ formatCacheTime(cacheInfo.cachedAt) }}</text>
      </view>
      <view v-if="sortMode" class="sort-hint">
        <text class="sort-hint-icon">💡</text>
        <text class="sort-hint-text">长按卡片拖拽排序，或点击 ↑↓ 微调位置</text>
      </view>
    </view>

    <!-- 列标签（明确当前所在列） -->
    <view class="col-tabs">
      <view
        v-for="(col, idx) in columns"
        :key="col.key"
        class="col-tab"
        :class="{ active: currentColIdx === idx }"
        @click="switchCol(idx)"
      >
        <view class="col-tab-dot" :class="`dot-${col.key}`"></view>
        <text class="col-tab-label">{{ col.label }}</text>
        <text class="col-tab-count">{{ tasksByColumn[col.key].length }}/{{ col.limit }}</text>
      </view>
    </view>

    <!-- 列内容（swiper 明确左右滑动切换） -->
    <swiper
      class="col-swiper"
      :current="currentColIdx"
      :duration="250"
      :circular="false"
      :show-scrollbar="false"
      @change="onSwiperChange"
    >
      <swiper-item v-for="col in columns" :key="col.key">
        <scroll-view scroll-y class="col-scroll">
          <!-- 列说明 -->
          <view class="col-intro">
            <text class="col-intro-title">{{ col.label }}</text>
            <text class="col-intro-desc">{{ col.desc }}</text>
            <view class="col-intro-bar">
              <view
                class="col-intro-fill"
                :class="`fill-${col.key}`"
                :style="{ width: colFillPercent(col.key) + '%' }"
              ></view>
            </view>
            <text class="col-intro-meta">{{ tasksByColumn[col.key].length }} / {{ col.limit }} · {{ colFillPercent(col.key) }}%</text>
          </view>

          <!-- 任务卡片列表 -->
          <view
            v-for="(task, idx) in tasksByColumn[col.key]"
            :key="task.id"
            class="task-card"
            :class="{
              done: task.status === 'done',
              dragging: drag.active && drag.taskId === task.id,
              'drag-over': drag.active && drag.targetId === task.id,
            }"
            @click="sortMode ? null : onTaskClick(task)"
            @touchstart="onCardTouchStart($event, task, idx, col.key)"
            @touchmove="onCardTouchMove($event)"
            @touchend="onCardTouchEnd"
            @touchcancel="onCardTouchEnd"
          >
            <view v-if="sortMode" class="drag-handle">
              <text class="handle-icon">⠿</text>
            </view>
            <view class="task-main">
              <text class="task-content">{{ task.content }}</text>
              <view class="task-meta">
                <text class="meta-idx">#{{ idx + 1 }}</text>
                <text v-if="task.status === 'done'" class="meta-done">✓ 已完成</text>
              </view>
            </view>
            <view class="task-actions">
              <template v-if="sortMode">
                <text class="task-btn sort-btn" @click.stop="moveTask(task, -1)">↑</text>
                <text class="task-btn sort-btn" @click.stop="moveTask(task, 1)">↓</text>
              </template>
              <text
                v-else
                class="task-btn"
                :class="task.status === 'done' ? 'btn-restore' : 'btn-done'"
                @click.stop="toggleStatus(task)"
              >
                {{ task.status === "done" ? "↩" : "✓" }}
              </text>
            </view>
          </view>

          <!-- 添加任务 -->
          <view
            v-if="tasksByColumn[col.key].length < col.limit"
            class="add-task"
            @click="addTask(col.key)"
          >
            <text class="add-icon">+</text>
            <text class="add-text">添加到「{{ col.label }}」</text>
          </view>
          <view v-else class="add-task disabled">
            <text class="add-text">{{ col.label }}已满 {{ col.limit }} 项，做减法才能加新任务</text>
          </view>

          <!-- 空状态 -->
          <view v-if="tasksByColumn[col.key].length === 0" class="col-empty">
            <text class="col-empty-icon">{{ col.icon }}</text>
            <text class="col-empty-text">{{ col.label }}还是空的</text>
            <text class="col-empty-hint">{{ col.emptyHint }}</text>
          </view>
        </scroll-view>
      </swiper-item>
    </swiper>

    <!-- 滑动切换提示 -->
    <view class="swipe-hint">
      <text class="swipe-hint-text">← 左右滑动切换列 →</text>
    </view>

    <!-- 底部导航 -->
    <TabBar :current="1" />
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { getTasks, createTask, updateTask, deleteTask } from "@/api/tasks.js";
import { setCache, getCache, formatCacheTime } from "@/utils/cache.js";
import TabBar from "@/components/TabBar.vue";

const columns = [
  {
    key: "northstar",
    label: "北极星",
    limit: 3,
    icon: "⭐",
    desc: "长期最重要的目标，最多 3 个",
    emptyHint: "添加你的北极星目标，专注长期价值",
  },
  {
    key: "campaign",
    label: "战役",
    limit: 5,
    icon: "🎯",
    desc: "阶段性重点，最多 5 个",
    emptyHint: "添加当前阶段的战役级任务",
  },
  {
    key: "task",
    label: "任务",
    limit: 10,
    icon: "📋",
    desc: "本周要推进的具体任务，最多 10 个",
    emptyHint: "添加本周要推进的具体任务",
  },
];

const tasks = ref([]);
const cacheInfo = ref(null);
const sortMode = ref(false);
const currentColIdx = ref(0);

// 拖拽状态
const drag = ref({
  active: false,
  taskId: null,
  targetId: null,
  column: null,
  startIndex: -1,
  startY: 0,
  moved: false,
});
let longPressTimer = null;
const LONG_PRESS_MS = 350;
const MOVE_THRESHOLD = 10;

const tasksByColumn = computed(() => {
  const map = { northstar: [], campaign: [], task: [] };
  for (const t of tasks.value) {
    if (map[t.column]) map[t.column].push(t);
  }
  for (const k of Object.keys(map)) {
    map[k].sort((a, b) => (a.position || 0) - (b.position || 0));
  }
  return map;
});

function colFillPercent(key) {
  const col = columns.find((c) => c.key === key);
  if (!col) return 0;
  return Math.min(100, Math.round((tasksByColumn.value[key].length / col.limit) * 100));
}

function switchCol(idx) {
  currentColIdx.value = idx;
}

function onSwiperChange(e) {
  currentColIdx.value = e.detail.current;
}

async function loadTasks() {
  try {
    const res = await getTasks();
    tasks.value = res.tasks || [];
    setCache("board_tasks", res.tasks || []);
    cacheInfo.value = null;
  } catch (e) {
    const cache = getCache("board_tasks");
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
  }
}

function toggleSortMode() {
  sortMode.value = !sortMode.value;
  if (!sortMode.value) {
    drag.value = { active: false, taskId: null, targetId: null, column: null, startIndex: -1, startY: 0, moved: false };
  }
}

function addTask(column) {
  uni.showModal({
    title: `添加到「${columns.find((c) => c.key === column).label}」`,
    editable: true,
    placeholderText: "输入任务内容",
    success: async (res) => {
      if (res.confirm && res.content && res.content.trim()) {
        try {
          await createTask({ content: res.content.trim(), column });
          uni.showToast({ title: "已添加", icon: "success" });
          loadTasks();
        } catch (e) {
          uni.showToast({ title: e.message || "添加失败", icon: "none" });
        }
      }
    },
  });
}

async function toggleStatus(task) {
  try {
    const newStatus = task.status === "done" ? "active" : "done";
    await updateTask(task.id, { status: newStatus });
    task.status = newStatus;
    uni.showToast({
      title: newStatus === "done" ? "已完成" : "已恢复",
      icon: "success",
      duration: 800,
    });
  } catch (e) {
    uni.showToast({ title: e.message || "操作失败", icon: "none" });
  }
}

function onTaskClick(task) {
  const actions =
    task.status === "done"
      ? ["恢复为进行中", "编辑内容", "删除"]
      : ["标记完成", "编辑内容", "删除"];
  uni.showActionSheet({
    itemList: actions,
    success: async (res) => {
      if (res.tapIndex === 0) {
        toggleStatus(task);
      } else if (res.tapIndex === 1) {
        editTask(task);
      } else if (res.tapIndex === 2) {
        confirmDelete(task);
      }
    },
  });
}

function editTask(task) {
  uni.showModal({
    title: "编辑任务",
    editable: true,
    placeholderText: "输入新内容",
    content: task.content,
    success: async (res) => {
      if (res.confirm && res.content && res.content.trim()) {
        try {
          await updateTask(task.id, { content: res.content.trim() });
          task.content = res.content.trim();
          uni.showToast({ title: "已更新", icon: "success" });
        } catch (e) {
          uni.showToast({ title: e.message || "更新失败", icon: "none" });
        }
      }
    },
  });
}

function confirmDelete(task) {
  uni.showModal({
    title: "确认删除",
    content: task.content.slice(0, 50),
    confirmColor: "#ef4444",
    success: async (res) => {
      if (res.confirm) {
        try {
          await deleteTask(task.id);
          tasks.value = tasks.value.filter((t) => t.id !== task.id);
          uni.showToast({ title: "已删除", icon: "success" });
        } catch (e) {
          uni.showToast({ title: e.message || "删除失败", icon: "none" });
        }
      }
    },
  });
}

// ===== 拖拽排序 =====
function onCardTouchStart(e, task, index, column) {
  if (!sortMode.value) return;
  const touch = e.touches[0];
  drag.value = {
    active: false,
    taskId: task.id,
    targetId: null,
    column,
    startIndex: index,
    startY: touch.clientY,
    moved: false,
  };
  longPressTimer = setTimeout(() => {
    if (drag.value.taskId === task.id) {
      drag.value.active = true;
      uni.vibrateShort && uni.vibrateShort({ type: "light" });
    }
  }, LONG_PRESS_MS);
}

function onCardTouchMove(e) {
  if (!drag.value.taskId) return;
  const touch = e.touches[0];
  const deltaY = touch.clientY - drag.value.startY;
  if (Math.abs(deltaY) > MOVE_THRESHOLD) {
    drag.value.moved = true;
  }
  if (drag.value.active) {
    e.preventDefault && e.preventDefault();
    const colTasks = tasksByColumn.value[drag.value.column];
    const CARD_H = 110;
    const deltaIndex = Math.round(deltaY / CARD_H);
    let targetIndex = drag.value.startIndex + deltaIndex;
    targetIndex = Math.max(0, Math.min(colTasks.length - 1, targetIndex));
    const targetTask = colTasks[targetIndex];
    drag.value.targetId = targetTask && targetTask.id !== drag.value.taskId ? targetTask.id : null;
  }
}

function onCardTouchEnd() {
  if (longPressTimer) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }
  if (drag.value.active && drag.value.targetId) {
    reorderInColumn(drag.value.column, drag.value.taskId, drag.value.targetId);
  }
  drag.value = {
    active: false,
    taskId: null,
    targetId: null,
    column: null,
    startIndex: -1,
    startY: 0,
    moved: false,
  };
}

async function reorderInColumn(column, taskId, targetId) {
  const colTasks = [...tasksByColumn.value[column]];
  const fromIndex = colTasks.findIndex((t) => t.id === taskId);
  const toIndex = colTasks.findIndex((t) => t.id === targetId);
  if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return;

  const [moved] = colTasks.splice(fromIndex, 1);
  colTasks.splice(toIndex, 0, moved);

  const reordered = colTasks.map((t, i) => ({ ...t, position: i }));

  const otherTasks = tasks.value.filter((t) => t.column !== column);
  tasks.value = [...otherTasks, ...reordered];

  uni.showToast({ title: "排序中...", icon: "loading", duration: 1500 });
  try {
    await Promise.all(
      reordered.map((t, i) =>
        updateTask(t.id, { position: i }).catch(() => {})
      )
    );
    uni.showToast({ title: "已排序", icon: "success", duration: 800 });
  } catch (e) {
    uni.showToast({ title: "排序保存失败", icon: "none" });
  }
}

async function moveTask(task, direction) {
  const colTasks = [...tasksByColumn.value[task.column]];
  const index = colTasks.findIndex((t) => t.id === task.id);
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= colTasks.length) return;
  const targetTask = colTasks[targetIndex];
  await reorderInColumn(task.column, task.id, targetTask.id);
}

onMounted(loadTasks);
onShow(loadTasks);
</script>

<style scoped>
.page {
  min-height: 100vh;
  padding: 32rpx 32rpx 0 32rpx;
  padding-bottom: calc(32rpx + env(safe-area-inset-bottom) + 160rpx);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}

/* 头部 */
.header {
  margin-bottom: 24rpx;
}
.header-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}
.header-title {
  display: block;
  font-size: 48rpx;
  font-weight: 700;
  color: #1d1d1f;
}
.header-hint {
  display: block;
  font-size: 24rpx;
  color: #86868b;
  margin-top: 8rpx;
}

.sort-toggle {
  display: flex;
  align-items: center;
  gap: 6rpx;
  padding: 12rpx 24rpx;
  border-radius: 32rpx;
  background-color: rgba(245, 158, 11, 0.12);
}
.sort-toggle.active {
  background: linear-gradient(135deg, #f59e0b, #f97316);
}
.sort-toggle-icon {
  font-size: 24rpx;
  color: #f59e0b;
}
.sort-toggle.active .sort-toggle-icon {
  color: #ffffff;
}
.sort-toggle-text {
  font-size: 26rpx;
  color: #f59e0b;
  font-weight: 600;
}
.sort-toggle.active .sort-toggle-text {
  color: #ffffff;
}

.sort-hint {
  display: flex;
  align-items: center;
  gap: 8rpx;
  margin-top: 12rpx;
  padding: 12rpx 20rpx;
  background-color: rgba(59, 130, 246, 0.08);
  border-radius: 12rpx;
}
.sort-hint-icon {
  font-size: 22rpx;
}
.sort-hint-text {
  font-size: 22rpx;
  color: #3b82f6;
}

.offline-banner {
  display: inline-flex;
  align-items: center;
  gap: 8rpx;
  padding: 8rpx 20rpx;
  background-color: rgba(59, 130, 246, 0.08);
  border-radius: 12rpx;
  margin-top: 12rpx;
  align-self: flex-start;
}
.offline-icon {
  font-size: 22rpx;
}
.offline-text {
  font-size: 22rpx;
  color: #3b82f6;
}

/* 列标签 */
.col-tabs {
  display: flex;
  gap: 12rpx;
  margin-bottom: 20rpx;
}
.col-tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  padding: 16rpx 12rpx;
  background-color: #ffffff;
  border-radius: 16rpx;
  border: 2rpx solid transparent;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);
  transition: all 0.2s;
}
.col-tab.active {
  border-color: #f59e0b;
  background-color: rgba(245, 158, 11, 0.06);
  box-shadow: 0 4rpx 16rpx rgba(245, 158, 11, 0.15);
}
.col-tab-dot {
  width: 14rpx;
  height: 14rpx;
  border-radius: 50%;
}
.dot-northstar { background-color: #f59e0b; }
.dot-campaign { background-color: #3b82f6; }
.dot-task { background-color: #10b981; }
.col-tab-label {
  font-size: 26rpx;
  font-weight: 600;
  color: #1d1d1f;
}
.col-tab.active .col-tab-label {
  color: #f59e0b;
}
.col-tab-count {
  font-size: 20rpx;
  color: #86868b;
  background-color: #f2f2f7;
  padding: 2rpx 10rpx;
  border-radius: 12rpx;
}
.col-tab.active .col-tab-count {
  background-color: rgba(245, 158, 11, 0.15);
  color: #f59e0b;
}

/* swiper 列容器 */
.col-swiper {
  flex: 1;
  height: 70vh;
}
.col-scroll {
  height: 100%;
  padding-right: 8rpx;
}

/* 列说明 */
.col-intro {
  background-color: #ffffff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);
}
.col-intro-title {
  display: block;
  font-size: 32rpx;
  font-weight: 700;
  color: #1d1d1f;
  margin-bottom: 4rpx;
}
.col-intro-desc {
  display: block;
  font-size: 22rpx;
  color: #86868b;
  margin-bottom: 16rpx;
}
.col-intro-bar {
  height: 10rpx;
  background-color: #f2f2f7;
  border-radius: 5rpx;
  overflow: hidden;
  margin-bottom: 8rpx;
}
.col-intro-fill {
  height: 100%;
  border-radius: 5rpx;
  transition: width 0.4s ease;
}
.fill-northstar { background: linear-gradient(90deg, #f59e0b, #fbbf24); }
.fill-campaign { background: linear-gradient(90deg, #3b82f6, #60a5fa); }
.fill-task { background: linear-gradient(90deg, #10b981, #34d399); }
.col-intro-meta {
  font-size: 22rpx;
  color: #86868b;
}

/* 任务卡片 */
.task-card {
  display: flex;
  align-items: flex-start;
  background-color: #ffffff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);
  transition: all 0.2s;
  border-left: 6rpx solid transparent;
}
.task-card.done {
  opacity: 0.55;
}
.task-card.dragging {
  opacity: 0.4;
  transform: scale(0.98);
  box-shadow: 0 8rpx 24rpx rgba(245, 158, 11, 0.3);
}
.task-card.drag-over {
  border: 2rpx solid #f59e0b;
  background-color: rgba(245, 158, 11, 0.05);
}

/* 列颜色边条（按当前列着色） */
.col-swiper swiper-item:nth-child(1) .task-card { border-left-color: #f59e0b; }
.col-swiper swiper-item:nth-child(2) .task-card { border-left-color: #3b82f6; }
.col-swiper swiper-item:nth-child(3) .task-card { border-left-color: #10b981; }

.drag-handle {
  margin-right: 12rpx;
  display: flex;
  align-items: center;
  padding-top: 4rpx;
}
.handle-icon {
  font-size: 32rpx;
  color: #c7c7cc;
}
.task-main {
  flex: 1;
}
.task-content {
  display: block;
  color: #1d1d1f;
  font-size: 28rpx;
  line-height: 1.5;
}
.task-meta {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-top: 8rpx;
}
.meta-idx {
  font-size: 20rpx;
  color: #aeaeb2;
  font-weight: 600;
}
.meta-done {
  font-size: 20rpx;
  color: #10b981;
  font-weight: 600;
}
.task-actions {
  flex-shrink: 0;
  margin-left: 16rpx;
  display: flex;
  gap: 8rpx;
}
.task-btn {
  display: inline-block;
  width: 56rpx;
  height: 56rpx;
  line-height: 56rpx;
  text-align: center;
  border-radius: 12rpx;
  font-size: 28rpx;
  font-weight: 700;
}
.sort-btn {
  background-color: rgba(59, 130, 246, 0.12);
  color: #3b82f6;
}
.btn-done {
  background-color: rgba(16, 185, 129, 0.12);
  color: #10b981;
}
.btn-restore {
  background-color: rgba(245, 158, 11, 0.12);
  color: #f59e0b;
}

/* 添加任务 */
.add-task {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  border: 2rpx dashed #d1d1d6;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-top: 8rpx;
}
.add-icon {
  font-size: 32rpx;
  color: #f59e0b;
  font-weight: 700;
}
.add-text {
  color: #86868b;
  font-size: 26rpx;
}
.add-task.disabled {
  border-color: #e5e5ea;
  border-style: solid;
  background-color: #f8f8fa;
}
.add-task.disabled .add-text {
  color: #aeaeb2;
  font-size: 22rpx;
}

/* 空状态 */
.col-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60rpx 0;
}
.col-empty-icon {
  font-size: 72rpx;
  margin-bottom: 16rpx;
}
.col-empty-text {
  font-size: 28rpx;
  color: #1d1d1f;
  font-weight: 600;
  margin-bottom: 8rpx;
}
.col-empty-hint {
  font-size: 22rpx;
  color: #aeaeb2;
  text-align: center;
}

/* 滑动切换提示 */
.swipe-hint {
  text-align: center;
  padding: 16rpx 0 8rpx 0;
}
.swipe-hint-text {
  font-size: 20rpx;
  color: #aeaeb2;
  letter-spacing: 2rpx;
}

/* ===== 深色模式 ===== */
:global([data-theme="dark"]) .header-title,
:global([data-theme="dark"]) .col-intro-title,
:global([data-theme="dark"]) .col-tab-label,
:global([data-theme="dark"]) .task-content {
  color: #f5f5f7 !important;
}
:global([data-theme="dark"]) .header-hint,
:global([data-theme="dark"]) .col-intro-desc,
:global([data-theme="dark"]) .col-intro-meta,
:global([data-theme="dark"]) .col-tab-count,
:global([data-theme="dark"]) .meta-idx,
:global([data-theme="dark"]) .add-text,
:global([data-theme="dark"]) .swipe-hint-text {
  color: #98989d !important;
}
:global([data-theme="dark"]) .col-tab,
:global([data-theme="dark"]) .col-intro,
:global([data-theme="dark"]) .task-card {
  background-color: #1c1c1e !important;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.3) !important;
}
:global([data-theme="dark"]) .col-tab.active {
  background-color: rgba(245, 158, 11, 0.1) !important;
}
:global([data-theme="dark"]) .col-intro-bar {
  background-color: #2c2c2e !important;
}
:global([data-theme="dark"]) .col-tab-count {
  background-color: #2c2c2e !important;
}
:global([data-theme="dark"]) .add-task {
  border-color: #38383a !important;
}
:global([data-theme="dark"]) .add-task.disabled {
  background-color: #2c2c2e !important;
}
:global([data-theme="dark"]) .handle-icon {
  color: #636366 !important;
}
</style>

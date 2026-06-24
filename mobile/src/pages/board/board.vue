<template>
  <view class="page">
    <view class="header">
      <text class="header-title">决策看板</text>
      <text class="header-hint">做减法 · 强制优先级</text>
    </view>

    <scroll-view scroll-x class="columns-scroll" :show-scrollbar="false">
      <view class="columns">
        <view
          v-for="col in columns"
          :key="col.key"
          class="column"
        >
          <view class="col-header">
            <view class="col-title-wrap">
              <view class="col-dot" :class="`dot-${col.key}`"></view>
              <text class="col-title">{{ col.label }}</text>
            </view>
            <text class="col-count">{{ tasksByColumn[col.key].length }}/{{ col.limit }}</text>
          </view>

          <view
            v-for="task in tasksByColumn[col.key]"
            :key="task.id"
            class="task-card"
            :class="{ done: task.status === 'done' }"
            @click="onTaskClick(task)"
          >
            <text class="task-content">{{ task.content }}</text>
            <view class="task-actions">
              <text
                class="task-btn"
                :class="task.status === 'done' ? 'btn-restore' : 'btn-done'"
                @click.stop="toggleStatus(task)"
              >
                {{ task.status === "done" ? "↩" : "✓" }}
              </text>
            </view>
          </view>

          <view
            v-if="tasksByColumn[col.key].length < col.limit"
            class="add-task"
            @click="addTask(col.key)"
          >
            <text class="add-text">+ 添加</text>
          </view>
          <view v-else class="add-task disabled">
            <text class="add-text">已满 {{ col.limit }}</text>
          </view>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { getTasks, createTask, updateTask, deleteTask } from "@/api/tasks.js";

const columns = [
  { key: "northstar", label: "北极星", limit: 3 },
  { key: "campaign", label: "战役", limit: 5 },
  { key: "task", label: "任务", limit: 10 },
];

const tasks = ref([]);

const tasksByColumn = computed(() => {
  const map = { northstar: [], campaign: [], task: [] };
  for (const t of tasks.value) {
    if (map[t.column]) map[t.column].push(t);
  }
  return map;
});

async function loadTasks() {
  try {
    const res = await getTasks();
    tasks.value = res.tasks || [];
  } catch (e) {
    uni.showToast({ title: e.message || "加载失败", icon: "none" });
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

onMounted(loadTasks);
onShow(loadTasks);
</script>

<style scoped>
.page {
  min-height: 100vh;
  padding: 32rpx 0 32rpx 32rpx;
  box-sizing: border-box;
}
.header {
  margin-bottom: 32rpx;
  padding-right: 32rpx;
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

.columns-scroll {
  white-space: nowrap;
}
.columns {
  display: inline-flex;
  gap: 24rpx;
  padding-right: 32rpx;
}
.column {
  display: inline-block;
  width: 560rpx;
  vertical-align: top;
  white-space: normal;
}
.col-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24rpx;
  padding: 0 8rpx;
}
.col-title-wrap {
  display: flex;
  align-items: center;
  gap: 12rpx;
}
.col-dot {
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
}
.dot-northstar { background-color: #f59e0b; }
.dot-campaign { background-color: #3b82f6; }
.dot-task { background-color: #10b981; }
.col-title {
  font-size: 32rpx;
  font-weight: 600;
  color: #1d1d1f;
}
.col-count {
  font-size: 24rpx;
  color: #86868b;
}

.task-card {
  background-color: #ffffff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);
}
.task-card.done {
  opacity: 0.5;
}
.task-content {
  flex: 1;
  color: #1d1d1f;
  font-size: 28rpx;
  line-height: 1.5;
}
.task-actions {
  flex-shrink: 0;
  margin-left: 16rpx;
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
.btn-done {
  background-color: rgba(16, 185, 129, 0.12);
  color: #10b981;
}
.btn-restore {
  background-color: rgba(245, 158, 11, 0.12);
  color: #f59e0b;
}

.add-task {
  border: 2rpx dashed #d1d1d6;
  border-radius: 16rpx;
  padding: 24rpx;
  text-align: center;
}
.add-text {
  color: #86868b;
  font-size: 28rpx;
}
.add-task.disabled {
  border-color: #e5e5ea;
}
.add-task.disabled .add-text {
  color: #aeaeb2;
}
</style>

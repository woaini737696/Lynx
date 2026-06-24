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
            <text class="col-title" :class="`text-${col.key}`">{{ col.label }}</text>
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
            <text class="task-status" @click.stop="toggleStatus(task)">
              {{ task.status === "done" ? "↩恢复" : "✓完成" }}
            </text>
          </view>

          <view
            v-if="tasksByColumn[col.key].length < col.limit"
            class="add-task"
            @click="addTask(col.key)"
          >
            <text>+ 添加</text>
          </view>
          <view v-else class="add-task disabled">
            <text>已满 {{ col.limit }}</text>
          </view>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { getTasks, createTask, updateTask } from "@/api/tasks.js";

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
  } catch (e) {
    uni.showToast({ title: e.message || "操作失败", icon: "none" });
  }
}

function onTaskClick(task) {
  const actions = task.status === "done" ? ["恢复为进行中", "删除"] : ["标记完成", "删除"];
  uni.showActionSheet({
    itemList: actions,
    success: async (res) => {
      if (task.status === "done") {
        if (res.tapIndex === 0) toggleStatus(task);
        else if (res.tapIndex === 1) deleteTask(task);
      } else {
        if (res.tapIndex === 0) toggleStatus(task);
        else if (res.tapIndex === 1) deleteTask(task);
      }
    },
  });
}

async function deleteTask(task) {
  uni.showModal({
    title: "确认删除",
    content: task.content,
    success: async (res) => {
      if (res.confirm) {
        try {
          await updateTask(task.id, { status: "dropped" });
          loadTasks();
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
  color: #f5f5f5;
}
.header-hint {
  display: block;
  font-size: 24rpx;
  color: #737373;
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
.col-title {
  font-size: 32rpx;
  font-weight: 600;
}
.col-count {
  font-size: 24rpx;
  color: #525252;
}

.task-card {
  background-color: #171717;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 20rpx;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}
.task-card.done {
  opacity: 0.5;
}
.task-content {
  flex: 1;
  color: #f5f5f5;
  font-size: 28rpx;
  line-height: 1.5;
}
.task-status {
  font-size: 24rpx;
  color: #f6ad55;
  padding: 4rpx 12rpx;
  flex-shrink: 0;
  margin-left: 16rpx;
}

.add-task {
  border: 2rpx dashed #404040;
  border-radius: 16rpx;
  padding: 24rpx;
  text-align: center;
  color: #737373;
  font-size: 28rpx;
}
.add-task.disabled {
  border-color: #262626;
  color: #404040;
}
</style>

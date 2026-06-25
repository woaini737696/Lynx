<template>
  <view class="tabbar-safe-area">
    <view class="custom-tabbar" :class="{ dark: isDark }">
      <view class="tabbar-inner">
        <view
          v-for="(item, index) in items"
          :key="item.path"
          class="tab-item"
          :class="{ active: current === index, center: index === 2 }"
          @click="switchTab(index)"
        >
          <view class="tab-icon-wrap">
            <Icon
              :name="item.icon"
              :size="index === 2 ? 40 : 36"
              :color="activeColor(index)"
            />
          </view>
          <text v-if="index !== 2" class="tab-text" :class="{ active: current === index }">{{ item.text }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed } from "vue";
import { useSettingsStore } from "@/store/settings.js";
import Icon from "@/components/Icon.vue";

const props = defineProps({
  current: { type: Number, default: 0 },
});

const settingsStore = useSettingsStore();
const isDark = computed(() => settingsStore.theme === "dark");

const items = [
  { icon: "focus", text: "聚焦", path: "/pages/index/index" },
  { icon: "board", text: "看板", path: "/pages/board/board" },
  { icon: "assistant", text: "助理", path: "/pages/ai/chat/chat" },
  { icon: "task", text: "任务", path: "/pages/tasks/tasks" },
  { icon: "profile", text: "我的", path: "/pages/settings/settings" },
];

function activeColor(index) {
  if (index === 2) return "#ffffff";
  if (props.current === index) return "#f59e0b";
  return isDark.value ? "#9ca3af" : "#9ca3af";
}

function switchTab(index) {
  if (index === props.current) return;
  uni.switchTab({ url: items[index].path });
}
</script>

<style scoped>
.tabbar-safe-area {
  pointer-events: none;
}
.custom-tabbar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 999;
  padding: 0 32rpx calc(16rpx + env(safe-area-inset-bottom));
  pointer-events: auto;
}
.tabbar-inner {
  height: 96rpx;
  background-color: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(20rpx);
  border-radius: 999rpx;
  box-shadow: 0 8rpx 32rpx rgba(0, 0, 0, 0.1);
  border: 1rpx solid rgba(0, 0, 0, 0.05);
  display: flex;
  align-items: center;
  justify-content: space-around;
}
.custom-tabbar.dark .tabbar-inner {
  background-color: rgba(24, 26, 32, 0.92);
  border-color: rgba(255, 255, 255, 0.06);
  box-shadow: 0 8rpx 32rpx rgba(0, 0, 0, 0.35);
}
.tab-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4rpx;
  height: 96rpx;
  position: relative;
}
.tab-item.center {
  margin-top: -28rpx;
}
.tab-icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s ease;
}
.tab-item.active .tab-icon-wrap {
  transform: scale(1.1);
}
.tab-item.center .tab-icon-wrap {
  width: 84rpx;
  height: 84rpx;
  border-radius: 50%;
  background: var(--accent-gradient);
  box-shadow: 0 6rpx 20rpx rgba(245, 158, 11, 0.35);
}
.tab-text {
  font-size: 20rpx;
  color: var(--text-tertiary);
  font-weight: 500;
  transition: color 0.2s ease;
}
.tab-text.active {
  color: var(--accent);
  font-weight: 600;
}
</style>

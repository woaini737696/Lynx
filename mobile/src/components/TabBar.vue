<template>
  <view class="custom-tabbar" :class="{ dark: isDark }">
    <view
      v-for="(item, index) in items"
      :key="item.path"
      class="tab-item"
      :class="{ active: current === index, center: index === 2 }"
      @click="switchTab(index)"
    >
      <!-- 中间助理按钮：特殊样式 -->
      <view v-if="index === 2" class="tab-center-btn">
        <text class="tab-icon">{{ item.icon }}</text>
      </view>
      <template v-else>
        <text class="tab-icon">{{ item.icon }}</text>
        <text class="tab-text">{{ item.text }}</text>
      </template>
    </view>
  </view>
</template>

<script setup>
import { computed } from "vue";
import { useSettingsStore } from "@/store/settings.js";

const props = defineProps({
  current: { type: Number, default: 0 },
});

const settingsStore = useSettingsStore();
const isDark = computed(() => settingsStore.theme === "dark");

const items = [
  { icon: "🎯", text: "聚焦", path: "/pages/index/index" },
  { icon: "📊", text: "看板", path: "/pages/board/board" },
  { icon: "🤖", text: "助理", path: "/pages/ai/chat/chat" },
  { icon: "📋", text: "任务", path: "/pages/tasks/tasks" },
  { icon: "⚙️", text: "我的", path: "/pages/settings/settings" },
];

function switchTab(index) {
  if (index === props.current) return;
  uni.switchTab({ url: items[index].path });
}
</script>

<style scoped>
.custom-tabbar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: calc(100rpx + env(safe-area-inset-bottom));
  padding-bottom: env(safe-area-inset-bottom);
  background-color: #ffffff;
  border-top: 1rpx solid #e5e5ea;
  display: flex;
  align-items: center;
  z-index: 999;
  box-shadow: 0 -2rpx 12rpx rgba(0, 0, 0, 0.04);
}
.custom-tabbar.dark {
  background-color: #1c1c1e;
  border-top-color: #38383a;
  box-shadow: 0 -2rpx 12rpx rgba(0, 0, 0, 0.3);
}
.tab-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4rpx;
  height: 100rpx;
}
.tab-icon {
  font-size: 40rpx;
  line-height: 1;
  transition: transform 0.2s;
}
.tab-text {
  font-size: 20rpx;
  color: #86868b;
  font-weight: 500;
}
.tab-item.active .tab-icon {
  transform: scale(1.15);
}
.tab-item.active .tab-text {
  color: #f59e0b;
  font-weight: 600;
}

/* 中间助理按钮 */
.tab-center-btn {
  width: 96rpx;
  height: 96rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, #f59e0b, #f97316);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 6rpx 20rpx rgba(245, 158, 11, 0.35);
  margin-top: -20rpx;
  transition: transform 0.2s;
}
.tab-item.center.active .tab-center-btn {
  transform: scale(1.1);
  box-shadow: 0 8rpx 28rpx rgba(245, 158, 11, 0.5);
}
.tab-item.center .tab-icon {
  font-size: 44rpx;
}
</style>

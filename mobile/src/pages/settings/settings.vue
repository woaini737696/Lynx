<template>
  <view class="page">
    <view class="profile">
      <view class="avatar">
        <text class="avatar-text">{{ initial }}</text>
      </view>
      <view class="profile-info">
        <text class="profile-name">{{ userStore.displayName }}</text>
        <text class="profile-role">{{ roleLabel }}</text>
      </view>
    </view>

    <!-- 功能入口 -->
    <view class="section">
      <text class="section-title">功能</text>
      <view class="menu-item" @click="goInbox">
        <text class="menu-icon">💡</text>
        <text class="menu-label">灵感收件箱</text>
        <text class="menu-arrow">›</text>
      </view>
      <view class="menu-item" @click="goMemory">
        <text class="menu-icon">🧠</text>
        <text class="menu-label">记忆认知</text>
        <text class="menu-arrow">›</text>
      </view>
    </view>

    <!-- 外观 -->
    <view class="section">
      <text class="section-title">外观</text>
      <view class="menu-item" @click="toggleTheme">
        <text class="menu-icon">{{ settingsStore.theme === "dark" ? "🌙" : "☀️" }}</text>
        <text class="menu-label">深色模式</text>
        <view class="switch-wrap" @click.stop="toggleTheme">
          <view class="switch-track" :class="{ on: settingsStore.theme === 'dark' }">
            <view class="switch-thumb"></view>
          </view>
        </view>
      </view>
    </view>

    <view class="section">
      <text class="section-title">服务器配置</text>
      <view class="setting-item">
        <text class="setting-label">API 地址</text>
        <input
          v-model="baseUrl"
          class="setting-input"
          placeholder="http://192.168.x.x:3000"
          placeholder-class="placeholder"
        />
      </view>
      <view class="save-btn-wrap">
        <view class="save-btn" @click="saveBaseUrl">
          <text class="save-btn-text">保存地址</text>
        </view>
      </view>
    </view>

    <view class="section">
      <text class="section-title">关于</text>
      <view class="setting-item">
        <text class="setting-label">版本</text>
        <text class="setting-value">0.1.0</text>
      </view>
      <view class="setting-item">
        <text class="setting-label">后端</text>
        <text class="setting-value">{{ settingsStore.baseUrl || "默认（同源代理）" }}</text>
      </view>
    </view>

    <view class="logout-btn" @click="onLogout">
      <text class="logout-text">退出登录</text>
    </view>

    <!-- 底部导航 -->
    <TabBar :current="4" />
  </view>
</template>

<script setup>
import { ref, computed } from "vue";
import { useUserStore } from "@/store/user.js";
import { useSettingsStore } from "@/store/settings.js";
import TabBar from "@/components/TabBar.vue";

const userStore = useUserStore();
const settingsStore = useSettingsStore();

const baseUrl = ref(settingsStore.baseUrl);

const initial = computed(() => {
  const name = userStore.displayName;
  return name ? name.charAt(0).toUpperCase() : "U";
});

const roleLabel = computed(() => {
  const map = { admin: "管理员", editor: "编辑者", viewer: "访客" };
  return map[userStore.user?.role] || "用户";
});

function saveBaseUrl() {
  settingsStore.setBaseUrl(baseUrl.value);
  uni.showToast({ title: "已保存", icon: "success" });
}

function toggleTheme() {
  settingsStore.toggleTheme();
  uni.showToast({
    title: settingsStore.theme === "dark" ? "已切换深色模式" : "已切换浅色模式",
    icon: "none",
    duration: 1000,
  });
}

function goInbox() {
  uni.navigateTo({ url: "/pages/inbox/inbox" });
}

function goMemory() {
  uni.navigateTo({ url: "/pages/memory/memory" });
}

function onLogout() {
  uni.showModal({
    title: "退出登录",
    content: "确定要退出吗？",
    confirmColor: "#ef4444",
    success: (res) => {
      if (res.confirm) userStore.logout();
    },
  });
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  padding: 32rpx;
  padding-bottom: calc(32rpx + env(safe-area-inset-bottom) + 120rpx);
  box-sizing: border-box;
  background-color: var(--bg-page);
}
.profile {
  display: flex;
  align-items: center;
  background-color: var(--bg-card);
  border-radius: 20rpx;
  padding: 32rpx;
  margin-bottom: 32rpx;
  box-shadow: var(--shadow-card);
}
.avatar {
  width: 112rpx;
  height: 112rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, #f59e0b, #f97316);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 32rpx;
  box-shadow: 0 4rpx 16rpx rgba(245, 158, 11, 0.2);
}
.avatar-text {
  font-size: 48rpx;
  font-weight: 700;
  color: #ffffff;
}
.profile-name {
  display: block;
  font-size: 36rpx;
  font-weight: 600;
  color: var(--text-primary);
}
.profile-role {
  display: block;
  font-size: 24rpx;
  color: var(--text-secondary);
  margin-top: 8rpx;
}

.section {
  background-color: var(--bg-card);
  border-radius: 20rpx;
  padding: 32rpx;
  margin-bottom: 24rpx;
  box-shadow: var(--shadow-card);
}
.section-title {
  display: block;
  font-size: 26rpx;
  color: var(--text-secondary);
  margin-bottom: 24rpx;
  font-weight: 600;
}

.menu-item {
  display: flex;
  align-items: center;
  padding: 24rpx 0;
  border-bottom: 1rpx solid var(--border-light);
}
.menu-item:last-child {
  border-bottom: none;
}
.menu-icon {
  font-size: 36rpx;
  margin-right: 20rpx;
}
.menu-label {
  flex: 1;
  color: var(--text-primary);
  font-size: 30rpx;
}
.menu-arrow {
  color: var(--text-tertiary);
  font-size: 36rpx;
}

.switch-wrap {
  padding: 4rpx 0;
}
.switch-track {
  width: 88rpx;
  height: 52rpx;
  border-radius: 26rpx;
  background-color: #e5e5ea;
  position: relative;
  transition: background-color 0.3s;
}
.switch-track.on {
  background: linear-gradient(135deg, #f59e0b, #f97316);
}
.switch-thumb {
  position: absolute;
  top: 4rpx;
  left: 4rpx;
  width: 44rpx;
  height: 44rpx;
  border-radius: 50%;
  background-color: #ffffff;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.15);
  transition: transform 0.3s;
}
.switch-track.on .switch-thumb {
  transform: translateX(36rpx);
}

.setting-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20rpx 0;
  border-bottom: 1rpx solid var(--border-light);
}
.setting-label {
  color: var(--text-primary);
  font-size: 28rpx;
}
.setting-value {
  color: var(--text-secondary);
  font-size: 26rpx;
}
.setting-input {
  flex: 1;
  text-align: right;
  color: var(--text-primary);
  font-size: 26rpx;
}
.placeholder {
  color: var(--text-tertiary);
}

.save-btn-wrap {
  margin-top: 24rpx;
}
.save-btn {
  background-color: rgba(245, 158, 11, 0.12);
  border-radius: 12rpx;
  height: 80rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}
.save-btn-text {
  color: #f59e0b;
  font-size: 28rpx;
  font-weight: 600;
}

.logout-btn {
  background-color: var(--bg-card);
  border-radius: 16rpx;
  height: 96rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 32rpx;
  box-shadow: var(--shadow-card);
}
.logout-text {
  color: #ef4444;
  font-size: 30rpx;
  font-weight: 600;
}
</style>

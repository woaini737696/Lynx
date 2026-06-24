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
  </view>
</template>

<script setup>
import { ref, computed } from "vue";
import { useUserStore } from "@/store/user.js";
import { useSettingsStore } from "@/store/settings.js";

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
  box-sizing: border-box;
}
.profile {
  display: flex;
  align-items: center;
  background-color: #ffffff;
  border-radius: 20rpx;
  padding: 32rpx;
  margin-bottom: 32rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
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
  color: #1d1d1f;
}
.profile-role {
  display: block;
  font-size: 24rpx;
  color: #86868b;
  margin-top: 8rpx;
}

.section {
  background-color: #ffffff;
  border-radius: 20rpx;
  padding: 32rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
}
.section-title {
  display: block;
  font-size: 26rpx;
  color: #86868b;
  margin-bottom: 24rpx;
  font-weight: 600;
}

.menu-item {
  display: flex;
  align-items: center;
  padding: 24rpx 0;
  border-bottom: 1rpx solid #f2f2f7;
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
  color: #1d1d1f;
  font-size: 30rpx;
}
.menu-arrow {
  color: #c7c7cc;
  font-size: 36rpx;
}

.setting-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20rpx 0;
  border-bottom: 1rpx solid #f2f2f7;
}
.setting-label {
  color: #1d1d1f;
  font-size: 28rpx;
}
.setting-value {
  color: #86868b;
  font-size: 26rpx;
}
.setting-input {
  flex: 1;
  text-align: right;
  color: #1d1d1f;
  font-size: 26rpx;
}
.placeholder {
  color: #aeaeb2;
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
  background-color: #ffffff;
  border-radius: 16rpx;
  height: 96rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 32rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
}
.logout-text {
  color: #ef4444;
  font-size: 30rpx;
  font-weight: 600;
}
</style>

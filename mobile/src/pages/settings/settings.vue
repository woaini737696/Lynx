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
      <button class="save-btn" @click="saveBaseUrl">保存地址</button>
    </view>

    <view class="section">
      <text class="section-title">关于</text>
      <view class="setting-item">
        <text class="setting-label">版本</text>
        <text class="setting-value">0.1.0</text>
      </view>
      <view class="setting-item">
        <text class="setting-label">后端</text>
        <text class="setting-value">{{ settingsStore.baseUrl }}</text>
      </view>
    </view>

    <button class="logout-btn" @click="onLogout">退出登录</button>
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

function onLogout() {
  uni.showModal({
    title: "退出登录",
    content: "确定要退出吗？",
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
  background-color: #171717;
  border-radius: 20rpx;
  padding: 32rpx;
  margin-bottom: 40rpx;
}
.avatar {
  width: 112rpx;
  height: 112rpx;
  border-radius: 50%;
  background-color: #f6ad55;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 32rpx;
}
.avatar-text {
  font-size: 48rpx;
  font-weight: 700;
  color: #0a0a0a;
}
.profile-name {
  display: block;
  font-size: 36rpx;
  font-weight: 600;
  color: #f5f5f5;
}
.profile-role {
  display: block;
  font-size: 24rpx;
  color: #a3a3a3;
  margin-top: 8rpx;
}

.section {
  background-color: #171717;
  border-radius: 20rpx;
  padding: 32rpx;
  margin-bottom: 32rpx;
}
.section-title {
  display: block;
  font-size: 26rpx;
  color: #737373;
  margin-bottom: 24rpx;
}
.setting-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20rpx 0;
  border-bottom: 1rpx solid #262626;
}
.setting-label {
  color: #d4d4d4;
  font-size: 28rpx;
}
.setting-value {
  color: #737373;
  font-size: 26rpx;
}
.setting-input {
  flex: 1;
  text-align: right;
  color: #f5f5f5;
  font-size: 26rpx;
}
.placeholder {
  color: #525252;
}

.save-btn {
  background-color: #262626;
  color: #f6ad55;
  font-size: 28rpx;
  border-radius: 12rpx;
  margin-top: 24rpx;
  border: none;
}

.logout-btn {
  background-color: #171717;
  color: #ef4444;
  font-size: 30rpx;
  border-radius: 16rpx;
  margin-top: 40rpx;
  border: 1rpx solid #262626;
}
</style>

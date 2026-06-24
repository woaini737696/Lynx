<template>
  <view class="login-page">
    <view class="login-header">
      <text class="login-title">LynnHub</text>
      <text class="login-subtitle">灵感收敛 · 工作聚焦 · 记忆复利</text>
    </view>

    <view class="login-form">
      <view class="input-group">
        <input
          v-model="form.username"
          class="input"
          type="text"
          placeholder="用户名"
          placeholder-class="placeholder"
          @confirm="onLogin"
        />
      </view>
      <view class="input-group">
        <input
          v-model="form.password"
          class="input"
          :password="!showPassword"
          placeholder="密码"
          placeholder-class="placeholder"
          @confirm="onLogin"
        />
        <text class="toggle-eye" @click="showPassword = !showPassword">
          {{ showPassword ? "隐藏" : "显示" }}
        </text>
      </view>

      <button
        class="login-btn"
        :disabled="loading"
        @click="onLogin"
      >
        {{ loading ? "登录中..." : "登 录" }}
      </button>

      <view class="server-config" @click="showServerConfig = !showServerConfig">
        <text class="server-config-text">
          {{ showServerConfig ? "▼" : "▶" }} 服务器地址
        </text>
      </view>
      <view v-if="showServerConfig" class="input-group">
        <input
          v-model="form.baseUrl"
          class="input"
          type="text"
          placeholder="http://192.168.x.x:3000"
          placeholder-class="placeholder"
        />
      </view>
    </view>
  </view>
</template>

<script setup>
import { reactive, ref } from "vue";
import { useUserStore } from "@/store/user.js";
import { useSettingsStore } from "@/store/settings.js";

const userStore = useUserStore();
const settingsStore = useSettingsStore();

const loading = ref(false);
const showPassword = ref(false);
const showServerConfig = ref(false);

const form = reactive({
  username: "",
  password: "",
  baseUrl: settingsStore.baseUrl,
});

async function onLogin() {
  if (!form.username || !form.password) {
    uni.showToast({ title: "请输入用户名和密码", icon: "none" });
    return;
  }

  // 先保存服务器地址
  if (form.baseUrl && form.baseUrl !== settingsStore.baseUrl) {
    settingsStore.setBaseUrl(form.baseUrl);
  }

  loading.value = true;
  try {
    await userStore.login(form.username, form.password);
    uni.showToast({ title: "登录成功", icon: "success" });
    setTimeout(() => {
      uni.switchTab({ url: "/pages/index/index" });
    }, 500);
  } catch (e) {
    uni.showToast({ title: e.message || "登录失败", icon: "none" });
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  background-color: #0a0a0a;
  padding: 0 60rpx;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.login-header {
  text-align: center;
  margin-bottom: 80rpx;
}
.login-title {
  display: block;
  font-size: 64rpx;
  font-weight: 700;
  color: #f6ad55;
  letter-spacing: 4rpx;
}
.login-subtitle {
  display: block;
  font-size: 24rpx;
  color: #737373;
  margin-top: 16rpx;
}

.login-form {
  width: 100%;
}

.input-group {
  position: relative;
  margin-bottom: 32rpx;
}
.input {
  width: 100%;
  height: 96rpx;
  background-color: #171717;
  border: 1rpx solid #262626;
  border-radius: 16rpx;
  padding: 0 28rpx;
  color: #f5f5f5;
  font-size: 30rpx;
  box-sizing: border-box;
}
.placeholder {
  color: #525252;
}
.toggle-eye {
  position: absolute;
  right: 28rpx;
  top: 50%;
  transform: translateY(-50%);
  color: #737373;
  font-size: 24rpx;
  padding: 10rpx;
}

.login-btn {
  width: 100%;
  height: 96rpx;
  background-color: #f6ad55;
  color: #0a0a0a;
  font-size: 32rpx;
  font-weight: 600;
  border-radius: 16rpx;
  border: none;
  margin-top: 16rpx;
}
.login-btn[disabled] {
  opacity: 0.5;
}

.server-config {
  text-align: center;
  margin-top: 48rpx;
}
.server-config-text {
  color: #525252;
  font-size: 24rpx;
}
</style>

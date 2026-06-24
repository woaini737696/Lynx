<template>
  <view class="login-page">
    <view class="login-header">
      <view class="logo-circle">
        <text class="logo-text">L</text>
      </view>
      <text class="login-title">LynnHub</text>
      <text class="login-subtitle">灵感收敛 · 工作聚焦 · 记忆复利</text>
    </view>

    <view class="login-form">
      <view class="input-group">
        <text class="input-label">用户名</text>
        <input
          v-model="form.username"
          class="input"
          type="text"
          placeholder="请输入用户名"
          placeholder-class="placeholder"
          :adjust-position="true"
          :cursor-spacing="20"
          @confirm="onLogin"
        />
      </view>
      <view class="input-group">
        <text class="input-label">密码</text>
        <view class="password-wrapper">
          <input
            v-model="form.password"
            class="input"
            :password="!showPassword"
            placeholder="请输入密码"
            placeholder-class="placeholder"
            :adjust-position="true"
            :cursor-spacing="20"
            @confirm="onLogin"
          />
          <view class="toggle-eye" @click="showPassword = !showPassword">
            <text class="eye-icon">{{ showPassword ? "🙈" : "👁" }}</text>
          </view>
        </view>
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
          {{ showServerConfig ? "▼" : "▶" }} 服务器地址（H5 测试留空，App 需填后端 IP）
        </text>
      </view>
      <view v-if="showServerConfig" class="input-group">
        <text class="input-label">API 地址</text>
        <input
          v-model="form.baseUrl"
          class="input"
          type="text"
          placeholder="留空走代理；App 填 http://192.168.x.x:3000"
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
const showServerConfig = ref(true);

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
  background-color: #f5f5f7;
  padding: 0 56rpx;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.login-header {
  text-align: center;
  margin-bottom: 72rpx;
}
.logo-circle {
  width: 128rpx;
  height: 128rpx;
  border-radius: 32rpx;
  background: linear-gradient(135deg, #f59e0b, #f97316);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 24rpx;
  box-shadow: 0 12rpx 32rpx rgba(245, 158, 11, 0.3);
}
.logo-text {
  font-size: 64rpx;
  font-weight: 800;
  color: #ffffff;
}
.login-title {
  display: block;
  font-size: 56rpx;
  font-weight: 700;
  color: #1d1d1f;
  letter-spacing: 2rpx;
}
.login-subtitle {
  display: block;
  font-size: 24rpx;
  color: #86868b;
  margin-top: 12rpx;
}

.login-form {
  width: 100%;
}

.input-group {
  margin-bottom: 28rpx;
}
.input-label {
  display: block;
  font-size: 26rpx;
  font-weight: 600;
  color: #1d1d1f;
  margin-bottom: 12rpx;
}
.input {
  width: 100%;
  height: 96rpx;
  background-color: #ffffff;
  border: 2rpx solid #e5e5ea;
  border-radius: 20rpx;
  padding: 0 28rpx;
  color: #1d1d1f;
  font-size: 32rpx;
  box-sizing: border-box;
  transition: border-color 0.2s;
}
.input:focus {
  border-color: #f59e0b;
}
.placeholder {
  color: #aeaeb2;
  font-size: 30rpx;
}

.password-wrapper {
  position: relative;
}
.toggle-eye {
  position: absolute;
  right: 20rpx;
  top: 50%;
  transform: translateY(-50%);
  padding: 12rpx;
}
.eye-icon {
  font-size: 36rpx;
}

.login-btn {
  width: 100%;
  height: 100rpx;
  background: linear-gradient(135deg, #f59e0b, #f97316);
  color: #ffffff;
  font-size: 34rpx;
  font-weight: 600;
  border-radius: 20rpx;
  border: none;
  margin-top: 16rpx;
  box-shadow: 0 8rpx 24rpx rgba(245, 158, 11, 0.25);
}
.login-btn[disabled] {
  opacity: 0.5;
}

.server-config {
  text-align: center;
  margin-top: 40rpx;
}
.server-config-text {
  color: #86868b;
  font-size: 24rpx;
}
</style>

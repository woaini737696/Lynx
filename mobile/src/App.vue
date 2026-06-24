<script setup>
import { onLaunch } from "@dcloudio/uni-app";
import { useUserStore } from "@/store/user.js";

onLaunch(() => {
  // 清理旧版默认 baseUrl（http://localhost:3000），H5 模式改用 vite proxy 同源代理
  // 旧值会导致手机/外部浏览器访问不到电脑 localhost
  const storedBaseUrl = uni.getStorageSync("api_base_url");
  if (storedBaseUrl === "http://localhost:3000") {
    uni.removeStorageSync("api_base_url");
  }

  // 恢复登录态，未登录跳转登录页
  const userStore = useUserStore();
  userStore.restore();
  if (!userStore.token) {
    uni.reLaunch({ url: "/pages/login/login" });
  }
});
</script>

<style>
/* 全局样式 - 深色主题，对齐 Web 端配色 */
page {
  background-color: #0a0a0a;
  color: #e5e5e5;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  font-size: 28rpx;
}

/* 通用工具类 */
.flex { display: flex; }
.flex-center { display: flex; align-items: center; justify-content: center; }
.flex-between { display: flex; align-items: center; justify-content: space-between; }
.flex-1 { flex: 1; }
.card {
  background-color: #171717;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 20rpx;
}
.text-secondary { color: #a3a3a3; }
.text-northstar { color: #f6ad55; }
.text-campaign { color: #63b3ed; }
.text-task { color: #68d391; }
</style>

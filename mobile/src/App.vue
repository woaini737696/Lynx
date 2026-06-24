<script setup>
import { onLaunch } from "@dcloudio/uni-app";
import { useUserStore } from "@/store/user.js";

onLaunch(() => {
  // 清理旧版默认 baseUrl（http://localhost:3000），H5 模式改用 vite proxy 同源代理
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
/* 全局样式 - 浅色主题 */
page {
  background-color: #f5f5f7;
  color: #1d1d1f;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  font-size: 28rpx;
}

/* 通用工具类 */
.flex { display: flex; }
.flex-center { display: flex; align-items: center; justify-content: center; }
.flex-between { display: flex; align-items: center; justify-content: space-between; }
.flex-1 { flex: 1; }
.card {
  background-color: #ffffff;
  border-radius: 20rpx;
  padding: 28rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
}
.text-secondary { color: #86868b; }
.text-northstar { color: #f59e0b; }
.text-campaign { color: #3b82f6; }
.text-task { color: #10b981; }
.text-danger { color: #ef4444; }
</style>

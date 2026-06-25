<script setup>
import { onLaunch } from "@dcloudio/uni-app";
import { useUserStore } from "@/store/user.js";
import { useSettingsStore } from "@/store/settings.js";

onLaunch(() => {
  // 清理旧版默认 baseUrl（http://localhost:3000），H5 模式改用 vite proxy 同源代理
  const storedBaseUrl = uni.getStorageSync("api_base_url");
  if (storedBaseUrl === "http://localhost:3000") {
    uni.removeStorageSync("api_base_url");
  }

  // 初始化主题
  const settingsStore = useSettingsStore();
  settingsStore.initTheme();

  // 恢复登录态，未登录跳转登录页
  const userStore = useUserStore();
  userStore.restore();
  if (!userStore.token) {
    uni.reLaunch({ url: "/pages/login/login" });
  }
});
</script>

<style>
/* ===== CSS 变量：浅色主题（默认） ===== */
page {
  --bg-page: #f5f5f7;
  --bg-card: #ffffff;
  --bg-input: #f2f2f7;
  --bg-mask: rgba(0, 0, 0, 0.4);
  --text-primary: #1d1d1f;
  --text-secondary: #86868b;
  --text-tertiary: #aeaeb2;
  --border-color: #e5e5ea;
  --border-light: #f2f2f7;
  --accent: #f59e0b;
  --accent-gradient: linear-gradient(135deg, #f59e0b, #f97316);
  --shadow-card: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
  --shadow-fab: 0 8rpx 24rpx rgba(245, 158, 11, 0.35);

  background-color: var(--bg-page);
  color: var(--text-primary);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  font-size: 28rpx;
}

/* ===== CSS 变量：深色主题 ===== */
/* #ifdef H5 */
[data-theme="dark"] page,
[data-theme="dark"] {
  --bg-page: #0a0a0c;
  --bg-card: #1c1c1e;
  --bg-input: #2c2c2e;
  --bg-mask: rgba(0, 0, 0, 0.6);
  --text-primary: #f5f5f7;
  --text-secondary: #98989d;
  --text-tertiary: #636366;
  --border-color: #38383a;
  --border-light: #2c2c2e;
  --accent: #f59e0b;
  --accent-gradient: linear-gradient(135deg, #f59e0b, #f97316);
  --shadow-card: 0 2rpx 12rpx rgba(0, 0, 0, 0.3);
  --shadow-fab: 0 8rpx 24rpx rgba(245, 158, 11, 0.25);

  background-color: var(--bg-page);
  color: var(--text-primary);
}
/* #endif */

/* 通用工具类 */
.flex { display: flex; }
.flex-center { display: flex; align-items: center; justify-content: center; }
.flex-between { display: flex; align-items: center; justify-content: space-between; }
.flex-1 { flex: 1; }
.card {
  background-color: var(--bg-card);
  border-radius: 20rpx;
  padding: 28rpx;
  margin-bottom: 20rpx;
  box-shadow: var(--shadow-card);
}
.text-secondary { color: var(--text-secondary); }
.text-northstar { color: #f59e0b; }
.text-campaign { color: #3b82f6; }
.text-task { color: #10b981; }
.text-danger { color: #ef4444; }

/* ===== 深色模式全局覆盖（处理各页面硬编码颜色） ===== */
/* #ifdef H5 */
[data-theme="dark"] .page {
  background-color: #0a0a0c !important;
}
[data-theme="dark"] .header-title,
[data-theme="dark"] .task-summary,
[data-theme="dark"] .task-content,
[data-theme="dark"] .detail-summary,
[data-theme="dark"] .detail-title,
[data-theme="dark"] .col-title,
[data-theme="dark"] .idea-content,
[data-theme="dark"] .popup-title,
[data-theme="dark"] .profile-name,
[data-theme="dark"] .menu-label,
[data-theme="dark"] .setting-label,
[data-theme="dark"] .field-value,
[data-theme="dark"] .section-text {
  color: #f5f5f7 !important;
}
[data-theme="dark"] .header-hint,
[data-theme="dark"] .header-count,
[data-theme="dark"] .tab-count,
[data-theme="dark"] .col-count,
[data-theme="dark"] .idea-time,
[data-theme="dark"] .meta-due,
[data-theme="dark"] .meta-sub,
[data-theme="dark"] .meta-list,
[data-theme="dark"] .empty-text,
[data-theme="dark"] .section-label,
[data-theme="dark"] .field-label,
[data-theme="dark"] .profile-role,
[data-theme="dark"] .section-title,
[data-theme="dark"] .setting-value,
[data-theme="dark"] .char-count,
[data-theme="dark"] .sync-text {
  color: #98989d !important;
}
[data-theme="dark"] .task-item,
[data-theme="dark"] .task-card,
[data-theme="dark"] .idea-card,
[data-theme="dark"] .detail-popup,
[data-theme="dark"] .popup,
[data-theme="dark"] .tab,
[data-theme="dark"] .add-task {
  background-color: #1c1c1e !important;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.3) !important;
}
[data-theme="dark"] .textarea {
  background-color: #2c2c2e !important;
  color: #f5f5f7 !important;
}
[data-theme="dark"] .detail-mask,
[data-theme="dark"] .mask {
  background-color: rgba(0, 0, 0, 0.6) !important;
}
[data-theme="dark"] .detail-header,
[data-theme="dark"] .detail-actions,
[data-theme="dark"] .menu-item,
[data-theme="dark"] .setting-item {
  border-color: #38383a !important;
}
[data-theme="dark"] .task-arrow,
[data-theme="dark"] .menu-arrow,
[data-theme="dark"] .close-icon {
  color: #636366 !important;
}
[data-theme="dark"] .empty-hint {
  color: #636366 !important;
}
[data-theme="dark"] .task-check {
  border-color: #48484a !important;
}
/* #endif */
</style>

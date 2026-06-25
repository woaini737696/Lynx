<script setup>
import { onLaunch } from "@dcloudio/uni-app";
import { useUserStore } from "@/store/user.js";
import { useSettingsStore } from "@/store/settings.js";

onLaunch(() => {
  // 清理旧版默认 baseUrl（http://localhost:3000），H5 模式改用 vite proxy 同源代理
  // 后端固定使用 5176 端口
  const storedBaseUrl = uni.getStorageSync("api_base_url");
  if (storedBaseUrl === "http://localhost:3000" || storedBaseUrl === "http://localhost:5176") {
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
/* ===== CSS 变量：浅色主题（默认）- 豆包风格 ===== */
page {
  --bg-page: #f7f8fa;
  --bg-card: #ffffff;
  --bg-input: #f2f4f7;
  --bg-mask: rgba(0, 0, 0, 0.45);
  --text-primary: #1f2937;
  --text-secondary: #6b7280;
  --text-tertiary: #9ca3af;
  --border-color: #e5e7eb;
  --border-light: #f3f4f6;
  --accent: #f59e0b;
  --accent-soft: #fff7ed;
  --accent-gradient: linear-gradient(135deg, #f59e0b, #f97316);
  --blue: #3b82f6;
  --blue-soft: #eff6ff;
  --green: #22c55e;
  --red: #ef4444;
  --shadow-card: 0 4rpx 20rpx rgba(0, 0, 0, 0.05);
  --shadow-elevated: 0 12rpx 40rpx rgba(0, 0, 0, 0.12);
  --shadow-fab: 0 8rpx 28rpx rgba(245, 158, 11, 0.32);
  --radius-sm: 12rpx;
  --radius-md: 20rpx;
  --radius-lg: 28rpx;
  --radius-xl: 36rpx;
  --radius-pill: 999rpx;

  background-color: var(--bg-page);
  color: var(--text-primary);
  font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  font-size: 28rpx;
  -webkit-font-smoothing: antialiased;
}

/* ===== CSS 变量：深色主题 ===== */
/* #ifdef H5 */
[data-theme="dark"] page,
[data-theme="dark"] {
  --bg-page: #0b0d10;
  --bg-card: #181a20;
  --bg-input: #23262d;
  --bg-mask: rgba(0, 0, 0, 0.7);
  --text-primary: #f3f4f6;
  --text-secondary: #9ca3af;
  --text-tertiary: #6b7280;
  --border-color: #2f333a;
  --border-light: #1f2228;
  --accent: #f59e0b;
  --accent-soft: #2a1f0f;
  --accent-gradient: linear-gradient(135deg, #f59e0b, #f97316);
  --shadow-card: 0 4rpx 20rpx rgba(0, 0, 0, 0.35);
  --shadow-elevated: 0 12rpx 40rpx rgba(0, 0, 0, 0.45);
  --shadow-fab: 0 8rpx 28rpx rgba(245, 158, 11, 0.22);

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
  border-radius: var(--radius-lg);
  padding: 32rpx;
  margin-bottom: 24rpx;
  box-shadow: var(--shadow-card);
}
.text-secondary { color: var(--text-secondary); }
.text-northstar { color: #f59e0b; }
.text-campaign { color: #3b82f6; }
.text-task { color: #22c55e; }
.text-danger { color: #ef4444; }

/* 豆包风格统一按钮 */
.btn-primary {
  background: var(--accent-gradient);
  color: #ffffff;
  border-radius: var(--radius-pill);
  padding: 24rpx 40rpx;
  font-weight: 600;
  box-shadow: var(--shadow-fab);
}
.btn-ghost {
  background-color: var(--bg-input);
  color: var(--text-primary);
  border-radius: var(--radius-pill);
  padding: 20rpx 32rpx;
  font-weight: 500;
}

/* 统一输入框 */
.input-base {
  background-color: var(--bg-input);
  border-radius: var(--radius-md);
  padding: 24rpx;
  color: var(--text-primary);
  font-size: 28rpx;
}
.input-base::placeholder {
  color: var(--text-tertiary);
}

/* 页面容器 */
.page-container {
  min-height: 100vh;
  padding: 32rpx;
  padding-bottom: calc(32rpx + env(safe-area-inset-bottom) + 140rpx);
  box-sizing: border-box;
}

/* 页面标题 */
.page-title {
  font-size: 48rpx;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: 0.5rpx;
}
.page-subtitle {
  font-size: 26rpx;
  color: var(--text-secondary);
  margin-top: 8rpx;
}

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

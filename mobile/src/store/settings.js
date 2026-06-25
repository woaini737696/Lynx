import { defineStore } from "pinia";
import {
  getBaseUrl,
  setBaseUrl as setBaseUrlStorage,
} from "@/api/request.js";

const THEME_KEY = "lynnhub_theme";

/** 读取本地存储的主题 */
function loadTheme() {
  try {
    return uni.getStorageSync(THEME_KEY) || "light";
  } catch {
    return "light";
  }
}

/** 应用主题到页面（H5 模式操作 document，其他端操作 page 背景色） */
function applyTheme(theme) {
  // H5 模式：通过 document.documentElement 属性切换
  // #ifdef H5
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("data-theme", theme);
  }
  // #endif
  // 通用：设置 page 背景色
  // 通过 CSS 变量实现，见 App.vue
}

export const useSettingsStore = defineStore("settings", {
  state: () => ({
    baseUrl: getBaseUrl(),
    theme: loadTheme(),
  }),
  actions: {
    /** 设置后端 API 地址 */
    setBaseUrl(url) {
      const trimmed = (url || "").trim().replace(/\/$/, "");
      this.baseUrl = trimmed || getBaseUrl();
      setBaseUrlStorage(this.baseUrl);
    },

    /** 切换主题 */
    setTheme(theme) {
      this.theme = theme;
      try {
        uni.setStorageSync(THEME_KEY, theme);
      } catch {
        // ignore
      }
      applyTheme(theme);
    },

    /** 切换深色/浅色 */
    toggleTheme() {
      this.setTheme(this.theme === "dark" ? "light" : "dark");
    },

    /** 初始化主题（应用启动时调用） */
    initTheme() {
      applyTheme(this.theme);
    },
  },
});

import { defineStore } from "pinia";
import {
  getBaseUrl,
  setBaseUrl as setBaseUrlStorage,
} from "@/api/request.js";

export const useSettingsStore = defineStore("settings", {
  state: () => ({
    baseUrl: getBaseUrl(),
  }),
  actions: {
    /** 设置后端 API 地址 */
    setBaseUrl(url) {
      const trimmed = (url || "").trim().replace(/\/$/, "");
      this.baseUrl = trimmed || getBaseUrl();
      setBaseUrlStorage(this.baseUrl);
    },
  },
});

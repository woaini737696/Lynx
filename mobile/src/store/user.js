import { defineStore } from "pinia";
import { login as loginApi } from "@/api/auth.js";

const STORAGE_KEY_TOKEN = "auth_token";
const STORAGE_KEY_USER = "auth_user";

export const useUserStore = defineStore("user", {
  state: () => ({
    token: "",
    user: null, // { id, username, role, displayName }
  }),
  getters: {
    isLoggedIn: (state) => !!state.token,
    displayName: (state) =>
      state.user?.displayName || state.user?.username || "用户",
    isAdmin: (state) => state.user?.role === "admin",
  },
  actions: {
    /** 从本地存储恢复登录态 */
    restore() {
      this.token = uni.getStorageSync(STORAGE_KEY_TOKEN) || "";
      this.user = uni.getStorageSync(STORAGE_KEY_USER) || null;
    },
    /** 登录 */
    async login(username, password) {
      const res = await loginApi(username, password);
      this.token = res.token;
      this.user = res.user;
      uni.setStorageSync(STORAGE_KEY_TOKEN, res.token);
      uni.setStorageSync(STORAGE_KEY_USER, res.user);
      return res;
    },
    /** 退出登录 */
    logout() {
      this.token = "";
      this.user = null;
      uni.removeStorageSync(STORAGE_KEY_TOKEN);
      uni.removeStorageSync(STORAGE_KEY_USER);
      uni.reLaunch({ url: "/pages/login/login" });
    },
  },
});

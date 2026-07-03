import { create } from "zustand";
import type { PersistedUser, AuthCredentials } from "@/lib/auth-persistence";
import { isElectron, invoke } from "@/lib/tauri";

interface User extends PersistedUser {}

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  initialized: boolean;
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  setCredentials: (credentials: AuthCredentials | null) => void;
  setLoading: (loading: boolean) => void;
  setInitialized: (initialized: boolean) => void;
  signOut: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  loading: true,
  initialized: false,
  setUser: (user) => set({ user }),
  setToken: (token) => set({ token }),
  setCredentials: (credentials) => {
    set({
      user: credentials?.user ?? null,
      token: credentials?.token ?? null,
    });
    // 任务1: token 设置完成后，主动同步到 Electron 主进程的 store.js
    // 仅在 Electron 环境 + token 存在时触发（signOut 清空时不同步）
    const token = credentials?.token;
    if (token && isElectron()) {
      // 动态 import 避免与 cloud-api 形成循环依赖
      import("@/lib/cloud-api")
        .then(({ getCloudEndpoint }) => {
          invoke("sync_auth", { token, endpoint: getCloudEndpoint() }).catch(
            (e) => {
              console.warn("[authStore] sync_auth 到主进程失败:", e);
            }
          );
        })
        .catch((e) => {
          console.warn("[authStore] 加载 cloud-api 模块失败:", e);
        });
    }
  },
  setLoading: (loading) => set({ loading }),
  setInitialized: (initialized) => set({ initialized }),
  signOut: () => set({ user: null, token: null }),
}));

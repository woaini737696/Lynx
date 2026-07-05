import { create } from "zustand";
import type { PersistedUser, AuthCredentials } from "@/lib/auth-persistence";
import { isElectron, isTauri, invoke } from "@/lib/tauri";

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

// 桌面端环境检测：Electron 或 Tauri 都需要同步认证状态到主进程
const isDesktop = () => isElectron() || isTauri();

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
    // 同步认证到桌面端主进程（Electron + Tauri）
    // Rust 端需要 token + endpoint 来启动 WS 连接和发起云端请求
    const token = credentials?.token;
    if (token && isDesktop()) {
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
  signOut: () => {
    set({ user: null, token: null });
    // 登出时：1) 停止 WS 客户端 2) 清空 Rust 端 userToken
    if (isDesktop()) {
      // 先停止 WS，再清空 token（顺序重要：避免 WS 用旧 token 重连）
      invoke("stop_hermes_agent").catch((e) => {
        console.warn("[authStore] stop_hermes_agent 失败:", e);
      });
      import("@/lib/cloud-api")
        .then(({ getCloudEndpoint }) => {
          invoke("sync_auth", { token: "", endpoint: getCloudEndpoint() }).catch((e) => {
            console.warn("[authStore] signOut 同步主进程失败:", e);
          });
        })
        .catch((e) => console.warn("[authStore] 加载 cloud-api 失败:", e));
    }
  },
}));

import { load, Store } from "@tauri-apps/plugin-store";
import { isTauri } from "@/lib/tauri";

const STORE_NAME = "lynx-auth.bin";
const TOKEN_KEY = "token";
const USER_KEY = "user";
// localStorage 键名（非 Tauri 环境使用）
const LS_TOKEN_KEY = "lynx-auth-token";
const LS_USER_KEY = "lynx-auth-user";

let store: Store | null = null;

async function getStore(): Promise<Store> {
  if (!store) {
    store = await load(STORE_NAME, { autoSave: true, defaults: {} });
  }
  return store;
}

export interface PersistedUser {
  id: string;
  username?: string;
  displayName?: string;
  name?: string | null;
  avatarUrl?: string;
  email?: string;
  tier?: string;
}

export interface AuthCredentials {
  token: string;
  user: PersistedUser;
}

// 非数 Tauri 环境用 localStorage 持久化（Electron/Web 模式）
function lsSave(credentials: AuthCredentials): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(LS_TOKEN_KEY, credentials.token);
  localStorage.setItem(LS_USER_KEY, JSON.stringify(credentials.user));
}

function lsLoad(): AuthCredentials | null {
  if (typeof localStorage === "undefined") return null;
  const token = localStorage.getItem(LS_TOKEN_KEY);
  if (!token) return null;
  try {
    const user = JSON.parse(localStorage.getItem(LS_USER_KEY) || '{"id":""}');
    return { token, user };
  } catch {
    return { token, user: { id: "" } };
  }
}

function lsClear(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(LS_TOKEN_KEY);
  localStorage.removeItem(LS_USER_KEY);
}

export async function saveAuth(credentials: AuthCredentials): Promise<void> {
  // 非 Tauri 环境用 localStorage
  if (!isTauri()) {
    lsSave(credentials);
    return;
  }
  const s = await getStore();
  await s.set(TOKEN_KEY, credentials.token);
  await s.set(USER_KEY, credentials.user);
  await s.save();
}

export async function loadAuth(): Promise<AuthCredentials | null> {
  // 非 Tauri 环境用 localStorage
  if (!isTauri()) {
    return lsLoad();
  }
  const s = await getStore();
  const token = await s.get<string>(TOKEN_KEY);
  const user = await s.get<PersistedUser>(USER_KEY);
  if (!token) return null;
  return { token, user: user || { id: "" } };
}

export async function clearAuth(): Promise<void> {
  // 非 Tauri 环境用 localStorage
  if (!isTauri()) {
    lsClear();
    return;
  }
  const s = await getStore();
  await s.delete(TOKEN_KEY);
  await s.delete(USER_KEY);
  await s.save();
}

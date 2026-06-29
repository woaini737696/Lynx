import { load, Store } from "@tauri-apps/plugin-store";

const STORE_NAME = "lynx-auth.bin";
const TOKEN_KEY = "token";
const USER_KEY = "user";

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

export async function saveAuth(credentials: AuthCredentials): Promise<void> {
  const s = await getStore();
  await s.set(TOKEN_KEY, credentials.token);
  await s.set(USER_KEY, credentials.user);
  await s.save();
}

export async function loadAuth(): Promise<AuthCredentials | null> {
  const s = await getStore();
  const token = await s.get<string>(TOKEN_KEY);
  const user = await s.get<PersistedUser>(USER_KEY);
  if (!token) return null;
  return { token, user: user || { id: "" } };
}

export async function clearAuth(): Promise<void> {
  const s = await getStore();
  await s.delete(TOKEN_KEY);
  await s.delete(USER_KEY);
  await s.save();
}

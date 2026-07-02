// ============ 认证管理 ============
// 基于 zustand + AsyncStorage 的登录状态管理
// 与 Web 端保持一致的 token 机制（JWT Bearer）

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiRequest, ApiError } from './api-client';
import { TOKEN_STORAGE_KEY, USER_STORAGE_KEY, SMS_CODE_COOLDOWN_MS } from '@/config/env';

/** 登录用户信息（与后端 /api/auth/token 返回一致） */
export interface AuthUser {
  id: string;
  username: string;
  role: string;
  displayName: string;
}

/** /api/auth/token 成功响应 */
interface TokenResponse {
  token: string;
  user: AuthUser;
}

/** /api/auth/sms-code 成功响应 */
interface SmsCodeResponse {
  ok: boolean;
  message: string;
  masterCodeEnabled: boolean;
}

/** 认证状态 */
interface AuthState {
  /** JWT token（内存缓存，持久化在 AsyncStorage） */
  token: string | null;
  /** 当前登录用户 */
  user: AuthUser | null;
  /** 是否正在加载（初始化 hydrate 阶段） */
  isLoading: boolean;
  /** 是否已登录 */
  isLoggedIn: boolean;
  /** 登录：手机号 + 验证码 → 获取 token */
  login: (phone: string, code: string) => Promise<void>;
  /** 登出：清除 token 和用户信息 */
  logout: () => Promise<void>;
  /** 从 AsyncStorage 恢复登录状态（App 启动时调用） */
  hydrate: () => Promise<void>;
}

/**
 * 认证状态 store（zustand）。
 * 组件通过 useAuth() 读取登录状态、调用 login/logout。
 */
export const useAuth = create<AuthState>((set) => ({
  token: null,
  user: null,
  isLoading: true,
  isLoggedIn: false,

  login: async (phone, code) => {
    // 调用 /api/auth/token 获取 JWT（非标准响应格式，apiRequest 自动处理）
    const data = await apiRequest<TokenResponse>('/api/auth/token', {
      method: 'POST',
      body: { phone, code },
      skipAuth: true,
    });

    // 持久化到 AsyncStorage
    await AsyncStorage.setItem(TOKEN_STORAGE_KEY, data.token);
    await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(data.user));

    // 更新内存状态
    set({ token: data.token, user: data.user, isLoggedIn: true, isLoading: false });
  },

  logout: async () => {
    await AsyncStorage.removeItem(TOKEN_STORAGE_KEY);
    await AsyncStorage.removeItem(USER_STORAGE_KEY);
    set({ token: null, user: null, isLoggedIn: false });
  },

  hydrate: async () => {
    try {
      const token = await AsyncStorage.getItem(TOKEN_STORAGE_KEY);
      const userJson = await AsyncStorage.getItem(USER_STORAGE_KEY);
      if (token && userJson) {
        const user = JSON.parse(userJson) as AuthUser;
        set({ token, user, isLoggedIn: true, isLoading: false });
      } else {
        set({ token: null, user: null, isLoggedIn: false, isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },
}));

// ============ 独立工具函数 ============

/** 从 AsyncStorage 读取 token（供 api-client 等非组件场景使用） */
export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_STORAGE_KEY);
}

/**
 * 发送短信验证码。
 * @param phone 手机号（11 位）
 * @returns 服务端响应（含 masterCodeEnabled 标识）
 * @throws ApiError 请求失败时抛出（含 429 限流提示）
 */
export async function sendSmsCode(phone: string): Promise<SmsCodeResponse> {
  return apiRequest<SmsCodeResponse>('/api/auth/sms-code', {
    method: 'POST',
    body: { phone },
    skipAuth: true,
  });
}

export { ApiError, SMS_CODE_COOLDOWN_MS };

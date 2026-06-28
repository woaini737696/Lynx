import { create } from "zustand";
import type { PersistedUser, AuthCredentials } from "@/lib/auth-persistence";

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
  setCredentials: (credentials) =>
    set({
      user: credentials?.user ?? null,
      token: credentials?.token ?? null,
    }),
  setLoading: (loading) => set({ loading }),
  setInitialized: (initialized) => set({ initialized }),
  signOut: () => set({ user: null, token: null }),
}));

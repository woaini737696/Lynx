import { create } from "zustand";
import type { Theme } from "@/lib/theme";

interface UIState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

export const useUIStore = create<UIState>((set) => ({
  theme: "system",
  setTheme: (theme) => set({ theme }),
}));

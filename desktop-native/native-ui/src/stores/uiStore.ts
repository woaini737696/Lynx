import { create } from "zustand";
import type { Theme } from "@/lib/theme";

interface UIState {
  sidebarExpanded: boolean;
  theme: Theme;
  setSidebarExpanded: (expanded: boolean) => void;
  toggleSidebar: () => void;
  setTheme: (theme: Theme) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarExpanded: true,
  theme: "system",
  setSidebarExpanded: (expanded) => set({ sidebarExpanded: expanded }),
  toggleSidebar: () => set((state) => ({ sidebarExpanded: !state.sidebarExpanded })),
  setTheme: (theme) => set({ theme }),
}));

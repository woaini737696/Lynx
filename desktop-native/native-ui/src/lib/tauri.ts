import { invoke as tauriInvoke, type InvokeArgs } from "@tauri-apps/api/core";
import { listen as tauriListen, type Event, type UnlistenFn } from "@tauri-apps/api/event";

// Electron 环境检测：preload.js 通过 contextBridge 暴露 window.electronAPI
export function isElectron(): boolean {
  return typeof window !== "undefined" && !!(window as any).electronAPI;
}

export async function invoke<T>(cmd: string, args?: InvokeArgs): Promise<T> {
  // Electron 优先（IPC 桥接到 main.js 的 ipcMain.handle）
  if (isElectron()) {
    return (window as any).electronAPI.invoke(cmd, args) as Promise<T>;
  }
  // Tauri 回退
  try {
    return await tauriInvoke<T>(cmd, args);
  } catch (err) {
    console.error(`[tauri] invoke '${cmd}' failed:`, err);
    throw err instanceof Error ? err : new Error(typeof err === "string" ? err : JSON.stringify(err));
  }
}

export function listen<T>(event: string, handler: (payload: T) => void): Promise<UnlistenFn> {
  // Electron 优先（IPC 桥接到 main.js 的 webContents.send）
  if (isElectron()) {
    const unlisten = (window as any).electronAPI.on(event, handler);
    return Promise.resolve(unlisten as UnlistenFn);
  }
  // Tauri 回退
  return tauriListen<T>(event, (e: Event<T>) => handler(e.payload));
}

export function isTauri() {
  return typeof window !== "undefined" && !!(window as any).__TAURI__;
}

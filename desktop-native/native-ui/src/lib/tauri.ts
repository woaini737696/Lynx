import { invoke as tauriInvoke, type InvokeArgs } from "@tauri-apps/api/core";
import { listen as tauriListen, type Event, type UnlistenFn } from "@tauri-apps/api/event";

export async function invoke<T>(cmd: string, args?: InvokeArgs): Promise<T> {
  try {
    return await tauriInvoke<T>(cmd, args);
  } catch (err) {
    console.error(`[tauri] invoke '${cmd}' failed:`, err);
    // Tauri 2.x 把 Rust 端的 Err(String) reject 为字符串，这里包装成 Error
    // 让上层 catch 能拿到具体错误信息而非显示兜底文案
    throw err instanceof Error ? err : new Error(typeof err === "string" ? err : JSON.stringify(err));
  }
}

export function listen<T>(event: string, handler: (payload: T) => void): Promise<UnlistenFn> {
  return tauriListen<T>(event, (e: Event<T>) => handler(e.payload));
}

export function isTauri() {
  return typeof window !== "undefined" && !!(window as any).__TAURI__;
}

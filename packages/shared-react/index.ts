// @lynnhub/shared-react - React hooks 共享层
// 依赖 @lynnhub/shared（纯 TS 共享层），提供跨端 React hooks
// 依赖 React 但不依赖 DOM/Next.js，通过依赖注入接收平台适配器
//
// 用途：定义跨端共享的 React hooks，Web/RN/Tauri 三端通用
// 各端通过依赖注入实现平台特定逻辑（HTTP/通知/可见性/WS/本地命令执行）

// ============ Hooks ============
export * from "./hooks/useChat";
export * from "./hooks/useDeviceWs";
export * from "./hooks/usePollWhenVisible";
export * from "./hooks/useAsyncLoading";

// ============ Contexts ============
export * from "./contexts/ChatContext";

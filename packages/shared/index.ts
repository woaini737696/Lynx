// @lynnhub/shared - 纯 TypeScript 共享层
// 零平台依赖（无 DOM / 无 Node.js / 无 React），Web/RN/Tauri 三端通用
//
// 用途：定义跨端共享的协议类型、工具函数、平台适配接口
// 各端通过依赖注入实现平台特定逻辑

// ============ 协议定义 ============
export * from "./protocols/ws-protocol";
export * from "./protocols/sse-events";

// ============ 音频工具 ============
export * from "./audio/wav-encoder";

// ============ 平台适配接口 ============
export * from "./interfaces/audio-player";
export * from "./interfaces/audio-capture";
export * from "./interfaces/visibility";
export * from "./interfaces/vad-provider";
export * from "./interfaces/asr-provider";
export * from "./interfaces/tts-provider";
export * from "./interfaces/http-client";

// ============ 通用工具 ============
export * from "./utils/cursor-pagination";
export * from "./utils/sentence-splitter";

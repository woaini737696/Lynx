"use client";

import { createContext, useContext, type ReactNode } from "react";
import {
  useChat,
  type UseChatParams,
  type UseChatReturn,
} from "../hooks/useChat";

// ============ Context ============

const ChatContext = createContext<UseChatReturn | null>(null);

// ============ Provider ============

/**
 * 聊天上下文 Provider
 *
 * 让各端在 App 根节点注入平台适配器后，子组件直接用 useChatContext()
 * 获取聊天能力，无需逐层传递 props。
 *
 * 用法：
 *   <ChatProvider
 *     http={webHttpAdapter}
 *     notify={toast}
 *     endpoints={webEndpoints}
 *     currentSessionId={sessionId}
 *   >
 *     <ChatApp />
 *   </ChatProvider>
 *
 *   // 子组件中：
 *   const { messages, send, thinking } = useChatContext();
 */
export interface ChatProviderProps extends UseChatParams {
  children: ReactNode;
}

export function ChatProvider({ children, ...chatParams }: ChatProviderProps) {
  const chat = useChat(chatParams);
  return (
    <ChatContext.Provider value={chat}>{children}</ChatContext.Provider>
  );
}

// ============ Hook ============

/**
 * 消费聊天上下文
 *
 * 必须在 ChatProvider 内部使用，否则抛出错误。
 */
export function useChatContext(): UseChatReturn {
  const ctx = useContext(ChatContext);
  if (!ctx) {
    throw new Error("useChatContext 必须在 ChatProvider 内部使用");
  }
  return ctx;
}

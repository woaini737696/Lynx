import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// z-index 规范 tokens：统一各层级浮层/弹窗的堆叠顺序，供后续逐步替换硬编码值
export const Z_INDEX = {
  BASE: 0,
  SIDEBAR: 30,
  DROPDOWN: 40,
  STICKY: 50,
  POPOVER: 60,
  MODAL: 70,
  DRAWER: 80,
  TOAST: 100,
  OVERLAY: 120,
  TOOLTIP: 9999,
} as const;

// 看板列配置
export const BOARD_COLUMNS = {
  northstar: { label: "北极星", limit: 3, color: "#f6ad55", icon: "⭐" },
  campaign: { label: "战役", limit: 5, color: "#63b3ed", icon: "⚔️" },
  task: { label: "任务", limit: 10, color: "#68d391", icon: "✓" },
} as const;

export type BoardColumn = keyof typeof BOARD_COLUMNS;

// 认知库类型
export const COGNITION_TYPES = {
  method: { label: "方法论", color: "#f6ad55" },
  experience: { label: "经验", color: "#63b3ed" },
  prompt: { label: "提示词", color: "#a78bfa" },
} as const;

export type CognitionType = keyof typeof COGNITION_TYPES;

// 对话来源
export const CONVERSATION_SOURCES = {
  kimi: { label: "Kimi", color: "#63b3ed", kind: "chat" },
  "trae-solo": { label: "Trae Solo", color: "#4fd1c5", kind: "chat" },
  claude: { label: "Claude", color: "#f6ad55", kind: "chat" },
  codex: { label: "Codex", color: "#68d391", kind: "chat" },
  gpt: { label: "GPT", color: "#a78bfa", kind: "chat" },
  "file-md": { label: "Markdown", color: "#a78bfa", kind: "file" },
  "file-html": { label: "HTML", color: "#fb923c", kind: "file" },
  "file-txt": { label: "文本", color: "#94a3b8", kind: "file" },
  "file-csv": { label: "CSV", color: "#34d399", kind: "file" },
  "file-json": { label: "JSON", color: "#fbbf24", kind: "file" },
  "file-image": { label: "图片", color: "#f472b6", kind: "file" },
  "file-pdf": { label: "PDF", color: "#f87171", kind: "file" },
} as const;

export type ConversationSource = keyof typeof CONVERSATION_SOURCES;

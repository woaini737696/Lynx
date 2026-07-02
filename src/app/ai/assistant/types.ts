import type { LLMProvider } from "@/lib/ai-provider";
import type { ApprovalRequest } from "@/lib/desktop-client";
import { Target, Brain, BookOpen, Zap } from "lucide-react";

export type { LLMProvider, ApprovalRequest };

interface TokenUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

/** 工具调用信息（后端 assistantMode 返回） */
interface ToolCalled {
  tool: string;
  args: Record<string, any>;
  result: any;
}

/** 技能参数定义（与 @/lib/skill-parser 一致） */
interface SkillParameter {
  key: string;
  label: string;
  type: "text" | "textarea" | "select" | "date" | "number";
  required: boolean;
  placeholder?: string;
  options?: string[];
  defaultValue?: string;
}

/** 技能（用于技能选择面板） */
interface Skill {
  id: string;
  name: string;
  description: string;
  category: string;
  content: string;
  parameters: SkillParameter[];
  promptTemplate: string;
  source: string;
  tags: string[];
  usageCount: number;
  createdAt: string;
  updatedAt: string;
  /** Hermes 技能的原始 ID（source=hermes 时使用） */
  originalId?: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  time: string;
  provider?: LLMProvider;
  model?: string;
  error?: boolean;
  usage?: TokenUsage;
  streaming?: boolean;
  images?: string[];
  toolCalled?: ToolCalled | null;
  /** 标记本条回复由 Hermes Agent 生成（模式 C） */
  hermesMode?: boolean;
  /** 标记 Hermes 失败后回退到 LLM 模式生成 */
  hermesFallback?: boolean;
  /** 用户对 AI 回复的标注：good=好回复 | bad=不满意（用于 HermesAgent 学习纠正） */
  feedback?: "good" | "bad" | null;
  /** 不满意标注的原因 */
  feedbackReason?: string | null;
}

interface AISettings {
  assistantName: string;
  assistantAvatar: string;
  avatarUrl: string | null;
  personaStyle: string | null;
  distilledStyle: string | null;
  styleStrength: number;
  clonedVoiceId: string | null;
  clonedVoiceName: string | null;
  clonedAt: string | null;
  defaultVoice: string;
  autoSpeak: boolean;
  voiceMode: boolean;
  feishuNotify: boolean;
  hermesTakeover: boolean;
  hermesAutoReport: boolean;
  hermesReportCron: string;
}

/** 任务模式（Task 7：auto-work） */
interface TaskPatternItem {
  id: string;
  patternKey: string;
  taskTemplate: string;
  executionCount: number;
  autoExecutedCount: number;
  autoExecute: boolean;
  lastExecutedAt: string | null;
  lastAutoResult: string | null;
  matchKeywords: string[];
  createdAt: string;
}

/** 通话阶段：listening 聆听中 / speaking 用户说话中 / thinking AI 思考中 / replying AI 回复中 */
type VoicePhase = "listening" | "speaking" | "thinking" | "replying";

const DEFAULT_SETTINGS: AISettings = {
  assistantName: "Lynn",
  assistantAvatar: "🦊",
  avatarUrl: "/lynx-icon-256.png",
  personaStyle: null,
  distilledStyle: null,
  styleStrength: 0.7,
  clonedVoiceId: null,
  clonedVoiceName: null,
  clonedAt: null,
  defaultVoice: "mimo_default",
  autoSpeak: false,
  voiceMode: false,
  feishuNotify: false,
  hermesTakeover: false,
  hermesAutoReport: false,
  hermesReportCron: "0 9 * * *",
};

const SUGGESTIONS = [
  { icon: Target, text: "今天有哪些任务需要聚焦？", color: "text-northstar" },
  { icon: Brain, text: "帮我分析最近的灵感趋势", color: "text-cognition" },
  { icon: BookOpen, text: "从认知库中找一条方法论", color: "text-cognition" },
  { icon: Zap, text: "快速捕获一条灵感", color: "text-northstar" },
];

export {
  type TokenUsage,
  type ToolCalled,
  type SkillParameter,
  type Skill,
  type Message,
  type AISettings,
  type TaskPatternItem,
  type VoicePhase,
  DEFAULT_SETTINGS,
  SUGGESTIONS,
};

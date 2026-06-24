// 巡检规则模板库：预置常用巡检规则模板，用户可一键应用并自定义

export interface PatrolTemplate {
  id: string;
  name: string;
  description: string;
  scope: "inbox" | "board" | "graveyard" | "all";
  triggerTime: string;
  prompt: string;
  threshold: number;
  notifyChannels: string[];
}

export const PATROL_TEMPLATES: PatrolTemplate[] = [
  {
    id: "weekly-idea-review",
    name: "每周灵感回顾",
    description: "每周一检查Inbox中超过7天未处理的灵感，建议归类或送入墓地",
    scope: "inbox",
    triggerTime: "09:00",
    prompt:
      "分析以下灵感，找出超过7天未处理的，建议：1)拖入看板 2)送入墓地 3)继续保留。输出JSON: [{itemId, action, reason}]",
    threshold: 0.7,
    notifyChannels: ["toast", "notification"],
  },
  {
    id: "board-stagnation",
    name: "看板停滞检测",
    description: "检查看板上超过14天未完成的任务，提醒推进或放弃",
    scope: "board",
    triggerTime: "10:00",
    prompt:
      "分析以下看板任务，找出超过14天未更新的停滞任务，建议：1)继续推进 2)降级 3)放弃。输出JSON: [{itemId, action, reason}]",
    threshold: 0.7,
    notifyChannels: ["toast", "notification"],
  },
  {
    id: "graveyard-revive",
    name: "墓地复活检查",
    description: "检查墓地中的灵感是否满足复活条件",
    scope: "graveyard",
    triggerTime: "10:00",
    prompt:
      "分析以下墓地灵感和它们的复活条件，检查最近7天的新灵感是否满足复活条件。输出JSON: [{itemId, matched, reason}]",
    threshold: 0.75,
    notifyChannels: ["toast", "notification", "push"],
  },
  {
    id: "daily-summary",
    name: "每日总结巡检",
    description: "每天晚上汇总今日灵感、任务完成情况、认知提取",
    scope: "all",
    triggerTime: "21:00",
    prompt:
      "汇总今日数据：1)新增灵感数 2)完成任务数 3)提取认知数 4)建议明日聚焦的3件事。输出JSON: {ideasAdded, tasksCompleted, cognitionsExtracted, suggestions: []}",
    threshold: 0.5,
    notifyChannels: ["toast", "notification"],
  },
];

// 根据 id 查找模板
export function getPatrolTemplate(
  id: string
): PatrolTemplate | undefined {
  return PATROL_TEMPLATES.find((t) => t.id === id);
}

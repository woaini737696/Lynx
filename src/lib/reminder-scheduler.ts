// 灵感助理 - 提醒调度器
// 前端定时检查（每分钟），根据规则触发双通道通知（应用内 + 浏览器 Notification）
// 支持从数据库 PatrolRule 加载动态规则

export type ReminderRuleId = "inbox-reminder" | "revive-check" | `patrol:${string}`;

export interface ReminderRule {
  id: ReminderRuleId;
  label: string;
  description: string;
  enabled: boolean;
  // 触发时间（24h 制，HH:MM 格式）
  time: string;
  // 上次触发日期（YYYY-MM-DD），避免一天内重复触发
  lastTriggered?: string;
  // 动态规则关联的 PatrolRule ID（仅 patrol: 前缀的规则有值）
  patrolRuleId?: string;
}

export const DEFAULT_RULES: ReminderRule[] = [
  {
    id: "inbox-reminder",
    label: "Inbox 未处理提醒",
    description: "每晚 23:00 检查 Inbox 是否有未处理灵感",
    enabled: true,
    time: "23:00",
  },
  {
    id: "revive-check",
    label: "AI 巡检复活条件",
    description: "每天 10:00 检查灵感墓地的复活条件是否被新灵感命中",
    enabled: true,
    time: "10:00",
  },
];

export const REMINDER_RULES_KEY = "lynnhub:reminder-rules";
export const REMINDER_HISTORY_KEY = "lynnhub:reminder-history";
export const REMINDER_HISTORY_LIMIT = 20;

export interface ReminderHistoryItem {
  id: string;
  ruleId: ReminderRuleId;
  ruleLabel: string;
  message: string;
  triggeredAt: string; // ISO
  details?: ReviveSuggestion[];
}

export interface ReviveSuggestion {
  graveyardId: string;
  ideaId: string;
  originalContent: string;
  reason: string;
  reviveCondition: string;
  matchedContent: string;
  matchedIdeaId: string;
}

// ---- localStorage 读写 ----

export function loadReminderRules(): ReminderRule[] {
  if (typeof window === "undefined") return DEFAULT_RULES;
  try {
    const raw = localStorage.getItem(REMINDER_RULES_KEY);
    if (!raw) return DEFAULT_RULES;
    const parsed = JSON.parse(raw) as ReminderRule[];
    // 合并默认值（防止新增规则缺失），仅保留默认规则和 patrol: 前缀的动态规则
    const map = new Map(parsed.map((r) => [r.id, r]));
    const defaultRules = DEFAULT_RULES.map((d) => ({ ...d, ...map.get(d.id) }));
    // 保留动态规则（patrol: 前缀）
    const dynamicRules = parsed.filter((r) => r.id.startsWith("patrol:"));
    return [...defaultRules, ...dynamicRules];
  } catch {
    return DEFAULT_RULES;
  }
}

export function saveReminderRules(rules: ReminderRule[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(REMINDER_RULES_KEY, JSON.stringify(rules));
  } catch {
    // ignore
  }
}

/**
 * 从数据库 PatrolRule 加载动态规则，合并到本地规则列表
 * 仅加载 enabled=true 且 triggerTime != "manual" 的规则
 * 调用方应在合并后调用 saveReminderRules 持久化
 */
export async function loadDynamicPatrolRules(): Promise<ReminderRule[]> {
  if (typeof window === "undefined") return [];
  try {
    const res = await fetch("/api/patrol/rules");
    if (!res.ok) return [];
    const data = await res.json();
    const rules: Array<{
      id: string;
      name: string;
      description: string;
      triggerTime: string;
      enabled: boolean;
    }> = data.rules || [];
    return rules
      .filter((r) => r.enabled && r.triggerTime && r.triggerTime !== "manual")
      .map((r) => ({
        id: `patrol:${r.id}` as ReminderRuleId,
        label: r.name,
        description: r.description || "",
        enabled: true,
        time: r.triggerTime,
        patrolRuleId: r.id,
      }));
  } catch {
    return [];
  }
}

/**
 * 合并本地规则与数据库动态规则
 * 保留本地默认规则的 lastTriggered 状态，动态规则以数据库为准
 */
export async function mergeDynamicRules(
  localRules: ReminderRule[]
): Promise<ReminderRule[]> {
  const dynamicRules = await loadDynamicPatrolRules();
  // 保留本地默认规则
  const defaultRules = localRules.filter((r) => !r.id.startsWith("patrol:"));
  // 保留动态规则的 lastTriggered 状态
  const localDynamicMap = new Map(
    localRules
      .filter((r) => r.id.startsWith("patrol:"))
      .map((r) => [r.patrolRuleId, r.lastTriggered])
  );
  const mergedDynamic = dynamicRules.map((r) => ({
    ...r,
    lastTriggered: localDynamicMap.get(r.patrolRuleId),
  }));
  return [...defaultRules, ...mergedDynamic];
}

export function loadReminderHistory(): ReminderHistoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(REMINDER_HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ReminderHistoryItem[];
  } catch {
    return [];
  }
}

export function saveReminderHistory(history: ReminderHistoryItem[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      REMINDER_HISTORY_KEY,
      JSON.stringify(history.slice(0, REMINDER_HISTORY_LIMIT))
    );
  } catch {
    // ignore
  }
}

// ---- 时间工具 ----

function todayKey(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function nowHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// 判断当前时间是否匹配规则时间（精确到分钟）
function shouldTrigger(rule: ReminderRule): boolean {
  if (!rule.enabled) return false;
  const today = todayKey();
  if (rule.lastTriggered === today) return false;
  const now = nowHHMM();
  // 当前时间 >= 规则时间即触发（允许延迟，但一天只触发一次）
  return now >= rule.time;
}

// 标记规则已触发
export function markRuleTriggered(rules: ReminderRule[], ruleId: ReminderRuleId): ReminderRule[] {
  const today = todayKey();
  return rules.map((r) => (r.id === ruleId ? { ...r, lastTriggered: today } : r));
}

// ---- 通知发送 ----

export type NotificationChannel = "app" | "browser";

export function sendNotification(
  title: string,
  message: string,
  channels: NotificationChannel[] = ["app", "browser"]
): void {
  // 应用内通知通过 toast（由调用方实现，这里只处理浏览器通知）
  if (channels.includes("browser") && typeof window !== "undefined" && "Notification" in window) {
    if (Notification.permission === "granted") {
      try {
        new Notification(title, {
          body: message,
          icon: "/favicon.ico",
          tag: `lynnhub-${Date.now()}`,
        });
      } catch {
        // 某些浏览器在 SW 不可用时可能抛错，忽略
      }
    }
  }

  // 额外尝试 Web Push 推送：调用服务端 /api/push/test 触发，
  // 服务端会向当前用户的所有订阅设备发送推送（即使本页面关闭，其他设备也能收到）
  if (channels.includes("browser") && typeof window !== "undefined") {
    // fire-and-forget，不阻塞调用方
    fetch("/api/push/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, body: message }),
    }).catch(() => {
      // 推送失败静默忽略（可能未订阅或 VAPID 未配置）
    });
  }
}

// 请求浏览器通知权限
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "denied";
  }
  if (Notification.permission === "granted") return "granted";
  try {
    return await Notification.requestPermission();
  } catch {
    return "denied";
  }
}

// ---- 检查逻辑 ----

export interface ReminderCheckResult {
  ruleId: ReminderRuleId;
  triggered: boolean;
  message: string;
  details?: ReviveSuggestion[];
}

// 检查 Inbox 未处理灵感数量
async function checkInboxReminder(): Promise<ReminderCheckResult> {
  try {
    const res = await fetch("/api/ideas?limit=1");
    if (!res.ok) {
      return { ruleId: "inbox-reminder", triggered: false, message: "" };
    }
    const data = await res.json();
    // 兼容分页响应 { data, total } 与旧格式 { ideas }
    const count =
      (typeof data.total === "number" ? data.total : 0) ||
      (Array.isArray(data.data) ? data.data.length : 0) ||
      (Array.isArray(data.ideas) ? data.ideas.length : 0);
    if (count > 0) {
      return {
        ruleId: "inbox-reminder",
        triggered: true,
        message: `Inbox 还有 ${count} 条未处理灵感，建议今晚 23:00 前收敛`,
      };
    }
    return { ruleId: "inbox-reminder", triggered: false, message: "" };
  } catch {
    return { ruleId: "inbox-reminder", triggered: false, message: "" };
  }
}

// 检查墓地复活条件
async function checkReviveReminder(): Promise<ReminderCheckResult> {
  try {
    const res = await fetch("/api/ideas/revive-check");
    if (!res.ok) {
      return { ruleId: "revive-check", triggered: false, message: "" };
    }
    const data = await res.json();
    const suggestions: ReviveSuggestion[] = data.suggestions || [];
    if (suggestions.length > 0) {
      return {
        ruleId: "revive-check",
        triggered: true,
        message: `AI 巡检发现 ${suggestions.length} 条灵感可能命中复活条件，建议复查`,
        details: suggestions,
      };
    }
    return { ruleId: "revive-check", triggered: false, message: "" };
  } catch {
    return { ruleId: "revive-check", triggered: false, message: "" };
  }
}

// 检查动态巡检规则（调用 /api/patrol/run）
async function checkPatrolRule(
  rule: ReminderRule
): Promise<ReminderCheckResult> {
  if (!rule.patrolRuleId) {
    return { ruleId: rule.id, triggered: false, message: "" };
  }
  try {
    const res = await fetch("/api/patrol/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ruleId: rule.patrolRuleId }),
    });
    if (!res.ok) {
      return { ruleId: rule.id, triggered: false, message: "" };
    }
    const data = await res.json();
    const hitCount = data.hitCount || 0;
    if (hitCount > 0) {
      return {
        ruleId: rule.id,
        triggered: true,
        message: `巡检「${rule.label}」命中 ${hitCount} 项，建议查看`,
      };
    }
    return { ruleId: rule.id, triggered: false, message: "" };
  } catch {
    return { ruleId: rule.id, triggered: false, message: "" };
  }
}

// 主检查函数：遍历所有规则，触发到期的检查
// 同时检查数据库动态规则（patrol: 前缀）
export async function runReminderCheck(
  rules: ReminderRule[]
): Promise<{ results: ReminderCheckResult[]; updatedRules: ReminderRule[] }> {
  const results: ReminderCheckResult[] = [];
  let updatedRules = rules;

  // 先合并数据库动态规则
  try {
    updatedRules = await mergeDynamicRules(updatedRules);
  } catch {
    // 合并失败时使用本地规则
  }

  for (const rule of updatedRules) {
    if (!shouldTrigger(rule)) continue;

    let result: ReminderCheckResult;
    if (rule.id === "inbox-reminder") {
      result = await checkInboxReminder();
    } else if (rule.id === "revive-check") {
      result = await checkReviveReminder();
    } else if (rule.id.startsWith("patrol:") && rule.patrolRuleId) {
      result = await checkPatrolRule(rule);
    } else {
      continue;
    }

    // 无论是否触发通知，都标记规则已执行
    updatedRules = markRuleTriggered(updatedRules, rule.id);
    results.push(result);
  }

  // 持久化更新后的规则（含 lastTriggered 状态）
  saveReminderRules(updatedRules);

  return { results, updatedRules };
}

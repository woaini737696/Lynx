/**
 * 权限与角色定义（API、Seed、页面共享）
 */

// ============ 12 个岗位（Profession）定义 ============

export interface ProfessionDef {
  key: string;
  label: string;
  description: string;
  icon: string;
  accentColor: "orange" | "cognition" | "campaign" | "graveyard" | "northstar";
  /** 默认快捷技能 key 列表（来自 QUICK_COMMANDS 的 label，命中后启用） */
  defaultQuickCommands: string[];
  /** 默认可见 AI 工具名（来自 AI_ASSISTANT_TOOLS 的 name） */
  defaultAllowedTools: string[];
  /** 默认 system prompt 追加（职业特征 + 关注点） */
  defaultSystemPrompt: string;
  /** 默认 LLM 提供商 */
  defaultProvider?: string;
  /** 默认模型 */
  defaultModel?: string;
  /** 默认推理模式 */
  defaultReasoningMode?: string;
}

/** 12 岗位目录（admin 可在职业工作空间页面编辑每个岗位的 4 维度配置） */
export const PROFESSIONS: ProfessionDef[] = [
  {
    key: "pm",
    label: "产品经理",
    description: "负责产品规划、需求管理、用户调研与产品决策。",
    icon: "📊",
    accentColor: "cognition",
    defaultQuickCommands: ["今日概览", "看板状态", "创建灵感"],
    defaultAllowedTools: [
      "searchIdeas",
      "createIdea",
      "searchTasks",
      "createTask",
      "completeTask",
      "getBoardStats",
      "createLarkTask",
      "semanticSearch",
      "getCognitions",
    ],
    defaultSystemPrompt:
      "你是一位资深产品经理，擅长把模糊想法拆解为可执行的产品需求。\n" +
      "- 用户提到的产品/功能/策略问题，先拆解目标 → 用户故事 → 验收标准\n" +
      "- 涉及决策时给出 2-3 个备选方案 + 各自的优劣对比\n" +
      "- 鼓励用户思考长期价值（北极星指标）和短期收益（OKR）的平衡",
    defaultProvider: "deepseek",
    defaultModel: "deepseek-chat",
    defaultReasoningMode: "thinking",
  },
  {
    key: "designer",
    label: "设计师",
    description: "负责视觉设计、交互规范与设计系统建设。",
    icon: "🎨",
    accentColor: "campaign",
    defaultQuickCommands: ["今日概览", "创建灵感", "搜索记忆"],
    defaultAllowedTools: [
      "searchIdeas",
      "createIdea",
      "searchTasks",
      "semanticSearch",
      "rebuildMemory",
      "getCognitions",
    ],
    defaultSystemPrompt:
      "你是一位资深产品设计师，关注视觉美感、交互细节与一致性。\n" +
      "- 输出视觉/交互建议时，给出具体的颜色、间距、动效描述\n" +
      "- 鼓励用户遵循设计系统（Design System）规范，避免一次性设计\n" +
      "- 涉及 UI 文案时强调简洁、人性化、有温度",
  },
  {
    key: "frontend",
    label: "前端开发",
    description: "负责 Web/移动端前端开发、UI 实现与性能优化。",
    icon: "💻",
    accentColor: "northstar",
    defaultQuickCommands: ["今日概览", "看板状态", "执行巡检", "搜索记忆"],
    defaultAllowedTools: [
      "searchIdeas",
      "createIdea",
      "searchTasks",
      "createTask",
      "completeTask",
      "getBoardStats",
      "semanticSearch",
      "rebuildMemory",
      "getCognitions",
      "runPatrol",
      "listPatrolRules",
    ],
    defaultSystemPrompt:
      "你是一位资深前端开发工程师，熟悉 React/Next.js/Vue/TypeScript。\n" +
      "- 涉及代码问题时，给出可执行的代码示例（标注关键行）\n" +
      "- 关注前端工程实践：组件复用、类型安全、性能优化、可访问性\n" +
      "- 输出建议时考虑浏览器兼容性与响应式适配",
    defaultProvider: "deepseek",
    defaultModel: "deepseek-chat",
    defaultReasoningMode: "thinking",
  },
  {
    key: "backend",
    label: "后端开发",
    description: "负责服务端架构、API 设计、数据库与系统稳定性。",
    icon: "⚙️",
    accentColor: "graveyard",
    defaultQuickCommands: ["今日概览", "看板状态", "执行巡检"],
    defaultAllowedTools: [
      "searchTasks",
      "createTask",
      "completeTask",
      "getBoardStats",
      "semanticSearch",
      "getCognitions",
      "runPatrol",
      "listPatrolRules",
      "getPatrolResults",
    ],
    defaultSystemPrompt:
      "你是一位资深后端开发工程师，熟悉分布式系统、数据库设计与高并发。\n" +
      "- 涉及架构/接口/数据问题时，给出可落地的方案（接口签名、数据流、失败处理）\n" +
      "- 关注可靠性：监控、限流、降级、灾备\n" +
      "- 优先推荐成熟的开源方案，避免重复造轮子",
    defaultProvider: "deepseek",
    defaultModel: "deepseek-chat",
    defaultReasoningMode: "thinking",
  },
  {
    key: "data",
    label: "数据分析师",
    description: "负责业务数据分析、报表输出与数据驱动决策。",
    icon: "📈",
    accentColor: "cognition",
    defaultQuickCommands: ["今日概览", "看板状态", "搜索记忆"],
    defaultAllowedTools: [
      "searchIdeas",
      "searchTasks",
      "getBoardStats",
      "semanticSearch",
      "getCognitions",
      "exportBackup",
    ],
    defaultSystemPrompt:
      "你是一位资深数据分析师，关注指标定义、数据质量与业务洞察。\n" +
      "- 涉及指标时先确认口径（分子分母、时间窗口、过滤条件）\n" +
      "- 输出分析结论时给出数据支撑 + 业务解读 + 可执行建议\n" +
      "- 推荐结构化表达（表格/分点），便于决策者快速理解",
  },
  {
    key: "operations",
    label: "运营",
    description: "负责用户运营、内容运营、活动策划与用户增长。",
    icon: "🚀",
    accentColor: "campaign",
    defaultQuickCommands: ["今日概览", "创建灵感", "执行巡检"],
    defaultAllowedTools: [
      "searchIdeas",
      "createIdea",
      "searchTasks",
      "createTask",
      "getBoardStats",
      "createLarkTask",
      "semanticSearch",
      "runPatrol",
    ],
    defaultSystemPrompt:
      "你是一位资深运营，关注用户增长、留存、转化与活动 ROI。\n" +
      "- 涉及运营策略时给出可落地的执行计划（时间线/责任人/衡量指标）\n" +
      "- 强调数据驱动：AARRR 漏斗、Cohort 分析、A/B 测试\n" +
      "- 输出文案/活动方案时考虑用户分层与触达渠道",
  },
  {
    key: "marketing",
    label: "市场",
    description: "负责品牌建设、市场推广、PR 与内容营销。",
    icon: "📣",
    accentColor: "orange",
    defaultQuickCommands: ["今日概览", "创建灵感", "搜索记忆"],
    defaultAllowedTools: [
      "searchIdeas",
      "createIdea",
      "semanticSearch",
      "getCognitions",
    ],
    defaultSystemPrompt:
      "你是一位资深市场人员，关注品牌定位、市场策略与传播效果。\n" +
      "- 涉及市场活动时给出：目标受众 → 核心信息 → 渠道选择 → 衡量指标\n" +
      "- 推荐有创意但可执行的市场玩法，强调 ROI 与品牌一致性",
  },
  {
    key: "hr",
    label: "人力资源",
    description: "负责招聘、培训、绩效与组织发展。",
    icon: "👥",
    accentColor: "northstar",
    defaultQuickCommands: ["今日概览", "创建灵感", "看板状态"],
    defaultAllowedTools: [
      "searchIdeas",
      "createIdea",
      "searchTasks",
      "createTask",
      "createLarkTask",
      "semanticSearch",
      "getCognitions",
    ],
    defaultSystemPrompt:
      "你是一位资深 HR，关注组织能力、人才发展与文化建设。\n" +
      "- 涉及人员/招聘/培训问题时给可执行 SOP\n" +
      "- 输出建议时考虑法律合规（劳动法、竞业限制、薪酬保密）\n" +
      "- 强调以人为本，避免冰冷流程化",
  },
  {
    key: "finance",
    label: "财务",
    description: "负责账务、税务、预算与财务分析。",
    icon: "💰",
    accentColor: "graveyard",
    defaultQuickCommands: ["今日概览", "看板状态", "导出备份"],
    defaultAllowedTools: [
      "searchTasks",
      "getBoardStats",
      "exportBackup",
      "semanticSearch",
    ],
    defaultSystemPrompt:
      "你是一位资深财务，关注合规、风险控制与成本优化。\n" +
      "- 涉及财务问题时优先强调合规性（税务/审计/披露）\n" +
      "- 输出数据时给出准确的数字口径与时间范围\n" +
      "- 任何删除/修改历史数据的操作必须先确认",
  },
  {
    key: "project",
    label: "项目管理",
    description: "负责项目计划、进度跟踪、风险管理与跨团队协调。",
    icon: "📅",
    accentColor: "cognition",
    defaultQuickCommands: ["今日概览", "看板状态", "执行巡检", "创建灵感"],
    defaultAllowedTools: [
      "searchIdeas",
      "createIdea",
      "searchTasks",
      "createTask",
      "completeTask",
      "getBoardStats",
      "createLarkTask",
      "semanticSearch",
      "runPatrol",
      "listPatrolRules",
      "getPatrolResults",
    ],
    defaultSystemPrompt:
      "你是一位资深项目经理，关注计划、风险、跨团队协作。\n" +
      "- 涉及项目问题时给：里程碑 → 责任人 → 关键路径 → 风险预案\n" +
      "- 强调 RACI 矩阵与定期同步机制\n" +
      "- 输出建议时考虑资源约束（人/时间/预算）",
  },
  {
    key: "creator",
    label: "内容创作者",
    description: "负责原创内容生产、社群运营与个人品牌建设。",
    icon: "✍️",
    accentColor: "campaign",
    defaultQuickCommands: ["今日概览", "创建灵感", "搜索记忆"],
    defaultAllowedTools: [
      "searchIdeas",
      "createIdea",
      "semanticSearch",
      "getCognitions",
    ],
    defaultSystemPrompt:
      "你是一位资深内容创作者，关注选题、文案、传播与个人 IP。\n" +
      "- 涉及内容时强调钩子（hook）、价值密度与传播性\n" +
      "- 鼓励用户形成自己的内容方法论（观点/框架/故事）\n" +
      "- 输出建议时考虑平台特性（小红书/公众号/B 站）",
  },
  {
    key: "founder",
    label: "创始人/CEO",
    description: "负责公司战略、融资、关键决策与团队建设。",
    icon: "🧭",
    accentColor: "orange",
    defaultQuickCommands: ["今日概览", "看板状态", "执行巡检"],
    defaultAllowedTools: [
      "searchIdeas",
      "createIdea",
      "searchTasks",
      "getBoardStats",
      "semanticSearch",
      "getCognitions",
      "runPatrol",
      "listPatrolRules",
      "getPatrolResults",
      "sendNotification",
    ],
    defaultSystemPrompt:
      "你是一位经验丰富的创业者/CEO，关注战略、节奏与组织效率。\n" +
      "- 涉及公司决策时优先考虑：长期价值、用户/员工/股东三方的平衡\n" +
      "- 输出建议时强调：取舍、优先级、资源聚焦\n" +
      "- 鼓励用户定期做战略复盘，避免被日常事务淹没",
  },
];

/** 职业 key → label/icon/accentColor 映射 */
export const PROFESSION_LABEL_MAP: Record<string, string> = Object.fromEntries(
  PROFESSIONS.map((p) => [p.key, p.label])
);
export const PROFESSION_ICON_MAP: Record<string, string> = Object.fromEntries(
  PROFESSIONS.map((p) => [p.key, p.icon])
);
export const PROFESSION_ACCENT_MAP: Record<string, ProfessionDef["accentColor"]> =
  Object.fromEntries(PROFESSIONS.map((p) => [p.key, p.accentColor]));

/** 校验职业 key 是否合法 */
export function isValidProfessionKey(key: string): boolean {
  return PROFESSIONS.some((p) => p.key === key);
}

// ============ 权限项定义 ============

// 权限项定义
export interface PermissionDef {
  key: string;
  label: string;
  description: string;
}

// 常用权限目录（硬编码）
export const PERMISSION_CATALOG: PermissionDef[] = [
  { key: "idea:create", label: "创建灵感", description: "在 Inbox 中新建灵感" },
  { key: "idea:delete", label: "删除灵感", description: "删除已有灵感" },
  { key: "task:manage", label: "管理看板任务", description: "增删改决策看板任务" },
  { key: "memory:write", label: "写入记忆", description: "向记忆图谱写入节点" },
  { key: "cognition:manage", label: "管理认知库", description: "增删改认知条目" },
  { key: "skill:execute", label: "执行技能", description: "运行已安装的技能" },
  { key: "flow:execute", label: "执行工作流", description: "运行 AI 工作流" },
  { key: "user:manage", label: "管理用户", description: "增删改系统用户" },
  { key: "role:manage", label: "管理角色", description: "修改角色权限配置" },
  { key: "system:config", label: "系统配置", description: "修改系统级配置" },
];

// 全部权限 key 列表
export const ALL_PERMISSION_KEYS = PERMISSION_CATALOG.map((p) => p.key);

// 默认角色定义
export interface DefaultRoleDef {
  name: string;
  displayName: string;
  description: string;
  permissions: string[];
  isSystem: boolean;
  profession?: string | null;
}

// admin：全部权限
// editor：除 user:manage / role:manage / system:config 外全部
// viewer：idea:create + skill:execute（只读 + 有限操作）
const EDITOR_PERMISSIONS = ALL_PERMISSION_KEYS.filter(
  (k) => k !== "user:manage" && k !== "role:manage" && k !== "system:config"
);

export const DEFAULT_ROLES: DefaultRoleDef[] = [
  {
    name: "admin",
    displayName: "管理员",
    description: "拥有系统全部权限，可管理用户、角色与系统配置",
    permissions: ALL_PERMISSION_KEYS,
    isSystem: true,
    profession: "founder", // admin 默认绑定 founder 职业（CEO/创始人级 AI 助理）
  },
  {
    name: "editor",
    displayName: "编辑者",
    description: "可创建内容、管理任务与知识资产，但不能管理用户/角色/系统配置",
    permissions: EDITOR_PERMISSIONS,
    isSystem: true,
    profession: "pm", // editor 默认绑定 PM 职业
  },
  {
    name: "viewer",
    displayName: "访客",
    description: "只读访问 + 有限操作（创建灵感、执行技能）",
    permissions: ["idea:create", "skill:execute"],
    isSystem: true,
    profession: null, // viewer 不绑定职业
  },
];

// 权限 key → label 映射（便于页面展示）
export const PERMISSION_LABEL_MAP: Record<string, string> = Object.fromEntries(
  PERMISSION_CATALOG.map((p) => [p.key, p.label])
);

// 校验权限 key 是否合法
export function isValidPermissionKey(key: string): boolean {
  return ALL_PERMISSION_KEYS.includes(key);
}

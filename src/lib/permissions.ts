/**
 * 权限与角色定义（API、Seed、页面共享）
 */

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
  },
  {
    name: "editor",
    displayName: "编辑者",
    description: "可创建内容、管理任务与知识资产，但不能管理用户/角色/系统配置",
    permissions: EDITOR_PERMISSIONS,
    isSystem: true,
  },
  {
    name: "viewer",
    displayName: "访客",
    description: "只读访问 + 有限操作（创建灵感、执行技能）",
    permissions: ["idea:create", "skill:execute"],
    isSystem: true,
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

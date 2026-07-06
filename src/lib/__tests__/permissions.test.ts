// 权限与角色定义单元测试
import { describe, it, expect } from "vitest";
import {
  PROFESSIONS,
  PERMISSION_CATALOG,
  ALL_PERMISSION_KEYS,
  DEFAULT_ROLES,
  PROFESSION_LABEL_MAP,
  PROFESSION_ICON_MAP,
  PROFESSION_ACCENT_MAP,
  isValidProfessionKey,
  isValidPermissionKey,
  PERMISSION_LABEL_MAP,
} from "../permissions";

describe("PROFESSIONS 职业", () => {
  it("应有 12 个职业", () => {
    expect(PROFESSIONS).toHaveLength(12);
  });

  it("每个职业应包含必填字段", () => {
    for (const p of PROFESSIONS) {
      expect(p.key).toBeTruthy();
      expect(p.label).toBeTruthy();
      expect(p.description).toBeTruthy();
      expect(p.icon).toBeTruthy();
      expect(p.accentColor).toBeTruthy();
      expect(Array.isArray(p.defaultQuickCommands)).toBe(true);
      expect(Array.isArray(p.defaultAllowedTools)).toBe(true);
      expect(typeof p.defaultSystemPrompt).toBe("string");
    }
  });

  it("职业 key 应唯一", () => {
    const keys = PROFESSIONS.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("accentColor 应为允许的值", () => {
    const allowed = ["orange", "cognition", "campaign", "graveyard", "northstar"];
    for (const p of PROFESSIONS) {
      expect(allowed).toContain(p.accentColor);
    }
  });
});

describe("PROFESSION_LABEL_MAP / ICON_MAP / ACCENT_MAP", () => {
  it("映射应覆盖所有职业 key", () => {
    for (const p of PROFESSIONS) {
      expect(PROFESSION_LABEL_MAP[p.key]).toBe(p.label);
      expect(PROFESSION_ICON_MAP[p.key]).toBe(p.icon);
      expect(PROFESSION_ACCENT_MAP[p.key]).toBe(p.accentColor);
    }
  });
});

describe("isValidProfessionKey", () => {
  it("存在的 key 应返回 true", () => {
    expect(isValidProfessionKey("pm")).toBe(true);
    expect(isValidProfessionKey("designer")).toBe(true);
    expect(isValidProfessionKey("founder")).toBe(true);
  });

  it("不存在的 key 应返回 false", () => {
    expect(isValidProfessionKey("")).toBe(false);
    expect(isValidProfessionKey("xxx")).toBe(false);
    expect(isValidProfessionKey("PM")).toBe(false); // 大小写敏感
  });
});

describe("PERMISSION_CATALOG 权限目录", () => {
  it("权限项应非空", () => {
    expect(PERMISSION_CATALOG.length).toBeGreaterThan(50);
  });

  it("每个权限项应包含 key/label/description/group", () => {
    for (const p of PERMISSION_CATALOG) {
      expect(p.key).toBeTruthy();
      expect(p.label).toBeTruthy();
      expect(p.description).toBeTruthy();
      expect(p.group).toBeTruthy();
    }
  });

  it("权限 key 应唯一", () => {
    const keys = PERMISSION_CATALOG.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("权限 key 应遵循 module:action 格式", () => {
    // 允许多段冒号（如 ai:tool:use、c-user:manage、user:profile:edit）
    for (const p of PERMISSION_CATALOG) {
      expect(p.key).toMatch(/^[a-z][a-z-]*(:[a-z][a-z-]*)+$/);
    }
  });

  it("ALL_PERMISSION_KEYS 长度应等于 PERMISSION_CATALOG", () => {
    expect(ALL_PERMISSION_KEYS.length).toBe(PERMISSION_CATALOG.length);
  });

  it("PERMISSION_LABEL_MAP 应覆盖所有权限", () => {
    for (const p of PERMISSION_CATALOG) {
      expect(PERMISSION_LABEL_MAP[p.key]).toBe(p.label);
    }
  });
});

describe("isValidPermissionKey", () => {
  it("存在的 key 应返回 true", () => {
    expect(isValidPermissionKey("idea:create")).toBe(true);
    expect(isValidPermissionKey("user:manage")).toBe(true);
  });

  it("不存在的 key 应返回 false", () => {
    expect(isValidPermissionKey("")).toBe(false);
    expect(isValidPermissionKey("idea:xxx")).toBe(false);
    expect(isValidPermissionKey("xxx:create")).toBe(false);
  });
});

describe("DEFAULT_ROLES 默认角色", () => {
  it("应包含 admin / editor / viewer 三个系统角色", () => {
    const names = DEFAULT_ROLES.map((r) => r.name);
    expect(names).toContain("admin");
    expect(names).toContain("editor");
    expect(names).toContain("viewer");
    expect(DEFAULT_ROLES.every((r) => r.isSystem === true)).toBe(true);
  });

  it("admin 应拥有全部权限", () => {
    const admin = DEFAULT_ROLES.find((r) => r.name === "admin")!;
    expect(admin.permissions.length).toBe(ALL_PERMISSION_KEYS.length);
    // 全部权限 key 都应存在
    for (const k of ALL_PERMISSION_KEYS) {
      expect(admin.permissions).toContain(k);
    }
  });

  it("viewer 不应包含任何 admin-only 权限", () => {
    const adminOnly = [
      "user:manage",
      "c-user:manage",
      "role:manage",
      "system:config",
      "token:stats",
      "system:diagnostics",
      "profession:manage",
      "backup:import",
      "ai:settings",
      "ai:workspace:manage",
      "membership:manage",
      "wallet:manage",
      "hermes:install",
      "hermes:remote-command",
      "hermes:pattern:manage",
      "lark:bot:test",
      "flow:manage",
      "ai:distill:manage",
      "graveyard:manage",
    ];
    const viewer = DEFAULT_ROLES.find((r) => r.name === "viewer")!;
    for (const k of adminOnly) {
      expect(viewer.permissions).not.toContain(k);
    }
  });

  it("editor 应包含除 admin-only 外的全部权限", () => {
    const editor = DEFAULT_ROLES.find((r) => r.name === "editor")!;
    // editor 至少包含 50 个权限
    expect(editor.permissions.length).toBeGreaterThan(50);
    // editor 不应包含 user:manage（admin only）
    expect(editor.permissions).not.toContain("user:manage");
    // editor 应包含 idea:create（普通权限）
    expect(editor.permissions).toContain("idea:create");
  });

  it("所有角色的权限都应在 ALL_PERMISSION_KEYS 范围内", () => {
    for (const role of DEFAULT_ROLES) {
      for (const perm of role.permissions) {
        expect(ALL_PERMISSION_KEYS).toContain(perm);
      }
    }
  });

  it("admin 应绑定 founder 职业", () => {
    const admin = DEFAULT_ROLES.find((r) => r.name === "admin")!;
    expect(admin.profession).toBe("founder");
  });

  it("viewer 应不绑定职业", () => {
    const viewer = DEFAULT_ROLES.find((r) => r.name === "viewer")!;
    expect(viewer.profession).toBeNull();
  });
});

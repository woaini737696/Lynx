import { describe, it, expect, vi } from "vitest";

// Mock 依赖以避免加载 prisma / next-auth 带来的副作用
vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
  },
}));
vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

import { buildUserFilter, type AuthUser } from "@/lib/auth-utils";

describe("buildUserFilter", () => {
  it("admin 用户返回空对象（全局视图）", () => {
    const admin: AuthUser = { id: "u1", username: "admin", role: "admin", permissionVersion: 0 };
    expect(buildUserFilter(admin)).toEqual({});
  });

  it("非 admin 用户返回 { userId: user.id }（仅看自己数据）", () => {
    const editor: AuthUser = { id: "u2", username: "editor", role: "editor", permissionVersion: 0 };
    expect(buildUserFilter(editor)).toEqual({ userId: "u2" });
  });

  it("viewer 角色同样受限为只看自己数据", () => {
    const viewer: AuthUser = { id: "u3", username: "viewer", role: "viewer", permissionVersion: 0 };
    expect(buildUserFilter(viewer)).toEqual({ userId: "u3" });
  });

  it("admin 的 filter 不包含 userId 字段", () => {
    const admin: AuthUser = { id: "u1", username: "admin", role: "admin", permissionVersion: 0 };
    const filter = buildUserFilter(admin);
    expect(filter).not.toHaveProperty("userId");
  });

  it("普通用户的 filter 包含正确的 userId", () => {
    const user: AuthUser = {
      id: "abc-123",
      username: "test",
      role: "editor",
      permissionVersion: 0,
    };
    const filter = buildUserFilter(user);
    expect(filter.userId).toBe("abc-123");
  });
});

// C 端用户管理端点单元测试（GET）
// 覆盖：admin 鉴权、查询参数筛选（q/status/role/profession）、服务器错误
// 注意：c-users 使用 requireAdmin（与 /api/users 一致），不提供 POST 创建（走 /api/auth/register）
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findMany: vi.fn(), count: vi.fn() },
    role: { findMany: vi.fn() },
  },
}));
vi.mock("@/lib/auth-utils", () => ({
  requireAdmin: vi.fn(),
}));
vi.mock("@/lib/logger", () => ({
  getLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

import { GET } from "@/app/api/c-users/route";
import { requireAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/db";

const adminUser = { id: "admin1", username: "admin", role: "admin", permissionVersion: 0 };
const forbiddenResponse = new Response(JSON.stringify({ error: "权限不足" }), { status: 403 });

function makeReq(query = "") {
  return new NextRequest(`http://localhost/api/c-users${query}`, { method: "GET" });
}

describe("GET /api/c-users", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("非 admin 返回 403", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ user: null, error: forbiddenResponse } as never);
    const res = await GET(makeReq());
    expect(res.status).toBe(403);
  });

  it("admin 成功获取 C 端用户列表", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ user: adminUser } as never);
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      {
        id: "u1",
        username: "phone_13800138000",
        phone: "13800138000",
        email: null,
        displayName: "13800138000",
        role: "viewer",
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLoginAt: new Date(),
        registerIp: "1.2.3.4",
        source: "self_register",
        avatarUrl: null,
        profession: null,
      },
    ] as never);
    vi.mocked(prisma.user.count).mockResolvedValue(1 as never);
    vi.mocked(prisma.role.findMany).mockResolvedValue([
      { name: "viewer", profession: "pm" },
    ] as never);

    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.users).toHaveLength(1);
    expect(data.total).toBe(1);
    expect(data.users[0].source).toBe("self_register");
    // profession 回退到 Role.profession
    expect(data.users[0].profession).toBe("pm");
  });

  it("带 status=active 筛选", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ user: adminUser } as never);
    vi.mocked(prisma.user.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.user.count).mockResolvedValue(0 as never);
    vi.mocked(prisma.role.findMany).mockResolvedValue([] as never);

    await GET(makeReq("?status=active"));
    const callArgs = vi.mocked(prisma.user.findMany).mock.calls[0][0] as { where: { active?: boolean } };
    expect(callArgs.where.active).toBe(true);
  });

  it("带 status=disabled 筛选", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ user: adminUser } as never);
    vi.mocked(prisma.user.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.user.count).mockResolvedValue(0 as never);
    vi.mocked(prisma.role.findMany).mockResolvedValue([] as never);

    await GET(makeReq("?status=disabled"));
    const callArgs = vi.mocked(prisma.user.findMany).mock.calls[0][0] as { where: { active?: boolean } };
    expect(callArgs.where.active).toBe(false);
  });

  it("带 role 筛选", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ user: adminUser } as never);
    vi.mocked(prisma.user.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.user.count).mockResolvedValue(0 as never);
    vi.mocked(prisma.role.findMany).mockResolvedValue([] as never);

    await GET(makeReq("?role=editor"));
    const callArgs = vi.mocked(prisma.user.findMany).mock.calls[0][0] as { where: { role?: string } };
    expect(callArgs.where.role).toBe("editor");
  });

  it("带 profession 筛选时调用 role.findMany", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ user: adminUser } as never);
    vi.mocked(prisma.user.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.user.count).mockResolvedValue(0 as never);
    vi.mocked(prisma.role.findMany).mockResolvedValue([{ name: "editor", profession: "pm" }] as never);

    await GET(makeReq("?profession=pm"));
    expect(prisma.role.findMany).toHaveBeenCalled();
  });

  it("带 q 搜索参数", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ user: adminUser } as never);
    vi.mocked(prisma.user.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.user.count).mockResolvedValue(0 as never);
    vi.mocked(prisma.role.findMany).mockResolvedValue([] as never);

    const res = await GET(makeReq("?q=13800"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.users).toHaveLength(0);
  });

  it("prisma 抛错返回 500", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ user: adminUser } as never);
    vi.mocked(prisma.user.findMany).mockRejectedValue(new Error("DB error") as never);
    vi.mocked(prisma.user.count).mockResolvedValue(0 as never);
    vi.mocked(prisma.role.findMany).mockResolvedValue([] as never);

    const res = await GET(makeReq());
    expect(res.status).toBe(500);
  });
});

// 用户管理端点单元测试（GET + POST）
// 覆盖：admin 鉴权、查询参数筛选、输入校验、角色校验、手机号重复、成功创建
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
    role: { findMany: vi.fn(), findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/auth-utils", () => ({
  requireAdmin: vi.fn(),
}));
vi.mock("@/lib/validate", () => ({
  validateString: vi.fn((value: unknown) => (typeof value === "string" ? value.trim() : "")),
}));
vi.mock("bcryptjs", () => ({
  default: { hash: vi.fn(async () => "hashed-password") },
}));
vi.mock("@/lib/logger", () => ({
  getLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

import { GET, POST } from "@/app/api/users/route";
import { requireAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";

const adminUser = { id: "admin1", username: "admin", role: "admin", permissionVersion: 0 };
const forbiddenResponse = new Response(JSON.stringify({ error: "权限不足" }), { status: 403 });

function makeGetReq(query = "") {
  return new NextRequest(`http://localhost/api/users${query}`, { method: "GET" });
}

function makePostReq(body: unknown) {
  return new NextRequest("http://localhost/api/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("GET /api/users", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(bcrypt.hash).mockResolvedValue("hashed-password" as never);
  });

  it("非 admin 返回 403", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ user: null, error: forbiddenResponse } as never);
    const res = await GET(makeGetReq());
    expect(res.status).toBe(403);
  });

  it("admin 成功获取用户列表", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ user: adminUser } as never);
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { id: "u1", username: "user1", phone: "13800138000", email: null, displayName: "User1", role: "viewer", active: true, createdAt: new Date(), profession: null },
    ] as never);
    vi.mocked(prisma.role.findMany).mockResolvedValue([
      { name: "viewer", profession: "pm" },
    ] as never);

    const res = await GET(makeGetReq());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.users).toHaveLength(1);
    expect(data.users[0].id).toBe("u1");
    // profession 回退到 Role.profession
    expect(data.users[0].profession).toBe("pm");
  });

  it("带 profession 筛选参数时调用 role.findMany", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ user: adminUser } as never);
    vi.mocked(prisma.role.findMany).mockResolvedValue([{ name: "editor", profession: "pm" }] as never);
    vi.mocked(prisma.user.findMany).mockResolvedValue([] as never);

    await GET(makeGetReq("?profession=pm"));
    // profession 筛选时先查 role.findMany（带 where），再在 Promise.all 中再查一次
    expect(prisma.role.findMany).toHaveBeenCalled();
  });

  it("带 q 搜索参数时返回结果", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ user: adminUser } as never);
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { id: "u1", username: "john", phone: "13800138000", email: null, displayName: "John", role: "viewer", active: true, createdAt: new Date(), profession: null },
    ] as never);
    vi.mocked(prisma.role.findMany).mockResolvedValue([] as never);

    const res = await GET(makeGetReq("?q=john"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.users).toHaveLength(1);
  });

  it("prisma 抛错返回 500", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ user: adminUser } as never);
    vi.mocked(prisma.user.findMany).mockRejectedValue(new Error("DB error") as never);
    vi.mocked(prisma.role.findMany).mockResolvedValue([] as never);

    const res = await GET(makeGetReq());
    expect(res.status).toBe(500);
  });
});

describe("POST /api/users", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(bcrypt.hash).mockResolvedValue("hashed-password" as never);
  });

  it("非 admin 返回 403", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ user: null, error: forbiddenResponse } as never);
    const res = await POST(makePostReq({ phone: "13800138000", role: "viewer" }));
    expect(res.status).toBe(403);
  });

  it("手机号为空返回 400", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ user: adminUser } as never);
    const res = await POST(makePostReq({ phone: "", role: "viewer" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("手机号");
  });

  it("手机号格式错误返回 400", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ user: adminUser } as never);
    const res = await POST(makePostReq({ phone: "12345", role: "viewer" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("手机号");
  });

  it("角色为空返回 400", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ user: adminUser } as never);
    const res = await POST(makePostReq({ phone: "13800138000", role: "" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("角色");
  });

  it("角色无效返回 400（role.findUnique 返回 null）", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ user: adminUser } as never);
    vi.mocked(prisma.role.findUnique).mockResolvedValue(null as never);
    const res = await POST(makePostReq({ phone: "13800138000", role: "superadmin" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("角色");
  });

  it("手机号已存在返回 400", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ user: adminUser } as never);
    vi.mocked(prisma.role.findUnique).mockResolvedValue({ name: "viewer" } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "existing" } as never);
    const res = await POST(makePostReq({ phone: "13800138000", role: "viewer" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("手机号");
  });

  it("成功创建用户返回 200", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ user: adminUser } as never);
    vi.mocked(prisma.role.findUnique).mockResolvedValue({ name: "viewer" } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null as never);
    vi.mocked(prisma.user.create).mockResolvedValue({
      id: "u1",
      username: "phone_13800138000",
      phone: "13800138000",
      email: null,
      displayName: "Test",
      role: "viewer",
      active: true,
      createdAt: new Date(),
    } as never);

    const res = await POST(makePostReq({
      phone: "13800138000",
      role: "viewer",
      password: "password123",
      displayName: "Test",
    }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.user.id).toBe("u1");
  });

  it("prisma 抛错返回 500", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ user: adminUser } as never);
    vi.mocked(prisma.role.findUnique).mockRejectedValue(new Error("DB error") as never);
    const res = await POST(makePostReq({ phone: "13800138000", role: "viewer" }));
    expect(res.status).toBe(500);
  });
});

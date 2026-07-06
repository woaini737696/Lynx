// 用户注册端点单元测试
// 覆盖：手机号校验、验证码/邀请码校验、万能验证码、手机号重复、邀请码状态、成功注册、速率限制、服务器错误
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// prisma mock：$transaction 将 prisma 自身作为 tx 传入回调
vi.mock("@/lib/db", () => {
  const prisma = {
    user: { findFirst: vi.fn(), create: vi.fn() },
    inviteCode: { findUnique: vi.fn(), update: vi.fn() },
    loginLog: { create: vi.fn() },
    $transaction: vi.fn(async (cb: (tx: typeof prisma) => Promise<unknown>) => cb(prisma)),
  };
  return { prisma };
});
vi.mock("@/lib/auth-config", () => ({
  getEffectiveMasterCode: vi.fn(),
}));
vi.mock("@/lib/jwt", () => ({
  signToken: vi.fn(async () => "mock-token"),
}));
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(() => ({ success: true, remaining: 4, resetAt: Date.now() + 1000 })),
  getClientKey: vi.fn(() => "test-ip"),
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

import { POST } from "@/app/api/auth/register/route";
import { prisma } from "@/lib/db";
import { getEffectiveMasterCode } from "@/lib/auth-config";
import { signToken } from "@/lib/jwt";
import { rateLimit } from "@/lib/rate-limit";
import bcrypt from "bcryptjs";

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validInvite = {
  id: "inv1",
  code: "ABC123",
  status: "unused",
  expiresAt: null,
};

const createdUser = {
  id: "u1",
  username: "phone_13800138000",
  role: "viewer",
  displayName: "13800138000",
  permissionVersion: 0,
};

describe("POST /api/auth/register", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // 重设默认 mock 值
    vi.mocked(rateLimit).mockReturnValue({ success: true, remaining: 4, resetAt: Date.now() + 1000 });
    vi.mocked(getEffectiveMasterCode).mockResolvedValue("888888");
    vi.mocked(signToken).mockResolvedValue("mock-token");
    vi.mocked(bcrypt.hash).mockResolvedValue("hashed-password" as never);
    // $transaction 在 resetAllMocks 后需要重新建立实现
    vi.mocked(prisma.$transaction).mockImplementation(
      async (cb: (tx: typeof prisma) => Promise<unknown>) => cb(prisma)
    );
  });

  it("手机号格式错误返回 400", async () => {
    const res = await POST(makeReq({ phone: "12345", code: "888888", inviteCode: "ABC123" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("手机号");
  });

  it("缺少验证码返回 400", async () => {
    const res = await POST(makeReq({ phone: "13800138000", inviteCode: "ABC123" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("必填");
  });

  it("缺少邀请码返回 400", async () => {
    const res = await POST(makeReq({ phone: "13800138000", code: "888888" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("必填");
  });

  it("万能验证码未启用返回 503", async () => {
    vi.mocked(getEffectiveMasterCode).mockResolvedValue(null);
    const res = await POST(makeReq({ phone: "13800138000", code: "888888", inviteCode: "ABC123" }));
    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.error).toContain("未启用");
  });

  it("验证码错误返回 401", async () => {
    vi.mocked(getEffectiveMasterCode).mockResolvedValue("888888");
    const res = await POST(makeReq({ phone: "13800138000", code: "000000", inviteCode: "ABC123" }));
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toContain("验证码错误");
  });

  it("手机号已注册返回 409", async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: "existing" } as never);
    const res = await POST(makeReq({ phone: "13800138000", code: "888888", inviteCode: "ABC123" }));
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.error).toContain("已注册");
  });

  it("邀请码无效返回 400", async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null as never);
    vi.mocked(prisma.inviteCode.findUnique).mockResolvedValue(null as never);
    const res = await POST(makeReq({ phone: "13800138000", code: "888888", inviteCode: "INVALID" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("邀请码无效");
  });

  it("邀请码已被使用返回 400", async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null as never);
    vi.mocked(prisma.inviteCode.findUnique).mockResolvedValue({ ...validInvite, status: "used" } as never);
    const res = await POST(makeReq({ phone: "13800138000", code: "888888", inviteCode: "ABC123" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("使用");
  });

  it("邀请码已过期返回 400", async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null as never);
    vi.mocked(prisma.inviteCode.findUnique).mockResolvedValue({
      ...validInvite,
      expiresAt: new Date(Date.now() - 86400000), // 1 天前过期
    } as never);
    const res = await POST(makeReq({ phone: "13800138000", code: "888888", inviteCode: "ABC123" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("过期");
  });

  it("成功注册（带密码）- passwordSetByUser 为 true", async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null as never);
    vi.mocked(prisma.inviteCode.findUnique).mockResolvedValue(validInvite as never);
    vi.mocked(prisma.user.create).mockResolvedValue(createdUser as never);

    const res = await POST(
      makeReq({
        phone: "13800138000",
        code: "888888",
        inviteCode: "ABC123",
        password: "pass1234",
        displayName: "测试用户",
      })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.token).toBe("mock-token");
    expect(data.user.id).toBe("u1");
    expect(data.message).toContain("成功");

    // 验证 passwordSetByUser 为 true
    const createCall = vi.mocked(prisma.user.create).mock.calls[0][0] as { data: { passwordSetByUser: boolean } };
    expect(createCall.data.passwordSetByUser).toBe(true);
  });

  it("成功注册（不带密码）- passwordSetByUser 为 false", async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null as never);
    vi.mocked(prisma.inviteCode.findUnique).mockResolvedValue(validInvite as never);
    vi.mocked(prisma.user.create).mockResolvedValue(createdUser as never);

    const res = await POST(
      makeReq({
        phone: "13800138000",
        code: "888888",
        inviteCode: "ABC123",
      })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.token).toBe("mock-token");

    // 验证 passwordSetByUser 为 false
    const createCall = vi.mocked(prisma.user.create).mock.calls[0][0] as { data: { passwordSetByUser: boolean } };
    expect(createCall.data.passwordSetByUser).toBe(false);
  });

  it("IP 速率限制返回 429", async () => {
    vi.mocked(rateLimit).mockReturnValue({ success: false, remaining: 0, resetAt: Date.now() + 60000 });
    const res = await POST(makeReq({ phone: "13800138000", code: "888888", inviteCode: "ABC123" }));
    expect(res.status).toBe(429);
    const data = await res.json();
    expect(data.error).toContain("频繁");
  });

  it("prisma 抛错返回 500", async () => {
    vi.mocked(prisma.user.findFirst).mockRejectedValue(new Error("DB error") as never);
    const res = await POST(makeReq({ phone: "13800138000", code: "888888", inviteCode: "ABC123" }));
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toContain("服务器错误");
  });
});

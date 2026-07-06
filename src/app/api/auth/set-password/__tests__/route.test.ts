// 设置密码端点单元测试
// 覆盖：速率限制、未登录、密码校验、成功设置、服务器错误
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db", () => ({
  prisma: {
    user: { update: vi.fn() },
  },
}));
vi.mock("@/lib/auth-utils", () => ({
  requireAuth: vi.fn(),
}));
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(() => ({ success: true, remaining: 9, resetAt: Date.now() + 1000 })),
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

import { POST } from "@/app/api/auth/set-password/route";
import { requireAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import bcrypt from "bcryptjs";

const mockUser = { id: "u1", username: "test", role: "editor", permissionVersion: 0 };

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/auth/set-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/set-password", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(rateLimit).mockReturnValue({ success: true, remaining: 9, resetAt: Date.now() + 1000 });
    vi.mocked(bcrypt.hash).mockResolvedValue("hashed-password" as never);
  });

  it("速率限制返回 429", async () => {
    vi.mocked(rateLimit).mockReturnValue({ success: false, remaining: 0, resetAt: Date.now() + 60000 });
    const res = await POST(makeReq({ password: "password123" }));
    expect(res.status).toBe(429);
    const data = await res.json();
    expect(data.error).toContain("频繁");
  });

  it("未登录返回 401", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      user: null,
      error: new Response(null, { status: 401 }),
    } as never);
    const res = await POST(makeReq({ password: "password123" }));
    expect(res.status).toBe(401);
  });

  it("密码 < 6 位返回 400", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ user: mockUser } as never);
    const res = await POST(makeReq({ password: "123" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("6");
  });

  it("密码 > 64 位返回 400", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ user: mockUser } as never);
    const res = await POST(makeReq({ password: "a".repeat(65) }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("64");
  });

  it("密码为空返回 400", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ user: mockUser } as never);
    const res = await POST(makeReq({}));
    expect(res.status).toBe(400);
  });

  it("成功设置密码返回 200", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(prisma.user.update).mockResolvedValue({} as never);
    const res = await POST(makeReq({ password: "password123" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.message).toContain("成功");
    // 验证 prisma.user.update 被调用，且 passwordSetByUser 为 true
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "u1" },
        data: expect.objectContaining({
          passwordHash: "hashed-password",
          passwordSetByUser: true,
        }),
      })
    );
  });

  it("prisma 抛错返回 500", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(prisma.user.update).mockRejectedValue(new Error("DB error") as never);
    const res = await POST(makeReq({ password: "password123" }));
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toContain("服务器错误");
  });
});

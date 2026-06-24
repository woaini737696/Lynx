import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock prisma 以避免数据库依赖
vi.mock("@/lib/db", () => ({
  prisma: {
    flow: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
  },
}));

import { formatLastRun } from "@/lib/flow-store";

describe("formatLastRun", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("null 返回 '未运行'", () => {
    expect(formatLastRun(null)).toBe("未运行");
  });

  it("小于 1 分钟返回 '刚刚'", () => {
    vi.setSystemTime(new Date("2026-01-01T12:00:00Z"));
    const date = new Date("2026-01-01T11:59:30Z"); // 30 秒前
    expect(formatLastRun(date)).toBe("刚刚");
  });

  it("1-59 分钟返回 'X分钟前'", () => {
    vi.setSystemTime(new Date("2026-01-01T12:00:00Z"));
    const date = new Date("2026-01-01T11:50:00Z"); // 10 分钟前
    expect(formatLastRun(date)).toBe("10分钟前");
  });

  it("1-23 小时返回 'X小时前'", () => {
    vi.setSystemTime(new Date("2026-01-01T12:00:00Z"));
    const date = new Date("2026-01-01T09:00:00Z"); // 3 小时前
    expect(formatLastRun(date)).toBe("3小时前");
  });

  it(">= 24 小时返回 'X天前'", () => {
    vi.setSystemTime(new Date("2026-01-03T12:00:00Z"));
    const date = new Date("2026-01-01T12:00:00Z"); // 2 天前
    expect(formatLastRun(date)).toBe("2天前");
  });

  it("边界：刚好 60 秒显示 '1分钟前'", () => {
    vi.setSystemTime(new Date("2026-01-01T12:01:00Z"));
    const date = new Date("2026-01-01T12:00:00Z"); // 60000ms
    expect(formatLastRun(date)).toBe("1分钟前");
  });

  it("边界：刚好 60 分钟显示 '1小时前'", () => {
    vi.setSystemTime(new Date("2026-01-01T13:00:00Z"));
    const date = new Date("2026-01-01T12:00:00Z"); // 3600000ms
    expect(formatLastRun(date)).toBe("1小时前");
  });

  it("边界：刚好 24 小时显示 '1天前'", () => {
    vi.setSystemTime(new Date("2026-01-02T12:00:00Z"));
    const date = new Date("2026-01-01T12:00:00Z"); // 86400000ms
    expect(formatLastRun(date)).toBe("1天前");
  });

  it("边界：59 分 59 秒显示 '59分钟前'", () => {
    vi.setSystemTime(new Date("2026-01-01T12:00:00Z"));
    const date = new Date("2026-01-01T11:00:01Z"); // 3599999ms
    expect(formatLastRun(date)).toBe("59分钟前");
  });
});

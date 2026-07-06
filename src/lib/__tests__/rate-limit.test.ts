// 滑动窗口 Rate Limiter 单元测试
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { rateLimit, buildRateLimitKey, getClientKey } from "../rate-limit";

// rate-limit 模块内部有全局 store，无法直接清空，但可通过独立 key 隔离测试
beforeEach(() => {
  // 时间可控：使用真实时间，但每条用例使用独立 key
  vi.useRealTimers();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("rateLimit 滑动窗口", () => {
  it("窗口内未达上限应成功", () => {
    const result = rateLimit("test-allow-1", 5, 60_000);
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(4);
    expect(result.resetAt).toBeGreaterThan(Date.now());
  });

  it("窗口内达上限应拒绝", () => {
    const key = "test-deny-1";
    for (let i = 0; i < 3; i++) rateLimit(key, 3, 60_000);
    const result = rateLimit(key, 3, 60_000);
    expect(result.success).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("不同 key 应分别计数", () => {
    const r1 = rateLimit("key-A", 2, 60_000);
    const r2 = rateLimit("key-B", 2, 60_000);
    expect(r1.success).toBe(true);
    expect(r2.success).toBe(true);
    expect(r1.remaining).toBe(1);
    expect(r2.remaining).toBe(1);
    // 第二次 key-A 应该消耗，但 key-B 仍是 1
    const r1b = rateLimit("key-A", 2, 60_000);
    expect(r1b.remaining).toBe(0);
  });

  it("窗口过期后应能再次请求", () => {
    const key = "test-expire-1";
    // 用一个 100ms 窗口快速测试
    rateLimit(key, 1, 100);
    const blocked = rateLimit(key, 1, 100);
    expect(blocked.success).toBe(false);
    // 等待窗口过期
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const after = rateLimit(key, 1, 100);
        expect(after.success).toBe(true);
        resolve();
      }, 150);
    });
  });

  it("resetAt 应为最早请求 + windowMs", () => {
    const key = "test-reset-1";
    const before = Date.now();
    const r1 = rateLimit(key, 10, 60_000);
    expect(r1.resetAt).toBeGreaterThanOrEqual(before + 60_000 - 50);
    expect(r1.resetAt).toBeLessThanOrEqual(before + 60_000 + 50);
  });

  it("remaining 不应为负数", () => {
    const key = "test-neg-1";
    rateLimit(key, 1, 60_000);
    rateLimit(key, 1, 60_000); // 已满
    const r = rateLimit(key, 1, 60_000);
    expect(r.remaining).toBe(0);
    expect(r.remaining).toBeGreaterThanOrEqual(0);
  });
});

describe("buildRateLimitKey", () => {
  it("应包含 scope、ip、userId", () => {
    const key = buildRateLimitKey("login", "1.2.3.4", "user-abc");
    expect(key).toBe("login:1.2.3.4:user-abc");
  });

  it("未提供 userId 应使用 anon", () => {
    expect(buildRateLimitKey("upload", "5.6.7.8")).toBe("upload:5.6.7.8:anon");
    expect(buildRateLimitKey("upload", "5.6.7.8", null)).toBe("upload:5.6.7.8:anon");
    expect(buildRateLimitKey("upload", "5.6.7.8", "")).toBe("upload:5.6.7.8:anon");
  });
});

describe("getClientKey", () => {
  it("默认不信任 x-forwarded-for", () => {
    delete process.env.TRUST_PROXY;
    const req = new Request("https://example.com", {
      headers: { "x-forwarded-for": "9.9.9.9" },
    });
    // 没有 socket 模拟时返回 unknown
    const key = getClientKey(req);
    expect(key).toBe("unknown"); // 测试环境无真实 socket
  });

  it("TRUST_PROXY=true 时应信任 x-forwarded-for", () => {
    process.env.TRUST_PROXY = "true";
    const req = new Request("https://example.com", {
      headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
    });
    expect(getClientKey(req)).toBe("5.6.7.8"); // 取最后一个
  });

  it("TRUST_PROXY=true 时应信任 x-real-ip", () => {
    process.env.TRUST_PROXY = "true";
    const req = new Request("https://example.com", {
      headers: { "x-real-ip": "10.0.0.1" },
    });
    expect(getClientKey(req)).toBe("10.0.0.1");
  });

  it("Cloudflare cf-connecting-ip 应被信任", () => {
    delete process.env.TRUST_PROXY;
    const req = new Request("https://example.com", {
      headers: { "cf-connecting-ip": "8.8.8.8" },
    });
    expect(getClientKey(req)).toBe("8.8.8.8");
  });
});

// 健康检查端点单元测试
// GET /api/health → { ok: true, timestamp, uptime, memory }
import { describe, it, expect } from "vitest";
import { GET } from "@/app/api/health/route";

describe("GET /api/health", () => {
  it("返回 200 和健康状态信息", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(typeof data.timestamp).toBe("string");
    expect(typeof data.uptime).toBe("number");
    expect(data.memory).toBeDefined();
    expect(typeof data.memory.rss).toBe("number");
    expect(typeof data.memory.heapUsed).toBe("number");
    expect(typeof data.memory.heapTotal).toBe("number");
  });

  it("timestamp 为合法 ISO 字符串", async () => {
    const res = await GET();
    const data = await res.json();
    const d = new Date(data.timestamp);
    expect(d.toString()).not.toBe("Invalid Date");
  });

  it("uptime 为非负数", async () => {
    const res = await GET();
    const data = await res.json();
    expect(data.uptime).toBeGreaterThanOrEqual(0);
  });
});

// JWT (HS256) 单元测试
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { signToken, verifyToken, type JwtPayload } from "../jwt";

const ORIGINAL_ENV = { ...process.env };
const TEST_SECRET = "test-secret-for-vitest-0123456789abcdef";

beforeEach(() => {
  process.env.AUTH_SECRET = TEST_SECRET;
  process.env.NODE_ENV = "test";
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("jwt signToken/verifyToken", () => {
  const samplePayload: JwtPayload = {
    id: "user-001",
    username: "admin",
    role: "admin",
  };

  it("签发的 token 应为三段式 JWT 结构", async () => {
    const token = await signToken(samplePayload);
    expect(token.split(".")).toHaveLength(3);
  });

  it("verifyToken 应还原 payload", async () => {
    const token = await signToken(samplePayload);
    const decoded = await verifyToken(token);
    expect(decoded).not.toBeNull();
    expect(decoded!.id).toBe("user-001");
    expect(decoded!.username).toBe("admin");
    expect(decoded!.role).toBe("admin");
  });

  it("签发时 iat 和 exp 应被填充，且 exp = iat + 7天", async () => {
    const before = Math.floor(Date.now() / 1000);
    const token = await signToken(samplePayload);
    const after = Math.floor(Date.now() / 1000);
    const decoded = await verifyToken(token);
    expect(decoded!.iat).toBeGreaterThanOrEqual(before);
    expect(decoded!.iat).toBeLessThanOrEqual(after);
    expect(decoded!.exp).toBe(decoded!.iat! + 7 * 24 * 60 * 60);
  });

  it("篡改 payload 后签名校验应失败", async () => {
    const token = await signToken(samplePayload);
    const [header, body, sig] = token.split(".");
    // 篡改 body：把 role 改成 superadmin
    const tamperedBody = Buffer.from(
      JSON.stringify({ ...samplePayload, role: "superadmin" })
    ).toString("base64url");
    const tamperedToken = `${header}.${tamperedBody}.${sig}`;
    const decoded = await verifyToken(tamperedToken);
    expect(decoded).toBeNull();
  });

  it("篡改签名后应校验失败", async () => {
    const token = await signToken(samplePayload);
    const [header, body, sig] = token.split(".");
    // 翻转最后一位
    const last = sig[sig.length - 1];
    const flipped = last === "A" ? "B" : "A";
    const tamperedSig = sig.slice(0, -1) + flipped;
    const tamperedToken = `${header}.${body}.${tamperedSig}`;
    expect(await verifyToken(tamperedToken)).toBeNull();
  });

  it("非三段式 token 应返回 null", async () => {
    expect(await verifyToken("not.a.jwt")).toBeNull();
    expect(await verifyToken("onlyonepart")).toBeNull();
    expect(await verifyToken("a.b.c.d")).toBeNull();
    expect(await verifyToken("")).toBeNull();
  });

  it("不同 secret 签发的 token 应校验失败", async () => {
    const token = await signToken(samplePayload);
    // 切换 secret
    process.env.AUTH_SECRET = "different-secret-xxx";
    expect(await verifyToken(token)).toBeNull();
  });

  it("permissionVersion 字段应能正确传递", async () => {
    const token = await signToken({ ...samplePayload, permissionVersion: 42 });
    const decoded = await verifyToken(token);
    expect(decoded!.permissionVersion).toBe(42);
  });

  it("过期 token 应返回 null", async () => {
    // 通过手动构造过期 token 测试
    // 这里直接验证 exp 字段被正确检查：用一个极小的 exp
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const past = Math.floor(Date.now() / 1000) - 100; // 100秒前过期
    const body = Buffer.from(
      JSON.stringify({ ...samplePayload, iat: past - 100, exp: past })
    ).toString("base64url");
    // 重新计算签名（使用 crypto Hmac sha256）
    const crypto = await import("crypto");
    const sig = crypto
      .createHmac("sha256", TEST_SECRET)
      .update(`${header}.${body}`)
      .digest("base64url");
    const expiredToken = `${header}.${body}.${sig}`;
    expect(await verifyToken(expiredToken)).toBeNull();
  });
});

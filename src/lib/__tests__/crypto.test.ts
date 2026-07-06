// AES-256-GCM 加密工具单元测试
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { encrypt, decrypt, isEncrypted } from "../crypto";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  // 使用固定的 base64 编码 32 字节密钥
  process.env.ENCRYPTION_KEY = Buffer.from(
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    "hex"
  ).toString("base64");
  process.env.NODE_ENV = "test";
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("crypto encrypt/decrypt", () => {
  it("加密后应以 enc: 前缀开头", () => {
    const ct = encrypt("hello world");
    expect(ct).toBeTruthy();
    expect(ct!.startsWith("enc:")).toBe(true);
  });

  it("加密-解密应能还原原文", () => {
    const plaintext = "sk-deepseek-abcdef123456";
    const ct = encrypt(plaintext);
    const rt = decrypt(ct);
    expect(rt).toBe(plaintext);
  });

  it("应支持中文与特殊字符", () => {
    const plaintext = "中文测试🎉line1\nline2\ttab";
    const ct = encrypt(plaintext);
    expect(decrypt(ct)).toBe(plaintext);
  });

  it("空值应原样返回", () => {
    // null 返回 null；空字符串返回空字符串（保持向后兼容）
    expect(encrypt(null)).toBe(null);
    expect(encrypt("")).toBe("");
    expect(decrypt(null)).toBe(null);
    expect(decrypt("")).toBe("");
  });

  it("已加密的值不应重复加密", () => {
    const ct1 = encrypt("secret");
    const ct2 = encrypt(ct1!);
    expect(ct2).toBe(ct1);
  });

  it("明文（无 enc: 前缀）应原样返回（向后兼容）", () => {
    expect(decrypt("plain-api-key")).toBe("plain-api-key");
  });

  it("不同次加密的密文应不同（IV 随机）", () => {
    const ct1 = encrypt("same-text");
    const ct2 = encrypt("same-text");
    expect(ct1).not.toBe(ct2);
    // 但都能解密到同一原文
    expect(decrypt(ct1)).toBe("same-text");
    expect(decrypt(ct2)).toBe("same-text");
  });

  it("篡改密文应解密失败返回 null", () => {
    const ct = encrypt("sensitive-data")!;
    // 篡改 ciphertext 部分
    const parts = ct.split(":");
    parts[2] = parts[2].slice(0, -4) + "0000";
    const tampered = parts.join(":");
    expect(decrypt(tampered)).toBe(null);
  });

  it("格式错误的 enc: 字符串应返回 null", () => {
    expect(decrypt("enc:onlyonepart")).toBe(null);
    expect(decrypt("enc:a:b")).toBe(null);
    expect(decrypt("enc:a:b:c:d")).toBe(null);
  });

  it("isEncrypted 应正确识别加密值", () => {
    expect(isEncrypted(encrypt("x"))).toBe(true);
    expect(isEncrypted("plain")).toBe(false);
    expect(isEncrypted(null)).toBe(false);
    expect(isEncrypted("")).toBe(false);
  });
});

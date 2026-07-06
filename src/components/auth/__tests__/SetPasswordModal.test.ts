// SetPasswordModal 组件中 getPasswordStrength 纯函数的单元测试
// 覆盖空字符串、短密码、仅字母、仅数字、字母+数字、字母+数字+特殊字符等场景
import { describe, it, expect } from "vitest";
import { getPasswordStrength } from "@/components/auth/SetPasswordModal";

describe("getPasswordStrength", () => {
  it("空字符串返回 none", () => {
    expect(getPasswordStrength("")).toBe("none");
  });

  it("长度 < 8 返回 weak", () => {
    expect(getPasswordStrength("ab1")).toBe("weak");
    expect(getPasswordStrength("a1!")).toBe("weak");
    expect(getPasswordStrength("abc123")).toBe("weak"); // 长度 6，含字母+数字但不足 8
  });

  it("仅字母（长度 >= 8）返回 weak", () => {
    expect(getPasswordStrength("abcdefgh")).toBe("weak");
    expect(getPasswordStrength("abcdefghijklmnopqrstuvwxyz")).toBe("weak");
  });

  it("仅数字（长度 >= 8）返回 weak", () => {
    expect(getPasswordStrength("12345678")).toBe("weak");
    expect(getPasswordStrength("0123456789")).toBe("weak");
  });

  it("仅特殊字符（长度 >= 8）返回 weak（缺字母和数字）", () => {
    expect(getPasswordStrength("!!!!!!!!")).toBe("weak");
  });

  it("字母 + 数字（长度 >= 8，无特殊字符）返回 medium", () => {
    expect(getPasswordStrength("abcd1234")).toBe("medium");
    expect(getPasswordStrength("pass1234")).toBe("medium");
    expect(getPasswordStrength("Abc12345")).toBe("medium");
  });

  it("字母 + 数字 + 特殊字符（长度 >= 8）返回 strong", () => {
    expect(getPasswordStrength("abcd1234!")).toBe("strong");
    expect(getPasswordStrength("Pass@1234")).toBe("strong");
    expect(getPasswordStrength("a1!bcdef")).toBe("strong"); // 长度 8
  });

  it("字母 + 特殊字符（长度 >= 8，无数字）返回 weak", () => {
    expect(getPasswordStrength("abc!def!")).toBe("weak");
  });

  it("数字 + 特殊字符（长度 >= 8，无字母）返回 weak", () => {
    expect(getPasswordStrength("1234!678")).toBe("weak");
  });

  it("边界长度 8：字母+数字刚好 8 位返回 medium", () => {
    expect(getPasswordStrength("abcd5678")).toBe("medium");
  });

  it("边界长度 7：字母+数字 7 位返回 weak", () => {
    expect(getPasswordStrength("abc1234")).toBe("weak");
  });
});

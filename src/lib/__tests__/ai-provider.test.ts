import { describe, it, expect, afterEach } from "vitest";
import { isModelMultimodal, getDefaultProvider } from "@/lib/ai-provider";

describe("isModelMultimodal", () => {
  it("DeepSeek VL2 支持多模态", () => {
    expect(isModelMultimodal("deepseek", "deepseek-vl2")).toBe(true);
  });

  it("DeepSeek Chat 不支持多模态", () => {
    expect(isModelMultimodal("deepseek", "deepseek-chat")).toBe(false);
  });

  it("DeepSeek Reasoner 不支持多模态", () => {
    expect(isModelMultimodal("deepseek", "deepseek-reasoner")).toBe(false);
  });

  it("MiMo 2.5 支持多模态", () => {
    expect(isModelMultimodal("mimo", "mimo-v2.5")).toBe(true);
  });

  it("MiMo 2.5 Pro 支持多模态", () => {
    expect(isModelMultimodal("mimo", "mimo-v2.5-pro")).toBe(true);
  });

  it("MiMo TTS 不支持多模态", () => {
    expect(isModelMultimodal("mimo", "mimo-v2.5-tts")).toBe(false);
  });

  it("未知模型返回 false", () => {
    expect(isModelMultimodal("deepseek", "unknown-model")).toBe(false);
  });
});

describe("getDefaultProvider", () => {
  const original = process.env.DEFAULT_LLM_PROVIDER;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.DEFAULT_LLM_PROVIDER;
    } else {
      process.env.DEFAULT_LLM_PROVIDER = original;
    }
  });

  it("未设置环境变量时默认 deepseek", () => {
    delete process.env.DEFAULT_LLM_PROVIDER;
    expect(getDefaultProvider()).toBe("deepseek");
  });

  it("设置为 mimo 时返回 mimo", () => {
    process.env.DEFAULT_LLM_PROVIDER = "mimo";
    expect(getDefaultProvider()).toBe("mimo");
  });

  it("大写 MIMO 转小写后返回 mimo", () => {
    process.env.DEFAULT_LLM_PROVIDER = "MIMO";
    expect(getDefaultProvider()).toBe("mimo");
  });

  it("设置为 deepseek 时返回 deepseek", () => {
    process.env.DEFAULT_LLM_PROVIDER = "deepseek";
    expect(getDefaultProvider()).toBe("deepseek");
  });

  it("非法值回退为 deepseek", () => {
    process.env.DEFAULT_LLM_PROVIDER = "invalid";
    expect(getDefaultProvider()).toBe("deepseek");
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

// 通过 hoisted 状态动态控制 hasAIEmbedding，以测试降级分支
const state = vi.hoisted(() => ({ hasAIEmbedding: false }));

vi.mock("@/lib/ai", () => ({
  embeddingProvider: { embedding: vi.fn(() => ({})) },
  embeddingModel: "test-model",
  get hasAIEmbedding() {
    return state.hasAIEmbedding;
  },
}));

const embedTextMock = vi.hoisted(() => vi.fn());
const cosineMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/embedding", () => ({
  embedText: embedTextMock,
  cosineSimilarity: cosineMock,
}));

const embedManyMock = vi.hoisted(() => vi.fn());
vi.mock("ai", () => ({
  embedMany: embedManyMock,
}));

import {
  generateEmbeddings,
  findSemanticMatches,
} from "@/lib/semantic-match";

beforeEach(() => {
  vi.clearAllMocks();
  state.hasAIEmbedding = false;
  embedTextMock.mockImplementation(async (text: string) => {
    const v = new Float32Array(4);
    v[0] = text.length;
    return v;
  });
});

describe("generateEmbeddings - TF-IDF 降级逻辑", () => {
  it("空数组直接返回空数组", async () => {
    const result = await generateEmbeddings([]);
    expect(result).toEqual([]);
    expect(embedTextMock).not.toHaveBeenCalled();
    expect(embedManyMock).not.toHaveBeenCalled();
  });

  it("无 AI embedding 时降级为 TF-IDF（逐条调用 embedText）", async () => {
    state.hasAIEmbedding = false;
    const result = await generateEmbeddings(["hello", "world"]);
    expect(embedTextMock).toHaveBeenCalledTimes(2);
    expect(embedTextMock).toHaveBeenCalledWith("hello");
    expect(embedTextMock).toHaveBeenCalledWith("world");
    expect(embedManyMock).not.toHaveBeenCalled();
    expect(result).toHaveLength(2);
    expect(result[0]).toBeInstanceOf(Float32Array);
  });

  it("有 AI embedding 时使用 embedMany 批量生成", async () => {
    state.hasAIEmbedding = true;
    embedManyMock.mockResolvedValue({
      embeddings: [
        [1, 2, 3],
        [4, 5, 6],
      ],
    });
    const result = await generateEmbeddings(["a", "b"]);
    expect(embedManyMock).toHaveBeenCalledTimes(1);
    expect(embedTextMock).not.toHaveBeenCalled();
    expect(result).toHaveLength(2);
    expect(result[0]).toBeInstanceOf(Float32Array);
    expect(Array.from(result[0])).toEqual([1, 2, 3]);
  });

  it("AI embedMany 失败时降级为 TF-IDF", async () => {
    state.hasAIEmbedding = true;
    embedManyMock.mockRejectedValue(new Error("network error"));
    const result = await generateEmbeddings(["a", "b"]);
    expect(embedManyMock).toHaveBeenCalled();
    // 失败后逐条调用 embedText 降级
    expect(embedTextMock).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(2);
  });
});

describe("findSemanticMatches", () => {
  it("空条件或空候选返回空数组", async () => {
    expect(
      await findSemanticMatches([], [{ id: "c1", text: "x" }])
    ).toEqual([]);
    expect(
      await findSemanticMatches([{ id: "q1", text: "x" }], [])
    ).toEqual([]);
  });

  it("所有配对高于阈值时全部返回并按分数降序", async () => {
    state.hasAIEmbedding = false;
    embedTextMock.mockResolvedValue(new Float32Array([1]));
    // 按嵌套循环顺序：q1-c1, q1-c2, q2-c1, q2-c2
    cosineMock
      .mockReturnValueOnce(0.9)
      .mockReturnValueOnce(0.6)
      .mockReturnValueOnce(0.95)
      .mockReturnValueOnce(0.8);
    const conditions = [
      { id: "q1", text: "a" },
      { id: "q2", text: "b" },
    ];
    const candidates = [
      { id: "c1", text: "x" },
      { id: "c2", text: "y" },
    ];
    const matches = await findSemanticMatches(conditions, candidates, 0.75);
    // 0.6 低于阈值被过滤，剩余 3 条按降序
    expect(matches).toHaveLength(3);
    expect(matches.map((m) => m.score)).toEqual([0.95, 0.9, 0.8]);
    expect(matches[0]).toEqual({
      conditionId: "q2",
      candidateId: "c1",
      score: 0.95,
    });
  });

  it("所有配对低于阈值时返回空数组", async () => {
    state.hasAIEmbedding = false;
    embedTextMock.mockResolvedValue(new Float32Array([1]));
    cosineMock.mockReturnValue(0.5);
    const matches = await findSemanticMatches(
      [{ id: "q1", text: "a" }],
      [{ id: "c1", text: "x" }],
      0.75
    );
    expect(matches).toEqual([]);
  });
});

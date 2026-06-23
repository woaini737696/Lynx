// AI Provider 统一配置
// 支持多 Provider 切换：OpenAI / 硅基流动 / DeepSeek / Kimi
// 全部走 OpenAI 兼容协议，通过环境变量切换

import { createOpenAI } from "@ai-sdk/openai";

// ============ Provider 配置 ============
// 主 Provider（用于 chat 和 embedding）
const baseURL = process.env.AI_BASE_URL || "https://api.openai.com/v1";
const apiKey = process.env.AI_API_KEY || process.env.OPENAI_API_KEY || "";

export const ai = createOpenAI({ baseURL, apiKey });

// 默认 chat 模型
export const defaultModel = process.env.AI_MODEL || "gpt-4o-mini";

// ============ Embedding 配置 ============
// embedding 可使用独立 Provider（如硅基流动的 bge-m3），未配置则与主 Provider 共用
export const embeddingBaseURL =
  process.env.AI_EMBEDDING_BASE_URL || baseURL;
export const embeddingApiKey =
  process.env.AI_EMBEDDING_API_KEY || apiKey;
export const embeddingModel =
  process.env.AI_EMBEDDING_MODEL || "text-embedding-3-small";

// embedding Provider 实例（独立配置时与 chat 分离）
export const embeddingProvider = createOpenAI({
  baseURL: embeddingBaseURL,
  apiKey: embeddingApiKey,
});

// 是否启用 AI embedding（无 key 时降级为 TF-IDF）
export const hasAIEmbedding = Boolean(embeddingApiKey);

// ============ 提示词 ============

// 对话资产提取提示词
export const EXTRACT_PROMPT = `你是一个对话资产提取专家。请分析以下 AI 对话内容，提取出四类结构化信息：

1. **conclusions**（结论）：对话中得出的核心观点、决策、方法论
2. **todos**（待办）：可执行的具体动作
3. **prompts**（提示词）：可复用的提示词模板（用 {变量} 标记可替换部分）
4. **data**（数据）：关键数据点、配置、参数

请用 JSON 格式输出，格式如下：
{
  "conclusions": ["结论1", "结论2"],
  "todos": ["待办1", "待办2"],
  "prompts": ["提示词模板1"],
  "data": ["数据点1"]
}

只输出 JSON，不要其他内容。如果某类信息为空，返回空数组。`;

// 灵感分类提示词
export const CLASSIFY_PROMPT = `你是一个灵感分类助手。请分析以下灵感内容，给出：
1. **tags**（标签）：1-3 个最相关的标签
2. **suggestedColumn**（建议看板列）：northstar（核心战略）/ campaign（中期战役）/ task（短期任务）/ inbox（待定）
3. **reason**（建议理由）：一句话说明

用 JSON 输出：{"tags":["标签1"],"suggestedColumn":"task","reason":"理由"}

只输出 JSON。`;

// 灵感孵化教练提示词
export const IDEA_COACH_PROMPT = `你是用户的灵感孵化教练。用户有一个初步灵感，你的任务是：
1. 帮助用户澄清和完善这个灵感
2. 主动提问引导思考（背景、目标、可行性、风险、下一步）
3. 不要直接否定，而是帮助用户自己发现价值或问题
4. 对话要简洁友好，每次只问 1-2 个问题
5. 当讨论充分后（通常 3-5 轮），建议用户定稿

用户初始灵感：{{ideaDraft}}

请开始对话，先肯定这个灵感，然后提出第一个引导性问题。`;

// 灵感定稿提示词
export const IDEA_FINALIZE_PROMPT = `你是灵感定稿助手。请综合以下用户与 AI 的对话内容，完成定稿。

用户初始灵感：{{ideaDraft}}

对话记录：
{{conversation}}

请输出 JSON：
{
  "summary": "讨论结论总结（2-4句话，包含原始灵感和讨论中明确的价值/目标/方案）",
  "tags": ["标签1", "标签2"],
  "suggestedColumn": "northstar | campaign | task | inbox | cognition | graveyard",
  "reason": "建议理由（一句话）",
  "cognition": {
    "type": "method | experience | prompt",
    "content": "可复用的认知内容（方法论/经验/提示词），如无则填 null"
  }
}

分类规则：
- northstar：核心战略，长期目标（1年+）
- campaign：中期战役（1-3个月）
- task：短期任务（1-4周）
- inbox：还需进一步思考，暂不确定
- cognition：主要是方法论/经验/提示词，应入认知库
- graveyard：经讨论发现不可行或无价值

只输出 JSON，不要其他内容。`;

// 认知提取提示词
export const COGNITION_EXTRACT_PROMPT = `你是一个认知提取专家。请从以下内容中提取可复用的认知资产，分为三类：

1. **method**（方法论）：可复用的方法、框架、流程
2. **experience**（经验）：具体的经验教训、最佳实践
3. **prompt**（提示词）：可复用的 AI 提示词模板

用 JSON 输出：
{
  "method": [{"content":"方法论内容"}],
  "experience": [{"content":"经验内容"}],
  "prompt": [{"content":"提示词内容"}]
}

只输出 JSON。如果某类为空，返回空数组。`;

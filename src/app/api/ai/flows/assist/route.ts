import { NextRequest, NextResponse } from "next/server";
import { chat } from "@/lib/ai-provider";
import { requireAuth } from "@/lib/auth-utils";
import { getLogger } from "@/lib/logger";
import type { NodeConfig } from "@/lib/flow-store";

const logger = getLogger("flows-assist-api");

// 节点类型枚举（与 flow-store.ts 保持一致）
const NODE_TYPES = [
  "trigger",
  "action",
  "condition",
  "output",
  "hermes",
  "http",
  "database",
  "transform",
  "delay",
] as const;

// ============ 公共校验 ============

function parseJsonFromResponse(text: string): unknown | null {
  // 优先尝试 ```json 代码块
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = codeBlockMatch ? codeBlockMatch[1] : text;
  // 找到第一个 { 到最后一个 } 之间的内容
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}

// ============ POST /api/ai/flows/assist ============

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.user === null) return auth.error;

  try {
    const body = await req.json().catch(() => ({}));
    const { type, prompt, nodeType, currentConfig } = body as {
      type?: "generate" | "configure";
      prompt?: string;
      nodeType?: string;
      currentConfig?: NodeConfig;
    };

    if (!prompt || typeof prompt !== "string" || prompt.trim().length < 2) {
      return NextResponse.json(
        { error: "请输入更详细的自然语言描述" },
        { status: 400 }
      );
    }
    if (prompt.length > 2000) {
      return NextResponse.json(
        { error: "描述过长，最多 2000 字符" },
        { status: 400 }
      );
    }

    // ============ 类型 1：自然语言生成完整工作流 ============
    if (type === "generate") {
      const system = `你是工作流编排专家。根据用户的自然语言描述，生成一个可执行的 AI 工作流。

可用节点类型：
- trigger（触发器）：triggerType=manual|schedule|event，schedule 用 cron 表达式，eventType 如 idea.created
- action（动作）：prompt 为 AI 提示词，可用 {{upstream}}，model=deepseek-chat|deepseek-reasoner
- condition（条件）：expression 表达式，支持 upstream.includes('xxx')、==、>、< 等
- output（输出）：outputTarget=notification|cognition|skills|idea.tags|chat
- hermes（本地代理）：hermesMode=auto|computer_use|shell，hermesPrompt 为任务描述
- http（网络请求）：httpMethod=GET|POST|PUT|DELETE，httpUrl，httpBody
- database（数据库）：dbOperation=query|create|update|delete，dbModel=idea|task|memory|cognition|skill
- transform（转换）：transformType=template|jsonpath|regex，transformExpression 或 transformTemplate
- delay（延时）：delayMs 毫秒数

输出格式（严格 JSON，不要任何额外说明）：
{
  "name": "工作流名称",
  "description": "简短描述",
  "nodes": [
    { "id": "n1", "type": "trigger", "label": "中文标签", "config": {...} },
    { "id": "n2", "type": "action", "label": "中文标签", "config": {...} }
  ],
  "edges": [
    { "from": "n1", "to": "n2" }
  ]
}

要求：
1. 节点 id 用 n1, n2, n3... 简短标识
2. label 必须是中文
3. 只输出 JSON，第一个字符必须是 {`;
      const aiResp = await chat(
        [{ role: "user", content: prompt }],
        { system, reasoningMode: "fast", temperature: 0.3, maxTokens: 1500 }
      );
      const parsed = parseJsonFromResponse(aiResp.content);
      if (!parsed || typeof parsed !== "object") {
        logger.warn({ content: aiResp.content }, "AI 生成工作流解析失败");
        return NextResponse.json(
          { error: "AI 输出格式异常，请重试或换一种描述" },
          { status: 502 }
        );
      }
      const obj = parsed as Record<string, unknown>;
      if (!Array.isArray(obj.nodes)) {
        return NextResponse.json(
          { error: "AI 输出缺少 nodes 字段" },
          { status: 502 }
        );
      }
      return NextResponse.json({
        flow: {
          name: typeof obj.name === "string" ? obj.name : "AI 生成工作流",
          description: typeof obj.description === "string" ? obj.description : "",
          nodes: obj.nodes,
          edges: Array.isArray(obj.edges) ? obj.edges : [],
        },
      });
    }

    // ============ 类型 2：自然语言配置单个节点 ============
    if (type === "configure") {
      if (!nodeType || !NODE_TYPES.includes(nodeType as (typeof NODE_TYPES)[number])) {
        return NextResponse.json(
          { error: "节点类型无效" },
          { status: 400 }
        );
      }
      const system = `你是工作流节点配置专家。根据用户的自然语言描述，生成 ${nodeType} 类型节点的 config 配置。

节点类型 ${nodeType} 的可用字段：
${describeNodeFields(nodeType)}

输出格式（严格 JSON，不要任何额外说明）：
{ "config": { ...对应字段... } }

要求：
1. 只输出 config 对象，外层包一个 config 字段
2. 字段值必须是中文或合法的代码/URL
3. 第一个字符必须是 {`;

      const userMsg = `用户描述：${prompt}
${currentConfig ? `\n当前已有配置（参考，未提及的字段保留）：${JSON.stringify(currentConfig)}` : ""}

请生成 ${nodeType} 节点的 config：`;

      const aiResp = await chat(
        [{ role: "user", content: userMsg }],
        { system, reasoningMode: "fast", temperature: 0.3, maxTokens: 800 }
      );
      const parsed = parseJsonFromResponse(aiResp.content);
      if (!parsed || typeof parsed !== "object") {
        return NextResponse.json(
          { error: "AI 输出格式异常，请重试" },
          { status: 502 }
        );
      }
      const obj = parsed as Record<string, unknown>;
      // 兼容直接返回 config 或 { config: {...} } 两种格式
      const config = (obj.config && typeof obj.config === "object")
        ? obj.config
        : obj;
      return NextResponse.json({ config });
    }

    return NextResponse.json(
      { error: "type 必须是 generate 或 configure" },
      { status: 400 }
    );
  } catch (e) {
    logger.error({ err: e }, "AI 工作流辅助失败");
    return NextResponse.json(
      { error: "服务器错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

// 节点字段描述（用于 AI 提示词）
function describeNodeFields(nodeType: string): string {
  const map: Record<string, string> = {
    trigger: "triggerType (manual|schedule|event), schedule (cron表达式 如 0 9 * * *), eventType (如 idea.created)",
    action: "prompt (AI提示词,可用 {{upstream}}), model (deepseek-chat|deepseek-reasoner)",
    condition: "expression (条件表达式,如 upstream.includes('重要') 或 score > 0.8)",
    output: "outputTarget (notification|cognition|skills|idea.tags|chat)",
    hermes: "hermesMode (auto|computer_use|shell), hermesPrompt (任务描述,可用 {{upstream}}), workDir (可选), timeout (秒,默认 120)",
    http: "httpMethod (GET|POST|PUT|PATCH|DELETE), httpUrl, httpHeaders (可选对象), httpBody (可选字符串), timeout (秒)",
    database: "dbOperation (query|create|update|delete), dbModel (idea|task|memory|cognition|skill), dbQuery (query 数量), dbData (create/update 对象)",
    transform: "transformType (template|jsonpath|regex|javascript), transformExpression, transformTemplate",
    delay: "delayMs (毫秒,1-60000)",
  };
  return map[nodeType] || "（未知类型）";
}

// AI 蒸馏模板：将重复性 AI 协同工作固化为参数化模板

export type DistillCategory =
  | "finance"
  | "report"
  | "review"
  | "knowledge"
  | "meeting"
  | "product";

export type DistillParamType =
  | "text"
  | "textarea"
  | "select"
  | "date"
  | "number";

export interface DistillParameter {
  key: string;
  label: string;
  type: DistillParamType;
  required: boolean;
  placeholder?: string;
  options?: string[]; // for select type
  defaultValue?: string;
}

export interface DistillTemplate {
  id: string;
  name: string;
  description: string;
  icon: string; // lucide icon name
  category: DistillCategory;
  parameters: DistillParameter[];
  promptTemplate: string; // 用 {{param}} 占位
  steps: string[];
}

export const DISTILL_TEMPLATES: DistillTemplate[] = [
  {
    id: "finance-forecast",
    name: "财务预测",
    description: "基于历史数据生成财务预测报告",
    icon: "TrendingUp",
    category: "finance",
    parameters: [
      {
        key: "period",
        label: "预测周期",
        type: "select",
        required: true,
        options: ["下月", "下季度", "下半年"],
        defaultValue: "下月",
      },
      {
        key: "dataSource",
        label: "数据来源",
        type: "textarea",
        required: true,
        placeholder: "粘贴历史财务数据或描述数据来源...",
      },
      {
        key: "focus",
        label: "重点关注",
        type: "text",
        required: false,
        placeholder: "如：营收增长、成本控制...",
      },
    ],
    promptTemplate: `你是一个财务分析专家。请基于以下信息生成{{period}}的财务预测报告：\n\n数据来源：\n{{dataSource}}\n\n重点关注：{{focus}}\n\n请输出：1.关键指标预测 2.趋势分析 3.风险提示 4.行动建议`,
    steps: ["收集数据", "趋势分析", "生成预测", "输出报告"],
  },
  {
    id: "weekly-report",
    name: "数据周报",
    description: "自动汇总本周工作生成周报",
    icon: "FileText",
    category: "report",
    parameters: [
      {
        key: "week",
        label: "周次",
        type: "text",
        required: true,
        placeholder: "如：2024-W42",
      },
      {
        key: "tasks",
        label: "本周任务",
        type: "textarea",
        required: true,
        placeholder: "列出本周完成的主要任务...",
      },
      {
        key: "metrics",
        label: "关键指标",
        type: "textarea",
        required: false,
        placeholder: "如：完成X个任务，Y个灵感...",
      },
    ],
    promptTemplate: `你是一个周报生成专家。请基于以下信息生成{{week}}的工作周报：\n\n本周任务：\n{{tasks}}\n\n关键指标：{{metrics}}\n\n请输出：1.本周总结 2.成果亮点 3.问题与反思 4.下周计划`,
    steps: ["汇总任务", "提取亮点", "分析问题", "生成周报"],
  },
  {
    id: "code-review",
    name: "代码审查",
    description: "AI 辅助代码审查与改进建议",
    icon: "Code",
    category: "review",
    parameters: [
      {
        key: "code",
        label: "代码内容",
        type: "textarea",
        required: true,
        placeholder: "粘贴待审查的代码...",
      },
      {
        key: "language",
        label: "编程语言",
        type: "select",
        required: true,
        options: ["TypeScript", "JavaScript", "Python", "Go", "Java", "其他"],
        defaultValue: "TypeScript",
      },
      {
        key: "focus",
        label: "审查重点",
        type: "select",
        required: false,
        options: ["安全性", "性能", "可读性", "最佳实践", "全面审查"],
        defaultValue: "全面审查",
      },
    ],
    promptTemplate: `你是一个{{language}}代码审查专家。请审查以下代码，重点关注{{focus}}：\n\n\`\`\`{{language}}\n{{code}}\n\`\`\`\n\n请输出：1.问题列表（按严重程度排序）2.改进建议 3.重构方案（如适用）`,
    steps: ["分析代码", "识别问题", "生成建议", "输出报告"],
  },
  {
    id: "knowledge-distill",
    name: "知识蒸馏",
    description: "从对话/文档中提取可复用认知",
    icon: "Brain",
    category: "knowledge",
    parameters: [
      {
        key: "content",
        label: "源内容",
        type: "textarea",
        required: true,
        placeholder: "粘贴对话/文档内容...",
      },
      {
        key: "type",
        label: "提取类型",
        type: "select",
        required: true,
        options: ["方法论", "经验教训", "提示词模板", "全部"],
        defaultValue: "全部",
      },
    ],
    promptTemplate: `你是一个知识蒸馏专家。请从以下内容中提取{{type}}：\n\n{{content}}\n\n请输出结构化的认知资产，标注类型和适用场景。`,
    steps: ["阅读理解", "识别认知", "结构化提取", "输出资产"],
  },
  {
    id: "meeting-minutes",
    name: "会议纪要",
    description: "将会议内容转化为结构化纪要",
    icon: "Users",
    category: "meeting",
    parameters: [
      {
        key: "meetingTitle",
        label: "会议主题",
        type: "text",
        required: true,
        placeholder: "如：产品周会、需求评审...",
      },
      {
        key: "content",
        label: "会议内容",
        type: "textarea",
        required: true,
        placeholder: "粘贴会议记录、语音转文字或笔记...",
      },
      {
        key: "participants",
        label: "参会人员",
        type: "text",
        required: false,
        placeholder: "如：张三、李四、王五",
      },
      {
        key: "focus",
        label: "重点关注",
        type: "select",
        required: false,
        options: ["决策项", "待办事项", "风险问题", "全部"],
        defaultValue: "全部",
      },
    ],
    promptTemplate: `你是一个会议纪要专家。请基于以下信息生成结构化会议纪要：\n\n会议主题：{{meetingTitle}}\n参会人员：{{participants}}\n重点关注：{{focus}}\n\n会议内容：\n{{content}}\n\n请输出：1.会议概要（2-3句话）2.讨论要点 3.决策事项 4.待办事项（标注负责人和截止时间）5.遗留问题`,
    steps: ["梳理内容", "提取要点", "识别决策", "输出纪要"],
  },
  {
    id: "prd-generator",
    name: "PRD 生成",
    description: "从需求描述生成产品需求文档",
    icon: "Package",
    category: "product",
    parameters: [
      {
        key: "requirement",
        label: "需求描述",
        type: "textarea",
        required: true,
        placeholder: "描述产品需求或功能点...",
      },
      {
        key: "productName",
        label: "产品名称",
        type: "text",
        required: false,
        placeholder: "如：奇思、记忆图谱...",
      },
      {
        key: "audience",
        label: "目标用户",
        type: "text",
        required: false,
        placeholder: "如：个人开发者、产品经理...",
      },
      {
        key: "priority",
        label: "优先级",
        type: "select",
        required: false,
        options: ["P0-紧急", "P1-高", "P2-中", "P3-低"],
        defaultValue: "P2-中",
      },
    ],
    promptTemplate: `你是一个资深产品经理。请基于以下信息生成 PRD 文档：\n\n产品名称：{{productName}}\n目标用户：{{audience}}\n优先级：{{priority}}\n\n需求描述：\n{{requirement}}\n\n请输出：1.需求背景 2.目标与非目标 3.功能详述（含用户流程）4.数据指标 5.里程碑计划 6.风险与依赖`,
    steps: ["理解需求", "梳理流程", "细化功能", "输出 PRD"],
  },
  {
    id: "competitor-analysis",
    name: "竞品分析",
    description: "生成竞品对比分析报告",
    icon: "TrendingUp",
    category: "product",
    parameters: [
      {
        key: "competitors",
        label: "竞品列表",
        type: "textarea",
        required: true,
        placeholder: "列出竞品名称和网址，每行一个...",
      },
      {
        key: "dimensions",
        label: "分析维度",
        type: "select",
        required: false,
        options: ["功能对比", "定价策略", "用户体验", "技术架构", "全面分析"],
        defaultValue: "全面分析",
      },
      {
        key: "ourProduct",
        label: "我方产品",
        type: "text",
        required: false,
        placeholder: "我方产品名称...",
      },
      {
        key: "goal",
        label: "分析目标",
        type: "text",
        required: false,
        placeholder: "如：寻找差异化机会、优化定价...",
      },
    ],
    promptTemplate: `你是一个竞品分析专家。请基于以下信息生成竞品分析报告：\n\n我方产品：{{ourProduct}}\n分析维度：{{dimensions}}\n分析目标：{{goal}}\n\n竞品列表：\n{{competitors}}\n\n请输出：1.市场概览 2.竞品对比矩阵 3.各自优势与劣势 4.差异化机会 5.战略建议`,
    steps: ["收集信息", "对比分析", "识别差异", "输出报告"],
  },
];

// 根据 id 查找模板
export function getDistillTemplate(
  id: string
): DistillTemplate | undefined {
  return DISTILL_TEMPLATES.find((t) => t.id === id);
}

// 用参数填充 promptTemplate
export function fillPromptTemplate(
  template: DistillTemplate,
  parameters: Record<string, string>
): string {
  let prompt = template.promptTemplate;
  for (const param of template.parameters) {
    const value = parameters[param.key] ?? "";
    prompt = prompt.replaceAll(`{{${param.key}}}`, value);
  }
  return prompt;
}

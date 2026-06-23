// Skill 解析/序列化工具
// 支持 Markdown + YAML frontmatter 格式
// 不引入 js-yaml，自己实现简易 YAML 解析（仅支持 Skill 所需语法）

export type SkillParamType =
  | "text"
  | "textarea"
  | "select"
  | "date"
  | "number";

export interface SkillParameter {
  key: string;
  label: string;
  type: SkillParamType;
  required: boolean;
  placeholder?: string;
  options?: string[];
  defaultValue?: string;
}

export interface SkillData {
  name: string;
  description: string;
  category: string;
  tags: string[];
  parameters: SkillParameter[];
  content: string;
  promptTemplate: string;
  source?: string;
}

// ============ 基础工具 ============

function stripQuotes(s: string): string {
  const t = s.trim();
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    return t.slice(1, -1);
  }
  return t;
}

function getIndent(line: string): number {
  return line.length - line.replace(/^\s+/, "").length;
}

// 解析行内标量：支持字符串、数字、布尔、行内数组 [a, b, c]
function parseInlineScalar(s: string): unknown {
  const t = s.trim();
  if (t === "") return "";
  if (t.startsWith("[") && t.endsWith("]")) {
    const inner = t.slice(1, -1).trim();
    if (inner === "") return [];
    return inner.split(",").map((x) => stripQuotes(x.trim()));
  }
  if (t === "true") return true;
  if (t === "false") return false;
  if (t === "null" || t === "~") return "";
  if (/^-?\d+$/.test(t)) return parseInt(t, 10);
  if (/^-?\d+\.\d+$/.test(t)) return parseFloat(t);
  return stripQuotes(t);
}

// ============ YAML 解析（针对 Skill frontmatter） ============
// 支持：
//   key: value
//   key: [a, b, c]
//   key:
//     - item
//     - key: val
//       key2: val2

function parseSkillYaml(text: string): Record<string, unknown> {
  const lines = text.split(/\r?\n/);
  const root: Record<string, unknown> = {};
  let i = 0;

  // 解析一个对象块：collected 为已收集的行，objIndent 为字段所在缩进
  function parseObject(
    collected: string[],
    objIndent: number
  ): Record<string, unknown> {
    const obj: Record<string, unknown> = {};
    let idx = 0;
    while (idx < collected.length) {
      const line = collected[idx];
      if (line.trim() === "") {
        idx++;
        continue;
      }
      const ind = getIndent(line);
      if (ind < objIndent) break;
      if (ind > objIndent) {
        // 属于子块，跳过（由父级处理）
        idx++;
        continue;
      }
      const content = line.trim();
      const kvMatch = content.match(/^([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
      if (!kvMatch) {
        idx++;
        continue;
      }
      const key = kvMatch[1];
      const val = kvMatch[2];
      if (val.trim() === "") {
        // 值在后续缩进行
        idx++;
        const subLines: string[] = [];
        while (idx < collected.length) {
          const sl = collected[idx];
          if (sl.trim() === "") {
            idx++;
            continue;
          }
          if (getIndent(sl) <= ind) break;
          subLines.push(sl);
          idx++;
        }
        obj[key] = parseValueBlock(subLines);
      } else {
        obj[key] = parseInlineScalar(val);
        idx++;
      }
    }
    return obj;
  }

  // 解析值块：判断是数组还是对象
  function parseValueBlock(subLines: string[]): unknown {
    if (subLines.length === 0) return "";
    const first = subLines.find((l) => l.trim() !== "") || "";
    if (first.trim().startsWith("- ")) {
      return parseArray(subLines);
    }
    const objIndent = getIndent(first);
    return parseObject(subLines, objIndent);
  }

  // 解析数组块
  function parseArray(collected: string[]): unknown[] {
    const arr: unknown[] = [];
    let idx = 0;
    // 数组项的起始缩进（"-" 所在列）
    let arrIndent = -1;
    while (idx < collected.length) {
      const line = collected[idx];
      if (line.trim() === "") {
        idx++;
        continue;
      }
      const ind = getIndent(line);
      if (arrIndent < 0) arrIndent = ind;
      if (ind < arrIndent) break;
      const content = line.trim();
      if (!content.startsWith("- ")) {
        idx++;
        continue;
      }
      const rest = content.slice(2).trim();
      const kvMatch = rest.match(/^([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
      if (kvMatch) {
        // 数组项是对象
        const obj: Record<string, unknown> = {};
        const key = kvMatch[1];
        const val = kvMatch[2];
        if (val.trim() === "") {
          obj[key] = "";
          idx++;
          // 收集属于此对象的后续字段（缩进 > ind）
          const subLines: string[] = [];
          while (idx < collected.length) {
            const sl = collected[idx];
            if (sl.trim() === "") {
              idx++;
              continue;
            }
            if (getIndent(sl) <= ind) break;
            subLines.push(sl);
            idx++;
          }
          if (subLines.length > 0) {
            const subIndent = getIndent(subLines[0]);
            Object.assign(obj, parseObject(subLines, subIndent));
          }
          arr.push(obj);
        } else {
          obj[key] = parseInlineScalar(val);
          idx++;
          // 收集同对象后续字段（缩进 > ind，且不是新的列表项）
          const subLines: string[] = [];
          while (idx < collected.length) {
            const sl = collected[idx];
            if (sl.trim() === "") {
              idx++;
              continue;
            }
            const slInd = getIndent(sl);
            if (slInd <= ind) break;
            subLines.push(sl);
            idx++;
          }
          if (subLines.length > 0) {
            const subIndent = getIndent(subLines[0]);
            Object.assign(obj, parseObject(subLines, subIndent));
          }
          arr.push(obj);
        }
      } else {
        // 纯标量列表项
        arr.push(parseInlineScalar(rest));
        idx++;
      }
    }
    return arr;
  }

  // 顶层解析
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "") {
      i++;
      continue;
    }
    const indent = getIndent(line);
    const content = line.trim();
    const kvMatch = content.match(/^([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
    if (!kvMatch) {
      i++;
      continue;
    }
    const key = kvMatch[1];
    const val = kvMatch[2];
    if (val.trim() === "") {
      i++;
      const subLines: string[] = [];
      while (i < lines.length) {
        const sl = lines[i];
        if (sl.trim() === "") {
          i++;
          continue;
        }
        if (getIndent(sl) <= indent) break;
        subLines.push(sl);
        i++;
      }
      root[key] = parseValueBlock(subLines);
    } else {
      root[key] = parseInlineScalar(val);
      i++;
    }
  }

  return root;
}

// ============ YAML 序列化 ============

function serializeValue(v: unknown): string {
  if (typeof v === "string") {
    if (/[:#\[\]{}&*!|>'"%@`]/.test(v) || v.includes("\n")) {
      return `"${v.replace(/"/g, '\\"')}"`;
    }
    return v;
  }
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) {
    return `[${v.map((x) => serializeValue(x)).join(", ")}]`;
  }
  return String(v);
}

function serializeParameter(p: SkillParameter): string[] {
  const lines: string[] = [`  - key: ${serializeValue(p.key)}`];
  lines.push(`    label: ${serializeValue(p.label)}`);
  lines.push(`    type: ${serializeValue(p.type)}`);
  lines.push(`    required: ${serializeValue(p.required)}`);
  if (p.placeholder) {
    lines.push(`    placeholder: ${serializeValue(p.placeholder)}`);
  }
  if (p.options && p.options.length > 0) {
    lines.push(
      `    options: [${p.options.map((o) => serializeValue(o)).join(", ")}]`
    );
  }
  if (p.defaultValue) {
    lines.push(`    defaultValue: ${serializeValue(p.defaultValue)}`);
  }
  return lines;
}

function serializeYaml(data: {
  name: string;
  description: string;
  category: string;
  tags: string[];
  parameters: SkillParameter[];
  source?: string;
}): string {
  const lines: string[] = [];
  lines.push(`name: ${serializeValue(data.name)}`);
  lines.push(`description: ${serializeValue(data.description)}`);
  lines.push(`category: ${serializeValue(data.category)}`);
  lines.push(`tags: [${data.tags.map((t) => serializeValue(t)).join(", ")}]`);
  if (data.source) {
    lines.push(`source: ${serializeValue(data.source)}`);
  }
  if (data.parameters.length > 0) {
    lines.push("parameters:");
    for (const p of data.parameters) {
      lines.push(...serializeParameter(p));
    }
  } else {
    lines.push("parameters: []");
  }
  return lines.join("\n");
}

// ============ 公共 API ============

/**
 * 从 Markdown 正文中提取提示词模板
 * 规则：查找 "## 提示词模板" / "## 提示词" / "## Prompt Template" 段落
 */
export function extractPromptTemplate(content: string): string {
  const patterns = [
    /^##\s*提示词模板\s*$/im,
    /^##\s*提示词\s*$/im,
    /^##\s*Prompt\s*Template\s*$/im,
    /^##\s*Prompt\s*$/im,
  ];
  for (const pat of patterns) {
    const match = pat.exec(content);
    if (match) {
      const startIdx = match.index + match[0].length;
      const rest = content.slice(startIdx);
      const nextHeading = /^##\s+/m.exec(rest);
      const body = nextHeading ? rest.slice(0, nextHeading.index) : rest;
      return body.trim();
    }
  }
  return "";
}

/**
 * 解析 Skill Markdown（YAML frontmatter + 正文）
 */
export function parseSkillMarkdown(md: string): SkillData {
  const fmMatch = md.match(
    /^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n?([\s\S]*)$/
  );
  if (!fmMatch) {
    return {
      name: "",
      description: "",
      category: "general",
      tags: [],
      parameters: [],
      content: md.trim(),
      promptTemplate: extractPromptTemplate(md),
      source: "imported",
    };
  }

  const yamlText = fmMatch[1];
  const body = fmMatch[2] || "";
  const parsed = parseSkillYaml(yamlText);

  const name = typeof parsed.name === "string" ? parsed.name : "";
  const description =
    typeof parsed.description === "string" ? parsed.description : "";
  const category =
    typeof parsed.category === "string" ? parsed.category : "general";
  const tags = Array.isArray(parsed.tags)
    ? parsed.tags.map((t) => String(t))
    : [];
  const source = typeof parsed.source === "string" ? parsed.source : "imported";

  const parameters: SkillParameter[] = Array.isArray(parsed.parameters)
    ? parsed.parameters
        .map((p): SkillParameter | null => {
          if (!p || typeof p !== "object") return null;
          const obj = p as Record<string, unknown>;
          const key = typeof obj.key === "string" ? obj.key : "";
          if (!key) return null;
          return {
            key,
            label: typeof obj.label === "string" ? obj.label : key,
            type: (typeof obj.type === "string"
              ? obj.type
              : "text") as SkillParamType,
            required: obj.required === true,
            placeholder:
              typeof obj.placeholder === "string" ? obj.placeholder : undefined,
            options: Array.isArray(obj.options)
              ? obj.options.map((x) => String(x))
              : undefined,
            defaultValue:
              typeof obj.defaultValue === "string"
                ? obj.defaultValue
                : undefined,
          };
        })
        .filter((x): x is SkillParameter => x !== null)
    : [];

  const content = body.trim();
  const promptTemplate =
    extractPromptTemplate(content) ||
    (typeof parsed.promptTemplate === "string" ? parsed.promptTemplate : "");

  return {
    name,
    description,
    category,
    tags,
    parameters,
    content,
    promptTemplate,
    source,
  };
}

/**
 * 序列化 Skill 为 Markdown（YAML frontmatter + 正文）
 */
export function serializeSkillToMarkdown(skill: {
  name: string;
  description: string;
  category: string;
  tags: string[];
  parameters: SkillParameter[];
  content: string;
  promptTemplate: string;
  source?: string;
}): string {
  const yaml = serializeYaml({
    name: skill.name,
    description: skill.description,
    category: skill.category,
    tags: skill.tags,
    parameters: skill.parameters,
    source: skill.source,
  });

  const parts: string[] = [];
  parts.push("---");
  parts.push(yaml);
  parts.push("---");
  parts.push("");

  let content = skill.content || "";
  if (skill.promptTemplate && !extractPromptTemplate(content)) {
    if (content && !content.endsWith("\n")) content += "\n\n";
    else if (content) content += "\n";
    content += "## 提示词模板\n\n" + skill.promptTemplate;
  }
  parts.push(content);

  return parts.join("\n");
}

/**
 * 用参数填充 promptTemplate（替换 {{param}}）
 */
export function fillPromptTemplate(
  template: string,
  parameters: Record<string, string>
): string {
  let prompt = template;
  for (const [key, value] of Object.entries(parameters)) {
    prompt = prompt.replaceAll(`{{${key}}}`, value ?? "");
  }
  return prompt;
}

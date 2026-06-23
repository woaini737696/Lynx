import type { ConversationSource } from "@/lib/utils";

// 支持的文件类型
export type FileType =
  | "md"
  | "html"
  | "txt"
  | "csv"
  | "json"
  | "image"
  | "pdf"
  | "spreadsheet" // xlsx / xls - 标记为待解析（不安装重型依赖）
  | "unknown";

const EXT_MAP: Record<string, FileType> = {
  md: "md",
  markdown: "md",
  html: "html",
  htm: "html",
  txt: "txt",
  csv: "csv",
  json: "json",
  png: "image",
  jpg: "image",
  jpeg: "image",
  gif: "image",
  webp: "image",
  pdf: "pdf",
  xlsx: "spreadsheet",
  xls: "spreadsheet",
};

// 根据文件名推断类型
export function getFileType(filename: string): FileType {
  const ext = filename.toLowerCase().split(".").pop() || "";
  return EXT_MAP[ext] || "unknown";
}

// 文件类型 -> 对话来源 source
export function fileTypeToSource(type: FileType): ConversationSource | null {
  switch (type) {
    case "md":
      return "file-md";
    case "html":
      return "file-html";
    case "txt":
      return "file-txt";
    case "csv":
      return "file-csv";
    case "json":
      return "file-json";
    case "image":
      return "file-image";
    case "pdf":
      return "file-pdf";
    case "spreadsheet":
      // 表格类暂归入 file-csv 来源（仅记录文件名，不解析内容）
      return "file-csv";
    default:
      return null;
  }
}

// HTML -> 纯文本（去除 script/style/标签）
export function parseHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// CSV -> 表格文本（用 | 分隔列）
export function parseCsv(csv: string): string {
  return csv
    .split("\n")
    .map((row) => row.split(",").join(" | "))
    .join("\n");
}

// JSON -> 格式化文本
export function parseJson(json: string): string {
  try {
    return JSON.stringify(JSON.parse(json), null, 2);
  } catch {
    return json;
  }
}

// 图片 base64 缩略图（前 1000 字符）
export function imageThumb(base64: string): string {
  return base64.slice(0, 1000);
}

// PDF -> 文本（动态加载 pdf-parse v2，使用 PDFParse 类）
export async function parsePdf(buffer: Buffer): Promise<string> {
  // 动态 import 避免 pdf-parse 在构建期被静态分析触发副作用
  const { PDFParse } = await import("pdf-parse");
  // pdf-parse v2 接受 Uint8Array；Buffer 是 Uint8Array 的子类型，直接传入即可
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText();
    const text = (result?.text || "").trim();
    if (!text) {
      throw new Error("PDF 文本为空（可能是扫描件）");
    }
    return text;
  } finally {
    await parser.destroy().catch(() => {});
  }
}

// 表格类（xlsx / xls）- 暂不解析，仅返回文件名占位
// 后续如需解析可在此处接入 xlsx 库
export function parseSpreadsheetPlaceholder(filename: string): string {
  return `[表格文件待解析] ${filename}\n（当前版本未集成 xlsx 解析，仅记录文件名）`;
}

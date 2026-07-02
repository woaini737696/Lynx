// 安全表达式求值器
//
// 替代 new Function()，避免代码执行风险。
// 支持运算符：! == != > < >= <= && || ?:
// 支持字面量：数字、字符串（单/双引号）、true/false/null
// 支持变量引用：传入 context 的 key 可直接引用
// 支持括号分组、成员访问（a.b.c）
//
// 用法：
//   const result = evaluate("output == 'hello' && count > 5", { output: "hello", count: 10 });
//   // → { ok: true, value: true }

export interface EvalResult {
  ok: boolean;
  value: unknown;
  error?: string;
}

// ============ Tokenizer ============

type TokenType = "num" | "str" | "ident" | "op" | "eof";

interface Token {
  type: TokenType;
  value: string;
}

const OPS = new Set(["!", "==", "!=", ">", "<", ">=", "<=", "&&", "||", "?", ":", ".", "(", ")"]);

function tokenize(expr: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < expr.length) {
    const ch = expr[i];
    if (ch === " " || ch === "\t" || ch === "\n") { i++; continue; }
    // 数字
    if (/[0-9]/.test(ch) || (ch === "." && /[0-9]/.test(expr[i + 1] ?? ""))) {
      let num = "";
      while (i < expr.length && /[0-9.]/.test(expr[i])) num += expr[i++];
      tokens.push({ type: "num", value: num });
      continue;
    }
    // 字符串
    if (ch === "'" || ch === '"') {
      const quote = ch;
      i++;
      let str = "";
      while (i < expr.length && expr[i] !== quote) {
        if (expr[i] === "\\" && i + 1 < expr.length) { str += expr[i + 1]; i += 2; continue; }
        str += expr[i++];
      }
      i++; // 跳过闭合引号
      tokens.push({ type: "str", value: str });
      continue;
    }
    // 标识符（含 true/false/null）
    if (/[a-zA-Z_$]/.test(ch)) {
      let ident = "";
      while (i < expr.length && /[a-zA-Z0-9_$]/.test(expr[i])) ident += expr[i++];
      tokens.push({ type: "ident", value: ident });
      continue;
    }
    // 多字符运算符
    const two = expr.slice(i, i + 2);
    if (OPS.has(two)) { tokens.push({ type: "op", value: two }); i += 2; continue; }
    // 单字符运算符
    if (OPS.has(ch)) { tokens.push({ type: "op", value: ch }); i++; continue; }
    throw new Error(`非法字符: ${ch}`);
  }
  tokens.push({ type: "eof", value: "" });
  return tokens;
}

// ============ Parser (递归下降) ============

class Parser {
  private pos = 0;
  constructor(private tokens: Token[], private ctx: Record<string, unknown>) {}

  private peek(): Token { return this.tokens[this.pos]; }
  private next(): Token { return this.tokens[this.pos++]; }

  parse(): unknown {
    const result = this.parseTernary();
    if (this.peek().type !== "eof") throw new Error("表达式末尾有多余字符");
    return result;
  }

  // 三元表达式：cond ? a : b
  private parseTernary(): unknown {
    const cond = this.parseLogicOr();
    if (this.peek().value === "?") {
      this.next();
      const then = this.parseTernary();
      if (this.peek().value !== ":") throw new Error("三元表达式缺少 :");
      this.next();
      const els = this.parseTernary();
      return cond ? then : els;
    }
    return cond;
  }

  // 逻辑或：a || b
  private parseLogicOr(): unknown {
    let left = this.parseLogicAnd();
    while (this.peek().value === "||") {
      this.next();
      const right = this.parseLogicAnd();
      left = left || right;
    }
    return left;
  }

  // 逻辑与：a && b
  private parseLogicAnd(): unknown {
    let left = this.parseEquality();
    while (this.peek().value === "&&") {
      this.next();
      const right = this.parseEquality();
      left = left && right;
    }
    return left;
  }

  // 相等比较：== !=
  private parseEquality(): unknown {
    let left = this.parseComparison();
    while (["==", "!="].includes(this.peek().value)) {
      const op = this.next().value;
      const right = this.parseComparison();
      left = op === "==" ? left === right : left !== right;
    }
    return left;
  }

  // 大小比较：> < >= <=
  private parseComparison(): unknown {
    let left = this.parseUnary();
    while ([">", "<", ">=", "<="].includes(this.peek().value)) {
      const op = this.next().value;
      const right = this.parseUnary();
      const l = Number(left), r = Number(right);
      if (op === ">") left = l > r;
      else if (op === "<") left = l < r;
      else if (op === ">=") left = l >= r;
      else left = l <= r;
    }
    return left;
  }

  // 一元运算：!
  private parseUnary(): unknown {
    if (this.peek().value === "!") {
      this.next();
      return !this.parseUnary();
    }
    return this.parsePrimary();
  }

  // 主表达式：字面量、变量、括号、成员访问
  private parsePrimary(): unknown {
    const tok = this.peek();
    // 括号
    if (tok.value === "(") {
      this.next();
      const inner = this.parseTernary();
      if (this.peek().value !== ")") throw new Error("缺少右括号");
      this.next();
      return this.parseMemberAccess(inner);
    }
    // 数字
    if (tok.type === "num") {
      this.next();
      return parseFloat(tok.value);
    }
    // 字符串
    if (tok.type === "str") {
      this.next();
      return tok.value;
    }
    // 标识符：true/false/null/变量名
    if (tok.type === "ident") {
      this.next();
      let val: unknown;
      if (tok.value === "true") val = true;
      else if (tok.value === "false") val = false;
      else if (tok.value === "null") val = null;
      else val = this.ctx[tok.value];
      return this.parseMemberAccess(val);
    }
    throw new Error(`意外的 token: ${tok.value || tok.type}`);
  }

  // 成员访问：a.b.c
  private parseMemberAccess(val: unknown): unknown {
    while (this.peek().value === ".") {
      this.next();
      const key = this.next();
      if (key.type !== "ident") throw new Error("成员访问需要标识符");
      val = val && typeof val === "object" ? (val as Record<string, unknown>)[key.value] : undefined;
    }
    return val;
  }
}

// ============ 公共 API ============

/** 安全求值表达式，返回 { ok, value, error? } */
export function evaluate(expression: string, context: Record<string, unknown>): EvalResult {
  if (!expression || !expression.trim()) return { ok: true, value: true };
  try {
    const tokens = tokenize(expression.trim());
    const parser = new Parser(tokens, context);
    const value = parser.parse();
    return { ok: true, value };
  } catch (e) {
    return { ok: false, value: false, error: "表达式求值失败：" + (e as Error).message };
  }
}

/** 安全求值表达式，返回布尔值（用于条件判断） */
export function evaluateBool(expression: string, context: Record<string, unknown>): { ok: boolean; value: boolean; error?: string } {
  const res = evaluate(expression, context);
  if (!res.ok) return { ok: false, value: false, error: res.error };
  return { ok: true, value: Boolean(res.value) };
}

/** 安全求值表达式，返回字符串（用于数据转换） */
export function evaluateStr(expression: string, context: Record<string, unknown>): { ok: boolean; value: string; error?: string } {
  const res = evaluate(expression, context);
  if (!res.ok) return { ok: false, value: "", error: res.error };
  const v = res.value;
  return { ok: true, value: typeof v === "string" ? v : v == null ? "" : JSON.stringify(v) };
}

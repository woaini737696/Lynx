// 轻量 JWT 实现（HS256），依赖 Node crypto，无需额外 npm 包
// 供 App 端 Token 鉴权使用，与 NextAuth session 并存

import crypto from "crypto";

const SECRET = process.env.AUTH_SECRET;

// 生产环境强制要求 AUTH_SECRET（与 auth.ts 保持一致）
if (!SECRET && process.env.NODE_ENV === "production") {
  throw new Error("AUTH_SECRET 环境变量未配置，请运行 `openssl rand -base64 32` 生成并配置到 .env");
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function hmacSign(data: string): string {
  return crypto.createHmac("sha256", SECRET as string).update(data).digest("base64url");
}

export interface JwtPayload {
  id: string;
  username: string;
  role: string;
  iat?: number;
  exp?: number;
}

/** 签发 JWT，有效期 7 天（与 NextAuth session maxAge 一致） */
export async function signToken(payload: JwtPayload): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + 7 * 24 * 60 * 60 };
  const headerB64 = base64url(JSON.stringify(header));
  const bodyB64 = base64url(JSON.stringify(body));
  const data = `${headerB64}.${bodyB64}`;
  return `${data}.${hmacSign(data)}`;
}

/** 校验 JWT 签名与过期时间，失败返回 null */
export async function verifyToken(token: string): Promise<JwtPayload | null> {
  if (!SECRET) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [headerB64, bodyB64, signature] = parts;
  const data = `${headerB64}.${bodyB64}`;
  const expectedSig = hmacSign(data);

  // 定时安全比较，防止时序攻击
  const a = Buffer.from(signature);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const body = JSON.parse(Buffer.from(bodyB64, "base64url").toString()) as JwtPayload;
    if (body.exp && body.exp < Math.floor(Date.now() / 1000)) return null;
    return body;
  } catch {
    return null;
  }
}

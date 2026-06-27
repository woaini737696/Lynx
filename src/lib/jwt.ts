// 轻量 JWT 实现（HS256），依赖 Node crypto，无需额外 npm 包
// 供 App 端 Token 鉴权使用，与 NextAuth session 并存

import crypto from "crypto";
import os from "os";

// 动态读取 SECRET：避免模块加载时 process.env 尚未填充导致 SECRET 为 undefined
// （Next.js dev server 中 .env 由 dotenv 在运行时注入，模块顶层常量可能读取过早）
function getSecret(): string {
  const s = process.env.AUTH_SECRET;
  if (s) return s;

  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET 环境变量未配置，请运行 `openssl rand -base64 32` 生成并配置到 .env");
  }

  // 开发环境：生成一个固定的默认 secret（不安全但非空），避免空密钥导致的安全问题
  // 基于 hostname + 固定盐值，保证同一开发机器上 secret 稳定（重启后 token 不失效）
  const devSecret = `dev-secret-not-for-production:${os.hostname()}:lynx-hub`;
  if (!devSecretWarningShown) {
    devSecretWarningShown = true;
    console.warn(
      "[jwt] WARNING: AUTH_SECRET 未配置，开发环境使用默认非安全 secret。请勿在生产环境使用！"
    );
  }
  return devSecret;
}

// 标记 warning 是否已打印（避免重复日志）
let devSecretWarningShown = false;

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function hmacSign(data: string): string {
  return crypto.createHmac("sha256", getSecret()).update(data).digest("base64url");
}

export interface JwtPayload {
  id: string;
  username: string;
  role: string;
  // 权限缓存版本号：角色变更时递增，用于多实例部署时缓存失效
  permissionVersion?: number;
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
  const secret = getSecret();
  if (!secret) {
    console.error("[jwt] verifyToken: SECRET 为空");
    return null;
  }
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [headerB64, bodyB64, signature] = parts;
  const data = `${headerB64}.${bodyB64}`;
  const expectedSig = hmacSign(data);

  // 定时安全比较，防止时序攻击
  const a = Buffer.from(signature);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    console.error("[jwt] verifyToken: 签名不匹配", { expected: expectedSig.slice(0, 10), actual: signature.slice(0, 10), secretLen: secret.length });
    return null;
  }

  try {
    const body = JSON.parse(Buffer.from(bodyB64, "base64url").toString()) as JwtPayload;
    if (body.exp && body.exp < Math.floor(Date.now() / 1000)) return null;
    return body;
  } catch {
    return null;
  }
}

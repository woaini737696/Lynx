import { NextRequest } from "next/server";
import { handlers } from "@/auth";
import { rateLimit, getClientKey } from "@/lib/rate-limit";

// 包装 NextAuth 的 POST 处理器，对 credentials 登录回调添加 rate limiting
// 限流：10 次/分钟（防暴力破解）
const originalPOST = handlers.POST;

async function POST(req: NextRequest) {
  // 仅对 credentials 回调（登录）做限流
  const url = new URL(req.url);
  if (url.pathname.endsWith("/callback/credentials")) {
    const ip = getClientKey(req);
    const { success, remaining, resetAt } = rateLimit(
      `login:${ip}`,
      10,
      60 * 1000
    );
    if (!success) {
      return new Response(
        JSON.stringify({ error: "登录尝试过于频繁，请稍后再试" }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "X-RateLimit-Limit": "10",
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(Math.floor(resetAt / 1000)),
            "Retry-After": String(Math.ceil((resetAt - Date.now()) / 1000)),
          },
        }
      );
    }
    const response = await originalPOST(req);
    // 透传限流信息到响应头（Headers 不可变，重新构造以避免 undici TypeError）
    const newHeaders = new Headers(response.headers);
    newHeaders.set("X-RateLimit-Remaining", String(remaining));
    newHeaders.set("X-RateLimit-Reset", String(Math.floor(resetAt / 1000)));
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  }
  return originalPOST(req);
}

export const { GET } = handlers;
export { POST };

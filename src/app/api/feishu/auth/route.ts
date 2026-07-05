// GET /api/feishu/auth
// 重定向到飞书授权页面，发起 OAuth 流程
// 需要登录（requireAuth），将 userId 编码到 state 中供回调用
// 支持 ?desktop=1 参数：标记桌面端 OAuth，回调时展示桌面端友好的成功页
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { serverLog } from "@/lib/logger";

// redirect_uri 必须与飞书应用配置一致，默认生产域名；可用 FEISHU_REDIRECT_URI 环境变量覆盖（本地调试）
const DEFAULT_REDIRECT_URI = "https://ai.lynxdo.com/api/feishu/callback";

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth.user === null) return auth.error;
  const userId = auth.user?.id;

  const appId = process.env.LARK_APP_ID;
  if (!appId) {
    serverLog.feishuError("auth-missing-app-id", { userId });
    return NextResponse.json({ error: "服务器未配置飞书应用" }, { status: 500 });
  }

  const redirectUri = process.env.FEISHU_REDIRECT_URI || DEFAULT_REDIRECT_URI;

  // 检测 desktop=1 参数（桌面端 OAuth 流程标记）
  const url = new URL(req.url);
  const isDesktop = url.searchParams.get("desktop") === "1";

  serverLog.feishu("auth-redirect", {
    userId,
    appId,
    redirectUri,
    source: process.env.FEISHU_REDIRECT_URI ? "env" : "default",
    isDesktop,
  });

  // state 编码 userId + 随机 nonce + 可选 desktop 标记，用于 CSRF 防护和回调时识别用户
  const nonce = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  const statePayload = isDesktop
    ? `${auth.user.id}:${nonce}:desktop`
    : `${auth.user.id}:${nonce}`;
  const state = Buffer.from(statePayload).toString("base64url");

  const authorizeUrl =
    `https://open.feishu.cn/open-apis/authen/v1/authorize` +
    `?app_id=${encodeURIComponent(appId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${encodeURIComponent(state)}`;

  return NextResponse.redirect(authorizeUrl);
}

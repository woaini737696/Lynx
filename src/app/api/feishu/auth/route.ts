// GET /api/feishu/auth
// 重定向到飞书授权页面，发起 OAuth 流程
// 需要登录（requireAuth），将 userId 编码到 state 中供回调用
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { getLogger } from "@/lib/logger";

const logger = getLogger("feishu-auth");

// redirect_uri 必须与飞书应用配置一致，默认生产域名；可用 FEISHU_REDIRECT_URI 环境变量覆盖（本地调试）
const DEFAULT_REDIRECT_URI = "https://ai.lynxdo.com/api/feishu/callback";

export async function GET() {
  const auth = await requireAuth();
  if (auth.user === null) return auth.error;

  const appId = process.env.LARK_APP_ID;
  if (!appId) {
    logger.error("[feishu-auth] 缺少环境变量 LARK_APP_ID");
    return NextResponse.json({ error: "服务器未配置飞书应用" }, { status: 500 });
  }

  const redirectUri = process.env.FEISHU_REDIRECT_URI || DEFAULT_REDIRECT_URI;

  // state 编码 userId + 随机 nonce，用于 CSRF 防护和回调时识别用户
  const nonce = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  const state = Buffer.from(`${auth.user.id}:${nonce}`).toString("base64url");

  const authorizeUrl =
    `https://open.feishu.cn/open-apis/authen/v1/authorize` +
    `?app_id=${encodeURIComponent(appId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${encodeURIComponent(state)}`;

  return NextResponse.redirect(authorizeUrl);
}

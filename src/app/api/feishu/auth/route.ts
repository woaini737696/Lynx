// GET /api/feishu/auth
// 重定向到飞书授权页面，发起 OAuth 流程
// 需要登录（requireAuth），将 userId 编码到 state 中供回调用
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { serverLog } from "@/lib/logger";

// redirect_uri 必须与飞书应用配置一致，默认生产域名；可用 FEISHU_REDIRECT_URI 环境变量覆盖（本地调试）
const DEFAULT_REDIRECT_URI = "https://ai.lynxdo.com/api/feishu/callback";

export async function GET() {
  const auth = await requireAuth();
  if (auth.user === null) return auth.error;
  const userId = auth.user?.id;

  const appId = process.env.LARK_APP_ID;
  if (!appId) {
    serverLog.feishuError("auth-missing-app-id", { userId });
    return NextResponse.json({ error: "服务器未配置飞书应用" }, { status: 500 });
  }

  const redirectUri = process.env.FEISHU_REDIRECT_URI || DEFAULT_REDIRECT_URI;

  // P0 修复（20029 错误诊断）：打印实际使用的 redirect_uri，便于对比飞书后台白名单配置
  // 飞书错误码 20029 = "重定向 URL 有误" → redirect_uri 未在飞书开放平台「安全设置 → 重定向URL」白名单中
  // 排查步骤：
  //   1) 检查飞书开放平台 → 应用 → 安全设置 → 重定向URL
  //   2) 必须完全一致（协议/域名/路径/末尾斜杠），如 https://ai.lynxdo.com/api/feishu/callback
  //   3) 修改后需重新发布应用版本并等待生效（约 1-5 分钟）
  serverLog.feishu("auth-redirect", {
    userId,
    appId,
    redirectUri,
    source: process.env.FEISHU_REDIRECT_URI ? "env" : "default",
  });

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

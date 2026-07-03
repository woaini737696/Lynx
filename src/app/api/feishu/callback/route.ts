// GET /api/feishu/callback?code=xxx&state=xxx
// OAuth 回调：用 code 换 access_token，拉取用户信息，upsert FeishuToken，重定向到前端
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { exchangeCodeForToken, getFeishuUserInfo } from "@/lib/feishu-api";
import { getLogger } from "@/lib/logger";

const logger = getLogger("feishu-callback");

// 前端跳转目标（带成功/失败参数）
function frontendUrl(status: "success" | "error", reason?: string): string {
  const base = process.env.NEXTAUTH_URL || "";
  // 优先使用 NEXTAUTH_URL，否则使用相对路径（由浏览器解析到当前域名）
  const path = "/lark-tasks";
  const url = base ? `${base}${path}` : path;
  const params = new URLSearchParams();
  if (status === "success") {
    params.set("feishu_connected", "1");
  } else {
    params.set("feishu_connected", "0");
    if (reason) params.set("reason", reason);
  }
  return `${url}?${params.toString()}`;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const errFromFeishu = searchParams.get("error");

  if (errFromFeishu) {
    logger.warn({ err: errFromFeishu }, "[feishu-callback] 飞书授权被拒绝");
    return NextResponse.redirect(frontendUrl("error", "auth_denied"));
  }

  if (!code || !state) {
    return NextResponse.redirect(frontendUrl("error", "missing_params"));
  }

  // 从 state 解析 userId
  let userId: string;
  try {
    const decoded = Buffer.from(state, "base64url").toString("utf-8");
    const idx = decoded.indexOf(":");
    userId = idx >= 0 ? decoded.slice(0, idx) : decoded;
    if (!userId) throw new Error("state 中无 userId");
  } catch {
    return NextResponse.redirect(frontendUrl("error", "invalid_state"));
  }

  // 校验 userId 对应的用户存在
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!user) {
    return NextResponse.redirect(frontendUrl("error", "user_not_found"));
  }

  // 1) 用 code 换 access_token
  const tokenRes = await exchangeCodeForToken(code);
  if (!tokenRes.ok || !tokenRes.tokenData) {
    logger.error({ err: tokenRes.error }, "[feishu-callback] code 换 token 失败");
    return NextResponse.redirect(frontendUrl("error", "token_exchange_failed"));
  }
  const { access_token, refresh_token, expires_in } = tokenRes.tokenData;

  // 2) 拉取飞书用户信息（open_id + name）
  const infoRes = await getFeishuUserInfo(access_token);
  if (!infoRes.ok || !infoRes.userInfo?.open_id) {
    logger.error({ err: infoRes.error }, "[feishu-callback] 获取用户信息失败");
    return NextResponse.redirect(frontendUrl("error", "user_info_failed"));
  }
  const { open_id, name, en_name } = infoRes.userInfo;
  const displayName = name || en_name || "飞书用户";

  // 3) upsert FeishuToken 记录
  const expiresAt = new Date(Date.now() + expires_in * 1000);
  try {
    await prisma.feishuToken.upsert({
      where: { userId },
      create: {
        userId,
        openId: open_id,
        name: displayName,
        accessToken: access_token,
        refreshToken: refresh_token,
        expiresAt,
      },
      update: {
        openId: open_id,
        name: displayName,
        accessToken: access_token,
        refreshToken: refresh_token,
        expiresAt,
      },
    });
  } catch (e) {
    logger.error({ err: e }, "[feishu-callback] 写入 FeishuToken 失败");
    return NextResponse.redirect(frontendUrl("error", "db_write_failed"));
  }

  logger.info({ userId, openId: open_id }, "[feishu-callback] 飞书账号绑定成功");
  return NextResponse.redirect(frontendUrl("success"));
}

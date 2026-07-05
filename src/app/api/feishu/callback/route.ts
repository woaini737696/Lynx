// GET /api/feishu/callback?code=xxx&state=xxx
// OAuth 回调：用 code 换 access_token，拉取用户信息，upsert FeishuToken，重定向到前端
// state 中含 :desktop 标记时，返回桌面端友好的 HTML 成功页（桌面端通过轮询 /api/feishu/status 检测连接）
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { exchangeCodeForToken, getFeishuUserInfo } from "@/lib/feishu-api";
import { serverLog } from "@/lib/logger";

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

// 桌面端 OAuth 成功页（纯 HTML，告知用户返回桌面端）
function desktopSuccessHtml(name: string): string {
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>飞书授权成功</title><style>
body{margin:0;padding:0;display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#030816;color:#fff}
.card{text-align:center;padding:48px 32px;border-radius:24px;background:rgba(255,255,255,0.05);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,0.1);max-width:420px}
.icon{width:64px;height:64px;margin:0 auto 20px;border-radius:50%;background:rgba(0,212,170,0.15);display:flex;align-items:center;justify-content:center;font-size:32px}
h1{font-size:22px;margin:0 0 12px;font-weight:600}
p{font-size:14px;color:rgba(255,255,255,0.6);margin:0;line-height:1.6}
.brand{margin-top:24px;font-size:12px;color:rgba(255,255,255,0.3)}
</style></head><body>
<div class="card"><div class="icon">✓</div><h1>飞书授权成功</h1><p>已连接飞书账号：${name}<br>请返回奇思桌面端，飞书任务将自动同步。</p><div class="brand">不用学AI，什么都能干</div></div>
</body></html>`;
}

// 桌面端 OAuth 失败页
function desktopErrorHtml(reason: string): string {
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>飞书授权失败</title><style>
body{margin:0;padding:0;display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#030816;color:#fff}
.card{text-align:center;padding:48px 32px;border-radius:24px;background:rgba(255,255,255,0.05);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,0.1);max-width:420px}
.icon{width:64px;height:64px;margin:0 auto 20px;border-radius:50%;background:rgba(239,68,68,0.15);display:flex;align-items:center;justify-content:center;font-size:32px}
h1{font-size:22px;margin:0 0 12px;font-weight:600}
p{font-size:14px;color:rgba(255,255,255,0.6);margin:0;line-height:1.6}
.brand{margin-top:24px;font-size:12px;color:rgba(255,255,255,0.3)}
</style></head><body>
<div class="card"><div class="icon">✗</div><h1>飞书授权失败</h1><p>原因：${reason}<br>请返回奇思桌面端重试。</p><div class="brand">不用学AI，什么都能干</div></div>
</body></html>`;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const errFromFeishu = searchParams.get("error");

  serverLog.feishu("callback-received", {
    hasCode: !!code,
    hasState: !!state,
    errFromFeishu,
  });

  // 从 state 解析 userId + desktop 标记
  let userId: string;
  let isDesktop = false;
  try {
    if (!state) throw new Error("state 为空");
    const decoded = Buffer.from(state, "base64url").toString("utf-8");
    const parts = decoded.split(":");
    userId = parts[0];
    isDesktop = parts.includes("desktop");
    if (!userId) throw new Error("state 中无 userId");
  } catch (e) {
    serverLog.feishuError("callback-invalid-state", { statePreview: state?.slice(0, 20) }, e);
    return NextResponse.redirect(frontendUrl("error", "invalid_state"));
  }

  // 桌面端错误页辅助函数
  const desktopError = (reason: string) =>
    new NextResponse(desktopErrorHtml(reason), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });

  if (errFromFeishu) {
    serverLog.feishuError("callback-feishu-error", { errFromFeishu, code: searchParams.get("error_code") });
    if (isDesktop) return desktopError("飞书授权被拒绝");
    return NextResponse.redirect(frontendUrl("error", "auth_denied"));
  }

  if (!code || !state) {
    serverLog.feishuWarn("callback-missing-params", { hasCode: !!code, hasState: !!state });
    if (isDesktop) return desktopError("缺少授权参数");
    return NextResponse.redirect(frontendUrl("error", "missing_params"));
  }

  // 校验 userId 对应的用户存在
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!user) {
    serverLog.feishuWarn("callback-user-not-found", { userId });
    if (isDesktop) return desktopError("用户不存在");
    return NextResponse.redirect(frontendUrl("error", "user_not_found"));
  }

  // 1) 用 code 换 access_token
  const tokenRes = await exchangeCodeForToken(code);
  if (!tokenRes.ok || !tokenRes.tokenData) {
    serverLog.feishuError("callback-token-exchange-failed", { userId }, tokenRes.error);
    if (isDesktop) return desktopError("Token 交换失败");
    return NextResponse.redirect(frontendUrl("error", "token_exchange_failed"));
  }
  const { access_token, refresh_token, expires_in } = tokenRes.tokenData;

  // 2) 拉取飞书用户信息（open_id + name）
  const infoRes = await getFeishuUserInfo(access_token);
  if (!infoRes.ok || !infoRes.userInfo?.open_id) {
    serverLog.feishuError("callback-user-info-failed", { userId }, infoRes.error);
    if (isDesktop) return desktopError("获取飞书用户信息失败");
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
    serverLog.feishuError("callback-db-write-failed", { userId }, e);
    if (isDesktop) return desktopError("数据库写入失败");
    return NextResponse.redirect(frontendUrl("error", "db_write_failed"));
  }

  serverLog.feishu("callback-success", { userId, openId: open_id, isDesktop });
  // 桌面端：返回 HTML 成功页（桌面端通过轮询 /api/feishu/status 检测连接状态）
  if (isDesktop) {
    return new NextResponse(desktopSuccessHtml(displayName), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
  return NextResponse.redirect(frontendUrl("success"));
}

// NextAuth middleware：保护路由，未登录重定向到首页并弹出登录窗
// App 端通过 Authorization: Bearer <token> 访问 /api/*，由 route handler 的 requireAuth 校验
//
// 重定向策略（2026-06-28 重构）：
// - 首次访问（无 session cookie）：重定向到 /?login=1
// - 会话过期（有 cookie 但无效）：重定向到 /?expired=1
// - 不再使用独立 /login 页面，改为首页内弹窗登录
import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { unauthorized } from "@/lib/api-response";

const publicRoutes = ["/login", "/api/auth"];
const publicPatterns = [
  /^\/login$/,
  /^\/api\/auth/,
  /^\/api\/health$/,
  // 公共技能广场：列表/详情/评论查询公开访问；load 路由内部 requireAuth 兜底
  /^\/api\/skills\/marketplace(?:\/|$)/,
  // 公共技能评论查询（GET 公开，POST 内部 requireAuth）
  /^\/api\/skills\/[^/]+\/reviews$/,
];

// 首页作为公开落地页：未登录用户可访问首页，由前端弹窗处理登录
const PUBLIC_LANDING = /^\/$/;

export default auth((req) => {
  const { pathname, searchParams } = req.nextUrl;

  // 公开路由放行
  if (publicPatterns.some((p) => p.test(pathname))) {
    return NextResponse.next();
  }

  // API 路由携带 Bearer Token 时放行（App 端），由 route handler 校验 token 有效性
  if (
    pathname.startsWith("/api/") &&
    req.headers.get("authorization")?.startsWith("Bearer ")
  ) {
    return NextResponse.next();
  }

  // 未登录处理
  if (!req.auth) {
    // API 路由（/api/*）：返回统一信封 JSON 401，不重定向到登录页
    // API 客户端（fetch/axios）期望 JSON 错误响应，而非 HTML 重定向
    if (pathname.startsWith("/api/")) {
      return unauthorized("未登录");
    }

    // RSC 预取请求（带 _rsc 查询参数或 RSC 头）：返回 401 而非重定向
    // 避免浏览器跟随重定向导致 net::ERR_ABORTED 控制台报错
    // 客户端路由器会根据 401 自行处理跳转到登录页
    const isRscPrefetch =
      searchParams.has("_rsc") || req.headers.get("RSC") === "1";
    if (isRscPrefetch) {
      return new NextResponse(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 首页作为公开落地页：未登录直接放行，由前端 AuthProvider 弹出登录窗
    if (PUBLIC_LANDING.test(pathname)) {
      return NextResponse.next();
    }

    // 区分首次访问 vs 会话过期：
    // - 有 session cookie 但 req.auth 为 null → 会话过期
    // - 无 session cookie → 首次访问
    const sessionCookieName =
      process.env.NODE_ENV === "production"
        ? "__Secure-authjs.session-token"
        : "authjs.session-token";
    const hasSessionCookie = Boolean(req.cookies.get(sessionCookieName)?.value);

    const homeUrl = new URL("/", req.nextUrl.origin);
    if (hasSessionCookie) {
      homeUrl.searchParams.set("expired", "1");
    } else {
      homeUrl.searchParams.set("login", "1");
    }
    return NextResponse.redirect(homeUrl);
  }

  // 路由守卫：/admin/* 仅 admin 可访问（服务端校验，避免普通用户看到 admin 页面骨架）
  if (pathname.startsWith("/admin/")) {
    const role = (req.auth.user as { role?: string } | undefined)?.role;
    if (role !== "admin") {
      const homeUrl = new URL("/", req.nextUrl.origin);
      homeUrl.searchParams.set("forbidden", "1");
      return NextResponse.redirect(homeUrl);
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    /*
     * 匹配所有路由，排除：
     * - _next/static, _next/image, favicon.ico
     * - public 静态资源
     */
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icons|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|html|woff|woff2|ttf|eot)$).*)",
  ],
};

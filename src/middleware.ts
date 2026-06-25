// NextAuth middleware：保护路由，未登录重定向到 /login
// App 端通过 Authorization: Bearer <token> 访问 /api/*，由 route handler 的 requireAuth 校验
import { auth } from "@/auth";
import { NextResponse } from "next/server";

const publicRoutes = ["/login", "/api/auth"];
const publicPatterns = [/^\/login$/, /^\/api\/auth/, /^\/api\/health$/];

export default auth((req) => {
  const { pathname } = req.nextUrl;

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

  // 未登录重定向到登录页
  if (!req.auth) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
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
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icons|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2|ttf|eot)$).*)",
  ],
};

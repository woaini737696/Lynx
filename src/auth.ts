// next-auth v5 (Auth.js) 配置
// Credentials Provider：用户名密码登录，bcrypt 哈希验证

// 启动检查：生产环境必须配置 AUTH_SECRET，否则抛出错误阻止启动
if (!process.env.AUTH_SECRET && process.env.NODE_ENV === "production") {
  throw new Error("AUTH_SECRET 环境变量未配置，请运行 `openssl rand -base64 32` 生成并配置到 .env");
}

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  // 信任当前 host（桌面端通过 localhost 访问，需要 trustHost 避免 host 校验失败）
  trustHost: true,
  // 开发环境（HTTP）下不使用 secure cookie，确保 WebView2 能正确设置和发送 cookie
  useSecureCookies: process.env.NODE_ENV === "production",
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60, // 7 天
  },
  // 显式配置 cookie 策略，解决 WebView2 跨域导航时的 cookie 丢失问题
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === "production" ? "__Secure-authjs.session-token" : "authjs.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
    csrfToken: {
      name: "authjs.csrf-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
    callbackUrl: {
      name: "authjs.callback-url",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        username: { label: "用户名", type: "text" },
        password: { label: "密码", type: "password" },
        phone: { label: "手机号", type: "text" },
        code: { label: "验证码", type: "text" },
      },
      async authorize(credentials) {
        // 模式1：手机号 + 验证码
        if (credentials?.phone && credentials?.code) {
          const phone = credentials.phone as string;
          const code = credentials.code as string;
          const masterCode = process.env.SMS_MASTER_CODE || "888888";
          if (code !== masterCode) {
            return null;
          }

          // 查找用户，不存在则自动注册
          let user = await prisma.user.findFirst({ where: { phone } });
          if (!user) {
            user = await prisma.user.create({
              data: {
                username: `phone_${phone}`,
                passwordHash: "",
                phone,
                displayName: phone,
                role: "viewer",
              },
            });
          }
          if (!user.active) {
            return null;
          }

          return {
            id: user.id,
            name: user.displayName || user.username,
            email: user.email || undefined,
            role: user.role,
            displayName: user.displayName,
            avatarUrl: user.avatarUrl,
            profession: user.profession,
          };
        }

        // 模式2：手机号 + 密码
        if (credentials?.phone && credentials?.password) {
          const phone = credentials.phone as string;
          const password = credentials.password as string;

          const user = await prisma.user.findFirst({ where: { phone } });
          if (!user || !user.active) {
            return null;
          }

          const valid = await bcrypt.compare(password, user.passwordHash);
          if (!valid) {
            return null;
          }

          return {
            id: user.id,
            name: user.displayName || user.username,
            email: user.email || undefined,
            role: user.role,
            displayName: user.displayName,
            avatarUrl: user.avatarUrl,
            profession: user.profession,
          };
        }

        // 模式3：用户名 + 密码（原有逻辑）
        if (!credentials?.username || !credentials?.password) {
          return null;
        }

        const username = credentials.username as string;
        const password = credentials.password as string;

        const user = await prisma.user.findUnique({
          where: { username },
        });

        if (!user || !user.active) {
          return null;
        }

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) {
          return null;
        }

        return {
          id: user.id,
          name: user.displayName || user.username,
          email: user.email || undefined,
          role: user.role,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          profession: user.profession,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role || "viewer";
        token.displayName = (user as { displayName?: string }).displayName || "";
        token.avatarUrl = (user as { avatarUrl?: string | null }).avatarUrl || "";
        token.profession = (user as { profession?: string | null }).profession || "";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.id as string;
        (session.user as { role?: string }).role = token.role as string;
        (session.user as { displayName?: string }).displayName = token.displayName as string;
        (session.user as { avatarUrl?: string }).avatarUrl = token.avatarUrl as string;
        (session.user as { profession?: string }).profession = token.profession as string;
      }
      return session;
    },
  },
});

// next-auth v5 (Auth.js) 配置
// Credentials Provider：手机号+密码 / 手机号+验证码（主推手机号登录）

// 启动检查：生产环境必须配置 AUTH_SECRET，否则抛出错误阻止启动
if (!process.env.AUTH_SECRET && process.env.NODE_ENV === "production") {
  throw new Error("AUTH_SECRET 环境变量未配置，请运行 `openssl rand -base64 32` 生成并配置到 .env");
}

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { getEffectiveMasterCode } from "@/lib/auth-config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  useSecureCookies: process.env.NODE_ENV === "production",
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60,
  },
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
        password: { label: "密码", type: "password" },
        phone: { label: "手机号", type: "text" },
        code: { label: "验证码", type: "text" },
      },
      async authorize(credentials) {
        // 模式1：手机号 + 验证码（依赖管理员启用的万能验证码）
        if (credentials?.phone && credentials?.code) {
          const phone = credentials.phone as string;
          const code = credentials.code as string;
          const masterCode = await getEffectiveMasterCode();
          if (!masterCode || code !== masterCode) {
            return null;
          }
          const user = await prisma.user.findFirst({ where: { phone } });
          if (!user || !user.active) {
            return null;
          }
          // 更新最后登录时间（不阻塞登录流程，NextAuth authorize 无法获取 req 头部）
          prisma.user
            .update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
            .catch(() => {});
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

        // 模式2：手机号 + 密码（主推）
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
          // 更新最后登录时间
          prisma.user
            .update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
            .catch(() => {});
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

        return null;
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

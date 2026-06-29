/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  // SWC 压缩（Next 13+ 默认 true，显式声明更安全）
  swcMinify: true,
  // 隐藏 X-Powered-By: Next.js 响应头，减少信息泄露
  poweredByHeader: false,
  // 生产部署使用 standalone 输出，便于容器化与最小化部署产物
  output: "standalone",
  // 远程图片加载白名单：User.avatarUrl 等字段可存外部 URL
  // 限制为实际使用的可信域名，避免任意域名图片加载
  // unoptimized: true — 禁用 Next.js 图片优化端点 /_next/image
  // 原因：standalone 模式下 publicDir 未在 required-server-files.json 中配置，
  // 导致 /_next/image 端点无法读取 public 目录的 logo/icon 文件，全部 404。
  // 禁用后 <Image> 组件直接使用原始 URL，由 Nginx 直接服务静态文件。
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "ai.lynxdo.com" },
      { protocol: "https", hostname: "localhost" },
      { protocol: "http", hostname: "localhost" },
      { protocol: "https", hostname: "127.0.0.1" },
      { protocol: "http", hostname: "127.0.0.1" },
    ],
  },
  experimental: {
    instrumentationHook: true,
    // 按需引入 lucide-react 等大库，避免全量打包
    optimizePackageImports: ["lucide-react", "ai", "@prisma/client"],
  },
  // 生产环境移除 console.log（保留 error/warn）
  compiler: {
    removeConsole:
      process.env.NODE_ENV === "production" ? { exclude: ["error", "warn"] } : false,
  },
  webpack: (config) => {
    // 减少开发模式下不必要的重新编译
    config.cache = config.cache || {};
    return config;
  },
};

export default nextConfig;

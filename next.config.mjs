/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  // SWC 压缩（Next 13+ 默认 true，显式声明更安全）
  swcMinify: true,
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

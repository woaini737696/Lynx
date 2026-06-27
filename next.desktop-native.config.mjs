/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  swcMinify: true,
  // 桌面端本地静态导出：图片不优化（无 Next.js 服务端）
  images: {
    unoptimized: true,
  },
  // 输出为静态 HTML/JS/CSS，供 Tauri 本地加载
  output: 'export',
  distDir: 'desktop-native/dist-web',
  // 禁用 ISR/SSR，所有页面在构建时预渲染，运行时调用云端 API
  trailingSlash: true,
  experimental: {
    instrumentationHook: false,
    optimizePackageImports: ["lucide-react", "ai"],
  },
  compiler: {
    removeConsole: { exclude: ["error", "warn"] },
  },
  webpack: (config) => {
    config.cache = config.cache || {};
    return config;
  },
};

export default nextConfig;

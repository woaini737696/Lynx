/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  experimental: {
    instrumentationHook: true,
  },
  webpack: (config) => {
    // 减少开发模式下不必要的重新编译
    config.cache = config.cache || {};
    return config;
  },
};

export default nextConfig;

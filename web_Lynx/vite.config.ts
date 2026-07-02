import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    port: 5177,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    target: 'es2020',
    cssCodeSplit: true,
    // 静态资源内联阈值（4KB 以下内联为 base64，减少请求数）
    assetsInlineLimit: 4096,
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        // 按依赖稳定性分组，提升缓存命中率
        manualChunks: {
          // three.js 体积大且稳定，单独拆分，长缓存
          'vendor-three': ['three'],
          // lenis 滚动库
          'vendor-lenis': ['lenis'],
          // React 核心
          'vendor-react': ['react', 'react-dom'],
        },
      },
    },
  },
})

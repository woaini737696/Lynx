import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// https://vitejs.dev/config/
// Electron 构建模式：VITE_ELECTRON_BUILD=1 时输出到 desktop-electron/renderer，base 设为相对路径
const isElectronBuild = !!process.env.VITE_ELECTRON_BUILD;

export default defineConfig({
  plugins: [react()],
  base: isElectronBuild ? './' : '/',
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@lynnhub/shared-types': resolve(__dirname, '../../packages/shared-types/index.ts'),
    },
  },
  build: {
    outDir: isElectronBuild ? '../../desktop-electron/renderer' : '../out/app',
    emptyOutDir: true,
    sourcemap: !isElectronBuild,
  },
  server: {
    port: 5177,
    strictPort: true,
    host: '127.0.0.1',
  },
});

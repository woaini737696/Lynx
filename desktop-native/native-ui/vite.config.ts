import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@lynnhub/shared-types': resolve(__dirname, '../../packages/shared-types/index.ts'),
    },
  },
  build: {
    outDir: '../out/app',
    emptyOutDir: true,
    sourcemap: true,
  },
  server: {
    port: 5177,
    strictPort: true,
    host: '127.0.0.1',
  },
});

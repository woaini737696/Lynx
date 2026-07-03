// Electron renderer 构建脚本：构建 native-ui 并输出到 desktop-electron/renderer/
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const nativeUiDir = path.resolve(__dirname, '..', '..', 'desktop-native', 'native-ui');
const rendererDir = path.resolve(__dirname, '..', 'renderer');

console.log('[build-renderer] 构建 native-ui → desktop-electron/renderer/');
console.log('[build-renderer] native-ui 目录:', nativeUiDir);

// 使用 VITE_ELECTRON_BUILD=1 环境变量触发 vite.config.ts 的 Electron 构建模式
// 该模式下 base='./'（支持 file:// 协议加载），outDir 指向 desktop-electron/renderer
try {
  execSync('npx vite build', {
    cwd: nativeUiDir,
    stdio: 'inherit',
    env: { ...process.env, VITE_ELECTRON_BUILD: '1' },
  });
} catch (e) {
  console.error('[build-renderer] 构建失败:', e.message);
  process.exit(1);
}

// 验证产物
import fs from 'fs';
if (!fs.existsSync(path.join(rendererDir, 'index.html'))) {
  console.error('[build-renderer] 错误：renderer/index.html 不存在');
  process.exit(1);
}

console.log('[build-renderer] 构建完成！产物位于:', rendererDir);

// electron-builder afterPack 钩子：在 win-unpacked 打包完成后、NSIS 安装包生成前执行
// 职责：
//   1. 用 rcedit 嵌入 icon.ico 到 奇思.exe（修复任务栏图标）
//   2. 用 Set-AuthenticodeSignature 签名 奇思.exe（修复发布者未知）
//
// 背景：signAndEditExecutable:true 会触发 winCodeSign-2.6.0 下载，
// 但 7z 解压因 Windows 符号链接权限失败（darwin/lib/libcrypto.dylib）。
// 本脚本绕过 electron-builder 的签名流程，手动完成 rcedit + 签名。
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// LynnHub 代码签名证书 thumbprint（已在 LocalMachine\Root 受信任）
const CERT_THUMBPRINT = '7BCF15A9E0867DADA9F97DAC69297EAF2672F748';

// 从 winCodeSign 缓存查找 rcedit-x64.exe
function findRcedit() {
  const cacheBase = path.join(process.env.LOCALAPPDATA, 'electron-builder', 'Cache', 'winCodeSign');
  if (!fs.existsSync(cacheBase)) return null;
  for (const dir of fs.readdirSync(cacheBase)) {
    const candidate = path.join(cacheBase, dir, 'rcedit-x64.exe');
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

module.exports = async function (context) {
  if (context.electronPlatformName !== 'win32') return;

  const appOutDir = context.appOutDir;
  const exeName = context.packager.appInfo.productName + '.exe';
  const exePath = path.join(appOutDir, exeName);
  const iconPath = path.join(__dirname, '..', 'build', 'icon.ico');

  console.log(`[after-pack] 处理: ${exePath}`);

  if (!fs.existsSync(exePath)) {
    console.warn(`[after-pack] WARN: ${exePath} 不存在，跳过`);
    return;
  }

  // ===== 步骤1: rcedit 嵌入图标 =====
  const rcedit = findRcedit();
  if (!rcedit) {
    console.error('[after-pack] ERROR: rcedit-x64.exe 未找到，无法嵌入图标');
    return;
  }
  if (fs.existsSync(iconPath)) {
    console.log(`[after-pack] rcedit: ${rcedit}`);
    console.log(`[after-pack] 嵌入图标: ${iconPath}`);
    try {
      execSync(`"${rcedit}" "${exePath}" --set-icon "${iconPath}"`, { stdio: 'inherit' });
      console.log('[after-pack] 图标嵌入成功');
    } catch (e) {
      console.error('[after-pack] rcedit 失败:', e.message);
    }
  } else {
    console.warn(`[after-pack] WARN: icon.ico 不存在: ${iconPath}`);
  }

  // ===== 步骤2: Set-AuthenticodeSignature 签名（用独立 .ps1 文件避免转义问题）=====
  console.log(`[after-pack] 签名 ${exeName} (cert thumbprint: ${CERT_THUMBPRINT})`);
  const signScript = path.join(__dirname, 'sign-exe.ps1');
  try {
    execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${signScript}" -ExePath "${exePath}"`, {
      stdio: 'inherit',
      timeout: 60000,
    });
    console.log('[after-pack] 签名完成');
  } catch (e) {
    console.error('[after-pack] 签名失败:', e.message);
  }
};

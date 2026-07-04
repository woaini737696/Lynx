// 签名最终 NSIS 安装包（QisiSetup-*.exe）
// electron-builder 的 afterPack 只签名内部 奇思.exe，不签名最终安装包
// 安装包本身未签名 → Windows 显示"未知发布者"
// 本脚本在 electron-builder 完成后执行，签名 release-final/ 下的 QisiSetup-*.exe
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const CERT_THUMBPRINT = '7BCF15A9E0867DADA9F97DAC69297EAF2672F748';
const releaseDir = path.join(__dirname, '..', 'release-v14');

if (!fs.existsSync(releaseDir)) {
  console.error('[sign-installer] release-v14 目录不存在:', releaseDir);
  process.exit(1);
}

// 查找 QisiSetup-*.exe
const installers = fs.readdirSync(releaseDir).filter(
  (f) => f.startsWith('QisiSetup-') && f.endsWith('.exe')
);

if (installers.length === 0) {
  console.error('[sign-installer] 未找到 QisiSetup-*.exe');
  process.exit(1);
}

const signScript = path.join(__dirname, 'sign-exe.ps1');
let allOk = true;

for (const installer of installers) {
  const exePath = path.join(releaseDir, installer);
  console.log(`\n[sign-installer] 签名: ${installer}`);
  try {
    execSync(
      `powershell -NoProfile -ExecutionPolicy Bypass -File "${signScript}" -ExePath "${exePath}"`,
      { stdio: 'inherit', timeout: 60000 }
    );
    console.log(`[sign-installer] ✓ ${installer} 签名成功`);
  } catch (e) {
    console.error(`[sign-installer] ✗ ${installer} 签名失败:`, e.message);
    allOk = false;
  }
}

if (!allOk) {
  console.warn('\n[sign-installer] 部分文件签名失败，但安装包仍可使用（只是会显示"未知发布者"）');
  console.warn('[sign-installer] 请确保已运行 scripts/gen-cert.cjs 生成证书并导入信任存储');
} else {
  console.log('\n[sign-installer] 全部签名完成！');
}

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const apiDir = path.join(root, "src", "app", "api");
const config = path.join(root, "next.config.mjs");
const nativeConfig = path.join(root, "next.desktop-native.config.mjs");
const backupDir = path.join(
  process.env.TEMP || "/tmp",
  `lynnhub-desktop-native-api-backup-${Date.now()}`
);

let hasApiBackup = false;
let hasConfigBackup = false;

function log(msg) {
  console.log(`[desktop-native] ${msg}`);
}

try {
  // 1. 备份并移除 API routes
  if (fs.existsSync(apiDir)) {
    log(`备份 src/app/api -> ${backupDir}`);
    fs.renameSync(apiDir, backupDir);
    hasApiBackup = true;
  }

  // 2. 临时替换 next.config.mjs
  if (fs.existsSync(nativeConfig)) {
    log("临时启用 next.desktop-native.config.mjs");
    fs.renameSync(config, `${config}.desktop-native.bak`);
    fs.copyFileSync(nativeConfig, config);
    hasConfigBackup = true;
  }

  // 3. 执行 static export
  log("执行 Next.js static export...");
  execSync("npx next build --no-lint", {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, NODE_ENV: "production" },
  });

  log("前端构建完成 -> desktop-native/dist-web");
} catch (err) {
  log(`构建失败: ${err.message}`);
  process.exitCode = 1;
} finally {
  // 4. 恢复 API routes
  if (hasApiBackup && fs.existsSync(backupDir)) {
    log("恢复 src/app/api");
    if (fs.existsSync(apiDir)) {
      fs.rmSync(apiDir, { recursive: true, force: true });
    }
    fs.renameSync(backupDir, apiDir);
  }

  // 5. 恢复 next.config.mjs
  if (hasConfigBackup) {
    log("恢复 next.config.mjs");
    if (fs.existsSync(config)) {
      fs.rmSync(config, { force: true });
    }
    fs.renameSync(`${config}.desktop-native.bak`, config);
  }
}

// WebSocket 状态中心网关启动脚本
//
// 用途：作为独立进程运行 WebSocket 网关，监听端口 3001
// 启动：node scripts/start-ws-gateway.js
//       或通过 PM2: pm2 start scripts/start-ws-gateway.js --name lynx-ws-gateway
//
// 职责：
// 1. 接收桌面端 HermesAgent 的 WS 注册（PC 上线）
// 2. 维护 PC 在线状态（按 userId 分组）
// 3. 接收安卓端/Web端的远程指令，转发给目标 PC
// 4. PC 执行完成后流式回传进度到安卓端/Web端
// 5. 定时清理超时离线的 PC
//
// 重要：此脚本直接 require 本地预编译好的 ws-gateway.compiled.js
//       服务器零依赖（不需要 tsx / typescript / dotenv / 任何构建工具）
//       编译由本地 scripts/compile-ws-gateway.mjs 完成（build.ps1 自动调用）

// 手动加载 .env 环境变量（不依赖 dotenv 模块，服务器零依赖）
// 读取 cwd 下的 .env 文件，解析 KEY=VALUE 格式，注入 process.env
(function loadEnv() {
  const fs = require("fs");
  const path = require("path");
  const envPath = path.join(process.cwd(), ".env");
  try {
    if (!fs.existsSync(envPath)) {
      console.warn("[start-ws-gateway] .env 文件不存在:", envPath);
      return;
    }
    const content = fs.readFileSync(envPath, "utf-8");
    let count = 0;
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let value = trimmed.slice(eqIdx + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (key && !(key in process.env)) {
        process.env[key] = value;
        count++;
      }
    }
    console.log(`[start-ws-gateway] 已从 .env 加载 ${count} 个环境变量`);
  } catch (e) {
    console.error("[start-ws-gateway] 加载 .env 失败:", e.message);
  }
})();

// 设置 WS 端口（默认 3001）
process.env.WS_PORT = process.env.WS_PORT || "3001";

// 直接加载预编译的 JS（零依赖，服务器无需 tsx）
require("./ws-gateway.compiled.js");

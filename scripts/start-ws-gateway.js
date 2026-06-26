// WebSocket 状态中心网关启动脚本
//
// 用途：作为独立进程运行 WebSocket 网关，监听端口 3001
// 启动：node scripts/start-ws-gateway.js
//       或通过 PM2: pm2 start scripts/start-ws-gateway.js --name ws-gateway
//
// 职责：
// 1. 接收桌面端 HermesAgent 的 WS 注册（PC 上线）
// 2. 维护 PC 在线状态（按 userId 分组）
// 3. 接收安卓端/Web端的远程指令，转发给目标 PC
// 4. PC 执行完成后流式回传进度到安卓端/Web端
// 5. 定时清理超时离线的 PC

// 加载 .env 环境变量（与 Next.js 共享 DATABASE_URL）
require("dotenv").config({ path: ".env" });

// 使用 tsx 运行 TypeScript 源文件
const { spawn } = require("child_process");
const path = require("path");

const tsxPath = path.resolve(__dirname, "..", "node_modules", ".bin", "tsx");
const gatewayPath = path.resolve(__dirname, "..", "src", "lib", "ws-gateway.ts");

// Windows 下 .bin 是 .cmd 文件
const isWin = process.platform === "win32";
const child = spawn(isWin ? tsxPath + ".cmd" : tsxPath, [gatewayPath], {
  stdio: "inherit",
  env: {
    ...process.env,
    WS_PORT: process.env.WS_PORT || "3001",
  },
  cwd: path.resolve(__dirname, ".."),
});

child.on("error", (err) => {
  console.error("[start-ws-gateway] 启动失败:", err);
  process.exit(1);
});

child.on("exit", (code) => {
  console.log(`[start-ws-gateway] 进程退出，code=${code}`);
  process.exit(code || 0);
});

// 转发终止信号
process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));

// PM2 进程配置 - Lynx 生产环境
//
// 重要：服务器零构建原则
// - lynx-app: 直接运行 standalone/server.js（Next.js 本地构建产物）
// - lynx-ws-gateway: 直接运行预编译的 ws-gateway.compiled.js（本地 esbuild 编译产物）
// - 服务器严禁执行 npm install / npx / tsc / esbuild / 任何构建命令
//
// 部署：本地构建后上传 /opt/lynx/app/，服务器执行 `pm2 start /opt/lynx/app/ecosystem.config.cjs`

module.exports = {
  apps: [
    {
      name: 'lynx-app',
      script: './server.js',
      cwd: '/opt/lynx/app',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '280M',  // 适配 2C2G，留余量给 ws-gateway 和 mysql
      env: { NODE_ENV: 'production', PORT: 5176 },
      error_file: '/opt/lynx/logs/error.log',
      out_file: '/opt/lynx/logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      // 优雅关闭：给 Next.js 足够时间处理完在途请求
      kill_timeout: 10000,
      listen_timeout: 30000,
      // 启动后等待 5 秒确认进程稳定
      min_uptime: '5s',
    },
    {
      name: 'lynx-ws-gateway',
      script: 'scripts/start-ws-gateway.js',  // 用 start 脚本（会先 require dotenv 加载 .env，再加载 compiled.js）
      cwd: '/opt/lynx/app',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '120M',  // WS 网关内存占用较小
      env: { NODE_ENV: 'production', WS_PORT: 3001 },
      error_file: '/opt/lynx/logs/ws-error.log',
      out_file: '/opt/lynx/logs/ws-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      // WS 网关需要更长优雅关闭时间（等待客户端重连）
      kill_timeout: 15000,
      listen_timeout: 10000,
      min_uptime: '5s',
    },
  ],
};

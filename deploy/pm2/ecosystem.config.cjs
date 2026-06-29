// PM2 进程配置 - Lynx 生产环境
//
// 重要：服务器零构建原则
// - lynx-app: 直接运行 standalone/server.js（Next.js 本地构建产物）
// - lynx-ws-gateway: 直接运行预编译的 ws-gateway.compiled.js（本地 esbuild 编译产物）
// - 服务器严禁执行 npm install / npx / tsc / esbuild / 任何构建命令

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
    },
    {
      name: 'lynx-ws-gateway',
      script: 'scripts/ws-gateway.compiled.js',  // 直接运行预编译 JS，零依赖（不需要 tsx）
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
    },
  ],
};

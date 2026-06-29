// PM2 配置 - Lynx 生产环境
// 部署位置：/opt/lynx/ecosystem.config.cjs

module.exports = {
  apps: [{
    name: 'lynx-app',
    script: './server.js',
    cwd: '/opt/lynx/app',
    instances: 1,
    exec_mode: 'fork',
    max_memory_restart: '350M',
    env: {
      NODE_ENV: 'production',
      PORT: 5176,
    },
    error_file: '/opt/lynx/logs/error.log',
    out_file: '/opt/lynx/logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    max_restarts: 10,
    restart_delay: 5000,
  }],
};

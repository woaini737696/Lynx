module.exports = {
  apps: [
    {
      name: 'lynx-app',
      script: 'start-with-env.js',
      cwd: '/opt/lynx/app',
      env: {
        NODE_ENV: 'production',
        PORT: 5176,
      },
      max_memory_restart: '280M',
    },
    {
      name: 'lynx-ws-gateway',
      script: 'scripts/start-ws-gateway.js',
      cwd: '/opt/lynx/app',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      max_memory_restart: '200M',
    },
  ],
};
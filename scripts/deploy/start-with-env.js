// /opt/lynx/app/start-with-env.js
// Next.js standalone 模式启动包装器
// 在启动 server.js 前加载 .env 文件中的环境变量
// 解决 PM2 启动 lynx-app 时 process.env.TTS_API_KEY 等未加载的问题
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  let loaded = 0;
  content.split('\n').forEach(line => {
    line = line.trim();
    if (!line || line.startsWith('#')) return;
    const eqIdx = line.indexOf('=');
    if (eqIdx < 0) return;
    const key = line.slice(0, eqIdx).trim();
    let value = line.slice(eqIdx + 1).trim();
    // 去除引号
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    // 只设置未存在的环境变量（不覆盖 PM2 已传递的）
    if (!process.env[key]) {
      process.env[key] = value;
      loaded++;
    }
  });
  console.log(`[start-with-env] 已从 .env 加载 ${loaded} 个环境变量`);
} else {
  console.warn('[start-with-env] .env 文件不存在:', envPath);
}

// 启动 Next.js standalone server
require('./server.js');

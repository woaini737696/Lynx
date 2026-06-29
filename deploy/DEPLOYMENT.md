# Lynx 阿里云部署方案

> 目标服务器：阿里云 ECS 2核2G | 域名：www.lynxdo.com（官网）/ ai.lynxdo.com（应用+API）
> 核心原则：**本地构建 → 同步部署**，服务器零编译，资源严格受控

---

## 1. 架构总览

```
                    ┌─────────────────────────────────┐
                    │        阿里云 ECS 2C2G           │
                    │                                   │
  www.lynxdo.com ──┤  Nginx (443/80)                   │
                    │    ├── / → 官网静态HTML            │
  ai.lynxdo.com  ──┤    ├── / → proxy_pass :5176       │
                    │    └── /download → 静态安装包      │
                    │                                   │
                    │  PM2 → Node.js :5176              │
                    │    └── Next.js standalone          │
                    │                                   │
                    │  MySQL 8.x :3306 (本地)           │
                    │    └── innodb_buffer_pool=256M    │
                    │                                   │
                    │  ✗ HermesAgent 不在服务器运行      │
                    │  ✗ 无 Redis（2G内存不允许）       │
                    └─────────────────────────────────┘
                              ↑ API 调用
                    ┌─────────┴─────────┐
                    │  客户端（本地运行） │
                    │  ├── Web浏览器      │
                    │  ├── 桌面端 Tauri   │
                    │  │   └── HermesAgent│
                    │  └── 数据云端读写   │
                    └───────────────────┘
```

### 1.1 服务职责划分

| 组件 | 运行位置 | 说明 |
|------|----------|------|
| 官网 (www.lynxdo.com) | 服务器 Nginx 静态托管 | web_Lynx 项目（Vite + React 19）构建产物，纯静态文件 |
| Web 应用 (ai.lynxdo.com) | 服务器 PM2 + Node.js | Next.js standalone，含全部 API routes |
| 数据库 | 服务器 MySQL 8.x | 本地 3306，不对外暴露 |
| 桌面端安装包 | 服务器 Nginx 静态托管 | **本地** Tauri 构建 NSIS exe，上传服务器供下载 |
| 安卓端安装包 | 服务器 Nginx 静态托管 | **本地** Gradle 构建 APK，上传服务器供下载（可选） |
| 桌面端源码 (desktop-native/) | **本地保留** | 不上服务器，仅本地构建打包 |
| 安卓端源码 (android/) | **本地保留** | 不上服务器，仅本地构建打包 |
| HermesAgent | **客户端本地运行** | Rust 进程内嵌于 Tauri，通过 API 读写云端数据 |
| AI 模型调用 | 客户端→模型API | 桌面端直接调用 DeepSeek/MiMo API，不经服务器中转 |

### 1.2 资源预算（2C2G = 2048MB）

| 进程 | 预估内存 | 说明 |
|------|----------|------|
| 系统内核+SSH | ~200MB | 不可压缩 |
| MySQL 8.x | ~400MB | innodb_buffer_pool=256M + 连接 + 临时表 |
| PM2 + Node.js | ~300MB | Next.js standalone，max-old-space-size=256 |
| Nginx | ~30MB | worker_processes=auto |
| 安全缓冲 | ~1118MB | 应对流量峰值、OOM 保护 |
| **合计** | **~930MB** | 剩余 ~1118MB 缓冲 |

---

## 2. 域名与 SSL

### 2.1 DNS 解析

| 域名 | 记录类型 | 值 | 说明 |
|------|----------|-----|------|
| www.lynxdo.com | A | 服务器公网IP | 官网 |
| ai.lynxdo.com | A | 服务器公网IP | Web应用+API |
| lynxdo.com | A | 服务器公网IP | 根域名（301→www） |

### 2.2 SSL 证书

使用 Let's Encrypt 免费证书，certbot 自动续期：
- www.lynxdo.com
- ai.lynxdo.com

---

## 3. 本地构建流程

### 3.1 构建前提
- Node.js 20+
- Rust + MSVC 工具链
- MySQL 客户端（可选，用于数据库迁移）
- PowerShell

### 3.2 一键构建

```powershell
# 在项目根目录执行
.\scripts\deploy\build.ps1            # 含桌面端（耗时较长）
.\scripts\deploy\build.ps1 -SkipDesktop  # 跳过桌面端（首次部署推荐）
```

构建脚本会依次执行：
1. **依赖安装**：`npm ci`（主项目）
2. **Prisma 生成**：`npx prisma generate`
3. **Web 端构建**：`npm run build` → `.next/standalone/` + `.next/static/`
4. **官网构建**：`cd web_Lynx && pnpm install && pnpm run build` → `web_Lynx/dist/`
5. **桌面端构建**（可选）：`cd desktop-native && cargo tauri build` → NSIS exe
6. **产物打包**：`deploy/dist/lynx-deploy-{timestamp}.tar.gz`

### 3.3 构建产物结构

```
deploy/dist/lynx-deploy-{timestamp}/
├── standalone/          # Next.js standalone 服务器（部署到 /opt/lynx/app）
│   ├── server.js        # 入口
│   ├── .next/           # 编译产物
│   │   └── static/      # 静态资源
│   ├── public/          # 公共资源
│   └── node_modules/    # 最小依赖（standalone 自动裁剪）
├── prisma/
│   ├── schema.prisma
│   └── seed.ts          # 数据库 seed（仅首次部署执行）
├── website/             # 官网静态文件（部署到 /opt/lynx/website，来自 web_Lynx/dist）
│   ├── index.html
│   └── assets/
├── downloads/           # 桌面端/安卓端安装包（部署到 /opt/lynx/downloads）
│   └── Lynx_1.0.0_x64-setup.exe
├── nginx/               # Nginx 配置
├── pm2/                 # PM2 配置
└── mysql/               # MySQL 优化配置
```

---

## 4. 服务器部署流程

### 4.1 首次初始化（手动 SSH 执行一次）

```bash
# 1. 安装基础软件
apt update && apt install -y nginx mysql-server certbot python3-certbot-nginx

# 2. 安装 Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
npm install -g pm2

# 3. 创建部署目录
mkdir -p /opt/lynx/{app,website,downloads}
mkdir -p /opt/lynx/logs

# 4. MySQL 安全配置
mysql_secure_installation

# 5. 创建数据库和用户
mysql -u root -p
CREATE DATABASE lynx CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'lynx'@'localhost' IDENTIFIED BY 'STRONG_PASSWORD';
GRANT ALL ON lynx.* TO 'lynx'@'localhost';
FLUSH PRIVILEGES;

# 6. 部署 MySQL 优化配置
cp /tmp/lynx-deploy/mysql/lynxdo.cnf /etc/mysql/conf.d/lynxdo.cnf
systemctl restart mysql

# 7. 部署 Nginx 配置
cp /tmp/lynx-deploy/nginx/lynxdo.conf /etc/nginx/sites-available/lynxdo
ln -s /etc/nginx/sites-available/lynxdo /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

# 8. 申请 SSL 证书
certbot --nginx -d www.lynxdo.com -d ai.lynxdo.com --non-interactive --agree-tos -m admin@lynxdo.com

# 9. 部署 PM2 配置
cp /tmp/lynx-deploy/pm2/ecosystem.config.cjs /opt/lynx/ecosystem.config.cjs
```

### 4.2 应用部署（每次迭代执行）

```powershell
# 在本地执行（需要服务器 SSH 信息）
.\scripts\deploy\deploy.ps1 -ServerIp "YOUR_SERVER_IP" -SshUser "root" -SshKey "C:\path\to\key"
```

部署脚本会：
1. 上传构建产物到服务器 `/tmp/lynx-deploy/`
2. SSH 执行远程部署命令：
   - 备份当前版本到 `/opt/lynx/backup/`
   - 解压新版本到 `/opt/lynx/app/`
   - 执行 `npx prisma db push`（数据库迁移）
   - 执行 `npx prisma db seed`（仅首次）
   - `pm2 reload ecosystem.config.cjs`
3. 上传桌面端安装包到 `/opt/lynx/downloads/`
4. 健康检查 `curl https://ai.lynxdo.com/api/health`

### 4.3 环境变量

服务器 `/opt/lynx/app/.env`（不进版本控制）：

```env
DATABASE_URL="mysql://lynx:STRONG_PASSWORD@localhost:3306/lynx"
AUTH_SECRET="GENERATED_SECRET"
NODE_ENV="production"
NEXTAUTH_URL="https://ai.lynxdo.com"
# AI API Keys（从本地 .env 复制，服务端 AI 调用用）
DEEPSEEK_API_KEY="..."
MIMO_API_KEY="..."
# 万能验证码已迁移到 DB（SystemConfig 表），不再使用环境变量
```

---

## 5. Nginx 配置

```nginx
# /etc/nginx/sites-available/lynxdo

# 官网 www.lynxdo.com
server {
    listen 80;
    server_name www.lynxdo.com lynxdo.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name www.lynxdo.com lynxdo.com;

    ssl_certificate /etc/letsencrypt/live/www.lynxdo.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/www.lynxdo.com/privkey.pem;

    root /opt/lynx/website;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }

    # 安装包下载
    location /download {
        alias /opt/lynx/downloads;
        autoindex on;
        add_header Content-Disposition "attachment";
    }
}

# 应用 ai.lynxdo.com
server {
    listen 80;
    server_name ai.lynxdo.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name ai.lynxdo.com;

    ssl_certificate /etc/letsencrypt/live/ai.lynxdo.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ai.lynxdo.com/privkey.pem;

    # 安全头
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # 上传大小限制（头像/附件）
    client_max_body_size 20M;

    # Next.js 静态资源（长缓存）
    location /_next/static/ {
        proxy_pass http://127.0.0.1:5176;
        proxy_cache_valid 200 1y;
        add_header Cache-Control "public, immutable";
    }

    # 公共资源
    location /public/ {
        proxy_pass http://127.0.0.1:5176;
    }

    # API + 页面（反向代理到 Next.js）
    location / {
        proxy_pass http://127.0.0.1:5176;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 90s;
        proxy_send_timeout 90s;

        # WebSocket 支持（ws-gateway）
        proxy_buffering off;
    }
}
```

---

## 6. PM2 配置

```javascript
// /opt/lynx/ecosystem.config.cjs
module.exports = {
  apps: [{
    name: 'lynx-app',
    script: './server.js',
    cwd: '/opt/lynx/app',
    instances: 1,           // 2G 内存只跑 1 实例
    exec_mode: 'fork',
    max_memory_restart: '350M',  // 超过 350M 自动重启
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
```

---

## 7. MySQL 优化配置

```ini
# /etc/mysql/conf.d/lynxdo.cnf
# 针对 2C2G 服务器优化

[mysqld]
# 内存限制
innodb_buffer_pool_size = 256M
innodb_log_buffer_size = 8M
key_buffer_size = 32M
max_connections = 50
max_user_connections = 40
thread_cache_size = 8

# 查询缓存（MySQL 8.0 已移除 query_cache，用 innodb_buffer_pool 替代）
table_open_cache = 200
table_definition_cache = 200

# 临时表
tmp_table_size = 32M
max_heap_table_size = 32M

# 慢查询日志
slow_query_log = 1
slow_query_log_file = /var/log/mysql/slow.log
long_query_time = 2

# 字符集
character-set-server = utf8mb4
collation-server = utf8mb4_unicode_ci

# 安全
bind-address = 127.0.0.1
skip-name-resolve = 1
local_infile = 0
```

---

## 8. HermesAgent 架构说明

HermesAgent **不在服务器运行**，保留在桌面端本地：

- **桌面端 Tauri 内嵌 Rust 进程**：执行 RPA、浏览器自动化、文件操作等本地能力
- **数据云端化**：所有配置、报告、任务通过 API 存取到服务器 MySQL
- **API 通信**：桌面端通过 `https://ai.lynxdo.com/api/...` 读写数据
- **WebSocket**：桌面端连接 `wss://ai.lynxdo.com/api/ws` 接收实时推送

这样的设计：
1. 服务器不需要运行 Rust 进程，节省内存
2. 本地 RPA 能力不受网络延迟影响
3. 数据集中存储，多端可访问

---

## 9. 安全清单

- [ ] `.env` 不进版本控制（已确认 .gitignore 包含）
- [ ] MySQL 仅监听 127.0.0.1，不对外暴露 3306
- [ ] SSH 禁用密码登录，仅允许密钥
- [ ] Nginx 配置安全头（X-Frame-Options / X-Content-Type-Options / XSS-Protection）
- [ ] Let's Encrypt 证书自动续期（certbot timer）
- [ ] PM2 max_memory_restart 防止内存泄漏撑爆
- [ ] 万能验证码生产环境关闭（DB SystemConfig 表配置）
- [ ] lynn 账号密码不在代码/日志/文档中出现
- [ ] 安装包签名（后续迭代可加代码签名证书）

---

## 10. 回滚方案

```bash
# 服务器端回滚到上一版本
cd /opt/lynx
pm2 stop lynx-app
rm -rf app
mv backup/lynx-app-{last-timestamp} app
pm2 start lynx-app

# 数据库回滚（如有迁移）
# prisma 不支持自动回滚，需手动执行 SQL 或从备份恢复
mysql -u lynx -p lynx < /opt/lynx/backup/db-{last-timestamp}.sql
```

---

## 11. 部署验证清单

部署完成后逐项验证：

1. `curl -I https://www.lynxdo.com` → 200，返回官网首页
2. `curl -I https://ai.lynxdo.com` → 200 或 302（重定向到登录）
3. `curl https://ai.lynxdo.com/api/health` → `{"ok":true}`
4. 浏览器访问 `https://ai.lynxdo.com` → 登录页面正常
5. 手机号+密码登录 → 成功进入工作台
6. 设置 > 认证 Tab → 可配置万能验证码和邀请码
7. 桌面端连接 `https://ai.lynxdo.com` → 登录成功
8. `pm2 status` → lynx-app 状态 online，内存 < 350M
9. `free -m` → 剩余内存 > 800M
10. `https://ai.lynxdo.com/download` → 可下载安装包

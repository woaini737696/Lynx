# Lynx 开发部署迭代规范

> 本规范为项目所有端（Web 端 / 桌面端 / 安卓端 / 服务端 / 官网）开发迭代的强制执行标准。每次迭代必须严格遵守，违反任意一条均视为不合格。

---

## 零、服务器零构建硬约束（最高优先级，不可违反）

> **此章节为绝对红线，违反即视为严重事故。** 2026-06-29 曾因在服务器执行 `npm install tsx` 导致 2C2G 服务器 OOM 宕机，强制重启才恢复。

### 0.1 禁止在服务器执行的操作

服务器（47.119.185.135，2C2G）**严禁**执行以下任何命令，无一例外：

| 禁止命令 | 原因 | 正确做法 |
|---|---|---|
| `npm install` / `npm ci` | 内存占用 >1G，直接 OOM | 本地装好，node_modules 随 standalone 上传 |
| `npx <anything>` | npx 会触发下载安装 | 本地执行，产物上传 |
| `tsc` / `esbuild` / `webpack` | 编译耗尽 CPU/内存 | 本地预编译，上传 JS 产物 |
| `prisma generate` | 需要下载 engine | 本地 generate，client 随 standalone 上传 |
| `cargo build` / `rustc` | 内存爆炸 | 本地构建，上传二进制 |
| `pnpm install` / `yarn install` | 同 npm | 本地装好 |
| `git clone` + 构建 | 在服务器构建 | 本地构建后上传产物 |
| `apt install`（大包） | 占磁盘/内存 | 仅允许小工具如 `htop` |

### 0.2 允许在服务器执行的操作

仅允许以下轻量操作：

- `pm2 start/restart/reload/save/list/logs` — 进程管理
- `nginx -t && systemctl reload nginx` — 配置重载
- `npx prisma db push` — **仅** 数据库结构同步（不下载包，用已上传的 prisma client）⚠️ 注意：此命令也会消耗内存，执行前确认服务器空闲，且仅在有 schema 变更时执行
- `mysql` / `mysqldump` — 数据库操作
- `cp/mv/rm/mkdir/tar` — 文件操作
- `curl` — 健康检查
- `node scripts/ws-gateway.compiled.js` — 运行预编译 JS（零依赖）
- `node server.js` — 运行 standalone 产物

### 0.3 TypeScript 源码的本地预编译规范

任何需要在服务器以独立进程运行的 TypeScript 文件（如 WS 网关、定时任务脚本），**必须**在本地用 esbuild 预编译成纯 CJS JavaScript：

```bash
# 本地预编译（见 scripts/compile-ws-gateway.mjs）
node scripts/compile-ws-gateway.mjs
# 产物 scripts/ws-gateway.compiled.js 上传到服务器
# 服务器直接 node 运行，零依赖（不需要 tsx/typescript）
```

**编译规范**：
- `bundle: true` — 把 npm 依赖打进单文件
- `external: ["@prisma/client"]` — Prisma Client 含二进制，运行时从 node_modules 解析（standalone 已包含）
- `format: "cjs"` — 与 standalone server.js 一致
- `target: "node18"` — 服务器 Node 20 兼容
- 编译步骤集成到 `build.ps1`，每次构建自动执行

### 0.4 部署前自检清单

部署到服务器前，**必须**确认：
- [ ] 构建产物中包含 `node_modules`（standalone 自带）
- [ ] TS 源码已预编译为 JS（如有独立进程）
- [ ] 不依赖服务器执行任何 `npm/npx/install` 命令
- [ ] `.env` 文件已包含在 standalone 中
- [ ] prisma client 已生成在 standalone/node_modules

---

## 一、总则

1. **本地构建原则**：阿里云 ECS 2C2G 服务器禁止任何形式的编译/构建操作。所有构建产物在本地完成，仅同步产物到服务器。（详见第零章）
2. **D 盘存储原则**：所有项目数据、依赖、构建产物必须存放在 D 盘，C 盘禁止写入。
3. **端口固定原则**：本地开发服务固定端口 3002，禁止修改（详见 service-runtime.md）。
4. **Gitee 提交原则**：每次迭代完成后必须自动提交并推送到 Gitee 仓库 `Admin/LynnHub`。
5. **开发日志原则**：每次迭代必须更新 `DEV_LOG.md`，记录迭代号、任务、完成内容、commit hash。
6. **使用说明原则**：每个功能模块右上角必须有使用说明入口，新增模块需在规范文件中补充。
7. **测试数据清理原则**：自测后必须清理 E2E 看板测试数据，避免脏数据。
8. **账号保护原则**：严禁修改 lynn 账号（`lynn` / `ee9527ff`）的密码、角色、displayName、active 状态，除非用户在对话中明确指示。
9. **设计确认原则**：任务中遇到不确定/待澄清的点，优先弹窗向用户确认，不自行决策。

---

## 二、本地开发环境

### 2.1 路径约定

| 用途 | 路径 |
|---|---|
| 项目根目录 | `d:\Lynn工作空间\LynnHub` |
| 桌面端源码 | `d:\Lynn工作空间\LynnHub\desktop-native` |
| 安卓端源码 | `d:\Lynn工作空间\LynnHub\android` |
| 官网源码 | `d:\Lynn工作空间\LynnHub\web_Lynx` |
| 服务端源码 | `d:\Lynn工作空间\LynnHub\src` |
| Cargo 构建产物 | `D:\cargo-target-native` |
| 部署产物 | `d:\Lynn工作空间\LynnHub\deploy\dist` |

### 2.2 端口分配

- **Web 端开发服务器**：`http://localhost:3002`（生产为 5176）
- **官网开发服务器**：`http://localhost:5177`
- **MySQL**：3306
- **HermesAgent Dashboard**：9119

### 2.3 开发流程

```bash
# 1. 拉取最新代码
git pull origin master

# 2. 安装依赖（如需）
npm ci

# 3. 生成 Prisma Client
npx prisma generate

# 4. 同步数据库结构（开发环境）
npx prisma db push

# 5. 启动开发服务器
npm run dev  # 默认 http://localhost:3002
```

---

## 三、迭代开发标准流程

每次功能迭代必须按以下步骤执行，缺一不可：

### 步骤 1：需求确认

- 任务模糊或涉及多端时，必须用 `AskUserQuestion` 工具弹窗向用户确认。
- 涉及 UI 设计时，遵循 iOS26 液态玻璃规范，浅色为主色调。

### 步骤 2：代码实现

- **Web 端**：编辑 `src/` 目录下的代码
- **桌面端**：编辑 `desktop-native/` 目录下的代码（Tauri 2.x + Rust）
- **安卓端**：编辑 `android/` 目录下的代码
- **官网**：编辑 `web_Lynx/` 目录下的代码（Vite + React 19）

### 步骤 3：本地自测

```bash
# Web 端 TypeScript 类型检查
npx tsc --noEmit

# Web 端 ESLint
npm run lint

# 本地启动开发服务器，端口 3002
npm run dev

# 桌面端构建（如涉及）
cd desktop-native/src-tauri
$env:CARGO_BUILD_TARGET = "x86_64-pc-windows-msvc"
cargo tauri build
```

### 步骤 4：本地构建部署产物

```powershell
# 仅构建 Web 端 + 官网（不含桌面端）
.\scripts\deploy\build.ps1 -SkipDesktop

# 完整构建（含桌面端安装包）
.\scripts\deploy\build.ps1
```

**构建产物结构**：
```
deploy/dist/lynx-deploy-{timestamp}/
├── standalone/          # Next.js standalone 产物
│   ├── .next/
│   ├── node_modules/
│   ├── public/
│   ├── prisma/
│   ├── .env
│   └── server.js
├── website/             # 官网 Vite 构建产物
├── nginx/               # Nginx 配置
├── pm2/                 # PM2 配置
├── mysql/               # MySQL 配置
└── downloads/           # 桌面端安装包（可选）
```

### 步骤 5：部署到云服务器

> **桌面端和安卓端不需要部署到服务器**，仅服务端、官网、数据库部署到阿里云。

#### 5.1 部署工具

使用 `scripts/deploy/ssh_exec.py`（基于 paramiko）执行 SSH 操作：

```python
# 执行远程命令
python scripts/deploy/ssh_exec.py "命令"

# 上传文件
python scripts/deploy/ssh_exec.py --upload 本地路径 远程路径

# 上传目录
python scripts/deploy/ssh_exec.py --upload-dir 本地目录 远程目录
```

#### 5.2 服务器信息

- **IP**：47.119.185.135
- **SSH**：root / Ee9527ffss
- **系统**：Ubuntu 22.04, 2C2G
- **目录**：
  - `/opt/lynx/app/` — Next.js standalone
  - `/opt/lynx/website/` — 官网静态文件
  - `/opt/lynx/downloads/` — 桌面端安装包
  - `/opt/lynx/logs/` — PM2 日志
  - `/opt/lynx/backup/` — 数据库备份

#### 5.3 部署步骤

```bash
# 1. 上传 standalone 产物到 /opt/lynx/app/
python scripts/deploy/ssh_exec.py --upload-dir deploy/dist/{pkg}/standalone /opt/lynx/app-new

# 2. 备份旧版本，切换新版本
python scripts/deploy/ssh_exec.py "mv /opt/lynx/app /opt/lynx/app.bak.$(date +%Y%m%d%H%M%S) && mv /opt/lynx/app-new /opt/lynx/app"

# 3. 上传官网产物
python scripts/deploy/ssh_exec.py --upload-dir deploy/dist/{pkg}/website /opt/lynx/website-new
python scripts/deploy/ssh_exec.py "rm -rf /opt/lynx/website && mv /opt/lynx/website-new /opt/lynx/website"

# 4. 同步数据库结构
python scripts/deploy/ssh_exec.py "cd /opt/lynx/app && npx prisma db push --accept-data-loss"

# 5. 重启 PM2
python scripts/deploy/ssh_exec.py "pm2 restart lynx-app"

# 6. Reload Nginx（如有配置变更）
python scripts/deploy/ssh_exec.py --upload deploy/nginx/lynxdo.conf /etc/nginx/sites-available/lynxdo
python scripts/deploy/ssh_exec.py "nginx -t && systemctl reload nginx"

# 7. 健康检查
python scripts/deploy/ssh_exec.py "curl -sS https://ai.lynxdo.com/api/health"
```

### 步骤 6：自测验证

部署后必须执行自测，验证：

1. **官网** [https://www.lynxdo.com](https://www.lynxdo.com) 可访问，logo 正常加载
2. **Web 应用** [https://ai.lynxdo.com](https://ai.lynxdo.com) 可访问，登录功能正常
3. **/api/health** 返回 200
4. **关键 API** 端点响应正常（用 `scripts/deploy/test_via_ssh.py` 工具）
5. **静态资源**（logo、icon、manifest）全部 200

### 步骤 7：清理测试数据

- 删除自测产生的 Idea / Task / Memory / Conversation / Skill 等数据
- 删除测试用户上传的文件
- 保留 lynn 账号及其真实数据

### 步骤 8：更新开发日志

在 `DEV_LOG.md` 顶部添加新迭代记录：

```markdown
## 迭代 N (YYYY-MM-DD)

**任务**：
- 任务1
- 任务2

**完成内容**：
1. 完成项1（涉及文件：xxx.tsx, xxx.ts）
2. 完成项2

**Commit hash**：`xxxxxxxx`
```

### 步骤 9：提交代码到 Gitee

```bash
git add .
git commit -m "iter{N}: 简要描述"
git push origin master
```

**Gitee 仓库**：`https://gitee.com/shenzhens-emotions-are-booming_0/lynn-hub.git`

---

## 四、域名与 DNS

| 域名 | 用途 | 解析 |
|---|---|---|
| `www.lynxdo.com` | 产品官网 | → 47.119.185.135 |
| `ai.lynxdo.com` | Web 应用 + API | → 47.119.185.135 |
| `lynxdo.com` | 根域名（重定向到 www） | → 47.119.185.135 |

- 所有域名必须使用 HTTPS（Let's Encrypt 证书）
- HTTP 自动 301 重定向到 HTTPS
- 证书统一存储在 `/etc/letsencrypt/live/www.lynxdo.com/`
- 证书有效期 90 天，到期前用 `certbot renew` 续期

---

## 五、Nginx 配置规范

配置文件位置：`deploy/nginx/lynxdo.conf`（服务器为 `/etc/nginx/sites-available/lynxdo`）

### 5.1 静态资源服务

> **重要**：Next.js standalone 模式下 `public` 目录的静态文件必须由 Nginx 直接服务，不要代理回 Next.js（会 404）。

```nginx
# Logo / Icon / Manifest 等静态文件
location ~* ^/(lynx-logo-|lynx-icon-|manifest\.webmanifest|sw\.js|ui-preview) {
    root /opt/lynx/app/public;
    try_files $uri =404;
    expires 7d;
    add_header Cache-Control "public, immutable";
}

# 用户上传文件
location /uploads/ {
    alias /opt/lynx/app/public/uploads/;
}
```

### 5.2 反向代理

```nginx
# API + 页面
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
    proxy_buffering off;  # WebSocket 支持
}
```

---

## 六、PM2 配置规范

配置文件：`deploy/pm2/ecosystem.config.cjs`

- **进程名**：`lynx-app`
- **启动文件**：`./server.js`（standalone 产物）
- **工作目录**：`/opt/lynx/app`
- **内存上限**：300MB（超过自动重启，适配 2C2G）
- **模式**：fork（单实例）
- **开机自启**：`pm2 startup` + `pm2 save`

---

## 七、MySQL 配置规范

配置文件：`deploy/mysql/lynxdo.cnf`

- **版本**：MySQL 8.x
- **数据库**：`lynx`
- **用户**：`lynx`（密码：`Ee9527ffss`）
- **关键参数**（适配 1.6G 实际内存）：
  - `innodb_buffer_pool_size = 128M`
  - `max_connections = 30`
  - `skip-name-resolve = 1`
  - `performance_schema = 0`
- **每日备份**：cron 凌晨 3 点 mysqldump，保留 7 天
  - 脚本：`scripts/deploy/backup-db.sh`

---

## 八、构建脚本规范

### 8.1 build.ps1（Web 端 + 官网）

- **必须**用 UTF-8 with BOM 编码保存（PowerShell 5.1 兼容）
- **必须**处理 npm ci 的 stderr（临时切换 `$ErrorActionPreference = "Continue"`）
- **必须**避免 `public/public/` 嵌套（检查目标目录是否存在）
- **必须**复制 `.env.production` 到 `standalone/.env`
- **必须**复制 `prisma/schema.prisma` 到 standalone（用于服务器端 db push）

### 8.2 .env.production

- **不入 git**（已在 `.gitignore` 中）
- 包含：`DATABASE_URL`、`AUTH_SECRET`、所有第三方 API Key
- 部署时复制到 `standalone/.env`

---

## 九、桌面端构建规范（Tauri 2.x）

- **工具链**：`stable-x86_64-pc-windows-msvc`（禁止 GNU）
- **窗口尺寸**：1280×800，居中显示
- **Tauri API**：`window.__TAURI__.core.invoke`（不是 `window.__TAURI__.invoke`）
- **服务器检测**：Rust 端用 `TcpStream::connect_timeout`，`localhost` 转 `127.0.0.1`
- **自动重连**：失败时递增间隔重试，最多 10 次
- **主题**：支持浅色/深色/跟随系统（next-themes）
- **构建命令**：
  ```powershell
  $env:CARGO_BUILD_TARGET = "x86_64-pc-windows-msvc"
  cargo tauri build
  ```
- **产物**：`D:\cargo-target-native\release\bundle\nsis\Lynx_{version}_x64-setup.exe`

---

## 十、安卓端构建规范

- 在本地构建 APK，不上传服务器
- 桌面端和安卓端均通过 HTTPS 连接云端 API（`https://ai.lynxdo.com`）
- HermesAgent 能力保留在桌面端/安卓端本地运行，数据从云端读取

---

## 十一、HermesAgent 部署规范

- HermesAgent 不部署到服务器，仅在桌面端/安卓端本地运行
- 通过 WebSocket 连接云端 `wss://ai.lynxdo.com/api/ws`，心跳 30 秒
- 一键安装命令：`pip install hermes-agent`（Windows）或 `pip3 install hermes-agent`（Linux/Mac）
- Dashboard 端口：9119
- 启动命令：`hermes dashboard --port 9119 --no-open`

---

## 十二、安全规范

1. **密码**：所有密码使用 bcrypt 哈希存储，禁止明文
2. **JWT**：`AUTH_SECRET` 必须为强随机字符串，不入 git
3. **数据库**：禁止 root 远程登录，仅 `lynx` 用户远程
4. **防火墙**：仅开放 22/80/443 端口
5. **文件上传**：必须校验魔数 + 扩展名 + 大小（10MB 上限）
6. **Rate Limiting**：登录 5 次/分钟，上传 20 次/分钟
7. **CORS**：仅允许 `ai.lynxdo.com` / `localhost` / `127.0.0.1`

---

## 十三、UI 设计规范

1. **主色调**：浅色液态玻璃（iOS26 设计规范）
2. **强调色**：iOS26 系统蓝 `#0A84FF`
3. **字体**：系统字体栈，标题 16-18px，正文 13-14px
4. **圆角**：8-16px
5. **阴影**：柔和，避免硬边
6. **图标**：优先使用 lucide-react
7. **弹窗**：
   - 标准 Modal 用 `src/components/ui/Modal.tsx`（自带 `z-[200]` + `max-h-[90vh] overflow-y-auto`）
   - 自实现弹窗必须 `z-[200]` 起步，内层 `max-h-[90vh] overflow-y-auto`
   - 弹窗必须在最顶层显示，避免被父容器层叠上下文遮挡
8. **使用说明**：每个功能模块右上角必须有使用说明按钮（`?` 图标）

---

## 十四、Git 提交规范

- **分支**：master（单一主分支）
- **Commit 格式**：`iter{N}: 简要描述` 或 `fix/feat/refactor(范围): 描述`
- **频率**：每次迭代至少一次 commit
- **推送**：必须推送到 Gitee origin
- **禁止**：提交 `.env.production`、构建产物、node_modules、cargo target

---

## 十五、迭代验收清单

每次迭代完成前，逐项检查：

- [ ] TypeScript 类型检查通过（`npx tsc --noEmit`）
- [ ] 本地开发服务器启动正常（端口 3002）
- [ ] 涉及的 UI 页面在浏览器中功能正常
- [ ] 桌面端构建成功（如涉及）
- [ ] 部署产物已构建（`build.ps1`）
- [ ] 已部署到阿里云服务器（如涉及服务端变更）
- [ ] 部署后自测通过（官网 + Web 应用 + API）
- [ ] 测试数据已清理
- [ ] `DEV_LOG.md` 已更新
- [ ] 代码已提交并推送到 Gitee
- [ ] 涉及的弹窗均能正常显示（z-index、居中、不溢出）
- [ ] 涉及的 logo/图标均能正常加载

---

## 十六、问题排查清单

| 现象 | 排查方向 |
|---|---|
| Logo 加载 404 | Nginx 静态资源 location 是否配置 / public 目录是否嵌套 |
| API 401 | JWT 是否过期 / AuthProvider 是否正确处理 401 事件 |
| 弹窗被遮挡 | 父容器是否创建层叠上下文 / z-index 是否够高 |
| 部署后页面白屏 | Nginx 配置 / PM2 进程状态 / .env 是否正确 |
| Next.js standalone 静态文件 404 | 用 Nginx 直接服务，不代理回 Next.js |
| PowerShell 脚本报编码错误 | 用 UTF-8 with BOM 保存 |
| SSH 命令超时 | paramiko timeout 改为 300 秒 |
| MySQL 连接被拒 | 检查 `skip-name-resolve` / 用户主机权限 |

---

**本规范自 2026-06-29 起执行，所有后续迭代必须严格遵守。**

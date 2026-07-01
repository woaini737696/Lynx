# 新设备环境部署指南

> 本文档面向新加入项目的开发者，按步骤操作即可完成环境搭建并开始开发。
> 适用于 Windows 10/11 开发环境（项目主开发环境）。

---

## 一、环境部署清单

### 1.1 必装工具链

| 工具 | 版本要求 | 用途 | 下载地址 |
|---|---|---|---|
| Node.js | 20 LTS+ | Web端、桌面端前端、官网构建 | https://nodejs.org/ |
| npm | 10+ | 依赖管理（随 Node.js 安装） | - |
| Git | 2.40+ | 版本控制 | https://git-scm.com/ |
| MySQL | 8.0+（推荐8.4） | 本地数据库 | https://dev.mysql.com/downloads/ |
| Python | 3.10+ | HermesAgent 引擎、构建脚本 | https://www.python.org/ |
| Rust | stable | 桌面端 Tauri 开发 | https://rustup.rs/ |
| Visual Studio Build Tools | 2022 | Rust MSVC 工具链依赖 | https://visualstudio.microsoft.com/visual-cpp-build-tools/ |

### 1.2 按开发端选择安装

#### Web 端开发（必装）
- Node.js 20+ + npm 10+
- MySQL 8.0+
- Git

#### 桌面端开发（在 Web 端基础上追加）
- Rust（通过 rustup 安装，选择 `stable-x86_64-pc-windows-msvc`）
- Visual Studio Build Tools 2022（勾选 "Desktop development with C++"）
- NSIS（Tauri 构建时会自动下载到 `%LOCALAPPDATA%\tauri\NSIS\`）

#### 安卓端开发（在 Web 端基础上追加）
- Android Studio（含 Android SDK）
- JDK 17（推荐 Temurin 17）
- Android SDK Platform 34（API Level 34）
- Android Build Tools 34.0.0

#### 官网开发（在 Web 端基础上追加）
- 无额外工具，复用 Node.js

### 1.3 推荐开发工具
- **IDE**：Trae Solo（项目主开发环境，配置见第 5 节）
- **数据库可视化**：DBeaver 或 Navicat
- **API 测试**：Postman 或 curl

---

## 二、项目克隆与依赖安装

### 2.1 克隆仓库

```bash
# 选择 D 盘作为项目目录（规范要求：所有数据存 D 盘，禁止 C 盘）
cd D:\

# 创建工作空间目录
mkdir "Lynn工作空间"
cd "Lynn工作空间"

# 克隆仓库
git clone https://gitee.com/shenzhens-emotions-are-booming_0/lynn-hub.git LynnHub
cd LynnHub
```

### 2.2 配置 Git 凭证（避免每次输入）

```bash
# 配置用户信息
git config user.name "你的名字"
git config user.email "你的邮箱"

# 缓存凭证（Windows）
git config credential.helper manager
```

### 2.3 安装项目依赖

```bash
# 安装 Web 端依赖（项目根目录）
npm install

# 安装桌面端依赖（如需桌面端开发）
cd desktop-native
npm install
cd ..

# 安装安卓端依赖（如需安卓端开发）
cd android
./gradlew.bat --version
cd ..
```

### 2.4 配置 Rust 构建目标（桌面端开发必选）

```bash
# 安装 MSVC 工具链（禁止 GNU 工具链）
rustup toolchain install stable-x86_64-pc-windows-msvc
rustup default stable-x86_64-pc-windows-msvc

# 设置统一的 Cargo 构建产物目录（避免项目内 cargo-target 膨胀）
# 在系统环境变量中添加：
# CARGO_TARGET_DIR = D:\cargo-target-native
```

---

## 三、数据库初始化

### 3.1 MySQL 配置

```sql
-- 登录 MySQL
mysql -u root -p

-- 创建数据库和用户
CREATE DATABASE lynnhub CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'lynx'@'localhost' IDENTIFIED BY 'Ee9527ffss';
GRANT ALL PRIVILEGES ON lynnhub.* TO 'lynx'@'localhost';
FLUSH PRIVILEGES;
```

### 3.2 数据目录配置（规范要求）

MySQL 数据目录必须存放在 D 盘：
- 数据目录：`D:\LynnHub\mysql_data`
- 在 MySQL 配置文件 `my.ini` 中设置 `datadir=D:/LynnHub/mysql_data`

### 3.3 同步数据库结构

```bash
# 生成 Prisma Client
npx prisma generate

# 同步数据库结构
npx prisma db push
```

### 3.4 初始化默认数据（按顺序执行）

```bash
# 1. 创建默认管理员账号
npx tsx prisma/seed.ts

# 2. 初始化角色权限（admin/editor/viewer）
npx tsx prisma/seed-roles.ts

# 3. 注入 60 个预置技能（12 岗位）
npx tsx prisma/seed-skills.ts

# 4. 注入默认巡检规则
npx tsx prisma/seed-patrol-rules.ts
```

### 3.5 默认账号

| 账号 | 密码 | 说明 |
|---|---|---|
| `admin` | `admin123` | 管理员账号 |
| `lynn` | `lynn123` | 主开发者账号 |

> **警告**：严禁修改 `lynn` 账号的密码、角色、displayName、active 状态。

---

## 四、环境变量配置

### 4.1 创建 .env 文件

```bash
# 复制环境变量模板
cp .env.example .env
```

### 4.2 必填项

编辑 `.env` 文件，填入以下必填项：

```bash
# 数据库连接（本地开发）
DATABASE_URL="mysql://lynx:Ee9527ffss@localhost:3306/lynnhub"

# JWT 签名密钥（生成命令：openssl rand -base64 32）
AUTH_SECRET="你的随机密钥"

# NextAuth 回调 URL（本地开发）
NEXTAUTH_URL="http://localhost:5176"
```

### 4.3 AI 模型配置（按需）

至少配置一个 LLM 提供商：

```bash
# DeepSeek（推荐）
DEEPSEEK_API_KEY="sk-你的key"
DEEPSEEK_BASE_URL="https://api.deepseek.com/v1"
DEEPSEEK_MODEL="deepseek-chat"

# 或 小米 MiMo
MIMO_API_KEY="sk-你的key"
MIMO_BASE_URL="https://api.xiaomimimo.com/v1"
MIMO_MODEL="mimo-v2.5"

# 默认 LLM 提供商
DEFAULT_LLM_PROVIDER="deepseek"
```

### 4.4 向量模型配置（记忆图谱功能依赖）

```bash
EMBEDDING_API_KEY="sk-你的key"
EMBEDDING_BASE_URL="https://api.siliconflow.cn/v1"
EMBEDDING_MODEL="BAAI/bge-m3"
```

> 未配置的 API Key 不会导致崩溃，对应功能会自动降级或禁用。

### 4.5 完整变量说明

所有环境变量详见 [.env.example](./.env.example) 文件。

---

## 五、首次启动验证

### 5.1 启动 Web 端开发服务器

```bash
npm run dev
# 启动后访问 http://localhost:5176
```

验证项：
- [ ] 首页正常加载，无白屏
- [ ] 登录功能正常（使用默认账号）
- [ ] AI 助理可以对话
- [ ] 灵感收件箱可以创建灵感

### 5.2 启动 WS 网关（多端协同必需）

```bash
# 编译 WS 网关 TypeScript
node scripts/compile-ws-gateway.mjs

# 启动 WS 网关（端口 3001）
node scripts/ws-gateway.compiled.js
```

### 5.3 启动桌面端（如需桌面端开发）

```bash
cd desktop-native
npm run dev
# Tauri 开发模式，前端 Vite 端口 5177
```

### 5.4 启动安卓端（如需安卓端开发）

```bash
cd android
./gradlew.bat :app:assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

---

## 六、Trae Solo IDE 配置（推荐）

项目主开发环境为 Trae Solo，安装后需配置文件监视排除，避免卡顿。

### 6.1 配置文件监视排除

打开 Trae Solo → `Ctrl+Shift+P` → "Preferences: Open Settings (JSON)"，添加：

```json
{
  "files.watcherExclude": {
    "**/node_modules/**": true,
    "**/.next/**": true,
    "**/target/**": true,
    "**/cargo-target*/**": true,
    "**/desktop-native/src-tauri/target/**": true,
    "**/deploy/dist/**": true,
    "**/.lynnhub/**": true,
    "**/hermes-agent-pkg/**": true,
    "**/__pycache__/**": true
  },
  "search.exclude": {
    "**/node_modules": true,
    "**/.next": true,
    "**/target": true,
    "**/cargo-target*": true,
    "**/deploy/dist": true,
    "**/.lynnhub": true
  },
  "typescript.tsserver.maxTsServerMemory": 4096
}
```

### 6.2 性能维护

每次迭代完成后必须执行清理（详见 [DEVELOPMENT_SPEC.md](./DEVELOPMENT_SPEC.md) 第 17 章）：

```powershell
# 清理 Rust 编译缓存
cargo clean --manifest-path desktop-native\src-tauri\Cargo.toml

# 清理 hermes-agent-pkg 构建产物
Remove-Item -Path "desktop-native\hermes-agent-pkg\dist" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "desktop-native\hermes-agent-pkg\build" -Recurse -Force -ErrorAction SilentlyContinue
```

---

## 七、项目结构与开发指南

### 7.1 项目结构

```
LynnHub/
├── src/                    # Web 端源码（Next.js 14 App Router）
│   ├── app/                # 页面和 API 路由
│   ├── components/         # React 组件
│   ├── lib/                # 工具库（hermes-client / ws-gateway / flow-engine）
│   ├── hooks/              # React Hooks
│   └── workers/            # Web Worker（力导向仿真）
├── desktop-native/         # 桌面端源码（Tauri 2.x + Rust）
│   ├── src-tauri/          # Rust 后端（HermesAgent 引擎 + RPA + 自动更新）
│   └── native-ui/          # React 前端（Vite + TypeScript）
├── android/                # 安卓端源码（Kotlin + Jetpack Compose + Hilt）
├── web_Lynx/               # 官网源码（Vite + React 19）
├── prisma/                 # 数据库 schema 和 seed 脚本
├── scripts/                # 构建和部署脚本
├── public/                 # 静态资源
├── deploy/                 # 部署配置（nginx / pm2 / mysql）
├── packages/               # 共享包（shared-types）
├── DEV_LOG.md              # 开发日志（每次迭代记录）
├── DEVELOPMENT_SPEC.md     # 开发部署迭代规范（强制执行）
├── DESIGN_SYSTEM.md        # 设计系统与主题配色
└── ANDROID_PRD.md          # 安卓端 PRD 方案
```

### 7.2 开发必读文档

| 文档 | 说明 | 优先级 |
|---|---|---|
| [DEVELOPMENT_SPEC.md](./DEVELOPMENT_SPEC.md) | 开发部署迭代规范（**必读**） | P0 |
| [DEV_LOG.md](./DEV_LOG.md) | 开发日志（了解历史迭代） | P1 |
| [README.md](./README.md) | 项目总览 | P1 |
| [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) | UI 设计规范 | P2 |
| [ANDROID_PRD.md](./ANDROID_PRD.md) | 安卓端 PRD | P2 |

### 7.3 开发规范要点

1. **D 盘存储原则**：所有项目数据、依赖、构建产物必须存放在 D 盘
2. **端口固定**：Web 端开发服务器端口 `5176`，WS 网关 `3001`，MySQL `3306`，Dashboard `9119`
3. **Gitee 提交**：每次迭代完成后必须自动提交并推送到 Gitee
4. **开发日志**：每次迭代必须更新 `DEV_LOG.md`
5. **使用说明**：每个功能模块右上角必须有使用说明入口
6. **测试数据清理**：自测后必须清理 E2E 测试数据
7. **UI 设计**：浅色液态玻璃风格，遵循 iOS26 设计规范
8. **设计确认**：任务中遇到不确定的点，必须弹窗向用户确认
9. **服务器零构建**：阿里云服务器禁止任何编译/构建操作，所有构建产物在本地完成

---

## 八、HermesAgent（Lynx Agent 引擎）

### 8.1 架构说明

- **HermesAgent 仅在用户本地电脑运行**，不部署到服务器
- Web 端和桌面端共用一个 HermesAgent 安装
- 服务器上不允许 CLI 和 Agent

### 8.2 本地安装（可选，如需 Lynx Agent 功能）

```bash
# 安装 HermesAgent
pip install hermes-agent

# 启动 Dashboard（端口 9119）
hermes dashboard --port 9119 --no-open
```

### 8.3 验证

访问 `http://127.0.0.1:9119/api/status`，返回 JSON 即正常。

---

## 九、常见问题排查

### 9.1 npm install 失败

```bash
# 清理 npm 缓存
npm cache clean --force

# 删除 node_modules 和 lock 文件后重试
rm -rf node_modules package-lock.json
npm install
```

### 9.2 Prisma 相关错误

```bash
# 重新生成 Prisma Client
npx prisma generate

# 检查数据库连接
npx prisma db push

# 如有 schema 变更
npx prisma db push --accept-data-loss
```

### 9.3 Rust 编译失败

```bash
# 确认工具链
rustup show

# 必须是 MSVC 工具链
rustup default stable-x86_64-pc-windows-msvc

# 设置 CARGO_TARGET_DIR 环境变量
# 系统环境变量 → 新建 → CARGO_TARGET_DIR = D:\cargo-target-native
```

### 9.4 MySQL 连接被拒

```bash
# 检查 MySQL 服务是否启动
net start mysql

# 检查端口 3306
netstat -an | findstr 3306

# 检查用户权限
mysql -u lynn -p
# 输入密码 Ee9527ffss
```

### 9.5 端口被占用

```bash
# 查找占用端口的进程
netstat -ano | findstr :5176

# 终止进程（PID 替换为实际值）
taskkill /PID <PID> /F
```

### 9.6 桌面端 Tauri 构建失败

```bash
# 确认前端已构建
cd desktop-native
npm run frontend:build

# 确认 Rust 工具链
rustup show

# 清理构建缓存后重试
cargo clean --manifest-path desktop-native/src-tauri/Cargo.toml
cd desktop-native/src-tauri
npx tauri build --bundles nsis
```

### 9.7 安卓端构建失败

```bash
# 确认 JDK 17
java -version

# 确认 Android SDK
cd android
./gradlew.bat :app:compileDebugKotlin

# 清理构建
./gradlew.bat clean
```

---

## 十、开发流程快速参考

### 10.1 标准迭代流程

```
1. 需求确认（弹窗确认方案）
2. 代码实现
3. 本地自测（npx tsc --noEmit + npm run dev 验证）
4. 本地构建部署产物（scripts/deploy/build.ps1）
5. 部署到云服务器（仅服务端，桌面端/安卓端不部署）
6. 自测验证
7. 清理测试数据
8. 更新 DEV_LOG.md
9. 提交代码到 Gitee
10. 清理临时文件
```

### 10.2 常用命令速查

```bash
# Web 端
npm run dev                    # 启动开发服务器
npm run build                  # 构建
npm run lint                   # 代码检查
npx tsc --noEmit               # TypeScript 类型检查
npx prisma studio              # 数据库可视化

# 桌面端
cd desktop-native && npm run dev          # 启动 Tauri 开发
cd desktop-native/src-tauri && npx tauri build --bundles nsis  # 构建安装包

# 安卓端
cd android && ./gradlew.bat :app:assembleDebug   # 构建 APK

# 部署
python scripts/deploy/deploy_standalone.py        # 部署 Web 端到服务器
node scripts/compile-ws-gateway.mjs                # 编译 WS 网关

# 清理
cargo clean --manifest-path desktop-native/src-tauri/Cargo.toml  # 清理 Rust 缓存
```

---

## 十一、服务器信息（仅参考，新设备开发无需操作）

| 项 | 值 |
|---|---|
| IP | 47.119.185.135 |
| 系统 | Ubuntu 22.04, 2C2G |
| Web 应用 | https://ai.lynxdo.com |
| 官网 | https://www.lynxdo.com |
| 服务器目录 | /opt/lynx/app/ |

> **警告**：服务器禁止执行 `npm install`、`npx`、`tsc`、`cargo build` 等构建命令（会导致 OOM 宕机）。所有构建产物在本地完成，仅同步产物到服务器。

---

## 十二、获取帮助

1. **查阅开发日志**：[DEV_LOG.md](./DEV_LOG.md) 记录了所有迭代历史
2. **查阅开发规范**：[DEVELOPMENT_SPEC.md](./DEVELOPMENT_SPEC.md) 包含完整的开发规范
3. **查阅 API 文档**：`docs/API.md`（如存在）
4. **询问主开发者**：遇到不确定的问题，优先通过飞书或即时通讯工具确认

---

> 本文档最后更新：2026-07-01（迭代97）
> 当前版本：Web 端 v1.0.32 / 桌面端 v1.0.32 / HermesAgent v0.18.0

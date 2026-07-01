# Lynx

> Lynx AI 工作台，不用学，直接干。

Lynx 是一个会自主学习、成长、进化的超级 AI 助理平台。它不只是 AI 聊天框，而是一套能自动执行、自动学习、自动记忆的完整工作系统，集灵感管理、决策看板、智能记忆图谱、AI 工作流、技能自动蒸馏、AGI 级 AI 能力于一体，支持 **Web / Windows 桌面 / Android** 三端互通可互相操控。

## 核心亮点

- **会进化的超级助理**：基于自研 **Lynx Agent**（实现于 HermesAgent 引擎）持久化记忆 + 持续学习管道 + bad 标注反馈纠错 + 巡检自动发现模式，越用越懂你
- **四大核心能力**：AI 工作流 / 自动蒸馏技能 / 智能记忆图谱 / AGI 级 AI 能力
- **三端互通**：Web、Windows、Android 共用一套 API 信封，可互相操控与远程指令
- **开箱即用**：60+ 预置技能、35 项细粒度权限、默认巡检规则、12 岗位职业空间
- **本地优先**：所有数据存本地 D 盘、桌面端 HermesAgent 引擎完全本地化运行

## 核心功能

### 知识管理
- ⚡ **闪电灵感**：快速捕捉灵感，支持附件、标签、自动收敛
- 📋 **决策看板**：北极星 → 战役 → 任务三层看板，拖拽排序，AI 自动提取认知
- 🧠 **记忆图谱**：基于 BGE-M3 embedding 的语义记忆图谱，自动连边（Top-K=20），5 分钟缓存，支持语义搜索
- 💡 **认知库**：方法 / 经验 / 提示词沉淀，AI 自动提取，独立 label 字段不污染源内容
- 📁 **对话资产**：捕获 Kimi / Claude / Codex 对话，提取结论和待办
- ⚰️ **灵感墓地**：归档不活跃灵感，支持复活检查与定时清理
- 🔗 **汇聚视图**：多源数据统一看板

### AI 能力
- 🤖 **AI 超级助理**：流式对话（首字延迟 < 700ms）、工具调用、语音对话、消息 good/bad 标注反馈学习
- 🎯 **Lynx Agent**（基于 HermesAgent 技术实现）：本地化运行，持久化记忆、持续学习、主动汇报、跨平台响应、操作审批安全机制
- 🛠️ **技能库**：可复用技能模板，AI SSE 流式生成，公共广场 + 导入导出
- 🔄 **AI 工作流**：可视化工作流编排，定时执行，flow-engine 调度
- 📊 **AI 巡检**：自动化巡检规则，定时检查灵感去重 / Graveyard 复活 / 定时清理软删除任务

### 协作能力
- 📋 **飞书任务同步**：双向同步飞书任务，Webhook 实时推送
- 🔔 **推送通知**：Web Push 通知，支持飞书加急
- 🖥️ **远程操控**：PC 远程控制，多设备协同，WS 网关独立进程（端口 3001）

### 管理后台
- 👥 **用户管理**：角色权限管理（35 项细粒度权限，memory:write / memory:update 分离）
- 🏢 **职业空间**：12 岗位定制化 AI 工具白名单
- 📊 **词元统计**：AI 调用量统计，每日 / 昨日 / 7日 / 累计，管理员可切换用户查看 + 排行榜
- 🔑 **用户 AI Key**：用户级 AI 大模型 Key 配置（支持 DeepSeek / MiMo / 自定义）

### 多端支持
- 🌐 **Web 端**：Next.js 14，端口 5176（强制），响应式 + PWA
- 🖥️ **桌面端**：Tauri 2.x + Rust（MSVC 工具链），1280×800 居中，托盘 + 全局快捷键 `Ctrl+Shift+L`，内置自动更新
- 📱 **移动端**：Android 原生（Kotlin + Jetpack Compose + Material3 + Hilt），五 Tab 结构（首页 / Lynx 助理 / 任务 / 记忆），便携使用 + 远程操控 Lynx Agent

## 技术架构

| 层级 | 技术 |
|------|------|
| 前端 | Next.js 14, React 18, TypeScript, Tailwind CSS, SWR, framer-motion |
| 后端 | Next.js API Routes, Prisma ORM, MySQL 8.0+ |
| AI | DeepSeek, MiMo（小米大模型）, BGE-M3 Embedding, TTS/ASR, 视觉多模态 |
| 桌面 | Tauri 2.x, Rust, HermesAgent 引擎（本地超级 AI 助理） |
| 移动 | Android 原生 (Kotlin, Jetpack Compose, Material3, Hilt) |
| 部署 | Node.js 20, PM2, Nginx |

### 架构亮点
- **统一 API 信封**：`{ success, data }` / `{ success, error: { code, message } }` 全端一致
- **双通道鉴权**：NextAuth session（Web）+ JWT Bearer Token（App / 桌面）
- **权限缓存版本号**：角色变更自动失效多实例缓存（permissionVersion 递增机制）
- **SSE 断连恢复**：流式输出支持断点续传
- **5 分钟记忆图谱缓存**：避免每次全量查询节点 + 边
- **Top-K 连边限制**：每个节点最多 20 条连边，防止 O(n²) 膨胀

## 快速开始

> **新设备首次搭建环境？请阅读 [新设备环境部署指南](./NEW_DEVICE_SETUP.md)**，按步骤操作即可完成环境搭建并开始开发。

### 环境要求
- Node.js 20+
- MySQL 8.0+（推荐 8.4）
- npm 10+
- Rust + MSVC 工具链（桌面端开发）

### 安装
```bash
# 克隆项目
git clone https://gitee.com/shenzhens-emotions-are-booming_0/lynn-hub.git
cd lynn-hub

# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 填入数据库和 AI API Key

# 初始化数据库
npx prisma db push
npx prisma generate

# 初始化默认数据（按顺序执行）
npx tsx prisma/seed.ts                # 创建默认管理员账号
npx tsx prisma/seed-roles.ts          # 初始化角色权限（admin/editor/viewer）
npx tsx prisma/seed-skills.ts         # 注入 60 个预置技能（12 岗位）
npx tsx prisma/seed-patrol-rules.ts   # 注入默认巡检规则

# 启动开发服务器（端口必须 5176）
npx next dev -p 5176
```

### 默认账号
- **管理员账号**：`admin` / `admin123`（或 `lynn` / `lynn123`）
- 首次登录后请立即修改密码（设置 → 个人资料）

### 桌面端开发
```bash
cd desktop-native
npm install
npm run dev      # 启动 Tauri 桌面端（独立 Vite 5177）
```

### 安卓端开发
```bash
cd android
./gradlew.bat :app:assembleDebug     # 构建 debug APK
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

### 访问
- Web 端：http://localhost:5176
- MySQL：localhost:3306
- WS 网关：localhost:3001

### 部署指南
生产环境部署请参考项目内部署脚本和配置，阿里云服务器部署流程：
1. 本地 `npm run build` 构建
2. 使用 PM2 托管 Next.js 服务
3. 配置 Nginx 反向代理
4. 配置环境变量（生产环境必须重新生成 `AUTH_SECRET`）

## 项目结构

```
src/
├── app/                    # Next.js App Router
│   ├── inbox/              # 灵感收件箱
│   ├── board/              # 决策看板（含 /board/trash 回收站）
│   ├── cognition/          # 认知库
│   ├── memory/             # 记忆图谱
│   ├── assets/             # 对话资产
│   ├── graveyard/          # 灵感墓地
│   ├── converge/           # 汇聚视图
│   ├── skills/             # 技能库 + 公共广场
│   ├── ai/                 # AI 助理 / 工作流 / 飞书任务 / 工作空间
│   ├── admin/              # 管理后台（用户 / 角色 / 词元统计）
│   ├── settings/           # 系统设置（备份 / 巡检 / 推送 / 远程操控 / 诊断）
│   └── api/                # API 路由（含 hermes 引擎 / desktop/update）
├── components/             # React 组件
│   ├── ai/                 # AI 助理组件（含 AssistantChat）
│   ├── layout/             # 布局（AppShell / CaptureBar / Sidebar / TitleBar）
│   ├── settings/           # 设置（含 DesktopHermesSection Lynx Agent 配置）
│   └── ui/                 # 通用 UI（Modal / Toast / ContextMenu / AnimatedList）
├── lib/                    # 工具库（含 hermes-learner / hermes-client / flow-engine）
├── hooks/                  # React Hooks
└── workers/                # Web Worker（力导向仿真）
desktop-native/             # Tauri 原生桌面应用（Rust + React）
│   ├── src-tauri/          # HermesAgent 引擎 + RPA + 自动更新 + auth
│   └── native-ui/          # 独立 React SPA 前端（Vite + TypeScript）
android/                    # Android 原生应用（Kotlin + Jetpack Compose + Hilt）
prisma/                     # 数据库 schema 和 seed
scripts/                    # 测试和维护脚本
web_Lynx/                   # 官网（Vite + React + TypeScript）
```

## Lynx Agent（基于 HermesAgent 技术实现）

Lynx Agent 是产品端显示名称，其底层引擎基于自研的 **HermesAgent** 技术实现 —— 一个本地化运行、持久化记忆、持续学习、可跨平台响应的 AGI 级 AI 代理框架。

### 三大进化机制
1. **Hermes 学习管道**：从用户行为 / 对话 / 任务执行中自动萃取模式，沉淀为可复用技能
2. **bad 标注反馈学习**：用户对 AI 回复标注 "bad" 时，附带 reason 写入 HermesReport，下次生成时主动避开
3. **巡检自动发现模式**：定时巡检规则扫描历史数据，主动发现高频模式并提报

### 三种 AI 模式
- **模式 A**：纯 LLM 对话（默认）
- **模式 B**：LLM + 工具调用（RAG / 记忆检索 / 技能执行）
- **模式 C**：Lynx Agent 接管（持久化记忆 + 持续学习，失败自动回退到 LLM）

### 安全机制
- 授权目录白名单（允许 Lynx Agent 访问的目录）
- 操作审批弹窗（高危操作需用户确认）
- 完全本地化 profile 存储于 `D:\LynnHub\.lynnhub\hermes-profiles\`

## 开发规范

- **端口**：开发服务器固定 5176，禁止 3000
- **数据库**：MySQL 数据目录 `D:\LynnHub\mysql_data`，启动前必须检测 3306 端口
- **磁盘**：所有数据存储在 D 盘，禁止 C 盘
- **配置**：`next.config.mjs` 是 Web 配置，禁止包含 `output: 'export'`（会导致 API 路由 `headers()` 报 `dynamic = "error"`）
- **提交**：每次迭代自动提交并推送到 Gitee
- **文档**：每个功能模块右上角必须包含使用说明
- **测试**：自测后清理 E2E 测试数据，避免脏数据
- **桌面端**：必须使用 MSVC 工具链（stable-x86_64-pc-windows-msvc）

详见 [DEVELOPMENT_SPEC.md](./DEVELOPMENT_SPEC.md)

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `DATABASE_URL` | MySQL 连接字符串 | - |
| `AUTH_SECRET` | next-auth JWT 签名密钥 | - |
| `NEXTAUTH_URL` | NextAuth 回调 URL | `http://localhost:5176` |
| `DEEPSEEK_API_KEY` | DeepSeek API Key | - |
| `DEEPSEEK_BASE_URL` | DeepSeek Base URL | `https://api.deepseek.com/v1` |
| `DEEPSEEK_MODEL` | DeepSeek 模型名 | `deepseek-chat` |
| `MIMO_API_KEY` | 小米 MiMo API Key | - |
| `MIMO_BASE_URL` | MiMo Base URL | `https://api.xiaomimimo.com/v1` |
| `MIMO_MODEL` | MiMo 模型名 | `mimo-v2.5` |
| `DEFAULT_LLM_PROVIDER` | 默认 LLM 提供商 | `deepseek` |
| `EMBEDDING_API_KEY` | 向量模型 Key（不填降级 TF-IDF） | - |
| `EMBEDDING_BASE_URL` | Embedding Base URL | `https://api.siliconflow.cn/v1` |
| `EMBEDDING_MODEL` | Embedding 模型名 | `BAAI/bge-m3` |
| `ASR_API_KEY` / `ASR_BASE_URL` / `ASR_MODEL` | 语音识别配置 | - |
| `TTS_API_KEY` / `TTS_BASE_URL` / `TTS_MODEL` | 语音合成配置 | - |
| `VISION_API_KEY` / `VISION_BASE_URL` / `VISION_MODEL` | 视觉多模态配置 | - |
| `LARK_APP_ID` / `LARK_APP_SECRET` | 飞书应用凭证 | - |
| `LARK_WEBHOOK_TOKEN` | 飞书 Webhook 验证 Token | - |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | Web Push 密钥对 | - |
| `SENTRY_DSN` | Sentry 错误监控（可选） | - |
| `TASK_DROPPED_RETENTION_DAYS` | 软删除任务清理天数 | 30 |
| `WS_PORT` | WebSocket 网关端口 | 3001 |
| `DESKTOP_LATEST_VERSION` | 桌面端最新版本号 | - |
| `DESKTOP_DOWNLOAD_URL` | 桌面端更新包下载地址 | - |
| `DESKTOP_SIGNATURE` | 桌面端更新签名 | - |

> 未配置的 AI Key 不会导致崩溃，对应功能会自动降级或禁用。

完整变量列表见 [.env.example](./.env.example)

## 桌面端自动更新

桌面端集成 `tauri-plugin-updater`，启动后延迟 5 秒自动检查更新：

- **检查端点**：`/api/desktop/update`（Tauri 2.x updater 协议）
- **版本来源**：`desktop/package.json` 的 `version` 字段
- **下载地址**：由 `DESKTOP_DOWNLOAD_URL` 环境变量提供
- **无更新**：返回 `204 No Content`
- **有更新**：返回 `platforms` 格式 JSON，前端通过 `update-available` 事件弹窗引导

可通过 Tauri command `check_for_updates` 主动触发检查。

## 开发日志

详细的迭代记录见 [DEV_LOG.md](./DEV_LOG.md)。

## 相关文档

- [新设备环境部署指南](./NEW_DEVICE_SETUP.md)
- [开发规范](./DEVELOPMENT_SPEC.md)
- [官网设计系统与主题配色](./DESIGN_SYSTEM.md)
- [安卓端 PRD 方案](./ANDROID_PRD.md)
- [API 文档](./docs/API.md)
- [用户指南](./docs/USER_GUIDE.md)
- [Lynx Agent 使用指南](./docs/hermes-usage-guide.md)

## License

MIT

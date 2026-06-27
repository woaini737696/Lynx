# Lynx

> Lynx AI工作台，不用学，直接干

Lynx 是一个会自主学习、成长、进化的超级 AI 助理平台，集灵感管理、决策看板、智能记忆图谱、AI 工作流、技能自动蒸馏于一体，支持 Web、Windows 桌面、Android 三端互通可互相操控。

## 核心功能

### 知识管理
- ⚡ **闪电灵感**：快速捕捉灵感，支持附件、标签
- 📋 **决策看板**：北极星指标 → 战役 → 任务三层看板，支持拖拽排序
- 🧠 **记忆图谱**：基于 embedding 的语义记忆图谱，自动连边，支持语义搜索
- 💡 **认知库**：方法/经验/提示词沉淀，AI 自动提取认知
- 📁 **对话资产**：捕获 Kimi/Claude/Codex 对话，提取结论和待办
- ⚰️ **灵感墓地**：归档不活跃灵感，支持复活检查
- 🔗 **汇聚视图**：多源数据统一看板

### AI 能力
- 🤖 **AI 超级助理**：流式对话、工具调用、语音对话、消息标注反馈
- 🎯 **Hermes Agent**：持久化记忆、持续学习、主动汇报、跨平台响应
- 🛠️ **技能库**：可复用技能模板，AI 流式生成，公共广场
- 🔄 **AI 工作流**：可视化工作流编排，定时执行
- 📊 **AI 巡检**：自动化巡检规则，定时检查灵感去重 / Graveyard 复活

### 协作能力
- 📋 **飞书任务同步**：双向同步飞书任务，Webhook 实时推送
- 🔔 **推送通知**：Web Push 通知，支持飞书加急
- 🖥️ **远程操控**：PC 远程控制，多设备协同

### 管理后台
- 👥 **用户管理**：角色权限管理（35 项细粒度权限）
- 🏢 **职业工作空间**：12 岗位定制化 AI 工具白名单
- 📊 **词元统计**：AI 调用量统计，每日 / 7日 / 累计
- 🔑 **用户 AI Key**：用户级 AI 大模型 Key 配置

### 多端支持
- 🌐 **Web 端**：Next.js 14，端口 5176
- 🖥️ **桌面端**：Tauri 框架，Windows / macOS / Linux，内置自动更新
- 📱 **移动端**：响应式 Web + PWA

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Next.js 14, React 18, TypeScript, Tailwind CSS |
| 后端 | Next.js API Routes, Prisma ORM, MySQL 8.0+ |
| AI | DeepSeek, MiMo（小米大模型）, BGE-M3 Embedding, TTS/ASR |
| 桌面 | Tauri 2.x, Rust |
| 部署 | Node.js 20, PM2 |

## 快速开始

### 环境要求
- Node.js 20+
- MySQL 8.0+
- npm 10+

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
npx tsx prisma/seed.ts          # 创建默认管理员账号
npx tsx prisma/seed-roles.ts    # 初始化角色权限（admin/editor/viewer）
npx tsx prisma/seed-skills.ts   # 注入 60 个预置技能（12 岗位）
npx tsx prisma/seed-patrol-rules.ts  # 注入默认巡检规则

# 启动开发服务器（端口 5176）
npm run dev
```

### 默认账号
- **管理员账号**：`admin` / `admin123`
- 首次登录后请立即修改密码（设置 → 个人资料）

### 桌面端开发
```bash
cd desktop
npm install
npm run dev      # 启动 Tauri 桌面端（自动拉起 Web 端 5176）
```

### 访问
- Web 端：http://localhost:5176
- MySQL：localhost:3306

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
│   ├── board/              # 决策看板
│   ├── cognition/          # 认知库
│   ├── memory/             # 记忆图谱
│   ├── assets/             # 对话资产
│   ├── graveyard/          # 灵感墓地
│   ├── converge/           # 汇聚视图
│   ├── skills/             # 技能库 + 公共广场
│   ├── ai/                 # AI 助理 / 工作流 / 飞书任务
│   ├── admin/              # 管理后台（用户/角色/词元/职业空间）
│   ├── settings/           # 系统设置（备份/巡检/推送/远程操控）
│   └── api/                # API 路由（含 hermes / desktop/update）
├── components/             # React 组件
├── lib/                    # 工具库
├── hooks/                  # React Hooks
desktop/                    # Tauri 桌面应用（Rust）
│   └── src-tauri/
│       ├── src/            # HermesAgent + RPA + 自动更新
│       └── tauri.conf.json # 桌面端配置
prisma/                     # 数据库 schema 和 seed
scripts/                    # 测试和维护脚本
```

## 开发规范

- **端口**：开发服务器固定 5176，禁止 3000
- **数据库**：MySQL 数据目录 `D:\LynnHub\mysql_data`
- **磁盘**：所有数据存储在 D 盘，禁止 C 盘
- **提交**：每次迭代自动提交并推送到 Gitee
- **文档**：每个功能模块右上角必须包含使用说明
- **测试**：自测后清理 E2E 测试数据

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

## License

MIT

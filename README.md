# LynnHub · 个人认知操作系统

> 灵感收敛 · 工作聚焦 · 记忆复利

一个集灵感管理、任务同步、AI 对话、知识沉淀、工作流编排于一体的个人认知操作系统。基于 Next.js 14 App Router 构建，深度集成飞书任务和多个 LLM 提供商。

## 核心功能

### 1. 灵感收敛（Inbox → Board → Cognition）
- **闪电输入**：全局快捷键唤起，快速捕获灵感
- **看板管理**：待处理 / 进行中 / 已完成 三列拖拽
- **认知库**：灵感沉淀为结构化知识，支持 AI 蒸馏

### 2. 飞书任务同步
- **全量同步**：通过 `lark-cli` 拉取所有任务清单的任务（含子任务）
- **实时推送**：Webhook 事件持久化到数据库 + SSE 实时推送（替代轮询）
- **多视图**：列表 / 日历 / 甘特 / 看板四种展示模式
- **DB 优先加载**：先返回数据库缓存（毫秒级），后台异步刷新 lark-cli
- **异步化**：`execSync` → `exec + Promise.all` 并行拉取，不阻塞事件循环

### 3. AI 助理
- **多模态对话**：支持文本 + 图片输入，DeepSeek / MiMo 动态切换
- **全双工语音**：VAD 语音活动检测 + 流式 ASR + 流式 TTS（首包 < 300ms）
- **VAD 自适应**：启动时采集 1 秒环境噪声，自动校准阈值
- **音色复刻**：上传 60 秒音频复刻个人音色

### 4. AI 工作流
- **可视化编排**：拖拽式节点画布，支持触发器/动作/条件/输出四类节点
- **真实执行引擎**：action 节点调用 LLM，condition 节点表达式求值
- **模板库**：灵感分类、对话蒸馏、每日复盘、技能生成、知识问答

### 5. 技能库
- **AI 生成**：从工作记录/对话中提取可复用技能模板
- **版本管理**：支持版本回滚和差异对比
- **分享码**：生成分享码供他人导入

### 6. 记忆图谱
- **向量检索**：基于 BGE-M3 embedding 的语义搜索
- **关联推理**：自动构建知识点之间的关联关系
- **降级策略**：无 embedding 时降级为 TF-IDF 关键词匹配

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Next.js 14 (App Router) + TypeScript |
| 样式 | Tailwind CSS + tailwindcss-animate |
| UI | Radix UI + lucide-react |
| 状态 | Zustand + React Hooks |
| 数据库 | MySQL + Prisma ORM |
| AI | DeepSeek + 小米 MiMo（OpenAI 兼容协议）|
| 飞书 | lark-cli（任务同步）+ Webhook 事件订阅 |
| 语音 | Web Audio API + MediaRecorder + SSE 流式 |

## 快速开始

### 环境要求
- Node.js ≥ 18
- MySQL ≥ 8.0
- lark-cli（飞书任务同步，[安装文档](https://github.com/larksuite/lark-cli)）

### 安装

```bash
# 1. 克隆仓库
git clone https://gitee.com/your-username/lynnhub.git
cd lynnhub

# 2. 安装依赖
npm install

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env 填入数据库连接、AI API Key、飞书凭证等

# 4. 初始化数据库
npm run db:generate
npm run db:push
npm run db:seed  # 可选：填充示例数据

# 5. 启动开发服务器
npm run dev
```

访问 http://localhost:5176

### 环境变量说明

| 变量 | 必填 | 说明 |
|------|------|------|
| `DATABASE_URL` | 是 | MySQL 连接字符串 |
| `DEEPSEEK_API_KEY` | 否 | DeepSeek API Key（不填则降级）|
| `MIMO_API_KEY` | 否 | 小米 MiMo API Key（不填则降级）|
| `LARK_APP_ID` | 否 | 飞书应用 ID（任务同步用）|
| `LARK_APP_SECRET` | 否 | 飞书应用密钥 |
| `LARK_WEBHOOK_TOKEN` | 否 | 飞书 Webhook 验证 Token |
| `EMBEDDING_API_KEY` | 否 | 向量模型 Key（不填则降级为 TF-IDF）|
| `ASR_API_KEY` | 否 | 语音识别 Key |
| `TTS_API_KEY` | 否 | 语音合成 Key |

> 未配置的 AI Key 不会导致崩溃，对应功能会自动降级或禁用。

## 项目结构

```
src/
├── app/                    # App Router 页面和 API
│   ├── ai/                 # AI 相关页面（助理/工作流/任务）
│   ├── api/                # API 路由
│   │   ├── ai/             # AI 能力（chat/asr/tts/flows）
│   │   ├── lark-tasks/     # 飞书任务 CRUD
│   │   ├── lark-webhook/   # Webhook 接收 + SSE 推送
│   │   ├── skills/         # 技能库管理
│   │   └── ...
│   ├── inbox/              # 灵感收件箱
│   ├── board/              # 看板视图
│   ├── cognition/          # 认知库
│   ├── memory/             # 记忆图谱
│   ├── skills/             # 技能库
│   ├── settings/           # 设置
│   ├── error.tsx           # 全局错误边界
│   ├── loading.tsx         # 全局加载 UI
│   └── layout.tsx          # 根布局
├── components/             # 通用组件
├── lib/                    # 核心库
│   ├── ai-provider.ts      # LLM 抽象层
│   ├── lark-sync.ts        # 飞书任务同步
│   ├── lark-webhook-handler.ts  # Webhook 处理
│   ├── db.ts               # Prisma 客户端
│   └── ...
└── prisma/
    └── schema.prisma       # 数据库模型
```

## 常用命令

```bash
npm run dev          # 启动开发服务器
npm run build        # 生产构建
npm run start        # 启动生产服务器
npm run lint         # ESLint 检查
npm run db:generate  # 生成 Prisma Client
npm run db:push      # 同步 schema 到数据库
npm run db:seed      # 填充示例数据
npm run db:studio    # 打开 Prisma Studio 可视化管理
```

## 飞书任务同步配置

1. **安装 lark-cli** 并完成登录授权
2. 在飞书开放平台创建应用，获取 `App ID` 和 `App Secret`
3. 配置事件订阅，URL 指向 `/api/lark-webhook`
4. 在 `.env` 中填入凭证
5. 首次访问 `/ai/lark-tasks` 触发全量同步

## 开发日志

详细的迭代记录见 [DEV_LOG.md](./DEV_LOG.md)。

## License

Private

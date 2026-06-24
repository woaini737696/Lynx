# LynnHub 安卓端 (uniapp) · 设计文档

> 日期：2026-06-24
> 状态：已确认，待实现
> 最低支持：Android 14（API 34）

## 1. 目标

为 LynnHub 个人认知操作系统开发安卓端 App，复用现有 Next.js 后端，零业务逻辑重写。

## 2. 已确认决策

| 决策项 | 选型 | 理由 |
|--------|------|------|
| 后端架构 | 复用现有 Next.js 后端 | 改动最小，功能对齐最快 |
| 功能范围 | 核心移动场景子集 | 聚焦高频移动场景，桌面重交互后续迭代 |
| 语音能力 | 文本优先，语音后续迭代 | 降低首版复杂度 |
| 数据离线 | 在线优先 + 本地缓存 | 架构简单，与现有后端一致 |
| uniapp 路线 | 经典 uniapp (Vue3) | 生态成熟，组件库丰富 |
| UI 组件库 | uni-ui 官方 | 深度适配，稳定免费 |
| 认证方式 | 新增 JWT Token 接口 | App 端 cookie 不可靠，Token 更适合 |
| 项目位置 | monorepo 子目录 mobile/ | 原子提交，共享上下文 |
| 最低系统 | Android 14（API 34） | 仅支持现代 Android |

## 3. 架构总览

```
┌─────────────────────┐        REST API         ┌──────────────────────────┐
│  uniapp (Vue3) App  │  ──── /api/* (JSON) ────▶│  现有 Next.js 后端        │
│  编译为 Android APK │  ◀── JSON 响应 ────────  │  MySQL + Prisma + AI     │
│  uni-ui 组件库      │                          │  部署到阿里云服务器       │
└─────────────────────┘                          └──────────────────────────┘
        │                                                  │
        │ uni.storage 缓存                                  │ 新增 /api/auth/token
        │ (token/用户/列表缓存)                              │ 改造 auth-utils 支持 Bearer
```

核心原则：uniapp 仅作移动前端，全部复用现有 `/api/*` 接口。后端仅做最小改造——新增 JWT 登录端点 + 让 `requireAuth()` 兼容 Bearer Token。

## 4. 后端改造（Next.js 侧）

现有 `src/lib/auth-utils.ts` 的 `getCurrentUser()` 只读 NextAuth session。改造为双通道鉴权：

1. **新增** `POST /api/auth/token`
   - 接收 `{username, password}`
   - bcrypt 校验（复用 `src/auth.ts` 中相同逻辑）
   - 签发 JWT（用现有 `AUTH_SECRET`，7 天有效期）
   - 返回 `{ token, user: {id, username, role, displayName} }`

2. **改造** `getCurrentUser()`
   - 优先检查 `Authorization: Bearer <token>` 头
   - 验证 JWT → 取得 user
   - 无 token 时回退到原 NextAuth session 逻辑（Web 端不受影响）

3. **改造** `src/middleware.ts`
   - 对 `/api/*` 路由，若携带合法 Bearer token 则放行（避免被重定向到 /login）
   - 非 API 路由保持原样

> 所有现有 API 路由（ideas/tasks/ai/chat/skills/memory...）一行不用改，自动支持 App 端 Token 鉴权。

## 5. 项目结构

```
LynnHub/
├── src/                      # 现有 Next.js（后端 + Web 前端）
├── mobile/                   # 新增：uniapp 安卓工程
│   ├── pages/
│   │   ├── login/            # 登录
│   │   ├── index/            # 今日聚焦（首页）
│   │   ├── inbox/            # 灵感收件箱
│   │   ├── board/            # 决策看板
│   │   ├── ai/chat/          # AI 对话
│   │   ├── tasks/            # 飞书任务
│   │   ├── memory/           # 记忆/认知查看
│   │   └── settings/         # 设置
│   ├── components/           # 复用组件（CaptureBar、IdeaCard 等）
│   ├── api/                  # API 封装层
│   │   ├── request.js        # uni.request 封装：注入 Bearer、401 拦截
│   │   ├── auth.js ideas.js tasks.js ai.js ...  # 按模块映射现有接口
│   ├── store/                # Pinia（user/settings/cache）
│   ├── static/               # 图标
│   ├── App.vue  main.js
│   ├── pages.json            # 路由 + tabBar 配置
│   ├── manifest.json         # App 配置（包名/权限/图标）
│   └── uni.scss              # 主题变量
```

## 6. 功能范围（核心移动场景子集）

| 模块 | 移动端实现 | 复用接口 |
|------|-----------|---------|
| 登录认证 | 用户名密码 → JWT | 新增 `/api/auth/token` |
| 今日聚焦 | 3 卡片首页 | `/api/focus` |
| 闪电输入 | 全局悬浮按钮(FAB) 唤起，替代 Ctrl+Space | `POST /api/ideas` |
| 灵感收件箱 | 列表 + 滑动操作 | `GET /api/ideas` |
| 决策看板 | 三列滑动，长按拖拽/状态切换 | `/api/tasks` |
| AI 对话 | 文本 + 图片输入，流式回复，provider 切换 | `/api/ai/chat/*` |
| 飞书任务 | 列表查看 + 完成/取消 | `/api/lark-tasks` |
| 记忆/认知 | 列表 + 语义搜索 | `/api/memory/search` `/api/cognitions` |
| 设置 | API 地址、主题、退出登录 | `/api/settings` |

首版不含：工作流可视化编排、力导向图谱、AI 巡检配置、语音 ASR/TTS/音色复刻、Web Push（后续迭代）。

## 7. 导航与交互

- **底部 tabBar**（替代 Web 左侧栏）：今日聚焦 / 看板 / AI / 任务 / 我的
- **闪电输入 FAB**：首页悬浮按钮，点击弹出输入浮层（移动端无全局快捷键）
- **深色主题**：对齐 Web 配色 `#0a0a0a` 背景，`#f6ad55`/`#63b3ed`/`#68d391` 三色

## 8. API 层与状态

- `api/request.js`：统一 `uni.request` 封装，自动注入 `Authorization: Bearer <token>`，401 → 清 token 跳登录
- **Pinia** 管理全局状态：`user`（登录态）、`settings`（API base URL、主题）、`cache`（列表缓存）
- API base URL 在设置页可配，存 `uni.storage`，默认指向开发服务器

## 9. 数据与缓存策略

- 在线优先：每次进页面调 API 取最新数据
- `uni.storage` 缓存：token、用户信息、各列表最近一次结果（弱网时先展示缓存，后台刷新）
- 图片上传：`uni.uploadFile` → 现有 `/api/upload`

## 10. 打包分发

- HBuilderX 云打包生成 APK
- Android 14+（API 34）
- `manifest.json` 配置包名、权限（网络/存储/相机用于图片输入）

## 11. 开发阶段

1. **脚手架**：uniapp 工程初始化 + 后端 JWT 改造 + 登录闭环 + tabBar 骨架
2. **核心捕获**：今日聚焦 + 闪电输入 FAB + Inbox + 看板
3. **AI 与任务**：AI 对话（流式）+ 飞书任务
4. **收尾**：记忆/认知 + 设置 + 主题打磨 + 打包

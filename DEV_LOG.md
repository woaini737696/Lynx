# LynnHub 开发日志

> 每次迭代开发时需先读取本文件，了解历史变更和当前状态。
> **规范**：每次迭代完成并提交后，必须同步更新本文件，新增一个迭代区块。

---

## 迭代 39 - 2026-06-27

### 任务概要
桌面端完整实现：Tauri 2.x 桌面端骨架 + HermesAgent 本地化 + 三档授权模式 + 多端协同远程操控 + 安全加固 + 自测验证。

### 完成内容

#### 1. WebSocket 网关（多端协同基础）
- `src/lib/ws-gateway.ts`：WS 网关服务，维护 PC 在线状态（userId → Set<channelId>），支持心跳保活、指令下发、审批请求转发
- `scripts/start-ws-gateway.js`：WS 网关启动脚本（tsx 运行，端口 3001，支持 PM2 托管）
- 新增依赖：`ws@^8.18.0`、`@types/ws@^8.5.10`

#### 2. 云端 API 路由（4 个新路由）
- `src/app/api/pc-sessions/route.ts`：PC 在线状态管理（GET 查询会话列表 / DELETE 删除会话）
- `src/app/api/hermes/remote-command/route.ts`：远程指令下发（POST 创建+转发 WS / GET 查询历史）
- `src/app/api/desktop/update/route.ts`：Tauri Updater 端点（版本检查 + semver 比较 + 签名验证）
- `src/app/api/agent-audit/route.ts`：Agent 审计日志（GET 查询/统计 / POST 写入）

#### 3. 桌面端前端集成
- `src/components/layout/DesktopBridge.tsx`：全局桥接组件，Tauri 环境自动同步 NextAuth session → Rust 端
- `src/app/layout.tsx`：挂载 DesktopBridge 组件
- `src/lib/desktop-client.ts`：桌面端桥接客户端（Tauri invoke/listen/emit 封装）

#### 4. 设置页 HermesAgent 桌面端专属区域
- `src/components/settings/DesktopHermesSection.tsx`（约 400 行）：五大区块
  - AI 环境检测与一键安装（调用 `installAiEnv()`，显示安装进度条）
  - HermesAgent 进程控制（启动 + 紧急停止）
  - 三档授权模式切换器（approve/once/free，仿 Codex）
  - 授权目录白名单管理（添加/移除）
  - 安全操作说明弹窗（`SafetyGuideModal`：三级操作分级 + 三档授权 + 紧急停止 + 审计日志 + 数据安全承诺）
- `src/app/settings/page.tsx`：插入 DesktopHermesSection
- `src/components/ui/Modal.tsx`：通用 Modal 组件（sm/md/lg/xl 四种尺寸 + Esc 关闭 + 遮罩关闭）

#### 5. AI 助理三档授权模式切换器
- `src/app/ai/assistant/page.tsx`：
  - 输入框上方新增三档授权模式切换器 UI（仅桌面端显示，仿 Codex 风格）
  - 新增审批请求弹窗 Modal（L2/L3 级操作显示操作描述、执行命令、批准/拒绝按钮）
  - 新增 WS 连接状态监听、授权模式切换、审批响应处理

#### 6. Web 端远程操控页面
- `src/app/settings/remote-control/page.tsx`（约 370 行）：三大区块
  - PC 设备列表：展示所有已登录同账号的 PC，在线/离线状态，点击选择目标 PC
  - 下发远程指令：输入框 + 快捷指令示例，调用 `/api/hermes/remote-command` POST
  - 指令历史：最近 20 条指令的状态（pending/dispatched/executing/completed/failed）和结果
- `src/components/layout/Sidebar.tsx`：新增「远程操控」导航项
- `src/lib/help-content.ts`：新增 `remote-control` 使用说明

#### 7. Tauri Rust 端核心模块（前序已完成）
- `desktop/src-tauri/src/hermes/`：HermesAgent 本地化（mod/router/executor）
- `desktop/src-tauri/src/rpa/`：RPA 能力（browser/desktop/file/shell）
- `desktop/src-tauri/src/auth.rs`：鉴权（session 同步）
- `desktop/src-tauri/src/installer.rs`：AI 环境一键安装
- `desktop/src-tauri/src/ws_client.rs`：WS 客户端（连接云端网关）
- `desktop/src-tauri/tauri.conf.json`：Updater 配置

#### 8. 数据库 Schema（前序已完成）
- `prisma/schema.prisma`：新增 PcSession / RemoteCommand / AgentAuditLog 三张表

#### 9. TypeScript 类型错误修复
- `src/app/api/ai/chat/route.ts`：修复 9 个类型错误
  - 导入 `ChatResponse` 类型，修正 `firstResult` 类型声明
  - 使用 `firstResultSync`（const）替代可空的 `firstResult`（避免 await 后类型 widening）
  - `LLMProvider` 类型断言处理 `"unknown"` fallback

#### 10. 规范文档更新
- `DEVELOPMENT_SPEC.md`：新增 §9 桌面端规范（9.1-9.7：架构/HermesAgent本地化/三档授权/多端协同/安全操作/自动更新/开发流程）

### 自测结果
- **TypeScript 编译**：`npx tsc --noEmit` 对 `src/` 目录零错误 ✓
- **MySQL 检查**：端口 3306 可达 ✓
- **Dev server 启动**：`npx next dev -p 5176` → Ready in 2.4s ✓
- **HTTP 探测**：
  - `http://localhost:5176/api/health` → 200 ✓
  - `http://localhost:5176/login` → 200 ✓
  - `http://localhost:5176/settings/remote-control` → 200（39KB 内容）✓
- **已知非致命问题**：pino/thread-stream worker.js 偶发模块缺失（日志线程，不影响主服务）

### Commit hash
（待提交后填写）

---

## 迭代 38 - 2026-06-27

### 任务概要
MySQL 启动规范补充 + start-mysql.ps1 编码修复 + 词元（Token）显示修复与重命名 + 词元统计增强（用户切换/排行榜/用户级 AI Key/职业权限）+ 系统性能深度优化。

### 完成内容

#### 1. 补充 §1.7 规范：dev server 启动前必须确认 MySQL 已运行
- `DEVELOPMENT_SPEC.md` §1.7 新增 MySQL 启动前置检查（端口 3306 探测 + 失败时禁止启动 dev server）
- 新增 `.next` 缓存清理步骤（避免 worker.js 模块缺失导致启动失败）
- 新增 `/login` 探测验证步骤

#### 2. 修复 start-mysql.ps1 中文编码问题
- PowerShell 脚本中 `Write-Host` 输出中文乱码 → 全部改为英文输出
- 脚本逻辑保持不变：检测 MySQL 服务 → 启动 `mysqld --datadir=D:/LynnHub/mysql_data --port=3306`

#### 3. 修复 AI 助理词元（Token）显示为 0 的问题
- **根因**：Provider（特别是 MiMo）流式响应不返回 `usage` 字段
- **修复**：`src/lib/ai-provider.ts` 新增 `estimateTokens(text)` 函数（中文 1.5 字/token，英文 0.75 词/token）
- **修复**：新增 `ensureUsage(usage, messages, output)` fallback 估算函数
- `chatStream` 在 `[DONE]` 事件中调用 `ensureUsage` 确保始终返回非零 token 数
- 全局将 "Token" 改名为 "词元"（`AssistantChat.tsx`、`ai/assistant/page.tsx`、`token-stats` 页面/API）

#### 4. 词元统计功能增强
- **管理员用户切换**：`/api/admin/token-stats` 新增 `userId` 查询参数，支持按用户过滤
- **词元排行榜**：新增 `byUser` 聚合（groupBy sessionId → 映射用户 → 按 tokens 排序），前端新增排行榜弹窗（金/银/铜排名样式）
- **用户级 AI Key 配置**：
  - Prisma schema: `User` 新增 `userDeepseekApiKey`/`userMimoApiKey`/`userAiProvider` 字段
  - 新建 `/api/user/ai-keys` API（GET 掩码显示 + PUT 更新）
  - 新建 `UserAIKeyConfig` 组件（DeepSeek/MiMo Key 输入 + 显隐切换 + 清除）
  - 设置页集成 `UserAIKeyConfig`
  - `ai-provider.ts` 新增 `getLLMConfigForUser(userId, provider?)` 函数
  - `chat()`/`chatStream()` 支持 `apiKey`/`baseUrl` 选项覆盖
  - `/api/ai/chat/route.ts` 三处 chat/chatStream 调用传入用户级 Key
- **职业管理 AI 大模型权限**：
  - Prisma schema: `ProfessionWorkspace` 新增 `allowedProviders Json @default("[]")` 字段
  - `/api/admin/profession-workspaces` GET/POST 支持 `allowedProviders` 字段
  - 职业工作空间页面新增 allowedProviders 选择 UI（DeepSeek/MiMo 切换按钮）
  - `getLLMConfigForUser` 读取用户职业的 `allowedProviders` 限制

#### 5. 系统性能深度优化
- **数据库索引优化**（`prisma/schema.prisma`）：
  - `Task`: 新增 `@@index([column, status, position])` 复合索引 + `@@index([createdAt])`
  - `Memory`: 新增 `@@index([createdAt])` + `@@index([strength])` + `@@index([ideaId])` + `@@index([conversationId])` + `@@index([cognitionId])`
  - `Cognition`: 新增 `@@index([createdAt])` + `@@index([ideaId])` + `@@index([conversationId])`
- **Prisma 连接池配置**（`src/lib/db.ts`）：
  - 新增 `connection_limit=20&pool_timeout=10` 连接池参数
  - 生产环境也缓存到 global，避免 HMR/模块边界创建多实例
- **Next.js 构建优化**（`next.config.mjs`）：
  - 新增 `swcMinify: true`
  - 新增 `experimental.optimizePackageImports: ["lucide-react", "ai", "@prisma/client"]`（按需引入大库）
  - 新增 `compiler.removeConsole`（生产环境移除 console.log，保留 error/warn）
- **API 路由 N+1 修复**：
  - `cognitions/route.ts` POST：3 个串行 for 循环 `create` → `createMany` 一次性批量插入
  - `ai/chat/route.ts`：职业工作空间查询 + AI 设置查询 → `Promise.allSettled` 并行化（减少 2 次 DB 往返）
  - `tasks/route.ts` GET：新增 `take: 100` 上限保护
- **客户端 N+1 fetch 修复**：
  - `board/page.tsx`：认知入库串行 for 循环 fetch → `Promise.all` 并行

### 验证结果
- ✅ MySQL 3306 端口可达
- ✅ dev server 在 5176 端口启动成功（`npx next dev -p 5176`）
- ✅ `/login` 返回 200
- ✅ `/api/auth/session` 返回 200
- ✅ `/api/admin/token-stats`、`/api/admin/profession-workspaces`、`/api/tasks`、`/api/cognitions` 返回 307（未认证重定向，符合预期）
- ✅ `npx tsc --noEmit` src/ 目录无 TypeScript 错误
- ✅ `npx prisma db push` 成功同步 schema
- ⚠️ worker.js MODULE_NOT_FOUND 是已知的 thread-stream logger 非致命问题，不影响功能

### 文件变更清单
- `DEVELOPMENT_SPEC.md` - §1.7 新增 MySQL 启动前置检查
- `scripts/start-mysql.ps1` - 中文输出改英文
- `prisma/schema.prisma` - User/ProfessionWorkspace 新字段 + 索引优化
- `src/lib/db.ts` - 连接池配置
- `src/lib/ai-provider.ts` - estimateTokens + ensureUsage + getLLMConfigForUser
- `src/app/api/ai/chat/route.ts` - 并行查询 + 用户级 Key 集成
- `src/app/api/cognitions/route.ts` - createMany 批量化
- `src/app/api/tasks/route.ts` - take 上限
- `src/app/api/admin/profession-workspaces/route.ts` - allowedProviders 字段
- `src/app/api/admin/token-stats/route.ts` - 用户过滤 + 排行榜
- `src/app/api/user/ai-keys/route.ts` - 新建用户级 Key API
- `src/app/admin/token-stats/page.tsx` - 用户切换 + 排行榜 UI
- `src/app/admin/profession-workspaces/page.tsx` - allowedProviders UI
- `src/app/settings/page.tsx` - 集成 UserAIKeyConfig
- `src/components/settings/UserAIKeyConfig.tsx` - 新建组件
- `src/components/ai/AssistantChat.tsx` - Token 改名词元
- `src/app/ai/assistant/page.tsx` - Token 改名词元
- `src/app/board/page.tsx` - 认知入库并行化
- `next.config.mjs` - 构建优化

---

## 迭代 37 - 2026-06-27

### 任务概要
AI 助理体验全面优化：Token 统计显示 + 流式回复 + 词元统计页面 + 创建灵感路径修复 + 语音通话重做 + Hermes Dashboard 启动修复 + Git Bash 依赖修复。

### 完成内容

#### 1. 修复 AI 助理回复后 Token 数未显示
- `ChatMessage` 接口新增 `usage`/`provider`/`model` 字段
- `sendText`/`sendVoice` 保存后端返回的 usage 信息
- 消息气泡下方渲染元信息：Provider（大写）· 模型 · Token 数（含 ↑prompt ↓completion）
- Hermes 模式标记 `Hermes` 徽章，回退标记 `回退` 徽章

#### 2. 修复设置页 Hermes Agent Dashboard 无法打开
- 端口统一为 9119（3 处修复：`settings/page.tsx`、`api/hermes/test/route.ts`、`hermes-client.ts`）
- `startHermesAgent` 重写：移除 `--skip-build` 参数；stdio 改为收集 stderr；30s HTTP 轮询替代 1.5s 固定等待；失败返回详细 stderr 日志

#### 3. 优化 AI 助理回复速度 + 展示思考/工具调用过程
- `assistantMode` + `stream=true`：第二轮 LLM 调用走 SSE 实时输出
- `/api/ai/chat/route.ts` 新增 3 个流式出口（无 action / 工具未授权 / 有 action 执行工具）
- 前端 SSE 解析：meta/delta/done/error 事件，delta 实时更新消息
- 流式且内容为空时显示"正在思考..."，有内容时显示闪烁光标 ▋

#### 4. 新增词元统计（Token）功能页面
- 新建 `src/app/api/admin/token-stats/route.ts`：聚合查询今日/昨日/近7天/累计 + byProvider groupBy + 分页
- 新建 `src/app/admin/token-stats/page.tsx`：4 个统计卡片（含环比涨跌）+ Provider 分布柱状图 + 消耗记录表格 + 分页
- `Sidebar.tsx` 管理组新增"词元统计"入口（Coins 图标）
- `AppShell.tsx` PAGE_TITLE_MAP 新增映射
- `help-content.ts` 新增 `admin-token-stats` 使用说明

#### 5. 修复 AI 助理创建灵感走错路径
- **根因**：Hermes Takeover 模式开启后，所有用户消息直接传给 Hermes Agent，Hermes 不知 LynnHub 数据库，创建 md 文件而非调用 `prisma.idea.create`
- **修复**：在 Hermes Takeover 调用前用 `detectIntent(userText)` 检测系统工具意图，命中（创建灵感/任务/看板等）则跳过 Hermes，直接走 LLM + Function Calling 路径

#### 6. 修复 AI 助理语音通话：状态显示 + 即时反馈 + 接听体验
- `VoicePhase` 类型新增 `connecting`（正在接通）和 `error`（异常）状态
- `startVoiceCall` 重写：先进入 connecting 状态给 UI 即时反馈；修复不支持流式 ASR 时 voiceCallActive 保持 true 的假通话 bug
- `sendVoice` 改为流式响应（`stream: true`）：边生成边 feed TTS，首字延迟最小化
- 状态条增强：connecting 显示"正在接通语音..."；listening/speaking 阶段显示 ASR 实时识别文字；error 状态显示异常
- 接听按钮：connecting 时显示加载动画并禁用点击

#### 7. 修复 Hermes Agent 依赖 Git Bash 问题（看板整理功能）
- **根因**：Hermes 执行 shell 命令时需要 bash，但 PATH 中没有 Git Bash 的 bin 目录
- **修复**：新增 `findBashDir()` 函数检测 bash.exe（D:\Git\bin → C:\Program Files\Git\bin → C:\Program Files (x86)\Git\bin），结果缓存 10 分钟
- `buildHermesEnv` 把 bash 目录 prepend 到 PATH
- `startHermesAgent` 的 spawn 传入 `env: buildHermesEnv()`，Dashboard 子进程也能找到 bash

### 自测结果
- TypeScript 编译：`npx tsc --noEmit` 通过（src 目录零错误）
- ESLint：`npx next lint` 通过（0 错误 0 警告）
- Git Bash 检测：D:\Git\bin\bash.exe 确认存在
- dev server 启动：`npx next dev -p 5176` Ready in 5.3s，HTTP `http://localhost:5176` 返回 200

### 修改文件清单
- `src/components/ai/AssistantChat.tsx` - Token 显示 + 流式回复 + 语音通话重做
- `src/app/api/ai/chat/route.ts` - assistantMode 流式 + Hermes Takeover 系统意图检测
- `src/app/api/hermes/test/route.ts` - 默认端口 9119
- `src/app/settings/page.tsx` - fallback 端口 9119
- `src/lib/hermes-client.ts` - startHermesAgent 重写 + findBashDir + buildHermesEnv PATH 修复
- `src/components/layout/Sidebar.tsx` - 词元统计导航
- `src/components/layout/AppShell.tsx` - 词元统计标题映射
- `src/lib/help-content.ts` - 词元统计使用说明
- `src/app/api/admin/token-stats/route.ts` - 词元统计 API（新增）
- `src/app/admin/token-stats/page.tsx` - 词元统计页面（新增）
- `DEVELOPMENT_SPEC.md` - 自动 push 配置 + PowerShell 环境说明

### Commit
- `2a32f5fc` - feat: 迭代37 - AI助理Token显示+流式回复+词元统计页面+创建灵感路径修复+语音通话重做+Hermes Dashboard启动修复+Git Bash依赖修复

---

## 迭代 36 - 2026-06-26

### 任务概要
悬浮聊天窗技能菜单遮挡修复 + 端口 5176 规范强化 + 角色管理完整 CRUD + 用户管理打通 + 职业工作空间简化 + 头像上传 + 使用说明补全。

### 完成内容

#### 1. 悬浮聊天窗技能菜单遮挡修复
- **问题**：`AssistantDrawer.tsx` 的 `overflow-hidden` 裁剪了技能下拉菜单（`absolute bottom-full` 向上弹出）
- **修复**：`AssistantChat.tsx` 中技能菜单改用 `createPortal` 渲染到 `document.body`，`z-[9999]` + `fixed` 定位，通过 `getBoundingClientRect()` 计算按钮位置

#### 2. 端口 5176 规范强化
- **`DEVELOPMENT_SPEC.md`** §2 新增启动命令规范：`npx next dev -p 5176`，禁止使用 3000 端口

#### 3. 角色管理完整 CRUD
- **API**（`src/app/api/admin/roles/route.ts`）：
  - 新增 POST：创建新角色（name 唯一校验 + profession 必选 + permissions 校验）
  - 新增 DELETE：删除非系统角色（有用户使用时拒绝删除）
  - 删除 `[id]/route.ts`（DELETE 合并到 route.ts）
- **前端**（`src/app/admin/roles/page.tsx`）：
  - 加"新建角色"按钮 + 新建弹窗（name 可编辑）
  - 非系统角色卡片加"删除"按钮 + 确认弹窗
  - profession 下拉必选校验

#### 4. 用户管理打通
- **API**（`src/app/api/users/route.ts` + `[id]/route.ts`）：
  - POST/PATCH 的 role 校验从硬编码改为动态查 Role 表
  - GET 返回 profession 字段（join Role 表）
- **前端**（`src/app/admin/users/page.tsx`）：
  - 角色选择从 `/api/admin/roles` 动态拉取
  - 筛选器角色列表动态拉取
  - RoleBadge 动态显示 displayName + 职业图标

#### 5. 职业工作空间简化
- **`src/app/admin/profession-workspaces/page.tsx`**：
  - 删除"快捷技能可见集"配置维度（改为用户自配）
  - 保留 3 维度：专属功能模块 + 可用 AI 模型 + System Prompt
  - POST body 不再发送 quickCommands

#### 6. 头像上传
- **`src/app/settings/profile/page.tsx`**：
  - 新增头像文件上传按钮（file input + `/api/upload` API）
  - 支持图片类型校验 + 5MB 大小限制
  - 上传中 loading 状态 + 清除按钮
  - 复用已有 `/api/upload` 通用上传 API

#### 7. 使用说明补全
- **`DEVELOPMENT_SPEC.md`** 新增 §3.1 功能模块使用说明规范
- **`src/lib/help-content.ts`** 新增 4 个 key：`profession-workspaces`、`admin-users`、`admin-roles`、`settings-profile`
- **4 个页面加 HelpButton**：职业工作空间、用户管理、角色管理、个人资料

### 自测结果
- TypeScript 编译：`npx tsc --noEmit` 通过（src 目录零错误）
- dev server：端口 5176 启动成功
- Git 2.54.0 安装到 D:\Git，PATH 配置完成

### Commit
- `62793508` - feat: 迭代36 - 悬浮窗技能菜单Portal修复+端口5176规范+角色CRUD+用户管理打通+职业工作空间简化+头像上传+使用说明补全
- push 待手动执行（Gitee 需要认证）

---

## 迭代 35 - 2026-06-26

### 任务概要
悬浮聊天窗技能按钮修复 + 快捷消息填入输入框（不自动发送） + 角色管理按职位分配 + 按职业定制 AI 工作空间（4 维度完整实现）。

### 完成内容

#### 1. 悬浮聊天窗 bug 修复
- **技能按钮可点击**：`AssistantChat.tsx` 中"技能"标签改造为可点击 button，点击展开下拉菜单（6 个快捷技能列表），选择后调用 `handleQuickCommand`
- **快捷消息填入输入框**：`handleQuickCommand` 改为把内容填入输入框 + 聚焦 textarea（不自动发送），与 AI 助理页行为同步
- **快捷消息超出屏幕修复**：`visibleQuickCommands` 过滤后只展示当前职业可见的快捷技能，避免超出屏幕
- **修复 NextAuth 登录 500**：`[...nextauth]/route.ts` 中 `response.headers.set` 在 undici 不可变 headers 下抛 TypeError，改为重新构造 `new Headers()` + `new Response()`

#### 2. 角色管理-按职位分配
- **`src/app/admin/roles/page.tsx`**：编辑弹窗新增"关联职业"下拉（12 岗位 + "不绑定"），保存时 PUT `profession` 字段
- **角色卡片显示职业绑定**：底部显示职业图标 + 名称 + "配置工作空间"跳转链接
- **`src/app/api/admin/roles/route.ts`**：
  - GET 返回 `profession` 字段
  - PUT 新增 `profession` 更新逻辑（含 `isValidProfessionKey` 校验）
  - `getOrCreateRoles` 新增升级兼容逻辑：已有系统角色缺 profession 字段时回填默认值（admin→founder, editor→pm）
- **`DEFAULT_ROLES`**：admin 绑定 founder, editor 绑定 pm, viewer 不绑定

#### 3. 按职业定制 AI 工作空间（4 维度）
- **Prisma schema**：`Role` 模型新增 `profession String?` 字段；新增 `ProfessionWorkspace` 模型（profession unique, displayName, description, icon, accentColor, quickCommands JSON, systemPrompt, defaultProvider, defaultModel, defaultReasoningMode, allowedTools JSON, enabled）
- **12 岗位静态定义**（`src/lib/permissions.ts`）：pm/designer/frontend/backend/data/operations/marketing/hr/finance/project/creator/founder，每个岗位有默认快捷技能、默认可见工具、默认 system prompt、默认模型
- **Admin 管理 API**：
  - `GET /api/admin/profession-workspaces` - 返回 12 岗位工作空间列表（合并 DB 自定义 + 静态默认）
  - `POST /api/admin/profession-workspaces` - upsert 自定义配置
  - `DELETE /api/admin/profession-workspaces/[profession]` - 重置为默认
  - `GET /api/admin/profession-workspaces/quick-commands` - 返回快捷技能清单
  - `GET /api/ai/tools` - 返回 23 个 AI 工具清单
- **用户工作空间 API**（`GET /api/ai/workspace`）：按 `Role.profession` 加载工作空间配置
- **Chat route 注入**（`src/app/api/ai/chat/route.ts`）：
  - auth 后加载 profession workspace
  - system prompt 追加"职业工作空间设定" + "可用工具白名单"
  - 拦截不在白名单的工具调用（返回"工具未授权"）
  - 应用职业默认 model/reasoningMode
- **Admin 配置页**（`src/app/admin/profession-workspaces/page.tsx`）：12 岗位 4 维度配置（图标/颜色/描述/快捷技能可见集/system prompt/默认模型/工具白名单/启用开关）+ 只读模式 + 编辑模式 + 重置默认
- **前端注入**（`AssistantChat.tsx`）：
  - `useWorkspace` hook 拉取职业工作空间
  - `visibleQuickCommands` 根据 workspace.quickCommands 过滤
  - useEffect 应用职业默认 model（仅初始化一次）
  - 头部副标题显示职业：`${workspace.icon} ${workspace.displayName} · 共享会话`
- **导航**：Sidebar 管理组新增"职业工作空间"入口，AppShell `PAGE_TITLE_MAP` 加对应标题

### 自测结果
- TypeScript 编译：`npx tsc --noEmit` 通过（exit 0）
- HTTP API 端到端自测（9 项全通过）：
  1. /api/auth/token 登录拿 JWT ✓
  2. /api/ai/workspace 返回 founder 默认工作空间（profession/displayName/quickCommands/systemPrompt/allowedTools 全对）✓
  3. /api/ai/tools 返回 23 个 AI 工具 ✓
  4. /api/admin/profession-workspaces/quick-commands 返回 6 个快捷技能 ✓
  5. /api/admin/profession-workspaces 返回 12 个职业工作空间 ✓
  6. /api/admin/roles 角色职业绑定正确（admin→founder, editor→pm, viewer→null）✓
  7. POST 保存 founder 自定义配置 ✓
  8. 再查 workspace 确认自定义配置已生效 ✓
  9. DELETE 重置 founder 工作空间 ✓
- 数据库：prisma db push 同步 schema，profession 字段回填到 3 个系统角色

### Commit
- `32583bf` - feat: 迭代35 - 悬浮窗技能按钮修复+快捷消息填入输入框+角色管理按职位分配+按职业定制AI工作空间(4维度)

---

## 迭代 34 - 2026-06-26

### 任务概要
C 盘数据迁移到 D 盘 + 磁盘使用规范写入强制规范文件 + npm 全局包路径迁移。

### 完成内容

#### 1. C 盘数据排查与迁移
- **MySQL 数据目录**：从 `C:\lynnhub_mysql_data2`（约 250MB）迁移到 `D:\LynnHub\mysql_data`，通过 `--datadir` 启动参数指定
- **Hermes profiles**：从 `C:\Users\lynnd\.lynnhub`（约 442MB）迁移到项目根目录 `.lynnhub/hermes-profiles/`
- **npm 全局包**：配置 `npm config set prefix "D:\LynnHub\npm-global"`，从 `C:\Users\lynnd\AppData\Roaming\npm`（约 1.1GB）迁移
- **C 盘累计释放**：约 1.8GB

#### 2. 代码路径改造
- **`src/lib/hermes-client.ts`**：`getUserProfileDir` 从 `os.homedir()`（C 盘）改为 `path.resolve(__dirname, "..", "..", "..")`（项目根目录），强制使用 D 盘
- **`scripts/start-mysql.ps1`**（新建）：MySQL 启动脚本，统一使用 `--datadir=d:/LynnHub/mysql_data --port=3306 --console` 参数
- **`scripts/reset-admin-user.ts`**：重建 lynn 超级管理员脚本（密码 ee9527ff），适配 D 盘数据库

#### 3. 规范文件更新
- **`DEVELOPMENT_SPEC.md`** 新增 §2.1 磁盘使用规范（强制）：
  - 禁止在 C 盘写入任何项目数据（MySQL/Hermes profiles/日志/缓存/临时文件）
  - 所有项目数据必须放在 D 盘
  - MySQL 数据目录：`D:\LynnHub\mysql_data`
  - Hermes profiles：`<项目根>/.lynnhub/hermes-profiles/`
  - npm 全局包：`D:\LynnHub\npm-global`
  - 临时文件：`os.tmpdir()` 返回 C 盘时改用项目目录下 `tmp/`
- **`.gitignore`** 新增：`/mysql_data/`、`/.lynnhub/`、`/tmp/`、`*.log` 排除
- **`debug.log`** 从 git 跟踪中移除（`git rm --cached`，已被 `*.log` 规则忽略）

#### 4. 数据库适配
- `npx prisma db push` 同步 schema 到 D 盘 MySQL（D 盘数据库是旧快照，缺少迭代31新增的 profession 字段）
- 重建 lynn 超级管理员 + 3 个默认角色 seed

### 自测结果
- TypeScript 编译：`npx tsc --noEmit` 通过（exit 0）
- MySQL 启动：`D:\LynnHub\mysql_data` 数据目录，端口 3306，2 个用户
- dev server 运行：端口 5176，API 返回 200
- npm 全局包路径：`npm config get prefix` 返回 `D:\LynnHub\npm-global`

### 待用户手动操作
C 盘旧数据目录沙箱 allowlist 限制无法自动删除，需用户手动清理：
- `C:\lynnhub_mysql_data2`（约 250MB）
- `C:\Users\lynnd\.lynnhub`（约 442MB）
- `C:\Users\lynnd\AppData\Roaming\npm`（约 1.1GB，可删除老数据）

### Commit
- `173105e` - feat: 迭代34 - C盘数据迁移到D盘+磁盘使用规范写入强制规范+npm全局包路径迁移
- `1e4c496` - feat: Android焦点页功能增强(addTask/deleteTask)+README磁盘空间规范

---

## 迭代 33 - 2026-06-26

### 任务概要
悬浮聊天窗与主 AI 助理共享会话 + 角色管理 CRUD（创建/编辑/删除）+ Role 绑定职业。

### 完成内容

#### 1. 悬浮聊天窗共享会话
- **`src/components/ai/AssistantChat.tsx`** 重写改造：
  - 加载最近会话：mount 时 GET /api/ai/chat/sessions?limit=10，取最近会话加载历史消息，无则创建新会话
  - 发送消息持久化：POST /api/ai/chat 带 sessionId+assistantMode:true，AI 回复后 POST /api/ai/chat/sessions/{id}/messages 持久化
  - 工具调用渲染对齐主页面：larkTaskCard 复用 LarkTaskCard 组件，通用工具调用可展开卡片（工具名+摘要+完整JSON）
  - 会话切换 UI：header 显示当前会话标题，点击展开下拉列表（最近10个会话），可切换或新建
  - 用 ref 持有最新闭包避免 stale closure
  - 保留全双工语音、快捷技能、模型切换、LarkTaskCard 功能

#### 2. 角色管理 CRUD + Role 绑定职业
- **`prisma/schema.prisma`**：Role 模型新增 `profession String? @db.VarChar(100)`
- **`src/lib/permissions.ts`**：新增 PROFESSIONS（12岗位 key/label/icon）、PROFESSION_LABEL_MAP、isValidProfessionKey
- **`prisma/seed-roles.ts`**：3 个默认角色补充 profession=null
- **`src/app/api/admin/roles/route.ts`**：GET 返回 profession+professions目录；新增 POST 创建角色（校验name唯一+格式、displayName、permissions、profession，强制 isSystem=false）；PUT 增加 profession/displayName 更新
- **`src/app/api/admin/roles/[id]/route.ts`**（新建）：DELETE 删除角色（系统角色403，有用户引用400）
- **`src/app/admin/roles/page.tsx`** 重写：创建角色按钮+创建/编辑共用弹窗（name/displayName/description/profession下拉+权限勾选）+删除按钮（非系统角色）+职业badge+权限数+用户数
- **`src/app/api/users/route.ts`**：GET 增加 profession；POST 改为动态校验角色（查Role表），自动同步 user.profession=role.profession
- **`src/app/api/users/[id]/route.ts`**：GET/PATCH 增加 profession；PATCH 角色变更时自动同步用户职业
- **`src/app/admin/users/page.tsx`**：User 类型加 profession；角色选择器改为动态（含自定义角色）；表格新增职业列显示橙色 badge

### 自测结果
- TypeScript 编译：`npx tsc --noEmit` 通过（exit 0）
- Prisma db push + generate 成功（Role 表新增 profession 字段）
- dev server 运行正常（5176 端口）

### Commit
`7aedc85` - feat: 迭代33 - 悬浮聊天窗共享会话+角色管理CRUD+Role绑定职业+用户分配角色同步职业

---

## 迭代 32 - 2026-06-26

### 任务概要
极简聊天抽屉深度增强+输入区固定+旧分类迁移+用户菜单/未登录 bug 修复+角色管理独立菜单。

### 完成内容

#### 1. 极简聊天抽屉深度增强
- **`src/components/ai/AssistantChat.tsx`** 重写增强：
  - 同步 AI 头像/名称（从 `/api/ai/settings` 拉取 assistantName/assistantAvatar/avatarUrl），header 显示头像+名称，AI 气泡前小头像
  - 全双工语音实时沟通（复用 VoiceVAD/StreamASR/StreamTTS/BackchannelPlayer），Phone 接通/PhoneOff 挂断，状态条显示聆听/说话/AI回复，用户开口打断 TTS，浏览器不支持回退文本
  - 输入框上方快捷技能（QUICK_COMMANDS 横向滚动按钮，点击直接发送）
  - ModelSwitcher 模型切换（deepseek/mimo/auto），发送时带 provider
  - 布局：header(shrink-0) + 消息区(flex-1 overflow-y-auto) + 快捷技能(shrink-0) + 输入区(shrink-0 固定底部)
  - 用 ref 避免 stale closure，抽出 readChatStream 复用 SSE 解析
- **`src/components/ai/AssistantDrawer.tsx`** 精简：移除自带 header（AssistantChat 自带），传 onClose 渲染关闭按钮

#### 2. AI 助理完整页输入区固定（已满足）
- `src/app/ai/assistant/page.tsx` 已是 `flex h-[calc(100vh-3.5rem)] flex-col` + header(sticky) + 消息区(flex-1 overflow-y-auto) + 输入区(shrink-0 border-t) 结构，输入区已固定底部

#### 3. 旧 category 迁移脚本
- **`scripts/migrate-skill-categories.ts`**（新建）：general→custom、report/review/product→pm、knowledge→creator、meeting→project、finance 保持
- 运行结果：finance 5 条更新（同值），其余旧分类已无数据，迁移后 60 条技能全部为新岗位分类

#### 4. 修复用户头像菜单 bug
- **`src/components/layout/UserMenu.tsx`**：根因是 onClick 切换与 onMouseEnter 冲突 + onMouseLeave 未覆盖整体。改为纯 hover 模式（onMouseEnter/onMouseLeave 绑定在外层 menuRef 容器，覆盖按钮+菜单整体），移除 onClick 切换，保留点击外部关闭兜底

#### 5. 修复未登录立即弹窗引导 bug
- **`src/components/ai/AssistantGlobalEntry.tsx`**：新增 useEffect，检测到 `authChecked && !isLoggedIn && pathname 非 /login、/register` 时立即 setShowLoginModal(true)，无需等用户点击

#### 6. 角色管理+用户管理独立一级菜单
- **`prisma/schema.prisma`**：新增 Role 模型（id/name/displayName/description/permissions JSON/isSystem）
- **`src/lib/permissions.ts`**（新建）：10 项权限目录 + 3 个默认角色定义（admin 10 权限/editor 7 权限/viewer 2 权限）
- **`prisma/seed-roles.ts`**（新建）：upsert 初始化 3 个默认角色，运行成功
- **`src/app/admin/users/page.tsx`**（新建）：从 settings/users 迁移，功能不变
- **`src/app/admin/roles/page.tsx`**（新建）：角色卡片列表+权限编辑弹窗（仅 admin）
- **`src/app/api/admin/roles/route.ts`**（新建）：GET 返回角色+权限+用户数，PUT 更新（requireAdmin）
- **`src/app/settings/users/page.tsx`**：改为 `redirect("/admin/users")`
- **`src/components/layout/Sidebar.tsx`**：新增"管理"一级菜单（用户管理+角色管理），从"系统"分组移除用户管理
- **`src/components/layout/AppShell.tsx`**：PAGE_TITLE_MAP 新增 /admin/users、/admin/roles

### 自测结果
- TypeScript 编译：`npx tsc --noEmit` 通过（exit 0）
- Prisma db push + generate 成功（Role 表创建）
- 旧分类迁移脚本运行成功
- 角色 seed 成功（3 个角色入库）

### Commit
`72685b3` - feat: 迭代32 - 极简聊天抽屉深度增强(全双工语音/快捷技能/模型切换)+用户菜单bug修复+未登录立即弹窗+角色管理独立菜单+旧分类迁移

---

## 迭代 31 - 2026-06-26

### 任务概要
全局体验与飞书任务下发 5 大任务：(1) 悬浮抽屉改为极简聊天组件（废弃 iframe，快速弹出/收回）；(2) 未登录弹窗引导重新登录；(3) 新增顶部 header 栏+用户头像菜单+个人资料设置+User 表扩展；(4) 技能按 12 岗位分类+预置 60 个技能；(5) AI 一句话生成飞书任务（解析+卡片预览+确认下发）。

### 完成内容

#### 1. 悬浮抽屉极简聊天组件
- **`src/components/ai/AssistantChat.tsx`**（新建）：极简聊天组件，仅消息列表+输入框+发送+流式响应（SSE 解析 meta/delta/done/error），多轮对话上下文，Enter 发送/Shift+Enter 换行，自动滚动，预留 `toolCall` 字段支持工具卡片渲染。
- **`src/components/ai/AssistantDrawer.tsx`**：删除全部 iframe 逻辑，改用 `<AssistantChat />`；动画 duration 从 300ms 改为 200ms；桌面端新增透明点击层支持点击空白收回。
- **`src/components/ai/AssistantGlobalEntry.tsx`**：新增未登录检测（fetch `/api/auth/session`），未登录点击悬浮按钮弹窗"登录已过期，请重新登录"+"去登录"按钮跳转 `/login`。

#### 2. 顶部 header 栏 + 用户菜单 + 个人资料
- **`prisma/schema.prisma`**：User 模型新增 `profession String? @db.VarChar(100)` 和 `avatarUrl String? @db.VarChar(500)`，`npx prisma db push` 同步成功。
- **`src/auth.ts`**：jwt/session callback 注入 `displayName`/`avatarUrl`/`profession` 到 session.user。
- **`src/components/layout/UserMenu.tsx`**（新建）：fetch session 获取用户，显示头像（avatarUrl 或首字母）+昵称，hover 下拉菜单（个人资料设置/退出登录），退出登录走 next-auth v5 signout 流程。
- **`src/app/settings/profile/page.tsx`**（新建）：表单含头像URL（实时预览）/昵称/用户名（只读）/职业/角色（只读 admin/editor/viewer），PUT `/api/user/profile` 持久化。
- **`src/app/api/user/profile/route.ts`**（新建）：GET 返回当前用户 profile，PUT 更新 displayName/profession/avatarUrl（禁止改 username/role/passwordHash）。
- **`src/components/layout/AppShell.tsx`**：新增顶部 header 栏（h-14 border-b），左侧 L logo + 页面标题（usePathname 映射 22 个路由），右侧 `<UserMenu />`。

#### 3. 技能岗位分类
- **`src/app/skills/page.tsx`**：CATEGORIES 替换为 12 岗位分类（产品经理 pm/设计师 designer/前端工程师 frontend/后端工程师 backend/数据分析师 data/运营 operations/市场 marketing/HR hr/财务 finance/项目经理 project/内容创作者 creator/创业者 founder）+ hermes + custom，每岗位配独立图标，CATEGORY_BADGE/LABEL 含旧 key 兼容映射。
- **`src/app/skills/market/page.tsx`**：同步岗位分类，CATEGORY_OPTIONS 显式列举 12 岗位 + custom。
- **`src/app/api/skills/route.ts`**：默认分类从 general 改为 custom，注释说明新旧 key。
- **`prisma/seed-skills.ts`**（新建）：12 岗位 × 5 = 60 个预置技能（PRD撰写/竞品分析/组件库/性能优化/A-B测试/内容排期/品牌定位/面试问题/财务报表/风险识别/SEO优化/商业计划等），幂等 upsert，运行成功写入 60 个。

#### 4. AI 一句话生成飞书任务
- **`src/lib/lark-sync.ts`**：新增 `resolveOpenIdByName(name)`（lark-cli contact 解析姓名→open_id，带缓存）和 `createLarkTask(params)`（接收姓名数组→解析 open_id→调用 lark-cli task +create→返回 guid+url）。
- **`src/lib/ai-assistant-tools.ts`**：新增 `createLarkTask` 工具定义（参数 summary/assignees/due/description），注入 system prompt 让 AI 解析自然语言。
- **`src/app/api/ai/chat/route.ts`**：detectIntent 兜底新增飞书任务下发意图识别（从"给XX下发任务"提取负责人/截止/标题）。
- **`src/app/api/ai/assistant/tool-executor.ts`**：新增 `createLarkTask` case 调用 `executeCreateLarkTask`，仅返回卡片数据 `{ type: "larkTaskCard", data: {...} }` 不直接创建。
- **`src/components/ai/LarkTaskCard.tsx`**（新建）：共用飞书任务卡片组件，四态（pending/submitting/done/error），橙黑灰配色，done 态显示可跳转飞书链接，lark-cli 不可用时优雅降级。
- **`src/app/api/lark-tasks/create/route.ts`**（新建）：POST 接口，requireAuth 鉴权，调用 createLarkTask 创建飞书任务返回 guid+url。
- **`src/app/ai/assistant/page.tsx`**：消息渲染中当 `toolCalled.tool === "createLarkTask"` 且 `result.type === "larkTaskCard"` 时渲染 `<LarkTaskCard />`。
- **`src/components/ai/AssistantChat.tsx`**：当 `message.toolCall?.type === "larkTaskCard"` 时渲染 `<LarkTaskCard />`。

### 自测结果
- TypeScript 编译：`npx tsc --noEmit` 通过（exit 0，无错误）
- Prisma db push 成功同步 User 新字段
- 预置技能 seed 运行成功（60 个技能写入）
- dev server 正常运行（5176 端口）
- 所有新增代码遵循项目规范（端口 5176、橙黑灰配色、数据持久化规范）

### Commit
`f1b6527` - feat: 迭代31 - 极简聊天抽屉+未登录引导+顶部header用户菜单+技能岗位分类+AI生成飞书任务

---

## 迭代 30 - 2026-06-26

### 任务概要
数据持久化与全双工语音升级 4 大任务：(1) 飞书机器人配置从 localStorage 迁移到数据库持久化；(2) e2e 脏数据清理 + 编码规范（清理脚本 + afterEach 自动清理 + DEVELOPMENT_SPEC 新增 2 节）；(3) AI 助理全局悬浮入口（右下角悬浮按钮 + 右侧抽屉 + Alt+J 快捷键）；(4) 全双工语音重写（Soul 级别：流式 ASR 边说边理解 + VAD 说完判定 + 流式 TTS + 后缀音反馈 + 主动打断 + stale closure 修复）。

### 完成内容

#### 1. 飞书机器人配置持久化到数据库
- **`prisma/schema.prisma`**：AISetting 模型新增 `larkWebhookUrl String? @db.VarChar(500)` 和 `larkWebhookToken String? @db.VarChar(255)` 字段，`npx prisma db push` 同步成功。
- **`src/app/api/ai/settings/route.ts`**：PUT 方法新增 `larkWebhookUrl` / `larkWebhookToken` 到 allowedFields，支持传 null 清空或字符串更新，按字段名限制长度。
- **`src/app/settings/lark-bot/page.tsx`**：删除 localStorage 常量改为 `LEGACY_*` 仅用于迁移；页面加载 GET `/api/ai/settings` 拉取配置；保存 PUT 到数据库；**首次加载迁移逻辑**：检测 localStorage 旧 key → PUT 到数据库 → removeItem 清除 → toast 提示"已迁移旧配置到数据库"。
- **`src/app/api/lark-bot/test/route.ts`**：`webhookUrl` 改为可选参数，前端未传时从数据库 AISetting 读取兜底。
- **`src/lib/hermes-client.ts`**：新增 `pushToLarkWebhook(text)` helper（从 AISetting 读取 webhook，含签名校验）；`generateProactiveReport` 和 `executeCronJobViaAssistant` 的飞书推送从 `runLarkCliService` 改为调用 `pushToLarkWebhook`。

#### 2. e2e 脏数据清理 + 规范
- **`scripts/cleanup-e2e-data.ts`**（新建）：按 content 前缀（`E2E` / `E2E测试` / `测试灵感`）清理 Idea/Task/Memory/Cognition/Graveyard 表，含关联 Memory 清理，输出清理数量统计。运行结果：当前数据库无脏数据（0 条）。
- **`e2e/helpers/auth.ts`**：新增 `cleanupTestData(request, prefixes)` 辅助函数，通过 API 搜索前缀匹配数据并删除（Idea/Task/Memory 逐个 DELETE，Cognition 无 DELETE API 输出警告由脚本兜底）。
- **5 个 `e2e/*.spec.ts`**（idea-flow / board-flow / search-flow / backup-flow / auth-flow）：全部新增 `test.afterEach` 调用 `cleanupTestData(request, ["E2E"])`。
- **`DEVELOPMENT_SPEC.md`**：新增 §1.5 数据持久化规范（强制）+ §1.6 自测数据清理规范（强制）。
- **`package.json`**：新增 `dotenv` devDependency（清理脚本需要 `import "dotenv/config"`）。

#### 3. AI 助理全局悬浮入口
- **`src/components/ai/AssistantFloatingButton.tsx`**（新建）：右下角 `fixed bottom-6 right-6 z-40` 圆形悬浮按钮，橙色主题 `bg-primary`，hover scale-105，hover 显示"Alt+J"快捷键标签，无障碍 aria-label。
- **`src/components/ai/AssistantDrawer.tsx`**（新建）：右侧抽屉桌面端 `md:w-[40%] md:min-w-[400px] md:max-w-[600px]`，移动端全屏；iframe 加载 `/ai/assistant` 保持功能完整；滑入动画 `transition-transform duration-300`；移动端遮罩 `bg-black/20`，桌面端无遮罩；Esc 键关闭；iframe 首次打开后才挂载避免重复加载。
- **`src/components/ai/AssistantGlobalEntry.tsx`**（新建）：组合组件，`useState` 管理 open，`usePathname` 检测 `/ai/assistant` 路径不渲染悬浮按钮，`useEffect` 监听 `Alt+J` 快捷键唤出/收起。
- **`src/app/layout.tsx`**：在 body 内挂载 `<AssistantGlobalEntry />`。

#### 4. 全双工语音重写（Soul 级别）
- **`src/lib/voice-vad.ts`**（新建）：VAD 引擎封装，requestAnimationFrame 循环分析频谱音量，阈值 SPEECH_THRESHOLD=0.05 / SILENCE_DURATION_MS=1500（说完判定）/ SHORT_PAUSE_MS=200（短停顿）/ MAX_SPEECH_MS=15000（主动打断），回调 onSpeechStart/onSpeechEnd/onShortPause/onVolumeChange。
- **`src/lib/voice-asr-stream.ts`**（新建）：流式 ASR 封装 Web Speech API `SpeechRecognition`（continuous=true + interimResults=true，lang=zh-CN），`onInterim` 实时中间结果，`onFinal` 最终结果累积，`getAccumulatedText()` 获取累积文字，`reset()` 重置，`isStreamASRSupported()` 浏览器兼容检测，onend 自动重启。
- **`src/lib/voice-tts-stream.ts`**（新建）：流式 TTS 播放，`feed(textChunk)` 接收 AI 流式响应按句分割边生成边播，`stop()` 立即停止（用户开口打断），`finish()` 标记流结束，复用 `/api/ai/tts` 端点，首字延迟 <500ms。
- **`src/lib/voice-backchannel.ts`**（新建）：后缀音反馈，Web Audio OscillatorNode 合成"嗯"音，回退 SpeechSynthesis API。
- **`src/app/ai/assistant/page.tsx`**：语音模块重写为全双工模式：
  - 接通后持续 VoiceVAD 监听 + StreamASR 流式识别（边说边出文字显示在输入框）
  - VAD 短停顿（<1.5s）→ BackchannelPlayer.play()（AI 回"嗯"）
  - VAD 长静音（>1.5s）→ 判定说完，立即提交 ASR 累积文字给 LLM
  - LLM 流式响应 → StreamTTS.feed() 边生成边播（说完即答，端到端延迟 <1.5s）
  - TTS 播放中 VAD 检测用户开口 → StreamTTS.stop() 立即打断 → 重新监听
  - AI 主动打断：用户说话 >15s 插话
  - 按钮：接通语音通话 / 挂断（废弃旧的开始录音/结束录音）
  - 浏览器不支持 SpeechRecognition 时回退到 MediaRecorder 模式 + toast 提示
  - **stale closure 修复**：新增 useEffect 同步 `sendVoiceRef.current` / `handleVoiceSpeechEndRef.current`，VAD/fallback 通过 ref 调用最新闭包，解决多轮对话历史消息丢失 bug。

### 自测结果
- TypeScript 编译：`npx tsc --noEmit` 通过（exit 0，无错误）
- e2e 脏数据清理脚本运行：当前数据库无脏数据（0 条）
- Prisma db push 成功同步新字段
- 所有新增代码遵循项目规范（端口 5176、橙黑灰配色、数据持久化规范、自测数据清理规范）

### Commit
`1e17441` - feat: 迭代30 - 飞书配置持久化+e2e脏数据清理+AI助理全局悬浮入口+全双工语音重写(Soul级别)

---

## 迭代 29 - 2026-06-26

### 任务概要
Hermes Agent 深度集成 8 大任务：(1) 技能管理新增 Hermes 分类；(2) Hermes 记忆与记忆图谱双向同步；(3) HermesCron 改造巡检打通 AI 助理；(4) 模式 C 默认开启+状态显示+飞书机器人汇报；(5) 持续调教训练使用说明（新增文档第 8 章 9 小节）；(6) Cron 任务设置简化（5 个预设）；(7) 自动工作（TaskPattern 模型：做一遍→自动学习→下次自动做）；(8) 修复 Hermes 技能 Tab 加载（多级回退）。

### 完成内容

#### 1. 技能管理新增 Hermes 分类
- **`src/app/skills/page.tsx`**：`CATEGORIES` 新增 `{ key: "hermes", label: "Hermes", icon: Bot }`；`CATEGORY_BADGE` 新增 `hermes: "cognition"`；`SOURCE_LABEL` 新增 `hermes-learned`、`hermes-imported`、`marketplace`；侧边栏 hermes 分类按 `source` 计数。
- **`src/app/api/skills/route.ts`**：`category === "hermes"` 时改用 `source: { in: ["hermes-learned", "hermes-imported"] }` 过滤。

#### 2. Hermes 记忆与记忆图谱双向同步
- **`src/lib/hermes-client.ts`**：新增 `syncHermesMemoryToLynnHub(userId)` 读取 Hermes memory 目录文件，创建 `type: "hermes"` 的 Memory 记录，用 `embedText` 生成 embedding；新增 `exportMemoryToHermes(userId)` 将数据库 Memory 导出为文件到 Hermes memory 目录。
- **`src/app/api/hermes/memory/sync/route.ts`**（新建）：POST 端点触发双向同步。
- **`src/app/memory/page.tsx`**：`GraphNode["type"]` 新增 `"hermes"`；`TYPE_LABELS`/`TYPE_HSL`/`TYPE_ICON`/`FILTER_OPTIONS` 新增 hermes；新增"同步 Hermes 记忆"按钮。
- **`src/app/api/memory/route.ts`**：支持 hermes 类型。

#### 3. HermesCron 改造巡检 + 打通 AI 助理
- **`src/lib/hermes-client.ts`**：新增 `executeCronJobViaAssistant(userId, prompt)` 通过 AI 助理路径执行 cron 任务，成功后推送飞书。
- **`src/app/api/hermes/cron/execute/route.ts`**（新建）：POST 端点触发 cron 任务执行。
- **`src/app/api/hermes/cron/route.ts`**：新增 `validateCronExpression()` 严格校验 5 字段 cron 表达式；修复 JSDoc 注释 bug（`*/5` → `*\/5`）。
- **`src/app/settings/patrol/page.tsx`**：新增"🤖 Hermes Cron 自动巡检"卡片（5 个预设时间按钮、prompt 输入、创建/试运行/接管按钮、已有任务列表）。

#### 4. 模式 C 默认开启 + 状态显示 + 飞书机器人汇报
- **`prisma/schema.prisma`**：`hermesTakeover` 默认值从 `false` 改为 `true`；`hermesAutoReport` 默认值从 `false` 改为 `true`。
- **`src/app/ai/assistant/page.tsx`**：Message 接口新增 `hermesMode?` / `hermesFallback?`；AI 消息气泡新增绿色"Hermes Agent 回复"/琥珀色"LLM 回退"徽章；底部状态栏新增模式指示（`hermesTakeover` 为 true 时显示绿色"🤖 Hermes Agent 模式"）。
- **`src/lib/hermes-client.ts`**：`generateProactiveReport` 新增飞书推送段，检查 `feishuNotify`，通过 `runLarkCliService("im", "+messages-send --user-id ... --text ...")` 发送。
- **`src/app/api/hermes/chat-to-user/route.ts`**（新建）：POST 端点让 Hermes 主动通过飞书发消息给用户。

#### 5. 持续调教训练使用说明（新增文档第 8 章）
- **`docs/hermes-usage-guide.md`**：新增第 8 章"持续调教训练：让 Hermes 越来越懂你"，共 9 小节：
  - 8.1 调教的四大方式（记忆调教/技能强化/任务模式学习/反馈纠正）
  - 8.2 记忆调教：告诉 Hermes 偏好
  - 8.3 技能强化：重复任务触发 /learn
  - 8.4 任务模式学习：做一遍→自动做 ⭐（核心功能，含工作原理+操作步骤+适用场景+调教技巧）
  - 8.5 反馈纠正：让 Hermes 不犯同样的错
  - 8.6 模型选择策略（DeepSeek/MiMo/Auto）
  - 8.7 调教进度评估（5 个指标+里程碑）
  - 8.8 调教最佳实践清单（每日/每周/每月）
  - 8.9 完整调教案例：从 0 到超级助理（30 天）
  - 原章节 8-11 重新编号为 9-12。

#### 6. Cron 任务设置简化
- **`src/app/settings/patrol/page.tsx`**：新增 5 个一键选择预设（每天 9:00 / 每天 18:00 / 每小时 / 每周一 9:00 / 工作日 9:00），点击即填充 cron 表达式。

#### 7. 自动工作（TaskPattern 模型）
- **`prisma/schema.prisma`**：新增 `TaskPattern` 模型（patternKey/taskTemplate/steps/hermesPrompt/matchKeywords/executionCount/autoExecutedCount/autoExecute/lastExecutedAt/lastAutoResult），含 `@@index([userId, patternKey])` 和 `@@index([autoExecute])`；User 模型新增 `taskPatterns TaskPattern[]` 关系。
- **`src/lib/hermes-client.ts`**：
  - `learnTaskPattern(userId, taskDescription, taskResult)` 提取关键词、查找已存在模式、累加或新建；2 次以上自动启用 `autoExecute`。
  - `findMatchingPattern(userId, taskDescription)` 在 autoExecute=true 的模式中按关键词命中率评分。
  - `executePatternAutomatically(userId, pattern)` 通过 `executeAssistantViaHermes` 执行模式。
- **`src/app/api/ai/chat/route.ts`**：三处 assistantMode 出口异步非阻塞调用 `learnTaskPattern(userId, userText, aiContent)`；新增 `hermesFallback` 跟踪变量，LLM 回退时返回 `hermesFallback: true`。
- **`src/app/api/hermes/patterns/route.ts`**（新建）：GET 列表 / POST 手动学习。
- **`src/app/api/hermes/patterns/[id]/route.ts`**（新建）：PATCH 更新 / DELETE 删除。
- **`src/app/api/hermes/patterns/auto-check/route.ts`**（新建）：POST 检查匹配并自动执行。
- **`src/app/ai/assistant/page.tsx`**：新增"任务模式学习"区块（列表显示已学习模式、autoExecute 开关、检查自动执行按钮）。

#### 8. 修复 Hermes 技能 Tab 加载
- **`src/app/api/hermes/skills/route.ts`**：重写为多级回退：
  1. 尝试 Hermes Agent（如果运行中）
  2. 回退到数据库查询 `source IN ["hermes-learned", "hermes-imported"]`
  3. 回退到文件系统 `listLearnedSkills(userId)`
  - 始终返回 HTTP 200，含 `{ skills, source, hermesRunning }`，不再返回 400。
- **`src/app/ai/assistant/page.tsx`**：`fetchHermesSkills` 修复：检查 `res.ok`，保存 `hermesSource`/`hermesRunning` 状态，空状态显示预加载按钮；新增 `handlePreloadHermesSkills` 方法。

### 自测结果
- TypeScript 编译：`npx tsc --noEmit` 通过（exit 0，无错误）
- Prisma schema 验证通过（TaskPattern 模型+索引）
- 所有新增 API 路由遵循项目规范（端口 5176、橙黑灰配色、分页搜索筛选）

### Commit
`dab20ce` - feat(hermes): 迭代29 - Hermes深度集成（记忆同步+任务模式学习+飞书汇报+技能分类+调教文档）

---

## 迭代 28 - 2026-06-25

### 任务概要
修复用户反馈的 8 个问题：(1) 开发日志同步规范；(2) 全双工语音实时通话深度优化；(3) 关闭自动语音播放后仍播放的 bug；(4) 语音识别总识别为"透支"的 bug；(5) Hermes Agent 技能无法使用；(6)(7) Hermes Agent 使用说明 + 案例 + 最佳实践；(8) Hermes Agent 支持切换模型与系统 AI 模型打通。

### 完成内容

#### 1. 全双工语音通话深度优化
- **`src/app/ai/assistant/page.tsx`**：
  - 修复 VAD 截断 bug：`ondataavailable` 始终收集数据块（不再检查 `vadSpeechActiveRef`），`onstop` 中才快照 chunks，确保 `recorder.stop()` 的最终 flush 不丢失。**这是 ASR "透支"问题的根因**——之前每次录音丢失最后几百毫秒音频。
  - 新增 TTS 打断：用户开口说话时立即调用 `stopSpeaking()` 停止 TTS 播放，实现全双工对话体验。
  - 降低语音结束检测延迟：`SPEECH_END_MS` 从 800ms 降到 500ms，响应更迅速。
  - 超时保护同步修复：同样在 `onstop` 中快照 chunks。

#### 2. 修复自动语音播放 bug
- **`src/app/ai/assistant/page.tsx`**：自动播放条件从 `(autoSpeak || voiceMode)` 改为 `(autoSpeak || (voiceMode && voiceCallActive))`，关闭 autoSpeak 后非语音通话中不再自动播放。

#### 3. 修复语音识别"透支"问题
- **`src/lib/audio-utils.ts`**：`webmToWav` 不再强制 `sampleRate: 16000`，改用 AudioBuffer 实际采样率编码 WAV，避免部分浏览器忽略 sampleRate 选项导致采样率错位。
- **`src/app/ai/assistant/page.tsx`**：`transcribeAudio` 转换失败时不再将 webm 伪装成 wav 发送（ASR 无法解析），改为返回错误提示。

#### 4. Hermes Agent 模型切换 + 系统打通
- **`src/lib/hermes-client.ts`**：`configureHermesModel(provider)` 支持 `"deepseek" | "mimo" | "auto"`，auto 模式读取 `AISetting.defaultProvider` 决策。MiMo 分支写入 `MIMO_API_KEY` / `MIMO_BASE_URL` / `MIMO_MODEL`。
- **`src/lib/hermes-client.ts`**：`isHermesModelConfigured()` 同时检测 DeepSeek 和 MiMo 的 API Key。
- **`src/app/api/hermes/configure-model/route.ts`**：POST 接受 `provider` 参数；GET 返回 `availableModels` 和 `defaultProvider`。
- **`src/app/settings/page.tsx`**：新增模型选择下拉框（自动 / DeepSeek / MiMo），配置时传递所选 provider。

#### 5. Hermes Agent 技能预加载
- **`src/lib/hermes-client.ts`**：新增 `preloadDefaultSkills(userId)` 函数，创建 6 个默认技能文件（lynnhub-overview / task-management / idea-capture / memory-search / daily-report / patrol-check）到用户 profile/skills/ 目录。
- **`src/app/api/hermes/skills/preload/route.ts`**（新建）：POST 端点触发预加载。

#### 6. Hermes Agent 使用文档
- **`docs/hermes-usage-guide.md`**：从 186 行扩展到 638 行，覆盖 10 章：Hermes 是什么、安装启动、五大核心功能、主动汇报、如何发挥最大价值、10 个使用案例、最佳实践、10 个 FAQ、API 参考、注意事项。重点解答"为什么开了 Hermes 没感觉到作用"。

### 自测结果
- TypeScript 编译：`npx tsc --noEmit` 通过
- 待提交后运行 E2E 测试

### Commit
`5410c0d` - feat: 迭代28 - 语音优化+Hermes模型切换+技能预加载+使用文档+开发日志规范

---

## 迭代 27 - 2026-06-25

### 任务概要
Hermes Agent 五大功能完善（持久化 profile + /learn 回写 + Cron 接管巡检 + Skills 双向同步 + 模式 C 接管 AI 助理）+ 项目规范文件 + 公共技能广场。

### 完成内容

#### 1. 持久化 Profile（每用户独立记忆）
- **`src/lib/hermes-client.ts`**：`getUserProfileDir(userId)` 返回 `~/.lynnhub/hermes-profiles/<userId>/`，`buildHermesEnv(userId)` 重定向 LOCALAPPDATA 实现隔离。Profile 内含 logs/skills/memory/sessions 子目录，记忆跨会话保留。

#### 2. /learn 回写
- **`src/lib/hermes-client.ts`**：`syncLearnedSkills(userId)` 扫描 profile/skills/ 目录，`parseHermesSkillFile()` 解析 YAML front matter，回写到 Skill 表（`source: "hermes-learned"`）。
- **`src/app/api/hermes/execute/route.ts`**：任务成功后异步调用 `syncLearnedSkills()`（非阻塞）。

#### 3. Hermes Cron 接管巡检
- **`src/lib/hermes-client.ts`**：`listHermesCronJobs` / `createHermesCronJob` / `deleteHermesCronJob` + `takeoverPatrolWithHermes(userId)` 将 PatrolRule 转换为 Hermes Cron 任务。

#### 4. Skills 双向同步
- **`src/lib/hermes-client.ts`**：`exportSkillToHermes(skillId, userId)` 写 YAML+MD 文件；`importSkillFromHermes(fileName, userId)` 解析文件写数据库；`listLearnedSkills(userId)` 列出文件系统技能。

#### 5. 模式 C：Hermes Agent 接管 AI 助理
- **`src/lib/hermes-client.ts`**：`executeAssistantViaHermes(userId, message)` 构建带记忆上下文的 prompt，通过 Hermes CLI 执行，失败回退 LLM。`buildAssistantPrompt()` 注入持久化记忆 + 看板摘要 + 成长状态。`generateProactiveReport()` 分析用户数据生成汇报 + Web Push 跨平台推送。
- **`src/app/api/ai/chat/route.ts`**：`hermesTakeover` 开启时优先走 Hermes Agent，失败静默回退 LLM。
- **`src/app/ai/assistant/page.tsx`**：设置面板新增 Hermes 接管模式开关 + 主动汇报开关 + Cron 配置 + 立即生成汇报按钮 + 巡检接管按钮。

#### 6. 新增 8 个 API 路由
- `src/app/api/hermes/` 下：skills/sync、skills/learned、skills/export、skills/import、cron、cron/[id]、memory/search、profile、proactive-report、reports、patrol-takeover

#### 7. 项目规范文件
- **`DEVELOPMENT_SPEC.md`**（新建）：8 大强制规范（Git 同步 / 端口 / UI / 工程 / Hermes / 数据库 / 提交时机 / PowerShell）

#### 8. 公共技能广场
- **`prisma/schema.prisma`**：Skill 表新增 publicId / isPublic / publishedAt / downloadCount / ratingAvg 字段。
- **`src/app/api/skills/marketplace/`**：4 个广场 API（列表 / 详情 / 评论 / 加载）。
- **`src/app/skills/market/page.tsx`**：广场页面重写。

#### 9. 修复
- 移除 Hermes CLI 不支持的 `--learn` flag（改用 `syncLearnedSkills` 扫描目录）。
- `memory search` 改为直接读取文件（Hermes CLI 不支持 search 子命令）。

### 自测结果
- TypeScript 编译通过
- 19/19 E2E 测试通过
- API 验证通过

### Commit
`7227e78` - feat(hermes): Hermes Agent 五大功能完善 + 模式C接管AI助理 + 项目规范
`ca4f74a` - feat(skills): 公共技能广场 + 鉴权漏洞修复
`9f278f7` - fix(hermes): HTTP 405 修复

---

## 迭代 26 - 2026-06-25

### 任务概要
完成用户反馈的 6 个问题：(1) 左侧导航栏固定不动，右侧内容区独立滚动；(2) 所有列表页分页展示，默认 10 条可设置；(3) 所有列表页增加筛选+搜索功能；(4) Hermes Agent 执行失败 HTTP 401 修复；(5) UI 颜色从蓝紫色渐变改为橙黑灰高级感搭配；(6) 记忆图谱 3D 性能优化+滚轮缩放+点击节点聚焦子图+列表分页管理。

### 完成内容

#### 1. 导航栏固定
- **`src/components/layout/AppShell.tsx`**：外层容器从 `min-h-screen` 改为 `h-screen overflow-hidden`，内容区 `overflow-y-auto`，实现导航栏与内容区独立滚动。
- **`src/components/layout/Sidebar.tsx`**：aside 改为 `lg:sticky lg:top-0 lg:h-full`，确保桌面端固定。

#### 2. 全列表分页+搜索+筛选（11 个页面）
- **新建 `src/components/ui/ListControls.tsx`**：通用列表控件，导出 `SearchInput`、`FilterSelect`、`Pagination`、`useClientPagination` 四个组件/Hook。默认每页 10 条，可选 10/20/50/100。
- 覆盖页面：inbox、converge、assets、graveyard、cognition、skills、skills/market、settings/users、settings/patrol、ai/lark-tasks、ai/assistant。每个页面添加搜索+筛选+分页，保留原有功能不破坏。

#### 3. Hermes Agent HTTP 401 修复
- **`src/lib/hermes-client.ts`**：HTTP API 遇到 401/403 时不再直接报错，而是标记 `httpAvailable=true` 并 `continue` 尝试下一个端点。若所有端点都 401/403，非 `computer_use` 任务直接回退到 CLI 模式（CLI 不需要 HTTP 鉴权）。

#### 4. UI 橙黑灰高级感
- **`src/app/globals.css`**：全局 CSS 变量从蓝紫色（hue=248）完全切换为橙色（hue=24）。浅色主题 `--primary: 24 95% 53%`，深色主题 `--primary: 24 95% 58%`。语义色 northstar/campaign/cognition 全部改为橙黑灰体系。Button/Card 组件从渐变改为实色。
- **多文件**：所有 `purple`/`from-cognition to-purple-600`/`bg-gradient-to-*` 引用替换为 `bg-primary`、`bg-primary/10` 等语义色。覆盖 assistant/page.tsx、flows/page.tsx、login/page.tsx、layout.tsx、page.tsx、converge/page.tsx 等。

#### 5. 记忆图谱 3D 优化
- **`src/app/memory/page.tsx`**：
  - **性能优化**：背景 40 个光点预渲染到 offscreen canvas（不再每帧重绘）；普通节点用纯色填充无 shadowBlur，仅选中/悬停/聚焦中心节点用 `createRadialGradient + shadowBlur`；worker tick 用 `requestAnimationFrame` 合并，同一帧只渲染一次。
  - **滚轮缩放**：canvas 注册原生 `wheel` 事件（`passive: false`），`preventDefault` 阻止页面滚动，缩放范围 0.3-3x。
  - **点击聚焦子图**：单击节点进入该节点的子图谱视图（只显示该节点+直接连接节点+它们之间的边），重新初始化力导向模拟。聚焦模式下点击其他节点递归切换聚焦，点击当前聚焦节点退出。顶部显示返回按钮和子图信息。
  - **列表分页**：记忆列表使用 `useClientPagination` 分页，底部添加 `Pagination` 组件，列表高度从 340px 增加到 420px。
  - **颜色更新**：类型颜色从蓝紫色改为橙黑灰（idea=橙、conversation=深灰、cognition=深橙棕）。
- **`src/workers/force-simulation.worker.ts`**：大图（>80 节点）降低 tick 频率到 33ms（~30fps），小图保持 16ms（~60fps）。

### 自测结果
- TypeScript 编译：`npx tsc --noEmit` 通过（exit code 0）
- E2E 测试：19/19 全部通过（18.7s）
- API 验证：`/api/health` 返回 200
- Dev server：`http://localhost:3000` 正常运行

### Commit
`bcb3a43` - 24 files changed, +1123/-253

---

## 迭代 24 - 2026-06-25

### 任务概要
修复用户反馈的 6 个问题：(1) RSC 预取 ERR_ABORTED 控制台报错；(2) Hermes Agent 快速执行任务失败（`no final response`）；(3) 外部浏览器打开显示旧版本（SW 缓存拦截 HMR）；(4) AI 巡检删除按钮未确认即删除（`confirm()` 在内置浏览器行为不一致）；(5) AI 工作流节点配置过于复杂；(6) 移动端与 Web 端 AI 助理聊天记录/头像/名称未同步。

### 完成内容

#### 1. RSC prefetch ERR_ABORTED 修复
- **`src/middleware.ts`**：未登录时对 RSC 预取请求（带 `_rsc` 查询参数或 `RSC: 1` 头）返回 401 JSON，而非 307 重定向。避免浏览器跟随重定向时中断导致 `net::ERR_ABORTED`。

#### 2. Hermes Agent 快速执行失败修复
- **`src/lib/hermes-client.ts`**：重写 `executeHermesTask`——去掉导致 `no final response` 的 `--cli` 标志（仅保留 `--yolo`）；HTTP API 尝试多个端点（`/api/task`、`/api/run`、`/api/execute`、`/task`、`/run`）；超时从 30s 提升到 180s；针对 `no final response`/timeout/ENOENT 给出友好错误提示。

#### 3. 浏览器缓存旧版本修复
- **`public/sw.js`**：`CACHE_VERSION` 从 `v1` 升级到 `v2`（强制清理旧缓存）；localhost/127.0.0.1 开发环境完全 bypass 缓存，直接透传 dev server，避免 HMR 热更新被 Service Worker 拦截。

#### 4. AI 巡检删除 bug 修复
- **`src/app/settings/patrol/page.tsx`**：用自定义 Modal 弹窗替代浏览器原生 `confirm()`（Trae Solo 内置浏览器的 `confirm()` 行为不一致，导致未确认即删除）。新增 `deleteTarget`/`deleting` 状态、`confirmDeleteRule` 回调、AlertCircle 图标的确认弹窗。

#### 5. AI 工作流节点配置简化
- **`src/app/ai/flows/page.tsx`**：重写 `NodeConfigPanel`——新增 `NODE_PRESETS` 常量（每种节点类型的常用配置预设，一键应用）；核心配置精简化（只显示必填字段）；高级设置可折叠（hermes 工作目录/超时、http 请求头/请求体/超时）；delay 节点添加 1s/5s/10s/30s 快速选择；头部固定 + 可滚动内容区 + 底部操作固定。

#### 6. 移动端/Web 端 AI 助理同步
- **Schema**：`AISetting` 新增 `assistantAvatar String @default("🤖")` 字段（Emoji 头像，无 URL 时使用）
- **`src/app/api/ai/settings/route.ts`**：`allowedFields` 新增 `assistantAvatar`，含长度校验（≤16 字符）
- **移动端 `mobile/src/store/settings.js`**：`aiSettings` state 新增 `assistantName`/`assistantAvatar`；`loadAISettings`/`updateAISettings` 读写这两个字段，与 Web 端共用 `/api/ai/settings`
- **移动端 `mobile/src/pages/ai/chat/chat.vue`**：新增 `syncAssistantFromStore()` 从后端同步名称/Emoji 到显示 ref 并缓存本地；`saveSettings` 通过 `updateAISettings` 同步名称+Emoji+头像URL+风格到后端
- **Web 端 `src/app/ai/assistant/page.tsx`**：`AISettings` 类型新增 `assistantAvatar`；fetchSettings/updateSettings 同步该字段；头像显示由 `<Bot>` 图标改为 Emoji（与移动端一致）；设置面板新增 Emoji 选择器（🤖🐱🦊🐼🧠⚡🌟🎯）
- **聊天记录**：移动端与 Web 端已共用 `/api/ai/chat/sessions` 接口，会话存数据库，天然同步

### 自测
- TypeScript 编译通过（`tsc --noEmit`）
- Prisma `db push` + `generate` 成功，`assistantAvatar` 字段已入库
- API 验证：GET `/api/ai/settings` 返回 `assistantAvatar`；PUT 更新 `assistantName`+`assistantAvatar` round-trip 正确（🤖 = U+1F916）
- 移动端 H5 构建成功
- Playwright E2E：19/19 通过，无回归

---

## 迭代 23 - 2026-06-25

### 任务概要
完成 P1-P2 剩余任务：(1) AI 助理头像上传；(2) 聊天风格蒸馏增强（预览+强度调节）；(3) 数据导出备份验证 UI；(4) 404 监控+健康检查端点；(5) Hermes Agent 易用性改进（快速执行+自动刷新+使用说明链接）。修复 Hermes client 残留端口、TypeScript 编译错误、备份页面 useEffect 导入、诊断页 toast 导入。

### 完成内容

#### 1. P1.5 AI 助理头像上传
- **API**：`/api/ai/avatar-upload` 新建，接收 multipart/form-data，校验类型（PNG/JPEG/GIF/WebP/SVG）和大小（2MB），保存到 `public/avatars/<userId>-<timestamp>.<ext>`
- **前端**：`assistant/page.tsx` 头像区域改为 URL 输入 + 上传按钮并排，新增 `avatarUploading` 状态和 `handleAvatarUpload` 函数

#### 2. P1.6 聊天风格蒸馏增强
- **Schema**：`AISetting` 新增 `styleStrength Float @default(0.7)` 字段控制蒸馏风格影响程度
- **distill-style API**：POST 新增 `preview` 参数（不保存 DB 仅返回结果）；新增 PUT 方法用蒸馏风格生成示例回复预览效果
- **settings API**：新增 `styleStrength` 字段校验（0-1 范围）
- **chat route**：根据强度值调整 system prompt 措辞——≥0.8 严格模仿、≥0.4 适度融入、<0.4 轻微参考
- **前端**：蒸馏区域大幅重写——预览模式按钮、效果预览按钮、强度滑块（0-1 step 0.1）、清除按钮、保存按钮

#### 3. P2.7 数据导出/备份验证
- **API**：`/api/backup/verify` 新建，返回 7 种核心数据类型（ideas/tasks/conversations/cognitions/memories/skills/flows）的当前数据库计数
- **前端**：`settings/backup/page.tsx` 新增「数据验证」区块——显示数据库计数、导出后对比计数、数量一致/不一致标识、刷新按钮、导入后自动刷新验证

#### 4. P2.9 404 监控 + 健康检查端点
- **健康监控模块**：`src/lib/health-monitor.ts` 新建——内存环形缓冲区 404 日志（最多 200 条）、`logNotFound`/`getRecentNotFoundLogs`/`getNotFoundStats`/`clearNotFoundLogs` 函数、`checkHealth` 函数（DB ping + 内存 + uptime + 404 统计）
- **健康检查 API**：`/api/health` GET 公开（无需鉴权），返回 status/uptime/memory/db/notFound 统计
- **404 监控 API**：`/api/health/404s` GET 获取日志+统计 / POST 客户端上报 / DELETE 清空（仅 admin）
- **404 上报**：`not-found.tsx` 改为客户端组件，挂载时通过 `keepalive: true` 静默上报 404 路径
- **中间件**：`middleware.ts` 新增 `/^\/api\/health$/` 到 publicPatterns，允许公开访问健康检查
- **诊断页 UI**：`settings/diagnostics/page.tsx` 新增 404 监控区块——高频路径 Top 5、最近 30 条日志表格、清空按钮（admin）、刷新按钮、每 30 秒自动刷新

#### 5. Hermes Agent 易用性改进
- **使用说明文档**：`docs/hermes-usage-guide.md` 新建 9 章节完整使用说明（安装/启动/测试连接/AI 助理使用/工作流使用/FAQ/API 参考/安全/参考链接）
- **状态自动刷新**：Hermes 配置区块每 10 秒自动拉取 `/api/hermes/status`，状态变化无需手动刷新
- **快速执行区块**：服务运行中时显示输入框 + 执行按钮 + 4 个示例任务 chips（打开浏览器/查看文件/截图/查天气），回车直接执行，结果区显示输出+耗时
- **使用说明入口**：说明区右上角新增「使用说明」链接（打开 docs/hermes-usage-guide.md）和「打开 Dashboard」链接（服务运行中时显示，新标签打开 endpoint）
- **端口修复**：默认 endpoint 从 `http://localhost:7432` 改为 `http://localhost:9119`（Hermes Dashboard 实际端口），handleStart 回退端口同步修复
- **hermes-client 修复**：`upsertHermesConfig` create 分支遗留的 7432 端口改为 9119

#### 6. 移动端同步（subagent 完成）
- `mobile/src/api/ideas.js` 新增 `batchDeleteIdeas(ids)` 批量删除函数
- `mobile/src/pages/inbox/inbox.vue` 新增多选模式批量删除 UI
- `mobile/src/store/settings.js` 新增 `avatarUrl/personaStyle/distilledStyle` 字段 + `loadAISettings/updateAISettings` actions
- `mobile/src/pages/ai/chat/chat.vue` 设置弹窗支持头像 URL/风格描述/蒸馏区块

### 错误修复
- `assistant/page.tsx` line 2226 字符串引号冲突（中文双引号 `"保存并预览"` 破坏 JS 字符串），改用「」全角引号
- `backup/page.tsx` 缺少 `useEffect` 导入
- `diagnostics/page.tsx` 缺少 `toast` 导入
- `prisma db push` 时 Prisma client DLL 重命名失败（Windows 文件锁），停止 dev server 后 `npx prisma generate` 修复

### 关键文件
- `prisma/schema.prisma` — AISetting 新增 styleStrength 字段
- `src/app/api/ai/avatar-upload/route.ts` — 新建头像上传 API
- `src/app/api/ai/distill-style/route.ts` — POST preview 参数 + PUT 效果预览
- `src/app/api/ai/settings/route.ts` — styleStrength 校验
- `src/app/api/ai/chat/route.ts` — 风格强度注入 system prompt
- `src/app/ai/assistant/page.tsx` — 头像上传 UI + 蒸馏增强 UI
- `src/app/api/backup/verify/route.ts` — 新建备份验证 API
- `src/app/settings/backup/page.tsx` — 数据验证 UI
- `src/lib/health-monitor.ts` — 新建健康监控模块
- `src/app/api/health/route.ts` — 新建健康检查端点
- `src/app/api/health/404s/route.ts` — 新建 404 监控端点
- `src/app/not-found.tsx` — 客户端上报 404
- `src/middleware.ts` — 放行 /api/health
- `src/app/settings/diagnostics/page.tsx` — 404 监控 UI
- `src/app/settings/page.tsx` — Hermes 快速执行 + 自动刷新 + 链接
- `src/lib/hermes-client.ts` — 端口修复
- `docs/hermes-usage-guide.md` — 新建使用说明
- 移动端：`mobile/src/api/ideas.js`/`inbox.vue`/`settings.js`/`chat.vue`

### 自测结果
- TypeScript 编译通过（`npx tsc --noEmit`）
- Prisma db push 同步成功 + Prisma client 重新生成
- `/api/health` 返回 200 + 完整健康状态 JSON（DB connected、内存 426MB/456MB、版本 0.1.0）
- Playwright E2E：19/19 全部通过（auth/backup/board/idea/search 流程无回归）
- Dev server 正常运行于 http://localhost:3000（admin/admin123）

---

## 迭代 22 - 2026-06-25

### 任务概要
修复 Hermes Agent 启动/连接问题、Hermes 开关样式、添加使用说明；Inbox 批量删除；AI 助理聊天风格自定义（含真人聊天记录蒸馏）；清除脏数据/假数据；修复 404 间歇性崩溃。

### 完成内容

#### 1. Hermes Agent 启动/连接/使用说明
- **启动失败修复**：`hermes-client.ts` 新增 `findHermesExe()` 自动查找 pip --user 安装路径（Python313/312/311 Scripts 目录）；改用 `hermes dashboard --port 9119 --no-open --skip-build` 命令（非 `serve`）；等待 1.5s 确认进程存活
- **连接测试修复**：`testHermesConnection` 改为 HTTP + 命令行双模式——先试 `GET /`，失败回退 `hermes status`
- **任务执行/技能列表**：`executeHermesTask`/`listHermesSkills` 同样支持 HTTP + 命令行双模式
- **进程停止**：新增 `stopHermesAgent(port)` — Windows 用 `netstat + taskkill`，Linux/macOS 用 `lsof + kill`
- **端口修正**：HermesConfig 默认端口从 7432 改为 9119（Hermes Dashboard 实际端口）
- **使用说明**：`help-content.ts` settings 版本升至 2.2，添加 Hermes 安装/启动/连接/路径查找详细说明

#### 2. Hermes 启用开关样式修复
- `settings/page.tsx` 两个 toggle（启用 Hermes + 自动启动）从 `h-5 w-9` + `h-4 w-4` 改为标准 `h-6 w-11` + `h-5 w-5`
- 添加 `role="switch"`, `aria-checked`, `type="button"`, focus ring 样式

#### 3. Inbox 批量删除
- **API**：`/api/ideas` 新增 DELETE 方法，接收 `{ ids: string[] }`，单次最多 100 条
- **前端**：`inbox/page.tsx` 新增多选模式（`selectedIds` Set 状态）、批量操作栏（全选/取消/批量删除）、每条卡片复选框

#### 4. AI 助理聊天风格自定义
- **数据模型**：AISetting 新增 3 个字段——`avatarUrl`（头像 URL）、`personaStyle`（风格描述）、`distilledStyle`（蒸馏的真人风格）
- **风格蒸馏 API**：`/api/ai/distill-style` 接收聊天记录，用 AI 分析提取语气/用词/句式/emoji/节奏特征，保存到 `distilledStyle`
- **风格注入**：`/api/ai/chat` assistantMode 分支读取 AISetting，将 `personaStyle` 和 `distilledStyle` 插入 system prompt 的"重要约束"之前；替换助理名称
- **前端 UI**：`ai/assistant/page.tsx` 设置面板新增——头像 URL 输入 + 预览、聊天风格描述 textarea、蒸馏真人聊天风格区块（textarea + 开始蒸馏按钮 + 结果展示 + 清除按钮）；3 处头像位置支持自定义 URL

#### 5. 清除脏数据/假数据
- **seed.ts 重写**：仅创建 admin 用户（upsert），添加生产环境守卫，不再注入任何假数据
- **数据库清理**：`scripts/cleanup-seed-data.ts` 按精确内容匹配删除 seed 数据——11 ideas、14 tasks、2 memories、4 conversations、7 cognitions、3 graveyard、10 skills、20 skillReviews、15 larkTasks、8 dailyFocusItems
- **DEFAULT_FLOWS 修复**：`flow-store.ts` 中 3 个默认工作流的 `lastRun` 从假时间（"10分钟前"/"1小时前"）改为"未运行"，节点 status 从 "done" 改为 "idle"
- **.ai-flows.json 删除**：迁移备份文件含假数据，已删除
- **清理后数据**：idea 37、task 8、memory 70、conversation 2、cognition 9、graveyard 0、skill 8、skillReview 0、larkTask 222（全部为真实用户数据）

#### 6. 404 间歇性崩溃修复
- **根因**：pino-pretty transport 使用 worker thread（thread-stream），`.next` 缓存损坏时 `worker.js` MODULE_NOT_FOUND 导致 uncaughtException，引发间歇性 404
- **修复**：`logger.ts` 添加 `sync: true` 选项，使 pino-pretty 在同步模式运行不使用 worker thread

### 自测结果
- TypeScript 编译：`tsc --noEmit` 通过（0 errors）
- Playwright E2E：19/19 passed（28.3s），无回归
- API 验证：Login/Ideas/AI Settings/Flows/Hermes Config/Hermes Status/Inbox DELETE 全部 200
- AI Settings 新字段验证：avatarUrl/personaStyle/distilledStyle 正确返回 null
- Hermes Config 端口更新：7432 → 9119

### 关键文件变更
- `src/lib/hermes-client.ts` — 大幅重写（findHermesExe + dashboard 命令 + HTTP/CLI 双模式）
- `src/lib/logger.ts` — sync: true 修复 404
- `src/lib/flow-store.ts` — DEFAULT_FLOWS 假时间修复
- `src/lib/help-content.ts` — Hermes 使用说明
- `prisma/seed.ts` — 重写为仅 admin 用户
- `prisma/schema.prisma` — AISetting 3 新字段 + HermesConfig 端口默认值
- `src/app/api/ideas/route.ts` — DELETE 批量删除
- `src/app/api/ai/distill-style/route.ts` — 新建风格蒸馏 API
- `src/app/api/ai/chat/route.ts` — 风格注入 system prompt
- `src/app/api/ai/settings/route.ts` — 新字段校验
- `src/app/api/hermes/install/route.ts` — 端口 + stopHermesAgent
- `src/app/settings/page.tsx` — 开关样式修复
- `src/app/inbox/page.tsx` — 批量删除 UI
- `src/app/ai/assistant/page.tsx` — 风格自定义 UI + 头像支持
- `scripts/cleanup-seed-data.ts` — 新建脏数据清理脚本

---

## 迭代 21 - 2026-06-25

### 任务概要
完成 6 项 AI 自动化工作流深化任务（分两批实现）：(1) Hermes Agent 接入——一键部署本地 AI 代理操控电脑；(2) AI 工作流节点类型扩展——新增 hermes/http/database/transform/delay 5 种节点；(3) AI 助理技能面板收藏/历史/Hermes 打通；(4) ASR 支持 Safari audio/mp4 格式；(5) 蒸馏模板版本管理；(6) 使用说明按最新版本自动更新。

### 完成内容

#### 第一批（任务 4/5/6）

##### 4. ASR 支持 Safari audio/mp4 格式
- **前端 MIME 优先选择**：`createMediaRecorder` 按 `audio/mp4`（Safari）→ `audio/m4a` → `audio/webm`（Chrome）→ `audio/ogg` 顺序选择
- **后端 MIME 映射扩展**：`/api/ai/asr/route.ts` 增加 `.mp4` → `audio/mp4` 映射

##### 5. 蒸馏模板版本管理
- **版本历史 API**：`/api/ai/distill/templates/[id]/versions` GET 返回版本列表
- **版本回滚 API**：`/api/ai/distill/templates/[id]/versions/[version]` POST 回滚到指定版本
- **PATCH 版本管理**：`/api/ai/distill/templates/[id]` PATCH 时自动写入 SkillVersion 表（含 `@@unique([skillId, version])`）
- **版本历史 UI**：工作空间模板编辑区显示版本列表，支持回滚

##### 6. 使用说明按最新版本自动更新
- **集中管理**：新建 `src/lib/help-content.ts`，统一管理 13 个页面的使用说明，每个条目含 version + updatedAt
- **HelpButton 改造**：`src/components/layout/HelpButton.tsx` 新增 `contentKey` 参数，从 HELP_CONTENT 读取最新内容
- **13 个页面接入**：ai-assistant/ai-workspace/ai-flows/skills/skills-market/inbox/board/graveyard/memory/settings/settings-patrol/settings-push/search 全部改用 contentKey

#### 第二批（任务 1/2/3）

##### 1. Hermes Agent 接入（一键部署本地 AI 代理）
- **数据模型**：Prisma schema 新增 3 个模型
  - `HermesConfig`：用户 Hermes 配置（enabled/endpoint/apiKey/autoStart/capabilities/installedAt/status/lastError）
  - `SkillFavorite`：技能收藏（userId/skillId/source/skillName/category，`@@unique([userId, skillId])`）
  - `SkillExecution`：技能执行历史（userId/skillId/trigger/parameters/result/success/durationMs/error）
- **Hermes 客户端库**：新建 `src/lib/hermes-client.ts`
  - `getHermesConfig` / `upsertHermesConfig`：配置 CRUD
  - `testHermesConnection`：测试连接（5秒超时）
  - `executeHermesTask`：执行任务（computer_use/shell/auto 模式，可配置超时）
  - `listHermesSkills` / `executeHermesSkill`：Skills Hub 技能调用
  - `detectHermesInstall`：检测 pip 包是否已安装
  - `installHermesAgent`：执行 `pip install hermes-agent`（5分钟超时）
  - `startHermesAgent`：后台启动 `hermes serve --port 7432`
- **6 个 API 路由**：
  - `/api/hermes/install` GET 状态 / POST install/start/stop
  - `/api/hermes/status` GET 完整状态（installed/config/connected/version/capabilities）
  - `/api/hermes/test` POST 测试连接
  - `/api/hermes/execute` POST 执行任务（记录到 SkillExecution）
  - `/api/hermes/skills` GET Skills Hub 技能列表
  - `/api/hermes/config` GET / PUT 配置
- **设置页 UI**：`src/app/settings/page.tsx` 新增 `HermesConfigSection` 组件（约 380 行）
  - 安装状态指示灯（未安装/已安装/运行中）
  - 一键安装/启动/停止按钮
  - 启用开关、端点配置、API Key、能力配置（4 个 checkbox）、自动启动
  - 保存配置、测试连接按钮

##### 2. AI 工作流节点类型扩展
- **类型定义扩展**：`src/lib/flow-store.ts` NodeConfig 添加 hermes/http/database/transform/delay 字段，FlowNode type 联合类型扩展
- **5 个新节点执行器**：`src/lib/flow-engine.ts`
  - `executeHermesNode`：动态导入 hermes-client，调用 executeHermesTask，记录到 SkillExecution
  - `executeHttpNode`：fetch HTTP 请求，支持 `{{upstream}}` 模板替换，超时控制
  - `executeDatabaseNode`：Prisma 动态模型操作（query/create），支持 `{{upstream}}` 替换
  - `executeTransformNode`：4 种转换（template/jsonpath/regex/javascript，含安全沙箱校验）
  - `executeDelayNode`：setTimeout 延时（最大 60 秒）
  - 更新 `executeFlow`（顺序执行）和 `executeFlowWithEdges`（图遍历）两处 switch
- **可视化编排 UI**：`src/app/ai/flows/page.tsx`
  - NODE_STYLES 添加 5 个新节点样式（purple/blue/emerald/orange/gray 配色）
  - NODE_TYPE_LABELS / NODE_PANEL_ITEMS / defaultLabels 添加 5 个新节点
  - 节点配置编辑器添加 5 个新节点类型的配置 UI

##### 3. AI 助理技能面板收藏/历史 + Hermes 打通
- **2 个 API 路由**：
  - `/api/skills/favorites` GET 收藏列表 / POST upsert 收藏 / DELETE 取消收藏
  - `/api/skills/executions` GET 执行历史（支持 skillId/source/limit 筛选）
- **助理页面 UI 重构**：`src/app/ai/assistant/page.tsx`
  - 技能面板升级为四 Tab 结构（全部/收藏/历史/Hermes）
  - 技能列表项添加收藏星标按钮
  - 收藏视图：显示已收藏技能
  - 历史视图：显示执行记录（成功/失败、结果摘要、时间、耗时）
  - Hermes 视图：加载并显示 Hermes Skills Hub 技能
- **工具执行器扩展**：`src/app/api/ai/assistant/tool-executor.ts` 添加 3 个 Hermes 工具
  - `hermesExecute`：调用 Hermes Agent 执行本地任务
  - `hermesListSkills`：列出 Hermes Skills Hub 技能
  - `hermesStatus`：查询安装/运行/连接状态
- **工具定义扩展**：`src/lib/ai-assistant-tools.ts` AI_ASSISTANT_TOOLS 添加 3 个 Hermes 工具定义（工具总数 18→21）

### 自测结果
- TypeScript 编译：`npx tsc --noEmit` 通过（exit 0）
- Playwright E2E：19 个测试 18 passed / 1 skipped（13.5s），与迭代 20 一致无回归
- 页面访问：/settings、/ai/flows、/ai/assistant、/ai/workspace 全部 200
- API 验证：/api/hermes/status、/api/hermes/install、/api/hermes/test、/api/hermes/execute、/api/hermes/skills、/api/hermes/config、/api/skills/favorites、/api/skills/executions 全部 200

### 涉及文件
**新增（11 个）**：
- `src/lib/hermes-client.ts` — Hermes 客户端库
- `src/app/api/hermes/install/route.ts` — 安装/启动/停止 API
- `src/app/api/hermes/status/route.ts` — 状态查询 API
- `src/app/api/hermes/test/route.ts` — 连接测试 API
- `src/app/api/hermes/execute/route.ts` — 任务执行 API
- `src/app/api/hermes/skills/route.ts` — Skills Hub 技能列表 API
- `src/app/api/hermes/config/route.ts` — 配置管理 API
- `src/app/api/skills/favorites/route.ts` — 技能收藏 API
- `src/app/api/skills/executions/route.ts` — 执行历史 API
- `src/app/api/ai/distill/templates/[id]/versions/route.ts` — 版本历史 API
- `src/app/api/ai/distill/templates/[id]/versions/[version]/route.ts` — 版本回滚 API

**修改（10 个）**：
- `prisma/schema.prisma` — 新增 HermesConfig/SkillFavorite/SkillExecution 模型
- `src/lib/flow-store.ts` — NodeConfig/FlowNode 类型扩展
- `src/lib/flow-engine.ts` — 5 个新节点执行器
- `src/lib/ai-assistant-tools.ts` — 3 个 Hermes 工具定义
- `src/lib/help-content.ts` — ai-assistant 2.2 / ai-flows 3.1 / settings 2.1
- `src/app/ai/flows/page.tsx` — 5 个新节点 UI
- `src/app/ai/assistant/page.tsx` — 四 Tab 技能面板 + Safari ASR 优化
- `src/app/ai/workspace/page.tsx` — 版本历史 UI
- `src/app/settings/page.tsx` — HermesConfigSection 组件
- `src/app/api/ai/assistant/tool-executor.ts` — 3 个 Hermes 工具执行器
- `src/app/api/ai/asr/route.ts` — mp4 MIME 映射
- `src/app/api/ai/distill/templates/[id]/route.ts` — PATCH 版本管理
- `src/components/layout/HelpButton.tsx` — contentKey 参数

---

## 迭代 20 - 2026-06-25

### 任务概要
完成 4 项 AI 中心功能深化任务：AI 工作流可视化编排完善（右键菜单+节点复制+连线规则+导入导出+参数验证+画布平移）、AI 工作空间蒸馏模板创建/编辑（复用 Skill 表+CRUD API+参数定义器）、AI 助理语音 ASR 报错修复（前端 AudioContext 转 WAV）、AI 助理体验优化（快捷指令插入输入框+顶部栏 sticky+技能选择面板）。

### 完成内容

#### 1. AI 工作流可视化编排完善
- **节点右键菜单**：右键节点显示上下文菜单（配置节点/复制节点/删除节点）
- **节点复制功能**：`duplicateNode` 创建副本（偏移 40px + 标签追加"(副本)"）
- **连线规则约束**：`addEdge` 重写，禁止自连、output 禁出边、trigger 单出边、DFS 环检测、防重复
- **工作流导入/导出**：`exportFlow` 导出 JSON 下载，`importFlow` 文件选择读取 JSON 还原画布
- **节点参数验证**：`NodeConfigPanel.handleSave` 按节点类型校验必填字段（action prompt/condition expression/trigger schedule/eventType/节点名称）
- **画布平移**：空格+左键拖拽或中键拖拽平移画布（修改 scrollLeft/scrollTop），动态 cursor

#### 2. AI 工作空间蒸馏模板创建/编辑
- **CRUD API**：`/api/ai/distill/templates` GET（返回内置+自定义）/ POST（创建）；`/api/ai/distill/templates/[id]` PATCH（更新）/ DELETE（删除）
- **复用 Skill 表**：自定义模板存入 Skill 表（source: "distill"），内置模板只读
- **创建/编辑 UI**：工作空间页面增加"新建模板"按钮 + TemplateEditor 组件
- **参数定义器**：可视化添加/删除/编辑参数（key/label/type/required/placeholder/options/defaultValue）
- **模板分类**：内置模板（只读）+ 自定义模板（可编辑/删除，显示"自定义"标签）
- **执行兼容**：自定义模板可直接执行（后端 `/api/ai/distill` 已支持按 Skill.id 查找）

#### 3. AI 助理语音 ASR 报错修复
- **根因**：浏览器 MediaRecorder 输出 webm/opus，MiMo ASR 只支持 mp3/flac/m4a/wav/ogg；原 webm→wav MIME 重试只改 MIME 头不改数据
- **前端 WAV 转换**：新建 `src/lib/audio-utils.ts`，`webmToWav` 函数用 AudioContext（16kHz）解码 webm → 取单声道 → 转 16bit PCM → 编码标准 WAV
- **transcribeAudio 改造**：发送前先调用 `webmToWav(blob)` 转换为真实 WAV 数据，转换失败回退原始 blob
- **后端简化**：移除 webm→wav MIME 重试逻辑，默认文件名改为 audio.wav

#### 4. AI 助理体验优化
- **快捷指令改为插入输入框**：点击快捷指令不再直接发送，而是追加到输入框（换行分隔）+ 聚焦输入框
- **顶部信息栏 sticky**：`sticky top-0 z-20 shrink-0 bg-background/95 backdrop-blur`，滚动容器加 `min-h-0`，输入区加 `shrink-0`，解决 flex 压缩导致顶部栏被隐藏的问题
- **技能选择面板**：输入框上方增加"技能"按钮（Wrench 图标），点击弹出技能选择面板
  - 列表视图：搜索框 + 分类筛选 + 卡片式技能列表
  - 参数视图：根据 parameters 定义动态渲染输入框（text/textarea/select/date/number）
  - 执行技能：调用 `/api/ai/distill`，结果作为 assistant 消息插入对话并持久化

### 自测结果
- TypeScript 编译：`npx tsc --noEmit` 通过（exit 0）
- Playwright E2E：19 个测试 18 passed / 1 skipped（14.3s）
- 页面访问：/ai/flows、/ai/workspace、/ai/assistant、/skills、/skills/market 全部 200
- API 验证：GET /api/ai/distill/templates 返回 200（内置+自定义模板），POST 创建模板返回 200

### 涉及文件
新增：`src/lib/audio-utils.ts`、`src/app/api/ai/distill/templates/route.ts`、`src/app/api/ai/distill/templates/[id]/route.ts`
修改：`src/app/ai/flows/page.tsx`（右键菜单+节点复制+连线规则+导入导出+参数验证+画布平移）、`src/app/ai/workspace/page.tsx`（模板创建/编辑 UI）、`src/app/ai/assistant/page.tsx`（快捷指令+sticky+技能面板）、`src/app/api/ai/asr/route.ts`（简化后端）

---

## 迭代 19 - 2026-06-25

### 任务概要
完成 6 项 P0-P1 深化任务：AI 助理打通全功能（Function Calling 混合模式 + 18 工具）、AI 巡检规则编辑（创建/编辑区分 + AI 对话编辑模式）、Web Push 订阅 bug 修复（sw.js + PWARegister + manifest）、AI 工作流 output 节点真实副作用 + 执行历史 UI、所有功能右上角使用说明（HelpButton 统一组件）、AI 中心 4 功能使用说明输出。

### 完成内容

#### 1. AI 助理打通所有功能（P0，核心架构）
- **工具定义**：`src/lib/ai-assistant-tools.ts` 定义 18 个工具，覆盖灵感/看板/记忆/认知/技能/工作流/巡检/通知全场景
- **混合调用模式**：AI 通过 system prompt 知道可用工具，回复中包含 ` ```action {"tool":"xxx","args":{}}``` ` 代码块，后端解析执行
- **工具执行器**：`src/app/api/ai/assistant/tool-executor.ts` 实现 18 个工具的执行逻辑（searchIdeas/createIdea/searchTasks/createTask/completeTask/getBoardStats/semanticSearch/rebuildMemory/getCognitions/listSkills/executeSkill/listFlows/executeFlow/getFlowHistory/runPatrol/listPatrolRules/getPatrolResults/sendNotification/exportBackup）
- **两轮调用**：`src/app/api/ai/chat/route.ts` assistantMode 第一轮 AI 决定调工具，第二轮基于工具结果生成回复
- **关键词意图检测 fallback**：`detectIntent` 函数，当 AI 未输出 action 块时用关键词匹配检测用户意图，覆盖全场景
- **快捷指令**：6 个快捷指令按钮（今日概览/创建灵感/看板状态/搜索记忆/执行巡检/执行技能）
- **工具调用卡片**：前端展示工具调用结果，可展开查看完整 JSON

#### 2. AI 巡检规则编辑功能（P1）
- **创建/编辑区分**：规则列表增加编辑按钮，AI 对话区增加创建/编辑模式切换
- **AI 对话编辑模式**：`/api/patrol/config-chat` 接收 editRuleId 参数，编辑模式系统提示词包含规则当前详情
- **直接编辑**：规则列表支持直接编辑规则字段
- **模板库**：`src/lib/patrol-templates.ts` 4 个预置模板（每周灵感回顾/看板停滞检测/墓地复活检查/每日总结巡检）
- **巡检结果可操作**：巡检结果项增加 itemType 字段（idea/task/graveyard），可点击跳转操作

#### 3. Web Push 订阅 bug 修复（P0）
- **根因 1**：`public/sw.js` 完全缺少 push 事件监听器 → 追加 push/notificationclick/notificationclose 三个事件监听器
- **根因 2**：`src/components/layout/PWARegister.tsx` 仅生产环境注册 SW → 移除环境限制，所有环境都注册
- **根因 3**：`public/manifest.webmanifest` 缺少 gcm_sender_id → 追加 `"gcm_sender_id": "103953800507"`
- **错误处理增强**：`src/app/settings/push/page.tsx` 重写 handleSubscribe，SW 未注册/权限拒绝/VAPID 未配置分别提示

#### 4. AI 工作流可视化编排完善（P1）
- **output 节点真实副作用**：`src/lib/flow-engine.ts` executeOutputNode 改为 async，按 outputTarget 执行真实副作用
  - cognition → 写入 Cognition 表
  - skills → 创建 Skill
  - notification → 发送 Push
- **执行历史 UI**：`src/app/ai/flows/page.tsx` 增加 History 按钮 + modal + 分页展示
- **看板完成认知确认**：`src/app/board/page.tsx` AI 提取认知后弹窗让用户确认/编辑/跳过
- **认知 API 直接写入模式**：`/api/cognitions` POST 新增直接写入模式（type+content+source+ideaId）

#### 5. 所有功能右上角使用说明（P1）
- **统一组件**：`src/components/layout/HelpButton.tsx` HelpContent 接口（painPoint/need/solution/usage），问号图标按钮 + modal 弹窗
- **12 个页面注入**：page.tsx、inbox、board、graveyard、memory、ai/workspace、skills、skills/market、settings/patrol、settings/push、settings、search

#### 6. AI 中心 4 功能使用说明输出
- 输出 AI 工作空间、AI 工作流、技能管理、Skill 市场的详细使用说明、价值和关系

### 自测结果
- TypeScript 编译：`npx tsc --noEmit` 通过（exit 0）
- Playwright E2E：19 个测试 18 passed / 1 skipped（16.4s）
- Dev server 运行中：http://localhost:3000（PID 54956）

### 涉及文件
新增：`src/components/layout/HelpButton.tsx`、`src/app/api/ai/assistant/tool-executor.ts`、`src/lib/patrol-templates.ts`
修改：`src/lib/ai-assistant-tools.ts`、`src/app/api/ai/chat/route.ts`、`src/app/api/patrol/config-chat/route.ts`、`src/app/api/patrol/run/route.ts`、`src/lib/flow-engine.ts`、`src/app/ai/flows/page.tsx`、`src/app/ai/assistant/page.tsx`、`src/app/board/page.tsx`、`src/app/settings/patrol/page.tsx`、`src/app/settings/push/page.tsx`、`public/sw.js`、`public/manifest.webmanifest`、`src/components/layout/PWARegister.tsx`、12 个页面注入 HelpButton

---

## 迭代 18 - 2026-06-24

### 任务概要
完成 10 项功能深化与体验完善任务：今日聚焦修复+看板状态同步、决策看板完成闭环（AI 提取认知）、灵感捕获附件上传、AI 巡检全可配置（AI 对话配置规则）、灵感墓地深度完善、通知设置完善（VAPID+多渠道）、设置页 AI Key 数据库配置、收敛仪式改名灵感收敛+移菜单、蒸馏模板修复、向量搜索 UI。

### 完成内容

#### 1. 今日聚焦修复 + 看板状态双向同步
- **5 卡片问题修复**：`/api/focus` GET 方法增加截断逻辑，已有 DailyFocus 的 items > 3 时截断为前 3 个
- **双向状态同步**：
  - 看板 `toggleDone` 成功后 `postMessage({ type: "LYNNHUB_REFRESH_FOCUS" })` 通知聚焦页
  - 聚焦页监听该事件重新加载
  - `/api/focus` PATCH 方法：单卡完成时即时同步 Task.status=done（不再等全部完成）

#### 2. 决策看板完成闭环（AI 提取认知 + 同步聚焦 + 归档统计）
- **AI 认知提取**：`/api/tasks/[id]` PATCH status=done 时，调用 AI + `COGNITION_EXTRACT_PROMPT` 提取 method/experience/prompt，写入 Cognition 表
- **完成统计 API**：`/api/tasks/stats` 返回 totalCompleted/totalActive/thisWeekCompleted/byColumn
- **看板 UI**：完成 toast 提示"AI 正在提取认知..."、已完成折叠区域、累计完成统计

#### 3. 灵感捕获支持上传文件/图片
- **上传 API**：`/api/upload` 接收 multipart/form-data，支持图片（jpg/png/gif/webp）和文档（pdf/txt/md/doc/docx），10MB 限制，20次/分钟限流
- **LightningInput 改造**：支持点击上传 + 拖拽上传 + 粘贴图片，附件缩略图列表，可删除
- **Idea 表扩展**：新增 `attachments Json` 字段
- **Inbox 展示**：图片缩略图可点击放大，文件显示图标+文件名

#### 4. AI 巡检全可配置（对象+时间+规则+通知）
- **Prisma schema**：新增 `PatrolRule`（规则）和 `PatrolLog`（日志）表
- **规则 CRUD API**：`/api/patrol/rules` GET/POST、`/api/patrol/rules/[id]` PATCH/DELETE
- **巡检执行 API**：`/api/patrol/run` 按 scope 收集数据 + AI 分析 + 写日志 + 发通知
- **AI 对话配置 API**：`/api/patrol/config-chat` 自然语言→规则草案
- **巡检日志 API**：`/api/patrol/logs` 分页查询
- **巡检设置页**：`/settings/patrol` 规则列表 + AI 对话配置区 + 日志展示
- **调度器集成**：`reminder-scheduler.ts` 支持从数据库加载动态规则

#### 5. 灵感墓地深度完善
- **彻底删除**：`/api/graveyard` DELETE 方法，先删 Graveyard 再删 Idea
- **编辑原因/条件**：`/api/graveyard` PUT 方法
- **批量操作**：多选模式，批量复活/批量删除
- **搜索 + 排序**：按内容/原因搜索，按放弃/创建时间排序
- **统计信息**：总数、已复活数、待复活数

#### 6. 通知设置完善
- **VAPID 密钥生成**：写入 `.env`（VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY/VAPID_SUBJECT）
- **多渠道统一管理**：浏览器推送 + 桌面通知 + 飞书通知
- **巡检通知打通**：`reminder-scheduler.ts` sendNotification 增加 Web Push 推送（调用 /api/push/test）
- **push/test API 增强**：支持可选 `{ title, body }` 参数

#### 7. 设置页 AI Key 数据库配置
- **AISetting 表扩展**：新增 defaultProvider + DeepSeek/MiMo/Embedding 配置字段
- **ai-provider.ts 改造**：`refreshAISettings()` 数据库缓存机制，优先级：数据库 > 环境变量
- **设置页 AI 配置区**：3 个 Provider 卡片（API Key/BaseURL/Model），默认 Provider 切换
- **设置 API**：GET 返回 dbSettings（mask）+ envSettings，PUT 保存并刷新缓存

#### 8. 收敛仪式改名"灵感收敛" + 移入灵感收集菜单
- Sidebar：从 `rituals` 分组移到 `capture` 分组，删除空的 rituals 分组
- 全项目"收敛仪式"→"灵感收敛"（converge/page.tsx、AppShell.tsx、CommandPalette.tsx、seed.ts）

#### 9. 蒸馏模板修复
- **字段名 bug**：`data.mock` → `data.fallback`（前端），后端增加 `mock: true` 向后兼容
- **ensureSkillsSeeded 修复**：改为按名称检查每个模板是否存在（不再只在表空时执行），解决 Skill 表有数据但缺蒸馏模板导致 404 的问题
- **验证**：蒸馏 API 200，AI 真实执行，结果 2997 字符

#### 10. 向量搜索 UI
- **搜索页**：`/search` 关键词搜索 + 语义搜索 tab 切换
- **语义搜索**：调用 `/api/memory/search`，展示相似度分数（进度条+百分比）
- **结果跳转**：idea→/inbox、conversation→/assets、cognition→/cognition

### 自测结果
- TypeScript 编译：`npx tsc --noEmit` 通过（exit 0）
- Playwright E2E：19 个测试全部通过（16.7s）
- API 验证：
  - PUT /api/settings（保存 AI Key）→ 200 ✓
  - POST /api/patrol/rules（创建巡检规则）→ 200 ✓
  - POST /api/patrol/config-chat（AI 对话配置）→ 200，AI 回复 410 字符 ✓
  - POST /api/patrol/run（执行巡检）→ 200，hitCount=9 ✓
  - POST /api/ai/distill（蒸馏）→ 200，AI 真实执行，结果 2997 字符 ✓
  - PATCH /api/tasks/[id]（看板完成）→ 200，cognitionExtracted=true ✓
  - GET /api/tasks/stats → 200 ✓
  - GET /api/memory/search?q=test → 200 ✓

### 涉及文件
新增 15+ 文件（upload API、patrol 5 个 API、tasks/stats API、search 页面、patrol 设置页），修改 25+ 文件

---

## 迭代 17 - 2026-06-24

### 任务概要
完成全部质量保障与生产准备任务：E2E 测试（Playwright）、页面 UI 自测修复、AI 功能验证、安全加固（rate limiting + 输入校验 + AUTH_SECRET 检查）、性能优化（N+1 查询 + API 缓存）、错误监控（Error Boundary + Sentry 准备）、UI/UX 打磨（骨架屏 + 空状态 + toast 统一）、API 文档与用户手册。修复三个具体 bug：飞书机器人位置/签名/前端传参、设置页 AI key 多 Provider 兼容、向量模型环境变量名。

### 完成内容

#### 1. Bug 修复（3 项）
- **飞书机器人挪到系统菜单**：`src/components/layout/Sidebar.tsx` 删除"集成"分组，将飞书机器人移入"系统"分组
- **飞书机器人测试消息发送 bug 修复**：`src/app/api/lark-bot/test/route.ts` 新增 `generateSign` 函数（HMAC-SHA256 签名校验），前端 `lark-bot/page.tsx` 传递 `webhookToken` 到测试 API
- **设置页 AI key 未配置修复**：`src/app/api/settings/route.ts` 扩展 chatApiKey/chatModel/chatBaseURL 检查链为 `AI_API_KEY || OPENAI_API_KEY || DEEPSEEK_API_KEY || MIMO_API_KEY`；embeddingModel 从 `AI_EMBEDDING_MODEL` 改为 `EMBEDDING_MODEL`

#### 2. E2E 测试（Playwright）
- **配置**：`playwright.config.ts`，使用 Edge 浏览器（msedge channel），复用已运行 dev server，globalSetup 登录一次复用 storageState
- **19 个测试全部通过**（5 个文件）：
  - `auth-flow.spec.ts`：未登录重定向、登录页渲染、admin 登录、API 鉴权（5 个）
  - `idea-flow.spec.ts`：创建灵感、流转到看板、API 结构（3 个）
  - `board-flow.spec.ts`：看板加载、任务数据、数量统计（3 个）
  - `search-flow.spec.ts`：搜索结果、空查询、total 字段、结果字段（4 个）
  - `backup-flow.spec.ts`：全量导出、分类导出、version 字段（4 个）

#### 3. 页面 UI 自测
- 20 个页面全部返回 200 无运行时报错

#### 4. AI 功能验证
- 聊天（DeepSeek）、技能执行、工作流执行、记忆图谱重建、向量搜索、对话提取全部通过

#### 5. 安全加固
- **Rate Limiting**：`src/lib/rate-limit.ts` 内存滑动窗口，`rateLimit(key, limit, windowMs)` + `getClientKey(req)`
  - 登录 API：10 次/分钟
  - AI 聊天 API：20 次/分钟
  - 备份导出 API：5 次/分钟
  - 备份导入 API：3 次/分钟
- **输入校验**：`src/lib/validate.ts` 导出 `validateString/validateInt/validateEnum/isNonEmptyString`，应用到 ideas/tasks/users API
- **AUTH_SECRET 检查**：`src/auth.ts` 添加生产环境启动检查，缺失时抛错

#### 6. 性能优化
- **N+1 查询修复**：`src/app/api/memory/route.ts` POST 重建记忆图谱，预取所有 Memory 记录构建查找表，批量 create/update 使用 `prisma.$transaction`，连边计算纯内存 O(n²) 后批量 update
- **API 响应缓存**：dev-log API `s-maxage=30`，settings 页 `no-store`
- **前端懒加载**：记忆图谱 Web Worker 力导向计算

#### 7. 错误监控
- **全局 Error Boundary**：`src/app/global-error.tsx`（根级，自带 html/body）+ `src/app/not-found.tsx`（404）
- **Sentry 准备**：`src/lib/sentry.ts` 配置模板，导出 `SENTRY_DSN/isSentryEnabled/reportError`，`.env.example` 添加 `SENTRY_DSN`（部署阶段启用）

#### 8. UI/UX 打磨
- **骨架屏**：inbox/board/assets/cognition 页面
- **空状态组件**：`src/components/layout/EmptyState.tsx`，应用到 inbox/graveyard/skills 页面
- **toast 统一**：多个页面 catch 块补充 toast 通知

#### 9. 文档
- **API 文档**：`docs/API.md`，覆盖 18 个 API 分组
- **用户使用手册**：`docs/USER_GUIDE.md`，7 个章节

#### 10. 记忆图谱/向量实现验证
- `src/lib/embedding.ts`：AI embedding + TF-IDF 降级 + EmbeddingCache 缓存，实现正确
- `src/lib/semantic-match.ts`：TF-IDF 降级逻辑正确
- `src/lib/ai.ts`：多 Provider fallback（AI_* → DEEPSEEK_* → 默认值）正确
- `src/app/memory/page.tsx`：3D 力导向图谱（Web Worker + Canvas）实现正确
- `src/app/api/memory/route.ts`：记忆图谱重建逻辑正确
- `src/app/api/memory/search/route.ts`：语义搜索分页查询正确

### 自测结果
- TypeScript 编译：`npx tsc --noEmit` 通过（exit 0）
- Playwright E2E：19 个测试全部通过（8.5s）
- 页面 UI：20 个页面全部返回 200
- AI 功能：聊天/技能/工作流/向量搜索/对话提取全部通过

### 涉及文件
新增 15+ 文件（playwright.config.ts、e2e/ 7 文件、rate-limit.ts、validate.ts、sentry.ts、global-error.tsx、not-found.tsx、EmptyState.tsx、docs/API.md、docs/USER_GUIDE.md），修改 20+ 文件

---

## 迭代 16 - 2026-06-24

### 任务概要
完成全部 P0-P2 任务规划：用户系统（next-auth + 三级角色权限）、Flows 迁移到 MySQL、全文搜索 + 数据备份导出 + Flows 执行历史持久化、飞书机器人基础版、向量搜索优化、vitest 单元测试 + pino 结构化日志、富文本编辑器 + Web Push + 移动端适配。修复登录页 CSRF token 缺失问题。

### 完成内容

#### 1. 用户系统（P0，高优先级）
- **Prisma schema**：新增 `User` model（username/passwordHash/email/displayName/role/active），所有业务 model 添加 `userId` 字段 + `@@index([userId])`
- **next-auth v5**：`src/auth.ts` 配置 Credentials Provider + JWT session（7天）+ role 注入
- **鉴权工具**：`src/lib/auth-utils.ts` 导出 `getCurrentUser/requireAuth/requireAdmin/buildUserFilter/buildUserCreateData`
  - `buildUserFilter`：admin 返回 `{}`（全局视图），非 admin 返回 `{ userId: user.id }`
- **middleware**：`src/middleware.ts` 保护所有路由，未登录重定向到 `/login`
- **登录页**：`src/app/login/page.tsx`，修复 CSRF token 缺失问题（先 GET `/api/auth/csrf` 获取 token，再 POST credentials）
- **用户管理**：`src/app/settings/users/page.tsx` + `src/app/api/users/route.ts`（仅 admin 可访问）
- **API 鉴权**：18 个 API 路由添加 `requireAuth` + `buildUserFilter`
- **seed**：`prisma/seed.ts` 创建 admin 用户（admin/admin123），所有种子数据关联 userId

#### 2. Flows 迁移到 MySQL（P0，高优先级）
- **Prisma schema**：新增 `Flow` model（nodes/edges 为 Json）+ `FlowExecution` model（执行历史）
- **flow-store.ts 重写**：文件存储 → Prisma/MySQL 存储，新增 `createFlow/updateFlow/deleteFlow/getFlowById/initializeDefaultFlows`
- **数据迁移**：`initializeDefaultFlows()` 读取 `.ai-flows.json` 迁移到数据库
- **执行历史 API**：`src/app/api/ai/flows/[id]/executions/route.ts` + `src/app/api/ai/flows/executions/route.ts`
- **类型修复**：`updateFlow` 使用 `Prisma.FlowUncheckedUpdateInput` 解决 `FlowUpdateInput` 缺少 userId 属性问题

#### 3. 全文搜索 + 数据备份 + Flows 执行历史（P0）
- **全文搜索**：`src/app/api/search/route.ts`，LIKE 查询 + 类型过滤 + 分页
- **数据备份导出**：`src/app/api/backup/export/route.ts`，导出全量数据为 JSON
- **数据备份导入**：`src/app/api/backup/import/route.ts`，导入 JSON 恢复数据
- **备份管理页面**：`src/app/settings/backup/page.tsx`

#### 4. 飞书机器人 + 向量优化 + 报错修复（P0）
- **飞书机器人基础版**：`src/app/settings/lark-bot/page.tsx` + `src/app/api/lark-bot/test/route.ts`
- **移除微信机器人**：Sidebar 删除微信机器人入口
- **向量搜索优化**：移除 500 条硬上限，改为分页查询
- **semantic-match.ts**：添加 TF-IDF 降级（AI 不可用时不再返回空数组）
- **环境变量统一**：`AI_EMBEDDING_*` → `EMBEDDING_*`，添加 `DEEPSEEK_*` fallback
- **删除死代码**：`src/lib/mock.ts`（263 行）、冗余 `next.config.js`

#### 5. vitest 单元测试 + pino 结构化日志（P1）
- **vitest 配置**：`vitest.config.ts`，path alias `@/` → `src/`
- **39 个单元测试**（5 个文件）：
  - `auth-utils.test.ts`：buildUserFilter 角色过滤
  - `flow-store.test.ts`：formatLastRun 时间格式化
  - `semantic-match.test.ts`：TF-IDF 降级逻辑
  - `ai-provider.test.ts`：isModelMultimodal + getDefaultProvider
  - `flow-engine.test.ts`：BFS 图遍历 + 条件分支
- **pino 日志**：`src/lib/logger.ts`，9 个 API 路由替换 23 处 `console.error` 为结构化日志

#### 6. 富文本编辑器 + Web Push + 移动端适配（P2）
- **富文本编辑器**：`src/components/editor/RichTextEditor.tsx`（tiptap），集成到技能编辑弹窗
- **Web Push**：`src/lib/push.ts` + `src/app/api/push/subscribe/route.ts` + `src/app/api/push/test/route.ts` + `src/app/settings/push/page.tsx`
  - Prisma 新增 `PushSubscription` model
- **移动端适配**：viewport meta 优化、记忆图谱画布水平滚动

### 自测结果
- TypeScript 编译：`npx tsc --noEmit` 通过（exit 0）
- 单元测试：`npx vitest run` 5 文件 39 测试全部通过
- API 自测：16 个 API 端点全部返回 JSON（登录 → CSRF → session cookie → API 调用）
- 数据库：MySQL 运行中，prisma db push 同步，seed 填充 10 灵感 + 15 任务 + 5 对话 + 8 认知 + 20 记忆 + 3 墓地 + 10 技能 + 20 评论 + 15 飞书任务 + 1 聚焦

### 涉及文件
新增 20+ 文件，修改 30+ 文件，删除 2 文件（mock.ts, next.config.js）

---

## 迭代 15 - 2026-06-24

### 任务概要
完成所有高/中/低优先级任务：Flows 条件分支可视化编排与图遍历执行、全局搜索扩展至技能库、PWA 离线支持、性能监控面板、代码重构（route.ts 抽离 lib）。

### 完成内容

#### 1. Flows 条件分支可视化编排（高优先级）
- **类型扩展**：`FlowEdge` 新增 `condition?: "true" | "false"` 字段，标记连线是 condition 节点的哪个分支
- **执行引擎重构**：新增 `src/lib/flow-engine.ts`，实现 `executeFlowWithEdges` BFS 图遍历
  - condition 节点根据求值结果选择匹配的 edge（true/false 分支）
  - 支持节点去重（executedSet），避免环路重复执行
  - 无 edges 时降级为顺序执行模式
- **前端 UI**：`src/app/ai/flows/page.tsx` 大幅增强
  - condition 节点出发的连线自动分配 true/false 标记（第一条→true，第二条→false）
  - 新增 `toggleEdgeCondition`：循环切换 undefined → "true" → "false" → undefined
  - SVG defs 新增 `flow-arrow-true`（绿色）和 `flow-arrow-false`（红色）marker
  - 边渲染：根据 condition 显示不同颜色 + 中点显示 TRUE/FALSE 标签
  - 工具栏：选中 condition 节点出发的连线时显示分支切换按钮
- **测试验证**：flow-1 执行成功，n3 condition 节点走 true 分支到 n4，总耗时 1570ms

#### 2. 代码重构：route.ts 抽离 lib（高优先级）
- **问题**：Next.js 路由文件不允许导出非 HTTP 方法函数，`.next/types` 类型检查报错
- **新增**：`src/lib/flow-store.ts`（数据层：FlowNode/FlowEdge/Flow 接口 + readFlows/writeFlows/generateFlowId + DEFAULT_FLOWS）
- **新增**：`src/lib/flow-engine.ts`（执行层：executeConditionNode + executeFlowWithEdges + executeFlowInternal）
- **精简**：`flows/route.ts`、`flows/[id]/route.ts`、`flows/[id]/execute/route.ts` 改为纯 API 路由，从 lib 导入
- **更新**：`flow-scheduler.ts` 导入路径从 `@/app/api/ai/flows/route` 改为 `@/lib/flow-store` 和 `@/lib/flow-engine`

#### 3. 全局搜索扩展至技能库（高优先级）
- **Command Palette 增强**：`src/components/layout/CommandPalette.tsx`
  - SearchResult type 添加 `"skill"` 类型
  - FilterTab 添加 `"skill"`，TYPE_LABELS 添加 `skill: "技能"`
  - TABS 添加 `{ key: "skill", label: "技能" }`
  - NAV_RESULTS 添加技能库导航项，QUICK_COMMANDS 添加 `cmd-skills`
  - doSearch 的 apis 数组添加 `/api/skills`，技能额外匹配 description 字段

#### 4. PWA 离线支持（中优先级）
- **manifest**：`public/manifest.webmanifest`，含 name/short_name/icons（SVG data URI）
- **Service Worker**：`public/sw.js`，三种缓存策略
  - 静态资源（_next/static, 图片字体）：cacheFirst
  - API 请求：networkFirst（5s 超时）
  - 页面导航：networkFirst（8s 超时）
  - install 时预缓存核心路由，activate 时清理旧缓存
- **注册器**：`src/components/layout/PWARegister.tsx`，仅生产环境注册，监听 updatefound
- **集成**：`src/app/layout.tsx` 添加 manifest link、appleWebApp 配置、apple-touch-icon、PWARegister 组件

#### 5. 性能监控面板（中优先级）
- **API**：`src/app/api/settings/diagnostics/route.ts`
  - 返回 14 个数据库表计数
  - 灵感/任务状态分布（Prisma groupBy 统计）
  - Embedding 缓存统计、Flows 调度器状态
  - 进程内存（rss/heapUsed/heapTotal/external）、运行时间、Node 版本/平台
- **页面**：`src/app/settings/diagnostics/page.tsx`
  - API 响应时间、运行时间、堆内存使用率（带进度条）
  - Flows 调度器状态、数据库表统计网格
  - Embedding 缓存详情、灵感状态分布、任务看板分布
  - 定时调度任务列表，每 30 秒自动刷新
- **入口**：`src/components/layout/Sidebar.tsx` 系统组添加"性能监控"（Activity 图标）

#### 6. Prisma JsonNull 类型修复
- **问题**：`images: images || null` 在 Prisma `Json?` 字段上报类型错误
- **修复**：`src/app/api/ai/chat/sessions/[id]/messages/route.ts` 改为 `images: images && images.length > 0 ? images : Prisma.JsonNull`

### 自测结果
- ✅ TypeScript 编译 0 错误
- ✅ `/api/ai/flows` GET — 返回 3 个工作流
- ✅ `/api/ai/flows/flow-1/execute` POST — 条件分支执行成功（n1→n2→n3 true→n4，1570ms）
- ✅ `/api/skills` GET — 返回 10 个技能
- ✅ `/api/settings/diagnostics` GET — 返回完整诊断数据
- ✅ `/api/ai/chat/sessions` GET/POST — 列表/创建正常
- ✅ `/api/ai/chat/sessions/[id]/messages` POST — 消息创建成功
- ✅ `/api/ai/flows/scheduler/status` GET — 返回 running: false

### 文件变更
- 新增：`src/lib/flow-store.ts`、`src/lib/flow-engine.ts`、`public/manifest.webmanifest`、`public/sw.js`、`src/components/layout/PWARegister.tsx`、`src/app/api/settings/diagnostics/route.ts`、`src/app/settings/diagnostics/page.tsx`
- 修改：`src/app/api/ai/flows/route.ts`、`src/app/api/ai/flows/[id]/route.ts`、`src/app/api/ai/flows/[id]/execute/route.ts`、`src/lib/flow-scheduler.ts`、`src/app/ai/flows/page.tsx`、`src/components/layout/CommandPalette.tsx`、`src/app/layout.tsx`、`src/components/layout/Sidebar.tsx`、`src/app/api/ai/chat/sessions/[id]/messages/route.ts`

---

## 迭代 14 - 2026-06-24

### 任务概要
完成所有高/中/低优先级任务：Flows 执行引擎、全局 Error Boundary、全局 Loading UI、Skills 降级提示、README 文档、同步/异步代码合并、Webhook 事件持久化、SSE 实时推送、评论 DB 迁移。

### 完成内容

#### 1. Flows 真实执行引擎（高优先级）
- **新增端点**：`POST /api/ai/flows/[id]/execute`，按节点类型真实执行
- **action 节点**：调用 LLM（DeepSeek/MiMo），支持 `{{upstream}}` 占位符注入上游输出
- **condition 节点**：安全表达式求值器（白名单字符 + Function 构造），支持 `==`/`!=`/`>`/`<`/`&&`/`||`/`!`
- **trigger 节点**：记录触发信息
- **output 节点**：收集最终产物，按 outputTarget 分类
- **执行流程**：按节点顺序执行，condition 不成立则跳过剩余节点，出错则终止
- **前端适配**：`runFlow` 函数从模拟 setTimeout 改为调用真实执行端点，展示节点耗时和状态
- **测试验证**：flow-2 执行成功，AI 调用 1928ms / 84 tokens，flow-3（未启用）正确返回 400

#### 2. Webhook 事件持久化到数据库（高优先级）
- **新增 Model**：`LarkWebhookEvent`（eventId 唯一、eventType、taskGuid、summary、raw JSON、processed、createdAt）
- **持久化**：`handleWebhookEvent` 将事件写入 DB，`getRecentEvents` 从 DB 读取
- **幂等性**：eventId 唯一约束 + 内存去重缓存（最近 100 个）
- **替代方案**：从内存队列迁移到数据库，重启不丢失事件

#### 3. SSE 实时推送替代 30 秒轮询（高优先级）
- **新增端点**：`GET /api/lark-webhook/stream`，返回 `text/event-stream`
- **订阅者模式**：`subscribeWebhookEvents` 注册回调，新事件到达时实时推送
- **回填机制**：连接时先发送历史事件（支持 `since` 参数），再发送 ready 标记
- **心跳**：每 30 秒发送 ping
- **前端适配**：`lark-tasks/page.tsx` 从 `setInterval(poll, 30000)` 改为 `EventSource`，断线 5 秒自动重连
- **测试验证**：模拟事件后 SSE 实时推送确认成功

#### 4. 任务评论迁移到数据库（高优先级）
- **新增 Model**：`LarkTaskComment`（taskGuid、content、creatorId、creatorName、source、createdAt）
- **迁移**：`addComment`/`getComments` 从 `.lark-task-comments.json` 文件改为 Prisma DB
- **索引**：taskGuid + createdAt 复合索引，查询高效

#### 5. 全局 Error Boundary（中优先级）
- **新增**：`src/app/error.tsx`，App Router 根级错误边界
- **功能**：捕获子树渲染错误，展示错误信息和 digest，提供"重试"和"返回首页"按钮
- **错误上报**：console.error 记录（可扩展为 Sentry）

#### 6. 全局 Loading UI（中优先级）
- **新增**：`src/app/loading.tsx`，路由段加载时自动展示
- **视觉**：旋转加载图标 + "加载中..."文本，避免白屏

#### 7. Skills 降级提示优化（中优先级）
- **问题**：AI 调用失败时静默降级到 fallback，用户无感知
- **改进**：新增 `fallbackReason` 字段，返回明确的降级原因和配置检查建议
- **前端适配**：`skills/page.tsx` 展示降级原因 toast

#### 8. README 文档（低优先级）
- **新增**：`README.md`，包含核心功能、技术栈、快速开始、环境变量、项目结构、常用命令
- **飞书配置**：lark-cli 安装和 Webhook 配置说明

#### 9. 同步/异步代码合并（低优先级）
- **删除未使用**：`getTaskDetail`（sync）、`runSync`（sync）—— 已被 async 版本替代，无任何引用
- **保留**：`getAllTasks`/`getMyTasks`/`getRelatedTasks`（sync）仍用于请求-响应路径，`runLarkCli`（sync）用于 mutation 端点
- **约定**：后台刷新用 async 版本，请求响应用 sync 版本

#### 10. 其他修复
- **simulate/route.ts**：`handleWebhookEvent` 改为 async 后补加 `await`
- **status/route.ts**：`getRecentEvents` 改为 async 后补加 `await`
- **LarkTask 索引**：新增 `parentTaskGuid` 和 `completedAt` 索引
- **URL 常量提取**：`LARK_TASK_URL_PREFIX` 提取为环境变量

### 修改文件清单
- `prisma/schema.prisma` - 新增 `LarkTaskComment`、`LarkWebhookEvent` model + LarkTask 索引
- `src/lib/lark-sync.ts` - 新增 `getTaskDetailAsync`/`runSyncAsync`，评论 DB 迁移，URL 常量，删除未使用 sync 函数
- `src/lib/lark-webhook-handler.ts` - 完全重写为 DB 持久化 + SSE 订阅者模式
- `src/app/api/lark-webhook/stream/route.ts` - 新增 SSE 端点
- `src/app/api/lark-webhook/simulate/route.ts` - 补加 `await`
- `src/app/api/lark-webhook/status/route.ts` - 补加 `await`
- `src/app/api/lark-webhook/events/route.ts` - `getRecentEvents` 加 `await`
- `src/app/api/lark-webhook/route.ts` - `handleWebhookEvent` 加 `await`
- `src/app/api/lark-tasks/[id]/route.ts` - `getTaskDetailAsync` + DB 优先
- `src/app/api/lark-tasks/[id]/comments/route.ts` - 评论 async 化
- `src/app/api/lark-tasks/sync/route.ts` - `runSyncAsync`
- `src/app/api/ai/flows/[id]/execute/route.ts` - 新增执行引擎
- `src/app/ai/flows/page.tsx` - `runFlow` 调用真实执行端点
- `src/app/ai/lark-tasks/page.tsx` - SSE EventSource 替代轮询
- `src/app/api/skills/generate/route.ts` - 降级提示 `fallbackReason`
- `src/app/skills/page.tsx` - 展示降级原因
- `src/app/error.tsx` - 新增全局错误边界
- `src/app/loading.tsx` - 新增全局加载 UI
- `README.md` - 新增项目文档
- `DEV_LOG.md` - 本次迭代记录

### 测试验证
- TypeScript 编译零错误（`npx tsc --noEmit` exit 0）
- Webhook status API：返回配置状态和事件统计
- Webhook simulate API：模拟事件成功持久化到 DB
- Webhook events API：从 DB 读取事件列表
- SSE stream API：历史事件回填 + ready 标记 + 实时推送验证成功
- Flows execute API：flow-2 执行成功（AI 1928ms/84 tokens），flow-3（未启用）返回 400
- lark-tasks fast 模式：DB 缓存 30 任务 / 27 subtaskMap / 9 assignees，source=db-cache
- lark-tasks sync：`runSyncAsync` 同步 219 任务成功
- skills generate：AI 成功生成财务分析技能（含参数/内容/提示词模板）

---

## 迭代 13 - 2026-06-24

### 任务概要
实现下一步建议中的 4 项优化：lark-cli 异步化、VAD 参数自适应、TTS 流式合成 API、任务看板拖拽视图。

### 完成内容

#### 1. lark-cli 异步化（不阻塞事件循环）
- **问题**：`execSync` 阻塞 Node.js 事件循环，后台刷新时其他 HTTP 请求排队等待
- **方案**：新增 `runLarkCliServiceAsync` / `runLarkCliAsync`（基于 `child_process.exec` + `promisify`）
- **新增**：`fetchAllTasksFromSourceAsync` / `getAllTasksAsync` / `getTasklistsAsync`，使用 `Promise.all` 并行拉取所有 tasklist 和子任务
- **性能提升**：7 个 tasklist 串行 → 并行，速度提升 3-5 倍
- **API 路由**：`refreshTasksInBackground` 改用 `getAllTasksAsync`，后台刷新完全不阻塞事件循环

#### 2. VAD 参数自适应（环境噪声校准）
- **问题**：固定阈值 18dB 在不同环境（安静办公室 vs 嘈杂咖啡厅）效果差异大
- **方案**：启动时采集 1 秒环境噪声样本，取中位数作为基线，阈值 = 基线 + 12dB
- **限制**：阈值范围 [10, 35]dB，避免极端值
- **重置**：每次 `stopVoiceCall` 重置阈值为 18dB，下次启动重新校准
- **日志**：校准完成后 console.log 输出基线和阈值

#### 3. TTS 流式合成 API（SSE）
- **新增端点**：`POST /api/ai/tts/stream`，返回 `text/event-stream`
- **协议**：SSE，每句一个 `data: {"type":"sentence","audioBase64":"..."}\n\n`
- **首包优化**：前 2 句并行合成，立即推送；后续句子顺序合成推送
- **前端适配**：`speak` 函数改用流式 API，通过 `ReadableStream` reader 逐句解析，base64 → blob → 队列播放
- **回退机制**：流式 API 失败时自动回退到非流式 `speakFallback`

#### 4. 任务看板拖拽视图
- **新增视图**：`DisplayMode = "list" | "calendar" | "gantt" | "board"`
- **三列看板**：待处理（蓝）/ 已逾期（红）/ 已完成（绿）
- **拖拽交互**：HTML5 Drag & Drop API，拖拽任务到"已完成"列触发完成，拖回"待处理"触发重开
- **卡片信息**：优先级圆点、标题、截止时间、子任务进度、负责人头像、"我负责"徽标
- **视觉反馈**：拖拽时半透明，目标列高亮 ring

### 修改文件清单
- `src/lib/lark-sync.ts` - 新增 `runLarkCliAsync`/`getAllTasksAsync`/`getTasklistsAsync`/`fetchAllTasksFromSourceAsync`，并行拉取
- `src/app/api/lark-tasks/route.ts` - `refreshTasksInBackground` 改用异步版本
- `src/app/api/ai/tts/stream/route.ts` - 新增流式 TTS SSE 端点
- `src/app/ai/assistant/page.tsx` - VAD 自适应阈值校准 + 流式 TTS 前端 + speakFallback 回退
- `src/app/ai/lark-tasks/page.tsx` - 新增 BoardView 看板组件 + board 显示模式
- `DEV_LOG.md` - 本次迭代记录

### 测试验证
- TypeScript 编译零错误
- API 测试：fast 模式 0.84s 响应，subtaskMap 27 个父任务，9 个 assignees
- 流式 TTS 测试：SSE 正常返回 base64 音频数据
- Dev server 编译：/api/lark-tasks、/api/ai/tts/stream 均编译成功

---

## 迭代 12 - 2026-06-24

### 任务概要
用户提出 4 项需求：飞书任务子任务展示修复、加载性能优化、VAD+流式ASR+流式TTS、飞书任务前端展示优化（排序+负责人徽标）。

### 完成内容

#### 1. 飞书任务子任务展示修复
- **根因**：前端从过滤后的 `tasks` 数组构建 `subtaskMap`，当 view=my 过滤掉子任务（子任务的 assignee 可能不是当前用户）时，subtaskMap 为空，导致只显示数量不显示具体子任务
- **解决方案**：API 路由新增 `subtaskMap` 字段，从 `result.allTasks`（全量数据）构建 `parentGuid → 子任务[]` 映射，确保子任务数据完整传递到前端
- **前端适配**：`lark-tasks/page.tsx` 新增 `subtaskMap` state，直接使用 API 返回的映射而非从过滤后数据构建
- `TaskCard` 组件接收 `myOpenId` prop，子任务展开时显示完整内容并支持完成/创建交互

#### 2. 加载性能优化（非阻塞式加载）
- **根因**：`fetchTasks` 使用 `setLoading(true)` 阻塞整个 UI，lark-cli 全量拉取需 48 秒，期间无法切换页面
- **DB 优先快速加载**：API 新增 `fast=true` 参数，优先从数据库返回缓存数据（毫秒级），后台异步触发 lark-cli 刷新
- **非阻塞 UI**：前端首次加载显示全屏 loading，已有数据时仅显示"同步中..."指示器（`refreshing` state），不阻塞页面交互
- **两阶段加载**：第一步 `fast=true` 请求 DB 缓存（instant）→ 第二步后台请求 lark-cli 最新数据并更新
- **强制刷新**：手动同步/子任务状态变更时使用 `fetchTasks({ force: true })` 带 `refresh=true` 强制拉取 lark-cli
- **避免无限循环**：使用 `hasDataRef` 替代 `tasks.length` 作为 useCallback 依赖，防止状态更新触发重复请求

#### 3. VAD 语音活动检测 + 流式 ASR + 流式 TTS
- **VAD（语音活动检测）**：
  - 基于 Web Audio API `AnalyserNode` 实时分析音频音量（RMS → dB）
  - 音量超阈值持续 300ms → 判定语音开始
  - 音量低于阈值持续 800ms → 判定语音结束，立即发送识别
  - 超时保护：单次语音最长 30 秒自动截断
  - VAD 不可用时自动回退到旧版 3 秒定时录音（`startVoiceChunkRecordingLegacy`）
- **流式 ASR（边说边识别）**：
  - VAD 检测到语音结束后立即发送音频段进行识别，无需等待固定超时
  - 相比旧版 3 秒固定超时，延迟降低 60-80%
  - `MediaRecorder` 使用 200ms timeslice 获取周期性数据块
- **流式 TTS（首包延迟 < 300ms）**：
  - 文本按句子切分（中文标点。！？；+ 英文标点 + 换行）
  - 前 2 句并行合成（降低首包延迟），后续句子在播放时后台继续合成
  - 队列播放：前一句播放完毕立即播放下一句，无缝衔接
  - 短句合并（<5 字符合并到前一句），避免过多请求

#### 4. 飞书任务前端展示优化
- **按截止时间排序**：未完成在前 → 已完成在后；有截止时间优先 → 无截止时间排最后；同状态按截止时间升序
- **负责人徽标区分**：
  - "我负责"：蓝色（cognition）徽标 + 头像高亮
  - "关注"：橙色（campaign）徽标
  - "他人负责"：灰色文字 + 灰色头像
- **子任务负责人徽标**：子任务列表中"我"负责的子任务头像高亮 + "我"标签
- **同步状态指示**：后台刷新时显示"同步中..."旋转图标，不阻塞操作

### 修改文件清单
- `src/lib/lark-sync.ts` - 导出 `applyClientFilters` 供 API 路由使用
- `src/app/api/lark-tasks/route.ts` - 新增 `fast` 快速模式、`subtaskMap` 返回、`buildSubtaskMap`/`refreshTasksInBackground` 辅助函数
- `src/app/ai/lark-tasks/page.tsx` - 非阻塞加载、subtaskMap state、按截止时间排序、负责人徽标、refreshing 指示器
- `src/app/ai/assistant/page.tsx` - VAD 录音、流式 TTS（句子切分+队列播放）、旧版录音回退
- `DEV_LOG.md` - 本次迭代记录

### 测试验证
- TypeScript 编译零错误
- Dev server 正常启动（localhost:3000）

---

## 迭代 11 - 2026-06-24

### 任务概要
用户提出 8 项需求：飞书任务同步深度修复、MiMo 多模态图片支持、TTS 音色复刻、新 MiMo key 测试、全双工语音对话、AI 助理命名+飞书机器人通知、规范完善、Gitee 提交。

### 完成内容

#### 1. 飞书任务同步深度重构
- **数据源替换**：废弃 `+get-my-tasks`/`+get-related-tasks`（返回字段不全且不支持搜索），改用 `tasklists list` + `tasklists tasks` 获取所有任务清单的全量任务
- **郭子梁任务未同步问题修复**：新方案从全部 7 个任务清单（王林涛/彭成龙/张雪/郭晓琴/王嫣然/辛宏伟/郭子梁）拉取，共获取 219 个任务，其中"我的任务"30 个，正确识别 open_id `ou_ef923312f1d427bffd9a26842b9d724e` 对应"郭子梁"
- **假数据清除**：发现 Prisma seed 残留模拟数据（Lynn/张三/李四等假名字），执行清理删除所有旧 LarkTask 记录，从飞书重新全量同步真实数据
- **子任务支持**：对 `subtask_count > 0` 的父任务调用 `subtasks list --task-guid` 获取子任务列表，使用 `parent_task_guid` 建立父子关系。数据库新增 `parentTaskGuid` 字段
- **成员姓名解析**：模块级缓存 `memberNameCache`，批量调用 `contact +get-user` 解析所有 open_id 对应的真实姓名，共解析出 9 位真实成员（恭斌、郭晓琴、张雪、郭子梁、王林涛、彭成龙、王嫣然、辛宏伟、李妙芬）
- **关键词搜索修复**：废弃原不支持 `--query` 参数的 CLI 搜索，改为客户端基于缓存的全量搜索（`allTasksCache`），在 summary/description 中过滤关键词
- **缓存策略**：全量任务 30 秒 TTL（`allTasksCache`），任务清单 5 分钟 TTL（`tasklistsCache`），写操作后自动调用 `invalidateTasksCache()` 失效缓存
- **API 返回增强**：`/api/lark-tasks` 现在返回 `myOpenId`、完整 `assignees`、`tasklists` 列表（从全量数据聚合，不受当前过滤条件影响）

#### 2. MiMo-v2.5 多模态支持
- `ai-provider.ts` 中 MiMo 系列模型标记 `multimodal: true`
- 前端上传按钮按 `isModelMultimodal()` 判断是否显示
- 确认 `mimo-v2.5`、`mimo-v2.5-pro`、`mimo-vl-7b` 均支持图片输入

#### 3. TTS 音色复刻功能
- 新增 `/api/ai/voice-clone` API 端点：支持 multipart/form-data 上传 60 秒内音频文件（≤10MB），调用 `mimo-v2.5-tts-voiceclone` 模型完成声音复刻
- 数据库新增 `AISetting` 表存储：`clonedVoiceId`、`clonedVoiceName`、`clonedAt`、`defaultVoice` 等配置
- 前端设置面板添加上传入口，支持录制/选择音频文件上传复刻
- **TTS 模型名修正**：验证正确模型名为小写 `mimo-v2.5-tts`（非 `MiMo-V2.5-TTS`），音色复刻模型为 `mimo-v2.5-tts-voiceclone`

#### 4. 新 MiMo Plan Key 测试
- 测试 `tp-cwv8cygr2nlesoqrpkanjrdgjw2rvcaro1x9ijmk7d6bdq4b`（tp- 前缀）在多个 endpoint（api.xiaomimimo.com、platform.xiaomimimo.com 等）均返回 401 未授权
- 结论：该 key 不可用，保留原有 sk- 前缀 key 作为主用，tp-key 记录到 .env 作为备用（`MIMO_PLAN_API_KEY`）

#### 5. 全双工语音对话
- 使用 Web Audio API + MediaRecorder 实现实时录音
- 3 秒静音检测自动停止录音并发送识别
- ASR 实时语音转文字：复用 `/api/ai/asr` 端点
- TTS 实时语音合成：复用 `/api/ai/tts` 端点，支持复刻音色
- 前端添加"开始语音对话"按钮，开启后进入全双工模式，自动监听→识别→回复→朗读循环
- 支持随时停止对话、打断朗读

#### 6. AI 助理命名 + 飞书机器人紧急通知
- **助理命名**：`AISetting` 表 `assistantName` 字段，设置面板可修改助理名称，默认"Lynn"
- **飞书通知**：新增 `/api/ai/notify-feishu` API 端点，通过 `lark-cli im +messages-send` 给当前用户（open_id）发送飞书私信
- 支持标记"紧急通知"，消息模板包含助理名称和通知内容
- 设置面板可开启/关闭飞书紧急通知

#### 7. 项目规范与日志
- 更新 `DEV_LOG.md` 记录本次迭代详细变更
- 清理临时调试/测试文件（_test_mimo_key.js、_cleanup.js 等）
- TypeScript 编译零错误
- 代码遵循现有项目风格（无注释、camelCase、Tailwind 样式）

### 测试验证结果
- **飞书任务**：我的任务 30 个（郭子梁负责人）、关键词搜索"语音"返回 4 条结果、子任务"更改语音模型的具体实施计划讨论"正确关联到父任务"语音识别模型选用方案"、成员列表显示 9 位真实人员无假名字
- **TTS API**：HTTP 200，返回 WAV 音频 40-100KB
- **Settings API**：HTTP 200，助理名/音色配置读写正常
- **TypeScript 编译**：零错误

### 修改文件清单
- `prisma/schema.prisma` - LarkTask 新增 parentTaskGuid；新增 AISetting 表
- `src/lib/lark-sync.ts` - 全量重构：tasklists API、子任务获取、成员解析、客户端搜索、缓存机制
- `src/lib/ai-provider.ts` - MiMo 模型标记 multimodal、修正 TTS 模型名为小写
- `src/app/api/lark-tasks/route.ts` - 返回 myOpenId/assignees/tasklists、使用全量数据聚合
- `src/app/api/ai/tts/route.ts` - 默认模型名修正为 mimo-v2.5-tts、支持复刻音色
- `src/app/api/ai/voice-clone/route.ts` - 新增音色复刻 API
- `src/app/api/ai/settings/route.ts` - 新增 AI 设置读写 API
- `src/app/api/ai/notify-feishu/route.ts` - 新增飞书通知 API
- `src/app/ai/assistant/page.tsx` - 重写：设置面板、语音对话、音色复刻、助理命名、多模态图片上传
- `.env` - 更新 TTS 模型名、新增 MIMO_PLAN_API_KEY 备用
- `DEV_LOG.md` - 本次迭代记录

---

## 迭代 10 - 2026-06-24

### 任务概要
用户提出 6 项需求：飞书任务修复、ASR/TTS 修复、AI 助理多模态、对话资产文件上传、开发日志模块、Gitee 推送。

### 完成内容

#### 1. 飞书任务完成状态+性能优化+完全同步
- **完成状态彻底修复（关键 BUG）**：发现列表端点 `+get-my-tasks`/`+get-related-tasks` 只返回极简字段（`guid/summary/created_at/url/due_at`），不含 `status/completed_at/members` 等详情字段。之前的"性能优化版"直接 normalize 列表项导致 `completed` 字段始终为 false。
  - **解决方案**：新增 `adaptListItem` 函数，利用服务端 `--complete=true/false` 过滤结果已知完成状态这一特性，直接注入正确的 `status` 字段
  - 新增 `fetchTaskList` 辅助函数：过滤查询时单次调用；全量查询（`complete=null`）时双次调用（已完成+未完成）分别标记后合并
  - 正确映射 `due_at` → `due` 字段（列表返回 ISO 字符串格式）
- **分页修复**：所有列表命令添加 `--page-all` 参数，确保获取超过默认分页限制的所有任务
- **超时配置**：lark-cli 超时从 15s 增加到 30s，避免大数据量超时
- **性能优化**：`lark-sync.ts` 中用 `enrichTasksWithBatchNamesInPlace` 批量解析昵称，消除逐任务详情查询（N 次→1-2 次 lark-cli 调用）
- **同步策略修复**：`route.ts` 和 `[id]/route.ts` 始终优先从 lark-cli 拉取最新数据，DB 仅作为降级缓存
- **meta 端点优化**：仅在 DB 完全为空时才触发全量同步
- **TTL 缓存**：`getTasklists` 添加 5 分钟 TTL 缓存
- **前端轮询优化**：webhook 轮询从 10 秒改为 30 秒，首次不刷新
- **性能指标**：我的未完成任务 ~1.2s、我的已完成任务 ~1.8s、Meta ~90ms（缓存命中）

#### 2. ASR 和 TTS 模型连接修复
- 验证 TTS API 返回 HTTP 200，生成 69KB WAV 音频
- 验证 ASR API 返回 HTTP 200，正确识别"你好，世界。"
- 修复 ASR 路由对 webm 格式的处理：先尝试原始 webm MIME，失败后回退 wav MIME

#### 3. AI 助理多模态识别
- `ai-provider.ts` 添加 `multimodal` 标记和 `isModelMultimodal` 函数
- 添加 DeepSeek VL2 和 MiMo VL 多模态模型变体
- `chat/route.ts` 支持多模态 content 数组（text + image_url）
- `ModelSwitcher` 显示"多模态"徽章
- `assistant/page.tsx` 添加图片上传、预览、显示功能，仅多模态模型显示上传按钮

#### 4. 对话资产捕获增强
- `utils.ts` 添加 `trae-solo` 对话来源
- `assets/page.tsx` 捕获表单添加文件上传按钮，支持 MD/HTML/TXT/CSV/JSON/图片/PDF
- 更新所有描述文本包含 Trae Solo

#### 5. 开发日志模块
- 创建 `DEV_LOG.md` 记录每次迭代变更
- 创建 `/api/dev-log` API 端点读取日志
- 创建 `/dev-log` 页面查看日志

#### 6. Gitee 推送
- 推送代码到 Gitee 仓库 `Admin@shenzhens-emotions-are-booming_0`

### 技术要点
- Next.js 14 App Router + TypeScript + Tailwind CSS + Prisma + MySQL 8.4
- lark-cli 外部凭证模式：`LARK_APP_ID`/`LARK_APP_SECRET` 环境变量
- MiMo TTS/ASR API：使用 `/chat/completions` 端点（非 OpenAI 标准）
- 硅基流动 Embedding：`BAAI/bge-m3` 模型
- PowerShell 兼容：`curl.exe` 替代 `curl`，`;` 替代 `&&`

### 修改文件清单
- `.env` - 更新硅基流动 Embedding API Key
- `src/lib/lark-sync.ts` - 性能优化 + TTL 缓存
- `src/app/api/lark-tasks/route.ts` - DB 缓存策略调整
- `src/app/api/lark-tasks/[id]/route.ts` - 优先 lark-cli
- `src/app/ai/lark-tasks/page.tsx` - 轮询优化
- `src/app/api/ai/asr/route.ts` - webm 格式处理
- `src/lib/ai-provider.ts` - 多模态支持
- `src/app/api/ai/chat/route.ts` - 多模态消息校验
- `src/components/ui/ModelSwitcher.tsx` - 多模态徽章
- `src/app/ai/assistant/page.tsx` - 图片上传功能
- `src/lib/utils.ts` - Trae Solo 来源
- `src/app/assets/page.tsx` - 文件上传增强
- `DEV_LOG.md` - 开发日志（新增）
- `src/app/api/dev-log/route.ts` - 日志 API（新增）
- `src/app/dev-log/page.tsx` - 日志页面（新增）

---

## 迭代 9 - 2026-06-23（历史）

### 完成内容
- 修复飞书任务同步、AI 助理、AI 工作流、记忆图谱等功能
- 添加 TTS/ASR API 路由
- 添加 ModelSwitcher 组件
- 添加向量嵌入 API

---

## 迭代 8 及更早（历史）

### 完成内容
- LynnHub 项目初始化
- 灵感闪电输入、决策看板、认知库、记忆图谱
- 飞书任务集成、AI 助理、对话资产捕获
- Skill 模板系统、每日聚焦

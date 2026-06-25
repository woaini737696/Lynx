# LynnHub 项目开发规范

> 本文件为项目强制规范，所有贡献者（含 AI 助手）每次开发必须遵守。

## 1. 代码同步规范（强制）

### 1.1 Git 提交同步规则
- **每次完成一个功能单元/迭代后必须立即提交**，不允许堆积多个未提交的功能单元
- **每次提交后必须立即推送到 Gitee（origin/master）**，命令：`git push origin master`
- **禁止长时间保留本地未推送的提交**，最长不超过 1 个工作日
- **提交信息规范**：使用 `feat/fix/docs/refactor(模块): 描述` 格式，中文描述
- **禁止提交**：临时调试文件（`test-*.cjs`、`*.txt` 临时文件）、`.env`、`node_modules/`、`.next/`、`dist/`

### 1.2 同步检查清单（每次开发前/后）
- [ ] 开发前：`git pull origin master` 拉取最新
- [ ] 开发中：小步提交，每个功能单元一次 commit
- [ ] 开发后：`git push origin master` 推送
- [ ] 验证：`git log origin/master..HEAD` 应为空（无未推送提交）
- [ ] 验证：`git status` 应 clean（无未跟踪的临时文件）

### 1.3 生产服务器同步
- **当前阶段**：开发期，无生产服务器
- **部署阶段**：代码同步到 Gitee 即视为完成同步；阿里云 ECS 部署延后到正式部署阶段
- **部署阶段触发条件**：所有 P0 功能成熟 + 用户明确指示"开始部署"

## 2. 端口规范（强制）

| 服务 | 端口 | 说明 |
|---|---|---|
| Web 后端（Next.js） | **5176** | 严禁占用 3000 或其他项目端口 |
| 移动端 H5（Vite） | **5175** | 严禁占用其他端口 |
| Hermes Dashboard | 9119 | Hermes Agent 默认端口 |

所有脚本、配置、文档、代理 target 均需遵循此规范。

## 3. UI 规范（强制）

- **配色**：橙黑灰（orange-black-gray），禁止蓝紫渐变
- **列表页**：必须实现分页（默认 10 项/页，可配置）+ 搜索 + 筛选
- **左侧导航栏**：内容区滚动时保持固定
- **3D 记忆图谱**：支持滚轮缩放 + 节点点击聚焦
- **移动端**：任务数据使用 database-only 模式（`db_only=true`），不依赖 lark-cli

## 4. 工程规范

### 4.1 任务优先级
- 按"功能成熟度"排序，而非"部署就绪度"
- P0 > P1 > P2 > P3

### 4.2 AI 助手 API
- 所有 AI 助手 API 调用必须包含 `assistantMode: true` 以启用工具集成
- Hermes Agent API 调用 `/api/task` 必须优雅处理 401 错误，不导致执行失败

### 4.3 鉴权规范
- 所有非公开 API 必须调用 `requireAuth()`
- 公开 API（如公共技能广场列表/详情）需在 `src/middleware.ts` 的 `publicPatterns` 白名单中声明
- 用户数据隔离：查询用户数据时必须 `where: { userId: user.id }`

### 4.4 可复用组件
- 列表控件（分页/搜索/筛选）使用 `ListControls` 组件
- 避免重复造轮子

## 5. Hermes Agent 规范（强制）

### 5.1 执行模式
- **CLI 模式为主**：`hermes -z "prompt" --yolo`，通过 `execHermes()` 调用
- **HTTP Dashboard 仅管理**：端口 9119，无通用 prompt 执行 API
- **持久化 profile**：每个用户独立 profile，路径 `~/.lynnhub/hermes-profiles/<userId>/`
- **环境隔离**：`buildHermesEnv()` 重定向 LOCALAPPDATA + 复制配置

### 5.2 学习闭环
- Agent 执行任务后，`/learn` 生成的新 Skill 必须回写到 LynnHub Skill 表（`source: "hermes-learned"`）
- LynnHub Skill 可导出为 Hermes skill 格式到 profile 的 `skills/` 目录
- 公共技能广场兼容 agentskills.io 开放标准

### 5.3 AI 助理接管
- AI 助理模块底层切换为 Hermes Agent（模式 C：长驻 + 持续工作 + 主动汇报）
- 保留原 LLM 直连作为 fallback（Hermes 未安装时）
- 持续学习闭环 + 持久化记忆 + 自动成长

## 6. 数据库规范

- Schema 修改后必须执行 `npx prisma db push --skip-generate` + `npx prisma generate`
- 不使用 Migration（开发期），直接 db push
- `prisma generate` 失败时（EPERM）：先 `Get-Process -Name "node" | Stop-Process -Force`

## 7. 提交时机（强制）

**以下情况必须立即 commit + push：**
1. 完成一个迭代（P0/P1 任务）
2. 修复一个 bug（验证通过后）
3. 完成一组相关功能
4. 每次开发会话结束前
5. 用户明确要求提交时

**禁止：**
- 累积超过 3 个功能单元才提交
- 跨日未推送的本地提交
- 提交未通过 `npx tsc --noEmit` 的代码

## 8. PowerShell 环境规范

- 命令分隔用 `;` 而非 `&&`
- Heredoc 不支持，用 `git commit -F <file>` 代替
- 路径含空格用双引号
- 查找文件用 `Glob`，搜索内容用 `Grep`，禁止 `find`/`grep`/`rg` 命令

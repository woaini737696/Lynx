# LynnHub 项目开发规范

> 本文件为项目强制规范，所有贡献者（含 AI 助手）每次开发必须遵守。

## 1. 代码同步规范（强制）

### 1.1 Git 提交同步规则
- **每次完成一个功能单元/迭代后必须立即提交**，不允许堆积多个未提交的功能单元
- **每次提交后必须立即推送到 Gitee（origin/master）**，命令：`git push origin master`
- **禁止长时间保留本地未推送的提交**，最长不超过 1 个工作日
- **提交信息规范**：使用 `feat/fix/docs/refactor(模块): 描述` 格式，中文描述
- **禁止提交**：临时调试文件（`test-*.cjs`、`*.txt` 临时文件）、`.env`、`node_modules/`、`.next/`、`dist/`
- **自动 push 配置**：remote URL 已嵌入 Gitee 私人令牌，`git push origin master` 无需手动输入密码
- **PowerShell 环境**：每次 git 命令前需设置 `$env:Path = "D:\Git\bin;D:\Git\cmd;" + $env:Path`（Git 安装在 D:\Git）

### 1.2 同步检查清单（每次开发前/后）
- [ ] 开发前：`git pull origin master` 拉取最新
- [ ] 开发中：小步提交，每个功能单元一次 commit
- [ ] 开发后：`git push origin master` 推送
- [ ] 验证：`git log origin/master..HEAD` 应为空（无未推送提交）
- [ ] 验证：`git status` 应 clean（无未跟踪的临时文件）

### 1.3 生产服务器同步
- **当前阶段**：已有阿里云生产服务器，支持正式部署
- **部署架构**：Node.js 20 + PM2 托管 Next.js + MySQL 8.0 + Nginx 反向代理
- **部署流程**：本地构建 → 上传服务器 → PM2 reload → 健康检查
- **代码同步**：代码同步到 Gitee 即视为完成代码同步；生产部署需手动触发
- **生产环境注意事项**：
  - 生产环境必须重新生成 `AUTH_SECRET`（`openssl rand -base64 32`）
  - 禁止在生产环境运行 `prisma seed`（仅开发环境可用）
  - 生产环境数据库连接必须使用密码
  - 启用 Sentry 错误监控（配置 `SENTRY_DSN`）

### 1.4 开发日志同步规范（强制）
- **每次迭代完成并 commit + push 后，必须同步更新 `DEV_LOG.md`**，在文件顶部（`---` 之后）新增一个迭代区块
- **迭代编号递增**：读取 `DEV_LOG.md` 中最大的迭代号 +1
- **日志格式**：包含「任务概要」「完成内容（按子任务分节，列出文件路径+变更说明）」「自测结果」「Commit hash」
- **禁止跳过**：即使是小迭代也必须记录，不允许出现"代码已提交但日志未更新"的情况
- **验证**：开发结束前检查 `DEV_LOG.md` 顶部迭代号是否等于本次迭代

### 1.5 数据持久化规范（强制）
- **用户配置数据（API Key、Webhook URL、Token 等）必须持久化到数据库，禁止使用 localStorage**
- **localStorage 仅可用于 UI 临时状态（如折叠状态、主题切换等非关键状态）**
- **数据迁移**：发现历史 localStorage 配置时，首次加载自动迁移到数据库后清除旧 key
- **验证**：清理浏览器 localStorage 后刷新页面，用户配置应仍在
- **禁止**：在代码中使用 localStorage 存储任何用户配置数据（API Key、密钥、Webhook、Token 等）

### 1.6 自测数据清理规范（强制）
- **所有自测产生的数据（含 e2e 测试、手动 API 测试、脚本验证）必须在自测完成后立即清理**
- **e2e 测试**：每个 test 必须在 `afterEach` 钩子中清理创建的数据（按内容前缀 `E2E` 匹配）
- **手动 API 测试**：测试数据统一使用 `E2E` / `测试` 前缀，便于识别和清理
- **脚本验证**：验证脚本产生的数据需在脚本末尾自行清理
- **清理工具**：`npx tsx scripts/cleanup-e2e-data.ts` 可一键清理所有 E2E 前缀脏数据
- **禁止**：遗留测试数据污染生产数据库，记忆图谱、看板、收件箱等不得有测试数据残留
- **验证**：开发结束前运行清理脚本，确认数据库无 `E2E*` 前缀数据

### 1.7 服务启动验证规范（强制）
- **每次完成任务（迭代/功能单元）后必须启动 dev server 验证服务正常运行**，禁止仅做代码修改不验证启动
- **启动前置条件（必须按顺序执行）**：
  1. **MySQL 启动检查**：dev server 启动前必须确认 MySQL 已运行（端口 3306 可达）
     - 检查命令：`Test-NetConnection localhost -Port 3306` 或 `Get-Process mysqld`
     - 未运行时先启动：`Start-Process "C:\Program Files\MySQL\MySQL Server 8.4\bin\mysqld.exe" -ArgumentList "--datadir=D:/LynnHub/mysql_data","--port=3306","--console" -WindowStyle Hidden`
     - 数据目录必须为 `D:\LynnHub\mysql_data`（见 §2.1）
  2. **清理 .next 缓存**（仅在出现 worker.js 错误/模块缺失/异常重启时）：`Remove-Item -Recurse -Force .next`
- **启动命令**：`npx next dev -p 5176`（端口 5176 强制，见 §2）
- **验证步骤**：
  1. 启动 dev server，等待控制台输出 "Ready in XXXms" 或类似就绪标志
  2. HTTP 探测 `http://localhost:5176` 返回 200（非 5xx 错误页）
  3. HTTP 探测 `http://localhost:5176/login` 返回 200（验证 NextAuth 路由可用）
  4. 检查启动日志无致命错误（如 `Cannot find module`、`Can't reach database server`、`worker thread exited` 等）
- **失败处理**：启动失败时必须修复后重新验证，禁止在服务未启动状态下提交代码
- **验证记录**：在 DEV_LOG.md 的「自测结果」中记录 dev server 启动状态（端口 5176 + HTTP 状态码 + MySQL 状态）
- **禁止**：跳过服务启动验证直接 commit/push，或仅靠 `tsc --noEmit` 通过就认为任务完成

### 1.8 内存缓存规范（强制）
- **适用场景**：高频读取但低频变更的数据（如记忆图谱、技能列表、岗位工作空间配置等）
- **缓存策略**：
  - **TTL 缓存**：使用 5 分钟（300s）过期策略，过期后下次请求自动重新拉取
  - **按 key 失效**：数据变更时通过 `invalidateCache(key)` 主动失效对应缓存项，避免脏读
  - **请求合并**：同一 key 的并发请求自动去重（Promise 复用），避免缓存击穿
- **实现位置**：`src/lib/cache.ts`（提供 `withCache(key, ttl, fetcher)` 工具函数）
- **使用范例**：记忆图谱 `/api/memory/graph` 已接入 5 分钟缓存；写入/更新/删除记忆后调用 `invalidateCache("memory:graph")`
- **禁止**：在缓存中存储用户敏感数据（API Key、Token）或会话信息；缓存命中时仍需做权限校验
- **监控**：缓存命中率日志通过 `logger.debug` 输出，便于性能调优

### 1.9 异步认知提取规范（强制）
- **适用场景**：看板任务标记完成（`PATCH /api/tasks/:id` status=done）时触发的 AI 认知提取
- **同步 vs 异步**：
  - **同步模式（已废弃）**：在 PATCH 请求中串行调用 AI 提取认知，导致响应时间从 ~200ms 飙升到 ~1800ms
  - **异步模式（强制）**：PATCH 请求立即返回 200 + 任务数据，认知提取通过 `setImmediate` / `queueMicrotask` 在后台执行
- **实现要点**：
  - PATCH 接口先更新 Task 状态并返回响应，再异步触发 `extractCognitionsFromTask(taskId)`
  - 异步任务失败不影响主流程，仅 `logger.warn` 记录
  - 提取结果通过 `extractedCognitions` 字段在下次拉取任务列表时附带返回，或通过 WS 推送给前端
- **前端配合**：前端 `toggleDone` 收到 200 响应后立即更新 UI，认知提取结果通过轮询或 WS 事件异步展示
- **禁止**：在 PATCH 接口中同步等待 AI 调用完成再返回响应

## 2. 端口规范（强制）

| 服务 | 端口 | 说明 |
|---|---|---|
| Web 后端（Next.js） | **5176** | 严禁占用 3000 或其他项目端口 |
| 移动端 H5（Vite） | **5175** | 严禁占用其他端口 |
| WebSocket 网关 | **3001** | 多端协同网关（`src/lib/ws-gateway.ts`），独立于 Next.js 进程 |
| Hermes Dashboard | 9119 | Hermes Agent 默认端口 |

所有脚本、配置、文档、代理 target 均需遵循此规范。

**启动命令必须使用 `-p 5176`：**
- 开发服务器：`npx next dev -p 5176`
- 生产构建：`npx next start -p 5176`
- **禁止**使用 3000 端口启动，AI 助手每次启动 dev server 必须遵守此规范

### 2.1 磁盘使用规范（强制）
- **禁止在 C 盘写入任何项目数据**，包括但不限于：MySQL 数据目录、Hermes profiles、日志、缓存、临时文件
- **所有项目数据必须放在 D 盘**（项目目录 `d:\Lynn工作空间\LynnHub\` 或 `D:\LynnHub\` 下）
- **MySQL 数据目录**：`D:\LynnHub\mysql_data`（启动脚本：`scripts/start-mysql.ps1`）
- **Hermes profiles**：`<项目根>/.lynnhub/hermes-profiles/`（代码中通过 `path.resolve(__dirname, "..", "..", "..")` 定位项目根，禁止用 `os.homedir()`）
- **npm/pnpm 全局包**：如需安装全局包（如 hermes-agent），配置 `npm config set prefix "D:\LynnHub\npm-global"`，避免占用 `C:\Users\...\AppData\Roaming\npm`
- **临时文件**：代码中 `os.tmpdir()` 返回 C 盘时，改用项目目录下 `tmp/` 子目录
- **每次开发前检查**：不得在 C 盘新建任何项目相关目录或文件

## 3. UI 规范（强制）

- **配色**：橙黑灰（orange-black-gray），禁止蓝紫渐变
- **列表页**：必须实现分页（默认 10 项/页，可配置）+ 搜索 + 筛选
- **左侧导航栏**：内容区滚动时保持固定
- **3D 记忆图谱**：支持滚轮缩放 + 节点点击聚焦
- **移动端**：任务数据使用 database-only 模式（`db_only=true`），不依赖 lark-cli

### 3.1 功能模块使用说明规范（强制）
- **每个功能模块页面右上角必须包含「使用说明」入口**（问号图标按钮或 `HelpButton` 组件）
- **新增模块时必须同步添加使用说明内容**，禁止出现"有页面无说明"的情况
- **每次功能更新后必须同步更新对应模块的使用说明**，确保说明与实际功能一致
- **使用说明内容**存放在 `src/lib/help-content.ts`，按模块 key 组织
- **规范检查**：开发结束前确认所有新增/修改的模块页面都包含使用说明入口

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

## 9. 桌面端规范（强制）

### 9.1 架构规范
- **桌面端基于 Tauri 2.x**：Rust 壳 + 复用 Next.js 前端代码，禁止使用 Electron
- **桌面端源码目录**：`desktop/src-tauri/`（Rust 代码）、前端复用 `src/` 目录
- **环境检测**：前端通过 `isDesktop()`（`src/lib/desktop-client.ts`）检测是否运行在 Tauri 环境
- **Web 端 vs 桌面端**：Web 端走云端 API，桌面端通过 Tauri invoke 调用本地 Rust 能力

### 9.2 HermesAgent 本地化规范
- **本地 AI 代理**：桌面端内置 HermesAgent 进程（Rust 端 `hermes/` 模块），负责本地电脑操控
- **一键安装**：设置页提供「一键安装 AI 环境」按钮（`DesktopHermesSection` 组件），调用 `installAiEnv()` Tauri 命令
- **进程管理**：启动/停止 HermesAgent 通过 Tauri invoke（`start_hermes` / `stop_hermes`），使用 AtomicBool 全局标志实现紧急停止
- **能力分级**：
  - L1（云端 CRUD）：直执不审批
  - L2（本地文件/浏览器）：首次授权
  - L3（Shell/桌面 RPA）：每次审批

### 9.3 三档授权模式（强制）
- **模式切换器**：AI 助理输入框上方必须显示三档授权模式切换器（仅桌面端显示，仿 Codex 风格）
- **三档模式**：
  - `approve`（弹窗审批）：每次操作弹窗确认（默认，最安全）
  - `once`（一次授权）：同类操作首次授权后会话内不再询问
  - `free`（免审批）：仅记录日志不弹窗（效率最高）
- **审批弹窗**：L2/L3 级操作在 `approve` / `once` 模式下必须弹出审批 Modal（`approval-request` 事件）
- **紧急停止**：所有操作支持紧急停止（AtomicBool 标志 + 执行前后双检查 + 5s 自动重置）

### 9.4 多端协同规范
- **WebSocket 网关**：`src/lib/ws-gateway.ts` 维护 PC 在线状态（端口 3001），独立于 Next.js 进程
- **WS 启动脚本**：`scripts/start-ws-gateway.js`（通过 tsx 运行，支持 PM2 托管）
- **PC 会话管理**：`PcSession` 表记录每台 PC 的 `wsChannelId`、在线状态、授权模式
- **远程指令**：安卓端/Web 端 → 云端 API `/api/hermes/remote-command` → WS 网关转发 → 目标 PC 执行
- **指令状态流转**：pending → dispatched → executing → completed/failed

### 9.5 安全操作规范（强制）
- **安全操作说明**：设置页 HermesAgent 区域必须包含「安全操作说明」按钮（`SafetyGuideModal`）
- **授权目录白名单**：用户可配置允许 AI 访问的目录白名单（`authDirectories`），白名单外目录拒绝访问
- **审计日志**：所有 AI 操作必须记录到 `AgentAuditLog` 表（含 level/action/result/source/durationMs）
- **数据安全承诺**：本地文件操作不自动上传，仅返回操作结果摘要

### 9.6 桌面端自动更新
- **Tauri Updater**：通过 `/api/desktop/update` 端点提供版本检查
- **更新配置**：环境变量 `DESKTOP_LATEST_VERSION` / `DESKTOP_DOWNLOAD_URL` / `DESKTOP_SIGNATURE`
- **语义化版本比较**：`isNewer()` 函数实现 semver 比较

### 9.7 桌面端开发流程
- **前端开发**：在 `src/` 目录开发，通过 `isDesktop()` 区分环境
- **Rust 开发**：在 `desktop/src-tauri/src/` 目录开发，通过 `tauri invoke` 暴露给前端
- **本地调试**：`cd desktop && npm run tauri dev`（需要 Rust 工具链）
- **构建发布**：`cd desktop && npm run tauri build`（生成各平台安装包）
- **桥接组件**：`DesktopBridge` 组件在 `layout.tsx` 全局挂载，负责 session 同步

### 9.8 原生壳规范（豆包/Kimi 级桌面端，强制）
- **架构定位**：桌面端为「Tauri 原生壳 + 云端 UI 深度原生集成」，对标豆包/Kimi/Trae Solo，禁止内置本地后端（Node+DB sidecar），禁止 Electron
- **无边框窗口**：`tauri.conf.json` 必须 `decorations: false` + `shadow: true`，标题栏由前端 `TitleBar` 组件自定义渲染（`src/components/layout/TitleBar.tsx`），禁止使用系统原生标题栏（避免双标题栏）
- **全局快捷键**：必须注册 `Ctrl+Shift+L` 唤起/隐藏主窗口（避开 `Ctrl+Space`，与中文输入法切换冲突），通过 `tauri-plugin-global-shortcut` 在 Rust 端 `lib.rs` 注册
- **远程 IPC 访问**：Web UI 从 `localhost:5176`（开发）或 `app.lynnhub.com`（生产）加载时，必须通过 `capabilities/default.json` 的 `remote.urls` 授权才能调用 Tauri 命令；禁止使用已废弃的 `dangerousRemoteDomainIpcAccess`（Tauri 1.x 字段，v2 不再生效）
- **窗口控制 API**：前端窗口操作（最小化/最大化/关闭/拖拽）必须通过 `src/lib/desktop-client.ts` 的 `windowMinimize/windowToggleMaximize/windowClose/getCurrentWindow` 封装调用，禁止直接 `window.__TAURI__` 强转
- **后端 endpoint 切换**：开发期 `frontendDist` 指向 `localhost:5176`，生产部署后切换为 `https://app.lynnhub.com`，实现「先本地跑通再部署云端」的独立安装产品形态
- **cargo 命令执行**：必须在 `desktop/src-tauri/` 目录下执行 cargo 命令（`.cargo/config.toml` 在该目录，配置了 ASCII `target-dir = D:/cargo-target`，从项目根执行会导致中文路径「工作空间」触发 MinGW dlltool 失败）
- **工具链**：使用 MSVC 工具链构建发布版（GNU 工具链构建的 exe 导入表不匹配会崩溃）
- **打包命令**：在 `desktop/` 目录执行 `npm run tauri build`，产物输出到 `D:\cargo-target\release\bundle\msi\Lynx_1.2.0_x64_en-US.msi`，需手动复制到 `desktop/dist/`（已加入 `.gitignore`，22MB+ 二进制不入版本控制）
- **WiX/NSIS 工具链下载**：tauri 内置从 `github.com` 下载 WiX/NSIS 在国内会卡死，必须用 `gh-proxy.com` 镜像手动下载到 `%LOCALAPPDATA%\tauri\WixTools314/` 和 `%LOCALAPPDATA%\tauri\NSIS/`，tauri 检测到缓存已存在会自动跳过下载
- **light.exe ICE 验证报错可忽略**：WiX 3.14 在某些 Windows 环境下 `light.exe` 会报 `LGHT0217` ICE 验证错误（script engine 注册问题），但 MSI 产物已完整生成在 `bundle/msi/` 目录，可直接使用；tauri 因此报 `failed to run light.exe` 但实际产物已生成
- **NSIS exe 打包沙箱限制**：TRAE 沙箱会拦截 `D:\cargo-target\release\*.d` 写入导致 `tauri build --bundles nsis` 失败（`os error 5 拒绝访问`），如需 NSIS exe 需在 TRAE 外部终端执行；MSI 是 Windows 标准安装包已满足双击安装需求

### 9.9 原生桌面端（Lynx 独立安装版，强制）
- **独立目录**：原生桌面端源码位于 `desktop-native/`，从 `desktop/` 复制并改造而来；禁止回改 `desktop/` 原版本，两条产品线并行存在
- **产品定位**：类豆包/Kimi 的独立原生桌面软件，非 Web 套壳；本地前端 + 云端 API，安装即用
- **独立前端打包**：
  - 使用 `next.desktop-native.config.mjs` 做 Next.js static export，产物到 `desktop-native/dist-web/`
  - 构建脚本 `desktop-native/build-web.ps1` 生成离线可用前端
  - `build-native.ps1` 将 `dist-web/` 合并到 `out/app/`，最终与 Tauri 二进制一起打包
  - Tauri `frontendDist` 指向 `../out`，启动页 `out/index.html` 负责加载本地前端并检测云端服务
- **安装包格式**：使用 NSIS 生成 `Lynx-Setup-1.2.0.exe`（用户要求的 exe 安装包），不再生成 MSI
  - 自定义安装脚本：`desktop-native/installer.nsi`
  - 品牌风格：橙黑主题、无边框现代感、类豆包安装流程
  - 版本号统一：`package.json` / `Cargo.toml` / `tauri.conf.json` / `installer.nsi` 必须一致
- **构建命令**：
  - 进入 `desktop-native/` 目录执行 `build-native.ps1`
  - 必须预先安装 NSIS 3.x（推荐路径 `C:\Program Files (x86)\NSIS\makensis.exe`）
  - 必须使用 MSVC 工具链（`stable-x86_64-pc-windows-msvc`）
  - Cargo target-dir 指向 `D:/cargo-target-native`（纯 ASCII 路径，避免中文路径链接错误）
- **安装与卸载验证**：
  - 静默安装：`Lynx-Setup-1.2.0.exe /S /D=D:\TargetDir`
  - 产物检查：安装目录必须包含 `lynnhub-desktop-native.exe`、`uninstall.exe`、`out/index.html`、`out/app/...` 完整前端资源
  - 版本信息检查：产品名 `Lynx`、版本 `1.2.0`、文件大小约 22MB
  - 卸载：执行安装目录 `uninstall.exe /S`
- **与原桌面端差异**：
  - `desktop/`：保留原有 WebView2 套壳形态，基于 `src/` 复用前端
  - `desktop-native/`：独立原生安装版，离线前端资源，面向终端用户发布
- **禁止行为**：
  - 禁止在 `desktop-native/` 中引用 `desktop/src-tauri/` 的构建产物
  - 禁止将 `output: 'export'` 写入根目录 `next.config.mjs`
  - 禁止提交 `dist/`、`dist-web/`、`out/app/`、`src-tauri/target/` 到版本控制（已加入 `.gitignore`）

## 10. 环境变量规范（强制）

- **配置文件**：`.env`（本地开发）、`.env.example`（示例模板，必须提交到仓库）
- **新增环境变量时必须同步更新 `.env.example`**，并在本节登记用途与默认值
- **禁止**：在代码中硬编码本应通过环境变量配置的值（如端口、密钥、保留天数等）

### 10.1 环境变量清单

| 变量名 | 用途 | 默认值 | 说明 |
|---|---|---|---|
| `DATABASE_URL` | MySQL 连接串 | - | Prisma 数据库连接字符串，生产环境必须带密码 |
| `NEXTAUTH_URL` | NextAuth 回调 URL | `http://localhost:5176` | 必须与端口规范 §2 一致，生产环境改为正式域名 |
| `AUTH_SECRET` | NextAuth 加密密钥 | - | 生产环境必须重新生成（`openssl rand -base64 32`） |
| `DEEPSEEK_API_KEY` | DeepSeek API Key | - | 支持动态切换 LLM 提供商 |
| `DEEPSEEK_BASE_URL` | DeepSeek Base URL | `https://api.deepseek.com/v1` | - |
| `DEEPSEEK_MODEL` | DeepSeek 模型名 | `deepseek-chat` | - |
| `MIMO_API_KEY` | 小米 MiMo API Key | - | - |
| `MIMO_BASE_URL` | MiMo Base URL | `https://api.xiaomimimo.com/v1` | - |
| `MIMO_MODEL` | MiMo 模型名 | `mimo-v2.5` | - |
| `DEFAULT_LLM_PROVIDER` | 默认 LLM 提供商 | `deepseek` | deepseek / mimo |
| `EMBEDDING_API_KEY` | 向量模型 Key | - | 不填则降级 TF-IDF 模式 |
| `EMBEDDING_BASE_URL` | Embedding Base URL | `https://api.siliconflow.cn/v1` | - |
| `EMBEDDING_MODEL` | Embedding 模型名 | `BAAI/bge-m3` | - |
| `ASR_API_KEY` | 语音识别 API Key | - | 可选，ASR 功能使用 |
| `ASR_BASE_URL` | 语音识别 Base URL | - | - |
| `ASR_MODEL` | 语音识别模型名 | `mimo-v2.5-asr` | - |
| `TTS_API_KEY` | 语音合成 API Key | - | 可选，TTS 功能使用 |
| `TTS_BASE_URL` | 语音合成 Base URL | - | - |
| `TTS_MODEL` | 语音合成模型名 | `mimo-v2.5-tts` | - |
| `TTS_VOICECLONE_MODEL` | 音色复刻模型名 | `mimo-v2.5-tts-voiceclone` | - |
| `VISION_API_KEY` | 视觉多模态 API Key | - | 可选，多模态功能使用 |
| `VISION_BASE_URL` | 视觉多模态 Base URL | - | - |
| `VISION_MODEL` | 视觉多模态模型名 | `deepseek-chat` | - |
| `LARK_APP_ID` | 飞书应用 App ID | - | 飞书集成使用 |
| `LARK_APP_SECRET` | 飞书应用 Secret | - | - |
| `LARK_WEBHOOK_TOKEN` | 飞书 Webhook Token | - | 飞书 Webhook 验证 |
| `VAPID_PUBLIC_KEY` | Web Push 公钥 | - | 推送通知使用 |
| `VAPID_PRIVATE_KEY` | Web Push 私钥 | - | - |
| `VAPID_SUBJECT` | Web Push 主题 | - | mailto: 链接或网站 URL |
| `SENTRY_DSN` | Sentry 错误监控 DSN | - | 可选，生产环境建议启用 |
| `TASK_DROPPED_RETENTION_DAYS` | 软删除任务保留天数 | `30` | 超过该天数的 dropped 任务由定时清理任务删除 |
| `WS_PORT` | WebSocket 网关端口 | `3001` | 多端协同网关端口 |
| `DESKTOP_LATEST_VERSION` | 桌面端最新版本号 | - | 用于 Tauri Updater 版本检查 |
| `DESKTOP_DOWNLOAD_URL` | 桌面端下载地址 | - | 用于 Tauri Updater 下载 |
| `DESKTOP_SIGNATURE` | 桌面端签名 | - | 用于 Tauri Updater 校验 |

### 10.2 TASK_DROPPED_RETENTION_DAYS 说明
- **作用**：控制看板中 `status=dropped` 的任务保留天数，超期后由定时清理任务（cron）自动删除
- **取值范围**：正整数（单位：天），最小 1，最大 365
- **默认值**：未配置时使用 `30` 天
- **读取位置**：`src/lib/cron/cleanup-dropped-tasks.ts`（或对应定时任务实现）
- **变更影响**：调整该值不会立即触发清理，需等待下次 cron 执行周期

## 11. API 响应规范（强制）

- **统一信封**：所有新增 API 必须使用 `src/lib/api-response.ts` 中的函数返回响应，禁止裸 `NextResponse.json({ ... })`
- **信封格式**：
  - 成功：`{ success: true, data: T }` 或 `{ success: true, data: T[], total: number }`
  - 失败：`{ success: false, error: { code: string, message: string } }`
- **工具函数**：
  - `successResponse(data, status?)` — 单个资源
  - `listResponse(data, total?)` — 列表
  - `createdResponse(data)` — 创建成功（201）
  - `errorResponse(message, status?, code?)` — 自定义错误
  - `badRequest(msg)` / `unauthorized(msg?)` / `forbidden(msg?)` / `notFound(msg?)` / `serverError(msg?)` — 常用快捷函数
- **鉴权层**：`requireAuth` / `requireAdmin` / `requirePermission` 已接入统一信封，鉴权失败自动返回 `{ success: false, error: { code, message } }`
- **中间件层**：`src/middleware.ts` 中 API 路由的 401 响应已接入统一信封
- **存量 API**：历史 API 暂不强制改造，但新增或修改 API 时必须使用统一信封
- **禁止**：新增 API 使用 `{ error: "..." }` 旧格式返回错误

## 12. 代码风格规范（强制）

### 12.1 ESLint 配置
- 项目使用 Next.js 内置 ESLint 配置（`next lint`）
- 检查命令：`npx next lint`
- 提交前必须确保 `npx next lint` 0 错误 0 警告
- 禁止使用 `eslint-disable` 绕过检查，如确需绕过需在注释中说明理由

### 12.2 TypeScript 规范
- 所有代码必须通过 `npx tsc --noEmit` 类型检查
- 禁止使用 `any` 类型，如确需使用需用 `unknown` 替代并做类型收窄
- 组件 Props 必须显式定义 interface 或 type
- API 请求/响应体必须定义 TypeScript 类型
- 禁止 `// @ts-ignore`，如确需忽略使用 `// @ts-expect-error` 并说明理由

### 12.3 命名规范
- 组件名：PascalCase（如 `UserList`）
- 变量/函数：camelCase（如 `getUserList`）
- 常量：UPPER_SNAKE_CASE（如 `MAX_RETRY_COUNT`）
- 类型/接口：PascalCase，接口不加 `I` 前缀
- 文件命名：组件用 PascalCase，工具函数用 kebab-case
- Hook：`use` 开头（如 `useAuth`）

### 12.4 导入规范
- 导入顺序：第三方库 → 内部绝对路径 → 相对路径
- 使用绝对路径导入（`@/lib/xxx`），避免深层相对路径（`../../xxx`）
- 禁止未使用的导入（`no-unused-vars`）
- React 17+ 无需导入 React（JSX 自动转换）

### 12.5 代码格式
- 使用 2 空格缩进
- 字符串使用单引号
- 语句末尾不加分号
- 尾随逗号：多行对象/数组最后一项加逗号
- 大括号风格：同一行（K&R 风格）
- 最大行长度：120 字符

## 13. 测试规范（强制）

### 13.1 测试类型
- **单元测试**：工具函数、Hooks、独立组件
- **集成测试**：API 路由、多组件交互
- **E2E 测试**：端到端功能验证（使用 `E2E` 前缀标记测试数据）

### 13.2 自测要求
- 每次迭代完成后必须进行自测，自测结果记录在 DEV_LOG.md
- 核心功能必须验证：登录、灵感创建、看板操作、AI 对话、权限校验
- 自测后必须清理测试数据（`npx tsx scripts/cleanup-e2e-data.ts`）
- 禁止遗留测试数据污染数据库

### 13.3 启动验证
- 每次完成任务后必须启动 dev server 验证（见 §1.7）
- 验证步骤：
  1. MySQL 运行检查
  2. dev server 启动（`npx next dev -p 5176`）
  3. HTTP 探测首页返回 200
  4. 检查控制台无致命错误
- 启动失败必须修复后再提交

### 13.4 数据清理规范
- 所有测试数据使用 `E2E` 或 `测试` 前缀
- E2E 测试必须在 `afterEach` 中清理创建的数据
- 手动测试数据用完立即删除
- 开发结束前运行清理脚本确认无脏数据

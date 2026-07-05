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
3. **端口固定原则**：本地开发服务固定端口 5176，禁止修改（与 `package.json` 的 `npm run dev` 一致，详见 service-runtime.md）。
4. **双远程提交原则**：每次迭代完成后必须自动提交并推送到 Gitee（`origin`）和 GitHub（`github`）两个远程仓库。GitHub 主仓库地址 `https://github.com/woaini737696/Lynx.git`，Gitee 镜像仓库 `https://gitee.com/shenzhens-emotions-are-booming_0/lynn-hub.git`。
5. **开发日志原则**：每次迭代必须更新 `DEV_LOG.md`，记录迭代号、任务、完成内容、commit hash。
6. **使用说明原则**：每个功能模块右上角必须有使用说明入口，新增模块需在规范文件中补充。
7. **测试数据清理原则**：自测后必须清理 E2E 看板测试数据，避免脏数据。
8. **账号保护原则**：严禁修改 lynn 账号（`lynn` / `ee9527ff`）的密码、角色、displayName、active 状态，除非用户在对话中明确指示。
9. **设计确认原则**：任务中遇到不确定/待澄清的点，优先弹窗向用户确认，不自行决策。

### 1.5 数据持久化规范

> 本规范为前端配置类数据持久化的强制标准，违反任意一条均视为不合格。

1. **数据库优先原则**：用户配置类数据（飞书机器人 webhook、AI 设置、通知设置、定时任务配置等）必须持久化到 MySQL 数据库，禁止仅依赖 localStorage 作为唯一存储。
2. **localStorage 仅作缓存**：localStorage 仅用于前端首屏渲染缓存（避免登录态闪烁），不能替代数据库存储。读取流程：先读 localStorage 缓存立即渲染 → fetch DB 最新数据 → 更新缓存。
3. **写入流程**：前端修改配置 → PUT 写入数据库 → 成功后同步更新 localStorage 缓存 → 失败回滚 UI 状态。
4. **敏感数据禁入 localStorage**：禁止在 localStorage 存储密码、AUTH_SECRET、第三方 API Key、用户 token 等敏感信息。
5. **旧键迁移**：旧版本若用 localStorage 存储配置，迭代时必须自动检测旧键、迁移到数据库、迁移成功后清除旧键，避免数据丢失。
6. **schema 变更**：新增配置字段时，必须同步更新 `prisma/schema.prisma` 并执行 `npx prisma db push` 同步数据库结构。

### 1.6 自测数据清理规范

> 本规范为开发自测与 e2e 测试数据清理的强制标准，违反任意一条均视为不合格。

1. **命名前缀约定**：自测创建的所有数据（Idea / Task / Memory / Cognition / Conversation / Skill 等）必须使用前缀 `E2E` / `E2E测试` / `测试灵感`，便于批量识别和清理。
2. **清理脚本**：自测完成后必须运行 `npx tsx scripts/cleanup-e2e-data.ts` 清理 `E2E*` 前缀数据，输出清理数量统计。
3. **e2e 用例清理**：所有 `e2e/*.spec.ts` 测试用例必须在 `afterEach` 钩子调用 `cleanupTestData(request, prefixes)` 清理本用例创建的数据，避免跨用例污染。
4. **部署前核查**：部署到生产服务器前，必须确认数据库无 `E2E*` 前缀的脏数据残留。
5. **保留数据例外**：lynn 账号及其真实业务数据不在清理范围内，禁止误删。
6. **localStorage 清理**：自测完成后清理本地 localStorage 中的测试缓存键（如 `lynx-test-*`、`e2e-*`），避免影响下次开发。

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

- **Web 端开发服务器**：`http://localhost:5176`（开发与生产一致，端口固定禁止修改）
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
npm run dev  # 默认 http://localhost:5176
```

---

## 三、迭代开发标准流程

每次功能迭代必须按以下步骤执行，缺一不可：

### 3.0 开发流程七条铁律（最高优先级，每次开发必须全部遵守）

> **此七条为开发流程的绝对红线，每次接到需求/任务时必须逐条对照执行，违反任意一条均视为本次开发不合格。**

| 编号 | 铁律 | 执行要点 | 违反后果 |
|------|------|----------|----------|
| **1** | **测试用例先行** | 收到需求或任务后，在编写任何实现代码之前，必须同步输出对应的测试用例和验收标准，覆盖正常流程、边界情况、异常分支 | 未输出测试用例即开始编码，视为不合格 |
| **2** | **逐条自测验收** | 每次完成开发时，必须根据步骤 1 输出的测试用例和验收标准逐条进行充分自测和验收评估，不得跳过任何一条 | 未逐条自测即提交，视为不合格 |
| **3** | **自动修复至发布标准** | 自测发现问题时必须自动修复，直到符合发布标准才能完成本次开发任务。发布标准 = 无 bug + 功能完整实现 + 所有流程正常跑通 + 无性能问题 | 存在已知问题即标记完成，视为不合格 |
| **4** | **Gitee 提交 + 开发日志** | 完成后代码必须提交到 Gitee 仓库（`origin master`），并在 `DEV_LOG.md` 保留本次迭代的开发日志说明（含任务、改动、测试用例、自测结果、commit hash） | 未提交或未写日志，视为本次迭代未完成 |
| **5** | **不确定即弹窗确认** | 接收到任务/需求时，有不清楚、不确定、未澄清的问题或细节，必须在本次任务中通过 `AskUserQuestion` 工具以弹窗形式与用户确定，完全澄清后才开始实现代码开发 | 擅自假设并实现，视为不合格 |
| **6** | **服务器零构建** | 代码部署阿里云服务器（47.119.185.135，2C2G）时，必须在本地构建好再部署，不允许在服务器执行任何构建和打包操作（`npm install`/`tsc`/`cargo build`/`pnpm install` 等全部禁止，详见第零章） | 在服务器构建导致 OOM 宕机，视为严重事故 |
| **7** | **清理临时文件** | 每次完成任务时必须清理干净无关文件、临时文件、无用文件、垃圾文件、重复代码，这些文件不允许提交到 Git 仓库和服务器 | 提交了临时/垃圾文件，视为不合格 |

**执行顺序**：收到需求 → 铁律 1（测试用例）→ 铁律 5（弹窗澄清）→ 代码实现 → 铁律 2（逐条自测）→ 铁律 3（修复至发布标准）→ 铁律 7（清理临时文件）→ 铁律 4（Gitee 提交 + 日志）→ 铁律 6（部署时本地构建）

### 3.0.1 开发质量八条原则（与七条铁律同级，每次开发必须全部遵守）

> **此八条为开发质量与交付标准的绝对红线，与七条铁律同级执行，违反任意一条均视为本次开发不合格。**

| 编号 | 原则 | 执行要点 | 违反后果 |
|------|------|----------|----------|
| **1** | **自测 bug 自动修复** | 自测找出来的 bug/问题，必须自动修复掉，不允许带着已知 bug 交付 | 存在未修复 bug 即标记完成，视为不合格 |
| **2** | **自动化测试流程** | 每次开始开发前输出测试用例和验收标准，完成开发后进行详细测试，完全通过测试后才可以完成交付。测试用例覆盖正常流程、边界情况、异常分支 | 未输出测试用例或未通过即交付，视为不合格 |
| **3** | **下一步迭代建议** | 每次完成交付后，必须给出详细的下一步迭代建议，分成 P0（必须）/P1（重要）/P2（可选）三阶段，明确优先级和实施方向 | 未给出迭代建议，视为交付不完整 |
| **4** | **架构师维度分析** | 站在架构师角度分析代码健壮性、日后扩展性、快速迭代性、性能体验等几个维度来分析全局技术架构是否符合标准，不符合标准给出优化建议 | 未做架构分析或发现风险未提示，视为不合格 |
| **5** | **任务后清理** | 每次完成任务后都需要清理无效文件、临时文件、无关文件、冗余代码，确保仓库干净 | 遗留临时文件或冗余代码，视为不合格 |
| **6** | **代码编写原则** | 能少写就不多写，能用简单的方案实现就不能做复杂，能共用的组件/代码就绝不重复写（DRY 原则）。禁止过度设计、禁止预演未来需求、禁止一次性代码抽象 | 代码冗余或过度设计，视为不合格 |
| **7** | **不确定即弹窗确认** | 对需求不理解、对任务不清晰、遇到不确定的、觉得不对劲的、觉得需求有问题/缺陷/漏洞的、发现本次任务以外的代码/功能/逻辑/需求有问题的，都必须要弹窗和用户确认，用户确认后再开始实现 | 擅自假设并实现，视为不合格 |
| **8** | **弹窗推荐方案** | 每次弹窗和用户确认任何事情，都需要给出最推荐的方案，并且说明推荐理由和原因（不允许只列选项不给推荐） | 弹窗未给推荐方案或未说明理由，视为不合格 |

**八条原则执行时机**：
- 开发前：原则 2（测试用例）+ 原则 7（弹窗确认）+ 原则 8（推荐方案）
- 开发中：原则 6（代码简洁）+ 原则 7（发现疑问即弹窗）
- 开发后：原则 1（自动修复）+ 原则 2（详细测试）+ 原则 5（清理）
- 交付时：原则 3（迭代建议）+ 原则 4（架构分析）

### 步骤 0：测试用例与验收标准（强制，先于一切）

> **核心原则**：收到需求后，在编写任何实现代码之前，必须先输出本次任务的测试用例和验收标准。未输出测试用例即开始编码视为不合格。

1. **同步输出测试用例**：收到需求或任务后，立即根据需求梳理出可验证的测试用例清单，覆盖正常流程、边界情况、异常分支。
2. **明确验收标准**：每条测试用例配套明确的验收标准（预期行为、成功条件），与用户确认无误后再进入实现阶段。
3. **测试用例文档位置**：本次迭代的测试用例写入 `DEV_LOG.md` 对应迭代章节的"测试用例与验收标准"小节，便于开发完成后逐条对照自测。

### 步骤 1：需求确认

- 任务模糊或涉及多端时，必须用 `AskUserQuestion` 工具弹窗向用户确认。
- 涉及 UI 设计时，遵循 iOS26 液态玻璃规范，浅色为主色调。
- **禁止擅自完成任务**：未完成所有任务前，不允许擅自标记任务完成或跳过任务；每个设计方案必须通过弹窗与用户确认后才能开始实现，不允许在文字中推荐后直接推进。
- **不确定即问**：接收到任务/需求时，有不清楚、不确定、未澄清的问题或细节，必须在本次任务中弹窗形式和用户确定，完全澄清确定后才开始实现代码开发。

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

# 本地启动开发服务器，端口 5176
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
└── downloads/           # 仅放 Android APK + HermesAgent whl，不放桌面端 exe
```

> **桌面端安装包固定目录**：`d:\Lynn安装包\奇思_{version}.exe`（按规格第十七章），**不上传服务器**，验证通过后仅更新 Gitee Release 下载链接。

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
  - `/opt/lynx/downloads/` — 仅 HermesAgent whl + latest.json，**禁止放桌面端安装包**（服务器空间有限）
  - `/opt/lynx/logs/` — PM2 日志
  - `/opt/lynx/backup/` — 数据库备份（仅保留最近 3 天，app 备份用完即删）

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

### 步骤 6.5：缺陷修复循环（强制，未达标不得完成）

> **核心原则**：发现问题时必须自动修复，直到符合发布标准才能完成本次开发任务。禁止带 bug 交付。

1. **对照自测**：根据步骤 0 输出的测试用例和验收标准，逐条自测每项功能。
2. **发现即修**：自测中发现任何不符合验收标准的问题（bug、功能缺失、流程跑不通、性能问题），必须立即修复后重新自测，循环直到全部通过。
3. **发布标准**（全部满足方可标记任务完成）：
   - 无 bug（已知缺陷全部修复）
   - 功能完整实现（需求中每一项均已落地）
   - 所有流程正常跑通（端到端链路无断裂）
   - 无性能问题（页面加载、API 响应在可接受范围内）
4. **未达标禁止收尾**：任一条不满足时，不得提交代码、不得更新 DEV_LOG 为"已完成"、不得向用户汇报"完成"。
5. **无法修复时**：如遇客观条件限制无法当场修复（如需第三方配合），必须在 DEV_LOG 中明确标注未解决项及原因，并弹窗告知用户获得确认后方可暂挂。

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

### 步骤 10：清理临时文件、无用文件、无用进程（必须执行）

每次完成开发任务后，必须执行以下清理操作，确保开发工具不会因垃圾文件累积而越来越卡顿：

```powershell
# 1. 清理桌面端 Rust 编译缓存（每次打包后必须执行）
cargo clean --manifest-path desktop-native\src-tauri\Cargo.toml

# 2. 清理 hermes-agent-pkg 构建产物
Remove-Item -Path "desktop-native\hermes-agent-pkg\dist" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "desktop-native\hermes-agent-pkg\build" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "desktop-native\hermes-agent-pkg\*.egg-info" -Recurse -Force -ErrorAction SilentlyContinue

# 3. 清理系统临时目录中的 HermesAgent 安装文件
Remove-Item -Path "$env:TEMP\lynnhub-hermes-install" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$env:TEMP\hermes_local_run" -Recurse -Force -ErrorAction SilentlyContinue

# 4. 清理打包临时文件
Remove-Item -Path "D:\LynnHub\Temp\lynx-standalone.tar.gz" -Force -ErrorAction SilentlyContinue

# 5. 清理 Next.js 构建缓存（仅在需要释放空间时执行）
# Remove-Item -Path ".next\cache" -Recurse -Force -ErrorAction SilentlyContinue

# 6. 运行 Trae Solo 缓存清理脚本（深度清理）
# powershell -ExecutionPolicy Bypass -File scripts\clean-trae-cache.ps1
```

**清理规范要点**：
- 每次迭代完成后**必须执行**清理，不允许跳过
- 桌面端打包后必须执行 `cargo clean`，防止 cargo-target 目录累积超过 10GB
- hermes-agent-pkg 打包后必须清理 dist/build/*.egg-info 目录
- 系统临时目录中的安装文件必须清理
- 清理完成后确认无残留的临时进程（如 hermes dashboard 子进程）
- 每周执行一次 `scripts\clean-trae-cache.ps1` 深度清理（需关闭 Trae Solo 后执行）

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
- **产物**：原始 `D:\cargo-target-native\release\bundle\nsis\*setup.exe`，构建后由 `build.ps1` 自动重命名并复制到固定目录 `d:\Lynn安装包\奇思_{version}.exe`
- **安装包固定目录**：`d:\Lynn安装包\`（D 盘，与项目代码分离，便于管理所有版本）
- **命名规则**：`奇思_版本号.exe`（如 `奇思_1.0.34.exe`），每次客户端代码改动版本号 +0.01
- **不上传服务器**：安装包仅在本地验证，验证通过后更新 Gitee Release 下载链接，**禁止上传到 `/opt/lynx/downloads/`**（服务器空间有限）
- **构建后清理**：`build.ps1` 第 7 步自动执行 `cargo clean`，防止 `cargo-target-native` 目录膨胀超过 10GB

---

## 十、安卓端构建规范

- 在本地构建 APK，不上传服务器
- 桌面端和安卓端均通过 HTTPS 连接云端 API（`https://ai.lynxdo.com`）
- HermesAgent 能力保留在桌面端/安卓端本地运行，数据从云端读取

### 10.1 安卓端自测规范（强制，每次迭代必须遵守）

> **核心原则**：未通过模拟器自测 + 回归测试的 APK，禁止安装到用户手机验收。

#### 自测流程（每次安卓端代码变更后必须执行）

1. **编译验证**：`.\gradlew.bat :app:compileDebugKotlin` 必须无错误
2. **构建 APK**：`.\gradlew.bat :app:assembleDebug` 必须成功
3. **启动模拟器自测**（必须，不可跳过）：
   - 启动 AVD 模拟器：`emulator -avd <avd_name> -no-snapshot-load`（推荐使用 API 34）
   - 安装 APK 到模拟器：`adb -e install -r app-debug.apk`
   - 启动 App，逐项验证本次迭代修改的功能点（无崩溃、无 ANR、功能正常）
4. **回归测试**（必须，不可跳过）：
   - 启动 App，遍历核心页面（首页/记忆/任务/助理/设置）确保无崩溃
   - 验证本次修改未破坏已有功能：
     - 登录流程正常
     - 首页 Tab 切换正常
     - 语音通话可进入（不崩溃）
     - 记忆页面列表加载正常
     - 设置页面各入口可点击
   - 如有特定功能依赖真机（如麦克风录音、相机），在模拟器验证不崩溃后，可标注"待真机验证"
5. **自测通过后才允许安装到用户手机**：
   - `adb -d install -r app-debug.apk`（`-d` 指定真机设备）
   - 如模拟器自测发现 bug，必须修复后重新执行步骤 1-4，不得带 bug 安装到用户手机
6. **自测结果记录**：在 DEV_LOG.md 对应迭代章节的"自测结果"小节，记录模拟器自测和回归测试的通过情况

#### AVD 模拟器配置建议

- AVD 名称：`lynx_test_api34`
- API Level：34（与 targetSdk 一致）
- 分辨率：1080×2400（主流手机尺寸）
- 启动命令：`emulator -avd lynx_test_api34 -no-snapshot-load -no-boot-anim`

#### 例外情况

- 仅修改注释、格式化等不影响功能的变更，可跳过模拟器自测，但仍需编译验证
- 模拟器无法启动时，必须在 DEV_LOG 中标注原因，并加快修复模拟器环境

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

- [ ] **测试用例已输出**（步骤 0：开发前已梳理测试用例和验收标准）
- [ ] **测试用例全部通过**（步骤 6.5：逐条对照自测，缺陷已修复循环）
- [ ] TypeScript 类型检查通过（`npx tsc --noEmit`）
- [ ] 本地开发服务器启动正常（端口 5176）
- [ ] 涉及的 UI 页面在浏览器中功能正常
- [ ] 桌面端构建成功（如涉及）
- [ ] 部署产物已构建（`build.ps1`）
- [ ] 已部署到阿里云服务器（如涉及服务端变更）
- [ ] 部署后自测通过（官网 + Web 应用 + API）
- [ ] 测试数据已清理
- [ ] `DEV_LOG.md` 已更新（含测试用例与自测结果记录）
- [ ] 代码已提交并推送到 Gitee
- [ ] 涉及的弹窗均能正常显示（z-index、居中、不溢出）
- [ ] 涉及的 logo/图标均能正常加载
- [ ] **临时/无用文件已清理**（cargo target、构建产物副本、__pycache__ 等）

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

## 十七、Trae Solo 性能维护规范（2026-06-30 新增）

> **此章节为 Trae Solo 长期流畅使用的强制规范。** 2026-06-30 曾因连续开发一周未清理，导致 70GB+ 缓存堆积（Trae snapshot 16.7GB + Rust编译缓存 10GB + 临时构建副本 21GB + Windows系统垃圾 11GB），Trae Solo 主进程占用 1.6GB 内存，越用越卡。

### 17.1 每次迭代完成后必须执行的清理（强制）

每次完成迭代并提交 Gitee 后，**必须**运行清理脚本：

```powershell
# 方法1：一键清理（推荐，关闭 Trae Solo 后运行效果最佳）
powershell -ExecutionPolicy Bypass -File d:\Lynn工作空间\LynnHub\scripts\clean-trae-cache.ps1

# 方法2：预览模式（只看不删，先确认）
powershell -ExecutionPolicy Bypass -File d:\Lynn工作空间\LynnHub\scripts\clean-trae-cache.ps1 -DryRun
```

清理脚本会安全清理以下内容（均为可再生缓存，不触碰代码/数据库/配置）：

| 清理项 | 说明 | 重新生成方式 |
|---|---|---|
| Trae `ai-agent\snapshot` | AI对话代码快照（最大元凶） | 下次AI对话自动生成 |
| Trae `ai-agent\vm\tools` | 虚拟机工具 | 重新下载 |
| Trae `logs` / `Partitions` / `Cache` | 日志和WebView缓存 | 自动重建 |
| `.next` | Next.js构建缓存 | `npm run build` 重新生成 |
| `cargo-target*`（5个目录） | Rust编译缓存 | `npx tauri build` 重新生成 |
| `.lynnhub` / `Temp` / `tmp` | 运行时临时文件 | 自动重建 |
| Windows 回收站 / Temp | 系统垃圾 | 不需要 |
| `~\.cargo\registry` | Rust包缓存 | `cargo build` 重新下载 |

### 17.2 桌面端构建后的必须清理

每次 `npx tauri build` 完成后，Rust 编译缓存会膨胀到 7-9GB。**必须**执行：

```powershell
# 清理 Rust 编译缓存（不影响已生成的安装包）
cd d:\Lynn工作空间\LynnHub\desktop-native\src-tauri
$env:CARGO_TARGET_DIR = 'D:\cargo-target-native'; cargo clean
```

### 17.3 禁止在项目内创建临时副本（强制）

| 禁止操作 | 原因 | 正确做法 |
|---|---|---|
| 复制整个项目到 `temp-*` 目录 | 产生 20GB+ 重复文件 | 直接在原目录构建 |
| 在 D 盘根目录创建 `cargo-target-*` 多份 | 每份 2-7GB 冗余 | 统一用 `CARGO_TARGET_DIR` 环境变量 |
| 手动 `cp -r` 项目做备份 | git 已有完整历史 | 用 `git branch` 或 `git stash` |

### 17.4 Trae Solo 文件监视排除配置（必须手动设置）

由于 Trae 安全策略限制，`.vscode/settings.json` 需要手动配置。打开 Trae Solo → `Ctrl+Shift+P` → "Preferences: Open Settings (JSON)"，添加：

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

### 17.5 每周深度清理（建议）

每周五下班前或感觉卡顿时：
1. 关闭 Trae Solo
2. 运行 `scripts\clean-trae-cache.ps1`
3. 用 Windows 磁盘清理工具清理 `$WINDOWS.~TMP`（Trae 安全策略限制脚本无法删除）
4. 重启电脑或重新打开 Trae Solo

### 17.6 Trae Solo 卡顿排查清单

| 现象 | 排查方向 |
|---|---|
| Trae Solo 主进程 >1GB 内存 | 运行清理脚本，重启 Trae |
| 文件搜索/替换很慢 | 检查 watcherExclude 配置是否生效 |
| TypeScript 智能提示卡顿 | tsserver 内存不足，检查 maxTsServerMemory |
| 磁盘空间不足 | 运行 `clean-trae-cache.ps1 -DryRun` 预览可清理空间 |
| git 操作很慢 | `.git` 目录过大，运行 `git gc --aggressive` |
| Trae 启动很慢 | snapshot 目录过大（可达 16GB+），关闭 Trae 后清理 |

---

**本规范自 2026-06-29 起执行，所有后续迭代必须严格遵守。**

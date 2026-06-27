# Lynx 原生桌面端一级页面与核心功能原生 UI 重构设计文档

> 日期：2026-06-28
> 迭代：48（设计文档）
> 方向：方案一-A — React 原生 SPA + Tauri Rust 命令桥接

---

## 1. 背景与目标

### 1.1 现状问题

当前 `desktop-native` 安装后打开仍是内嵌 Web 端：

- 启动页检测本地服务成功后，通过 `navigate_to_url` 跳转到 `http://localhost:5176` 或云端 `https://app.lynnhub.com`，加载完整 Next.js 应用。
- 用户体验与浏览器打开 Web 端几乎一致，缺少豆包/Kimi 级原生桌面客户端的启动速度、离线能力、本地系统集成和窗口级交互。
- 前端直接通过 `fetch('/api/*')` 访问网络，token 与业务逻辑暴露在 WebView 运行环境。

### 1.2 目标

将 Lynx 桌面端重构为「豆包/Kimi 级原生桌面客户端」：

1. **一级页面原生化**：今日聚焦、决策看板、AI 工作空间、AI 专属助理四个一级入口改为原生 React SPA 页面。
2. **全局功能原生化**：标题栏、侧边导航、全局搜索、用户菜单、托盘、全局快捷键、主题切换全部走原生实现。
3. **云端数据拉取**：业务数据统一通过 Tauri Rust 命令桥接云端 API，前端不直接请求公网。
4. **本地能力集成**：HermesAgent 一键本地部署、状态监控、RPA、文件/Shell 操作通过已有 Rust 命令直接调用。
5. **渐进式过渡**：未重构页面（设置、管理、复杂表单）先以 WebView 嵌入 Web 端作为过渡，避免一次性全量重写。

---

## 2. 架构设计

### 2.1 总体架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Lynx 原生桌面端                              │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  Tauri 2.x Rust 后端（常驻进程）                                 │  │
│  │  • 窗口管理 / 托盘 / 全局快捷键                                  │  │
│  │  • 云端 API 代理（cloud_get / cloud_post / cloud_delete）        │  │
│  │  • 本地 HermesAgent 安装/启动/状态                               │  │
│  │  • RPA / 文件 / Shell / 浏览器自动化                             │  │
│  │  • Token 管理与本地安全存储                                      │  │
│  └────────────────────────────┬──────────────────────────────────┘  │
│                               │ invoke / emit                        │
│  ┌────────────────────────────▼──────────────────────────────────┐  │
│  │  原生 SPA（React + Tailwind + shadcn/ui）                        │  │
│  │  • 全局布局：TitleBar / Sidebar / UserMenu / QuickSearch         │  │
│  │  • 一级页面：Focus / Board / AI Workspace / AI Assistant         │  │
│  │  • 本地能力面板：HermesAgent 状态/部署/日志                      │  │
│  │  • 未重构页面 fallback：WebView 嵌入 Web 端                     │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               ▼ HTTPS / WebSocket
                    ┌──────────────────────┐
                    │   app.lynnhub.com    │
                    │   (Next.js + API)    │
                    └──────────────────────┘
```

### 2.2 与现有 desktop-native 的关系

- 保留 `desktop-native/src-tauri/` Rust 后端，扩展云端代理命令。
- 新增 `desktop-native/native-ui/` 目录作为原生 SPA 源码，最终构建产物输出到 `desktop-native/out/app/`。
- 启动页 `desktop-native/out/index.html` 改为直接加载 `out/app/index.html`，不再跳转本地 `localhost:5176`。
- 开发阶段仍可通过 `npm run dev` 启动 Vite 开发服务器供原生 SPA 热更新，Tauri 壳指向该 dev server。

---

## 3. 技术选型

| 层级 | 选型 | 理由 |
|------|------|------|
| 原生壳 | Tauri 2.x（已有） | 已验证稳定，支持 Rust 后端、托盘、全局快捷键、自动更新。 |
| 原生 UI 框架 | React 18 + TypeScript | 复用现有 Next.js 组件与业务逻辑，团队熟悉。 |
| 样式 | Tailwind CSS + shadcn/ui | 现有设计系统（颜色变量、组件、图标）直接迁移。 |
| 构建工具 | Vite 5 | 比 Next.js 更适合纯 SPA 桌面端，启动快、HMR 快、产物简洁。 |
| 路由 | React Router v6 | 原生 SPA 路由，支持嵌套路由、懒加载、路由守卫。 |
| 状态管理 | Zustand + React Query (TanStack Query) | Zustand 管理 UI/用户状态；React Query 管理服务端状态与缓存。 |
| Tauri 桥接 | `@tauri-apps/api` v2 | 调用 Rust 命令和监听事件。 |
| 类型共享 | 独立 `types/` + JSON Schema | 前后端约定 API 数据结构。 |

### 3.1 不选 Next.js 的原因

- Next.js 的 SSR/SSG/RSC 在桌面端无意义，反而增加打包体积和复杂度。
- Next.js 需要服务端运行时，与「原生桌面端、数据走云端」目标冲突。
- Vite 构建的纯 SPA 更适合 Tauri `frontendDist` 静态资源模式。

---

## 4. 目录结构

```
desktop-native/
├── src-tauri/                 # Tauri Rust 后端（已有，扩展）
│   ├── src/
│   │   ├── lib.rs             # 命令注册、状态、托盘、快捷键
│   │   ├── cloud.rs           # 云端 API 代理（新增）
│   │   ├── auth.rs            # token 管理（扩展）
│   │   ├── hermes/            # HermesAgent 路由/执行/安装（已有）
│   │   ├── rpa/               # RPA 能力（已有）
│   │   └── ws_client.rs       # 云端 WebSocket 客户端（已有）
│   ├── capabilities/default.json
│   └── tauri.conf.json
├── native-ui/                 # 原生 SPA 源码（新增）
│   ├── index.html
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── tailwind.config.ts
│   ├── src/
│   │   ├── main.tsx           # 应用入口
│   │   ├── App.tsx            # 路由与全局布局
│   │   ├── lib/
│   │   │   ├── tauri.ts       # invoke / listen 封装
│   │   │   ├── cloud-api.ts   # 云端 API 调用层
│   │   │   ├── theme.ts       # 主题管理
│   │   │   └── utils.ts
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── TitleBar.tsx
│   │   │   │   ├── Sidebar.tsx
│   │   │   │   ├── UserMenu.tsx
│   │   │   │   ├── QuickSearch.tsx
│   │   │   │   └── AppLayout.tsx
│   │   │   ├── ui/            # shadcn/ui 组件副本/适配
│   │   │   └── hermes/
│   │   │       ├── AgentStatusCard.tsx
│   │   │       ├── InstallButton.tsx
│   │   │       └── AgentLogPanel.tsx
│   │   ├── pages/
│   │   │   ├── FocusPage.tsx
│   │   │   ├── BoardPage.tsx
│   │   │   ├── AIWorkspacePage.tsx
│   │   │   ├── AIAssistantPage.tsx
│   │   │   └── WebFallbackPage.tsx
│   │   ├── hooks/
│   │   │   ├── useCloudQuery.ts
│   │   │   ├── useAgent.ts
│   │   │   └── useTheme.ts
│   │   ├── stores/
│   │   │   ├── authStore.ts
│   │   │   ├── uiStore.ts
│   │   │   └── agentStore.ts
│   │   └── types/
│   │       ├── api.ts
│   │       └── agent.ts
│   └── public/
│       └── lynx-logo-black.png
├── out/
│   ├── index.html             # 启动页（改造后）
│   └── app/                   # 原生 SPA 构建产物
├── build-native.ps1           # 完整构建脚本
└── installer.nsi              # NSIS 安装脚本
```

---

## 5. 全局布局设计

### 5.1 窗口规格

- 尺寸：1280×800（居中），与 Trae Solo 一致。
- 最小尺寸：1000×640。
- 无边框窗口 + 自定义标题栏（`decorations: false`）。
- 关闭按钮最小化到托盘，托盘双击/右键「显示主窗口」恢复。
- 全局快捷键 `Ctrl+Shift+L` 唤起/隐藏窗口。

### 5.2 标题栏（TitleBar）

- 左侧：黑底白色猞猁高清 logo（`lynx-logo-black.png`）+「Lynx」文字。
- 中间：可拖拽区域（`data-tauri-drag-region`），双击最大化/还原。
- 右侧：最小化 / 最大化 / 关闭按钮，调用 Tauri 窗口控制命令。
- 右上角使用说明按钮（符合项目规范「每个功能模块使用说明在右上角」）。

### 5.3 侧边导航（Sidebar）

- 宽度 64px（图标模式）或 220px（展开模式），可切换折叠。
- 一级入口：今日聚焦、决策看板、AI 工作空间、AI 专属助理。
- 二级分组：灵感收集、知识资产、系统（点击后 WebView fallback）。
- 底部：HermesAgent 状态指示灯 + 用户头像菜单。

### 5.4 全局搜索（QuickSearch）

- `Ctrl+K` / `Cmd+K` 唤起命令面板。
- 支持：跳转页面、搜索任务/灵感/技能、触发 HermesAgent 快捷指令。

### 5.5 主题

- 支持 light / dark / system，与 Web 端 next-themes 变量保持一致。
- Rust 侧监听系统主题变化并下发事件，前端响应切换。

---

## 6. 一级页面设计

### 6.1 今日聚焦（FocusPage）

**功能**：展示今日聚焦列表，标记完成/取消，查看 AI 建议。

**数据来源**：`cloud_get('/api/focus')`

**关键 UI**：

- 顶部日期与进度环。
- 聚焦卡片列表，支持点击完成。
- 空状态引导创建。

**复用点**：迁移 `src/app/page.tsx` 中 FocusItem 渲染与 toggleComplete 逻辑。

### 6.2 决策看板（BoardPage）

**功能**：三列看板（northstar / campaign / task），新增/移动/完成任务，查看已完成任务。

**数据来源**：`cloud_get('/api/tasks')`、`cloud_post('/api/tasks')`、`cloud_patch('/api/tasks/:id')`

**关键 UI**：

- 三列拖拽看板（使用 `@dnd-kit`）。
- 顶部统计：累计完成、进行中、本周完成。
- 认知提取弹窗（完成任务时弹出）。

**复用点**：迁移 `src/app/board/page.tsx` 中列定义、任务卡片、认知弹窗逻辑。

### 6.3 AI 工作空间（AIWorkspacePage）

**功能**：展示 AI 工作空间模板，快速创建/运行蒸馏任务。

**数据来源**：`cloud_get('/api/ai/workspace')`、`cloud_post('/api/ai/flows/:id/execute')`

**关键 UI**：

- 模板卡片网格，按分类过滤。
- 最近使用/收藏。
- 一键运行按钮。

**复用点**：迁移 `src/app/ai/workspace/page.tsx` 中模板列表与分类过滤。

### 6.4 AI 专属助理（AIAssistantPage）

**功能**：原生 AI 聊天界面，支持文本输入、历史会话、快捷指令。

**数据来源**：`cloud_post('/api/ai/chat')`（SSE 流式输出）

**关键 UI**：

- 左侧会话列表。
- 中间消息气泡（用户/AI）。
- 底部输入框 + 快捷指令面板。
- 支持调用 HermesAgent 本地能力（截图、打开应用、文件操作）。

**复用点**：迁移现有 AI 聊天组件消息渲染与 SSE 处理逻辑。

---

## 7. 数据流程设计

### 7.1 云端 API 桥接

Rust 侧新增统一云端代理命令：

```rust
#[tauri::command]
async fn cloud_request(
    state: tauri::State<'_, Arc<AppState>>,
    method: String,
    path: String,
    body: Option<serde_json::Value>,
) -> Result<serde_json::Value, String> {
    let cloud = state.cloud_endpoint.lock().map_err(|e| e.to_string())?.clone();
    let token = state.user_token.lock().map_err(|e| e.to_string())?.clone()
        .ok_or("未登录")?;

    let client = reqwest::Client::new();
    let url = format!("{}{}", cloud, path);

    let mut req = match method.to_uppercase().as_str() {
        "GET" => client.get(&url),
        "POST" => client.post(&url).json(&body.unwrap_or_default()),
        "PATCH" => client.patch(&url).json(&body.unwrap_or_default()),
        "DELETE" => client.delete(&url),
        _ => return Err("不支持的 HTTP 方法".to_string()),
    };

    req = req.header("Authorization", format!("Bearer {}", token));

    let res = req.send().await.map_err(|e| e.to_string())?;
    let status = res.status();
    let data = res.json::<serde_json::Value>().await.unwrap_or_default();

    Ok(serde_json::json!({ "status": status.as_u16(), "data": data }))
}
```

前端封装：

```ts
// lib/cloud-api.ts
export async function cloudGet<T>(path: string): Promise<T> {
  const res = await invoke('cloud_request', { method: 'GET', path, body: null });
  if (res.status >= 400) throw new Error(res.data?.message || '请求失败');
  return res.data;
}
```

### 7.2 认证流程

1. 首次启动或 token 过期时，原生 SPA 显示登录页（或 WebView 嵌入 `/login`）。
2. 登录成功后，通过 `set_user_token` 命令将 token 写入 Rust AppState。
3. Rust 侧将 token 持久化到系统 keyring（Windows Credential / macOS Keychain）。
4. 后续启动从 keyring 读取 token，自动登录。

### 7.3 离线状态

- 原生 SPA 监听 Rust 下发的 `network-status` 事件。
- 离线时：
  - 只读展示本地缓存数据（React Query cache + IndexedDB）。
  - 写操作按钮禁用并提示「离线模式，连接后同步」。

---

## 8. 本地能力集成

### 8.1 HermesAgent 面板

全局固定在 Sidebar 底部或作为独立浮窗：

- **状态显示**：在线/离线/安装中/未安装。
- **一键安装**：调用 `install_ai_env`。
- **一键启动**：调用 `start_hermes_agent`。
- **日志输出**：监听 `hermes-log` 事件实时展示。
- **紧急停止**：托盘或全局按钮触发 `emergency_stop`。

### 8.2 AI 助理调用本地能力

在 AIAssistantPage 中，用户消息经 Rust `execute_assistant_command` 路由：

- 云端操作 → 由 Rust 转发到 `app.lynnhub.com`。
- 本地操作 → 由 Rust 调用 RPA / 文件 / Shell 执行器。
- 执行过程和结果通过事件流返回前端展示。

---

## 9. 未重构页面过渡方案

对于设置、管理、复杂表单等暂未重构页面：

1. 在原生 SPA 路由中注册 `/settings/*`、`/admin/*` 等路径。
2. 这些路由渲染 `WebFallbackPage`，内部使用 Tauri Webview 标签或 iframe 加载云端 `https://app.lynnhub.com/settings/*`。
3. WebFallbackPage 顶部显示「返回原生界面」按钮。
4. 过渡期间，这些页面仍使用 Web 端 Next.js 实现，数据直接走云端。

> 注意：Tauri v2 中直接嵌入外部 WebView 需要 `remote.urls` 权限，已在 `capabilities/default.json` 中配置。

---

## 10. 构建与开发流程

### 10.1 开发模式

```powershell
# 终端 1：启动原生 SPA 开发服务器
cd desktop-native/native-ui
npm run dev          # Vite dev server，端口 5177

# 终端 2：启动 Tauri 开发模式（指向 native-ui dev server）
cd desktop-native
npm run tauri dev
```

### 10.2 生产构建

更新 `build-native.ps1`：

1. 运行 `scripts/generate-desktop-native-assets.py` 生成图标。
2. 进入 `native-ui/`，执行 `npm run build`，产物输出到 `desktop-native/out/app/`。
3. 执行 Tauri release build，生成 `lynnhub-desktop-native.exe`。
4. 执行 NSIS 打包生成 `dist/Lynx-Setup-1.2.0.exe`。

### 10.3 配置变更

- `tauri.conf.json`：`frontendDist` 从 `../out` 改为 `../out/app`；`devUrl` 改为 `http://localhost:5177`。
- 启动页 `out/index.html`：删除本地服务检测逻辑，直接 `window.location.href = './app/index.html'`。

---

## 11. 安全与隐私

1. **Token 不留在 WebView**：用户 token 只存在于 Rust AppState 和系统 keyring，前端通过 invoke 间接访问云端。
2. **HTTPS 强制**：生产环境 cloud_endpoint 固定为 `https://app.lynnhub.com`，不允许明文 HTTP。
3. **本地操作授权**：HermesAgent / RPA / Shell 执行保留现有授权模式（approve / once / free）。
4. **CORS 隔离**：原生 SPA 不再依赖浏览器 CORS，Rust 后端作为唯一出口。

---

## 12. 风险与回滚

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 现有 Web 端组件依赖 Next.js 特性（如 `usePathname`、`next/navigation`） | 中 | 迁移时替换为 React Router API；复杂组件先在 WebFallback 中保留。 |
| 原生 SPA 与 Web 端主题/样式不一致 | 中 | 统一 Tailwind 变量和 shadcn/ui 组件；制定「桌面端 Design Token」。 |
| Rust 云端代理增加请求延迟 | 低 | 本地缓存 + React Query；关键路径可配置直连（开发模式）。 |
| 构建流程变复杂 | 低 | 更新 `build-native.ps1` 一键脚本，CI 自动化。 |
| 用户不接受过渡方案 | 中 | 先交付 4 个一级页面完整体验，再按优先级替换剩余页面。 |

**回滚方案**：保留原 `out/index.html` 跳转逻辑备份；若原生 SPA 存在严重问题，可通过配置文件或构建参数切回 Web 端模式。

---

## 13. 迭代计划

### 迭代 48（当前）

- 完成本设计文档并通过评审。
- 初始化 `desktop-native/native-ui/` 工程（Vite + React + Tailwind + shadcn/ui）。

### 迭代 49

- 实现全局布局：TitleBar、Sidebar、UserMenu、QuickSearch、AppLayout。
- 实现主题管理与 Tauri 桥接封装。
- 实现 Rust 云端代理命令 `cloud_request`。

### 迭代 50

- 实现今日聚焦页面（FocusPage）。
- 实现决策看板页面（BoardPage）。

### 迭代 51

- 实现 AI 工作空间页面（AIWorkspacePage）。
- 实现 AI 专属助理页面（AIAssistantPage）基础聊天。

### 迭代 52

- 集成 HermesAgent 状态面板与一键部署。
- 实现 WebFallbackPage 过渡机制。
- 更新构建脚本与安装包流程。
- 端到端测试与 Bug 修复。

---

## 14. 待确认事项

以下事项需要用户确认或后续细化：

1. 登录流程：是否直接嵌入现有 `/login` Web 页面，还是单独做原生登录页？
2. AI 聊天 SSE：Rust 侧是否统一代理 SSE 流，还是前端通过 Tauri HTTP 插件直连云端？
3. 通知：原生桌面通知是否通过 Tauri 通知插件实现，还是沿用 Web 端通知？
4. 数据离线缓存：是否需要 IndexedDB 持久化，还是仅依赖 React Query 内存缓存？

---

## 15. 参考文件

- `desktop-native/src-tauri/src/lib.rs`
- `desktop-native/src-tauri/src/hermes/router.rs`
- `desktop-native/src-tauri/tauri.conf.json`
- `desktop-native/out/index.html`
- `src/app/page.tsx`
- `src/app/board/page.tsx`
- `src/app/ai/workspace/page.tsx`
- `src/components/layout/TitleBar.tsx`
- `src/components/layout/Sidebar.tsx`

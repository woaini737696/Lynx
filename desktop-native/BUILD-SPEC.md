# 奇思桌面端构建规范（必读）

> 本规范为桌面端开发强制标准，每次开发完成后必须严格按此流程执行构建、编译、打包。违反规范的构建结果不得交付。

---

## 一、目录结构约定

```
desktop-native/
├── native-ui/                 # React + Vite 前端（TypeScript）
│   ├── src/
│   │   ├── pages/             # 路由页面
│   │   ├── components/        # 复用组件
│   │   ├── lib/               # 工具库（cloudApi、tauri、toast 等）
│   │   ├── stores/            # zustand 状态管理
│   │   └── types/             # 类型定义
│   └── tsconfig.json
├── src-tauri/                 # Rust + Tauri 后端
│   ├── src/
│   │   ├── hermes/            # HermesAgent 路由与执行
│   │   ├── rpa/               # 本地 RPA 能力（浏览器/桌面/文件/Shell）
│   │   ├── auth.rs
│   │   ├── installer.rs
│   │   ├── lib.rs
│   │   └── ws_client.rs
│   ├── Cargo.toml
│   ├── build.rs               # 读取 frontendDist 编译前端资源
│   └── tauri.conf.json
├── assets/                    # NSIS 安装包素材
├── installer.nsi              # NSIS 安装脚本
├── build-native.ps1           # 一键构建脚本（参考用，建议手动分步执行）
└── BUILD-SPEC.md              # 本文件
```

---

## 二、构建前置条件

| 依赖 | 版本 | 说明 |
|------|------|------|
| Node.js | ≥ 18 | 前端构建 |
| Rust (MSVC) | stable-x86_64-pc-windows-msvc | **禁止使用 GNU 工具链** |
| NSIS | tauri 自带版 | 路径：`%LOCALAPPDATA%\tauri\NSIS\makensis.exe` |
| Python | ≥ 3.10 | 生成安装包素材（可选） |

**Cargo target 目录固定**：`D:\cargo-target-native`（通过 `src-tauri/.cargo/config.toml` 配置，禁止改动）。

---

## 三、标准构建流程（每次必须按顺序执行）

### 步骤 1：TypeScript 类型检查

```powershell
cd d:\Lynn工作空间\LynnHub\desktop-native\native-ui
npx tsc --noEmit -p tsconfig.json
```

- **退出码必须为 0** 才能继续下一步
- 出现错误必须修复，禁止使用 `@ts-ignore` / `as any` 绕过
- 修复后重新执行本步骤

### 步骤 2：Vite 生产构建

```powershell
cd d:\Lynn工作空间\LynnHub\desktop-native\native-ui
npm run build
```

- 等价于 `tsc && vite build`
- 产物输出到 `native-ui/out/app/`（含 `index.html` + `assets/`）
- **chunk size 警告可忽略**（单页应用，首屏体积正常）
- 失败必须修复后重新执行

### 步骤 3：暂存前端资源到 Rust 构建目录

```powershell
cd d:\Lynn工作空间\LynnHub\desktop-native
if (Test-Path "src-tauri\out\app") { Remove-Item -Recurse -Force "src-tauri\out\app" }
New-Item -ItemType Directory -Path "src-tauri\out\app" -Force | Out-Null
Copy-Item -Path "out\app\*" -Destination "src-tauri\out\app" -Recurse -Force
```

- `src-tauri/build.rs` 通过 `frontendDist` 读取此目录
- 必须先清理旧目录，避免残留文件污染

### 步骤 4：Rust 编译（Release 模式）

```powershell
cd d:\Lynn工作空间\LynnHub\desktop-native\src-tauri
cargo build --release
```

- **退出码必须为 0**
- warnings 可忽略，errors 必须修复
- 常见错误：MutexGuard 类型不匹配 → 用 `.lock().map(|g| g.clone())` 解包
- 产物路径：`D:\cargo-target-native\release\lynnhub-desktop-native.exe`

### 步骤 5：暂存 Binary

```powershell
cd d:\Lynn工作空间\LynnHub\desktop-native
New-Item -ItemType Directory -Path "bin" -Force | Out-Null
Copy-Item "D:\cargo-target-native\release\lynnhub-desktop-native.exe" "bin\lynnhub-desktop-native.exe" -Force
```

### 步骤 6：NSIS 打包

```powershell
cd d:\Lynn工作空间\LynnHub\desktop-native
$nsis = "$env:LOCALAPPDATA\tauri\NSIS\makensis.exe"
if (-not (Test-Path $nsis)) { $nsis = "D:\Lynn工作空间\LynnHub\Temp\NSIS\makensis.exe" }
New-Item -ItemType Directory -Path "dist" -Force | Out-Null
& $nsis /INPUTCHARSET UTF8 installer.nsi
```

- 安装包输出：`desktop-native\dist\lynx_1.0.5.exe`
- **7010 警告可忽略**（无 resources / dll 时正常）
- **8000 警告可忽略**（使用自定义页面而非 instfiles）

### 步骤 7：验证产物

```powershell
Get-Item "dist\lynx_1.0.5.exe" | Format-Table Name,Length,LastWriteTime
```

- 确认文件存在且大小正常（约 6-7 MB）
- LastWriteTime 应为本次构建时间

### 步骤 8：Git 提交推送

```powershell
cd d:\Lynn工作空间\LynnHub
git add <本次修改的文件>
git commit -F .git/COMMIT_MSG.txt
git push origin master
```

- 提交信息用 heredoc 写入 `.git/COMMIT_MSG.txt` 后用 `-F` 提交（PowerShell 不支持 `$(cat <<EOF)`）
- **不提交** `dist/` `bin/` `out/` `src-tauri/out/` 等构建产物（已在 .gitignore）

---

## 四、强制规则（不可违反）

1. **禁止跳过类型检查**：tsc 报错必须修复，不得用 `as any` / `@ts-ignore` 绕过
2. **禁止使用 GNU 工具链**：Rust 必须用 `stable-x86_64-pc-windows-msvc`
3. **禁止改动 Cargo target 路径**：固定 `D:\cargo-target-native`
4. **禁止改动 `next.config.mjs`**：那是 Web 端配置，桌面端配置在 `native-ui/vite.config.ts`
5. **禁止提交构建产物**：`dist/` `bin/` `out/` `src-tauri/out/` `src-tauri/target/` 均在 .gitignore
6. **端口固定 3002**：Web 端 dev server 必须在 3002 端口运行；桌面端**默认连接云端** `https://ai.lynxdo.com`（生产环境），所有 API 通过 Tauri `cloud_request` 命令代理到云端，无需启动本地服务即可使用
7. **每次开发后必须打安装包**：用户要求每次完成开发后都要打包最新安装包供验收

---

## 五、快速构建命令（一键脚本）

若需快速执行完整流程，可使用：

```powershell
cd d:\Lynn工作空间\LynnHub\desktop-native
.\build-native.ps1
```

**注意**：`build-native.ps1` 在某些环境下可能挂起（Rust 编译完成后不继续）。挂起时按本规范第三节的步骤 3-6 手动执行。

---

## 六、常见问题排查

### Q1: Rust 编译报 `MutexGuard` 类型不匹配

**原因**：`Mutex::lock()` 返回 `Result<MutexGuard<T>>`，直接 `.unwrap_or_else(|_| "default".to_string()).clone()` 会得到 `String` 而非 `MutexGuard`。

**修复**：
```rust
// 错误
let v = state.field.lock().unwrap_or_else(|_| "default".to_string()).clone();

// 正确
let v = state.field.lock().map(|g| g.clone()).unwrap_or_else(|_| "default".to_string());
```

### Q2: Vite 构建报 `Cannot find module '@/'`

**原因**：路径别名未在 `tsconfig.json` 和 `vite.config.ts` 中同步配置。

**修复**：检查 `vite.config.ts` 的 `resolve.alias` 和 `tsconfig.json` 的 `paths`。

### Q3: NSIS 报 `File: "bin\resources\*.*" -> no files found`

**原因**：当前项目无 `resources/` 目录。

**处理**：可忽略，不影响安装包生成。如需消除警告，编辑 `installer.nsi` 删除对应 `File` 指令。

### Q4: Tauri 命令调用失败 `window.__TAURI__.invoke is not a function`

**原因**：Tauri 2.x API 路径变更。

**修复**：使用 `window.__TAURI__.core.invoke` 而非 `window.__TAURI__.invoke`。

### Q5: Prisma client 生成失败 `EPERM: operation not permitted`

**原因**：`query_engine-windows.dll.node` 被进程占用。

**处理**：关闭所有 Node.js 进程后重试 `npx prisma generate`。若仍失败，重启系统。

---

## 七、图标规范（每次打包必须遵守）

### 7.1 图标资源生成

所有桌面端图标资源由 `scripts/generate-installer-assets.py` 统一生成，**每次打包前必须重新执行**：

```powershell
cd d:\Lynn工作空间\LynnHub
python scripts/generate-installer-assets.py
```

### 7.2 图标文件清单

| 文件 | 尺寸 | 用途 | 缩放方式 |
|------|------|------|----------|
| `icon.png` | 512x512 | Linux/macOS 应用图标 | 直接复制源图 |
| `icon.ico` | 256/128/64/48/32/16 多尺寸 | Windows 应用图标 | **每个尺寸直接从 512 源 LANCZOS 一次重采样** |
| `tray-icon.png` | 64x64 | **系统托盘专用高清图标** | 从 512 源 LANCZOS 一次重采样 |
| `nsis-header.bmp` | 150x57 | NSIS 安装向导顶部图 | LANCZOS 缩放 |
| `nsis-sidebar.bmp` | 162x314 | NSIS 安装向导侧边图 | LANCZOS 缩放 |
| `Square*Logo.png` | 多尺寸 | Windows Store logo | LANCZOS 缩放 |

### 7.3 图标清晰度强制规则

1. **禁止双步缩放**：ICO 的每个尺寸必须直接从 512 源 LANCZOS 一次重采样，禁止 512→256→16 双步缩放
2. **系统托盘用专用 PNG**：Rust 代码中 `TrayIconBuilder` 必须用 `tauri::include_image!("icons/tray-icon.png")` 加载专用 64x64 PNG，禁止用 `app.default_window_icon()`（ICO 加载的小尺寸会模糊）
3. **源图固定**：`public/lynx-icon-512.png`（512x512 RGBA）为唯一源图，禁止用其他尺寸源图
4. **重新生成时机**：每次版本号递增时，必须重新执行 `generate-installer-assets.py`，确保 NSIS 侧边图版本号与安装包一致

### 7.4 Rust 端托盘图标加载方式（强制）

```rust
// ✅ 正确：用 include_image! 加载专用高清 PNG
.icon(tauri::include_image!("icons/tray-icon.png"))

// ❌ 错误：用 default_window_icon() 加载 ICO（小尺寸模糊）
// .icon(app.default_window_icon().cloned().unwrap())
```

---

## 变更记录

| 日期 | 版本 | 变更 |
|------|------|------|
| 2026-06-29 | v1.0 | 首次创建，基于 iter57 构建经验 |
| 2026-06-29 | v1.1 | 重构：废弃 `installer.nsi` 手动 NSIS，改用 `cargo tauri build` 标准流程；新增版本号管理规范（4 处同步、+0.01 递增）；固定输出目录 `desktop-native\dist\` |
| 2026-06-29 | v1.2 | 新增第七章「图标规范」：ICO 每尺寸直接从 512 源 LANCZOS 重采样；系统托盘专用 64x64 PNG + `include_image!` 加载；禁止双步缩放和 `default_window_icon()` |

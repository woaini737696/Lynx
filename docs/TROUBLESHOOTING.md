# 奇思故障排查指南

> 本文档汇总奇思三端常见问题的排查方法、根因分析与解决方案。所有排查**优先依赖日志系统**（详见 [LOG_SYSTEM.md](./LOG_SYSTEM.md)），不再依赖 console.print 或临时调试代码。

---

## 1. 通用排查流程

```
问题报告
  ↓
① 复现：明确操作步骤 / 设备 / 时间点
  ↓
② 取日志：
   - Web 端 → 设置 → 诊断 → 导出客户端日志 + 导出服务端日志
   - 桌面端 → %APPDATA%\Lynx\logs\qisi-desktop_YYYY-MM-DD.log
   - 安卓端 → adb logcat -s QisiApp
  ↓
③ 按事件名 / error / 时间戳搜索日志定位代码
  ↓
④ 修复后再次复现，确认日志不再报错
  ↓
⑤ 自测通过后清理 E2E 测试数据
```

---

## 2. Web 端常见问题

### 2.1 AI 助理对话无响应

**症状**：发送消息后无流式输出，或一直 loading

**排查步骤**：
1. 打开浏览器 DevTools Network 面板，查看 `/api/ai/chat` 请求状态
2. 导出服务端日志，搜索 `chat-completion-failed` 或 `chat-stream-start`
3. 检查 `.env` 中 `DEEPSEEK_API_KEY` / `MIMO_API_KEY` 是否配置
4. 检查服务端是否能访问 `https://api.deepseek.com/v1`

**常见根因**：
- AI Key 未配置或失效 → 日志报 `401 Unauthorized`
- 服务端到 AI 厂商网络不通 → 日志报 `ECONNREFUSED` 或超时
- 用户 Token 配额耗尽 → 日志报 `402 Payment Required`
- 流式响应被 Nginx 缓冲 → 检查 Nginx `proxy_buffering off`

### 2.2 助理消息刷新后丢失

**症状**：刚发送的消息刷新页面后消失

**日志事件名**：`persist-assistant-idempotent-hit` / `failed-all-retries` / `update-session-failed`

**根因**：
- DB 锁竞争（偶发，已加重试）
- `persistAssistantMessageSafely` 三次重试均失败
- 前端未使用 `serverMessageId` 替换临时 id

**修复参考**：迭代 117（DEV_LOG.md）

### 2.3 Token 消耗数显示不一致

**症状**：刷新后 Token 数消失

**根因**：API 返回 `tokens` 字段（number），前端需要 `usage: { total_tokens }` 对象

**修复位置**：[src/app/ai/assistant/hooks/useSessions.ts](file:///d:/Lynn工作空间/LynnHub/src/app/ai/assistant/hooks/useSessions.ts) `loadSession` 映射

### 2.4 全双工语音通话"语音合成失败"

**症状**：语音通话中提示"语音合成失败"

**日志事件名**：`tts-failed`

**根因**：
- TTS API Key 未配置
- `role: "assistant"` 应为 `role: "user"`（MiMo TTS 使用 `/chat/completions` 接口）
- voice-clone 失败时生成 `cloned_xxxx` 无效 ID 写入数据库

**修复参考**：迭代 117（DEV_LOG.md）

### 2.5 飞书 OAuth 20029 错误

**症状**：飞书授权返回错误码 20029

**根因**：飞书应用回调地址未配置桌面端专用回调

**修复位置**：[src/app/api/feishu/auth/route.ts](file:///d:/Lynn工作空间/LynnHub/src/app/api/feishu/auth/route.ts) 检测 `desktop=1` 参数

---

## 3. 桌面端常见问题

### 3.1 桌面端启动后白屏

**症状**：启动桌面端后窗口白屏，无 UI

**排查步骤**：
1. 查看 `%APPDATA%\Lynx\logs\qisi-desktop_YYYY-MM-DD.log` 末尾
2. 搜索 `panic` / `error` 关键字
3. 检查 `flexi_logger` 初始化是否成功（日志目录可写？）
4. 检查 `app.asar` 是否包含 `renderer/build/index.html`

**常见根因**：
- `renderer/build` 目录未提交到版本控制 → 重新构建桌面端
- `flexi_logger` 初始化 panic → 检查 `%APPDATA%\Lynx\logs\` 目录权限
- Tauri webview 加载失败 → 重启系统或更新 WebView2 Runtime

### 3.2 WS 连接假阳性（显示已连接但对话不可用）

**症状**：UI 显示"WS 已连接"，但发送指令无响应

**日志事件名**：`ws-status-changed` / `ws-disconnect`

**根因**：[ws_client.rs](file:///d:/Lynn工作空间/LynnHub/desktop-native/src-tauri/src/ws_client.rs) 未 emit `ws-status-changed` 事件

**修复参考**：迭代 119（DEV_LOG.md）

### 3.3 退出登录后白屏

**症状**：点击退出登录后窗口空白

**根因**：[authStore.ts](file:///d:/Lynn工作空间/LynnHub/desktop-native/native-ui/src/stores/authStore.ts) 未在 signOut 时同步清除 Rust 端 token

**修复参考**：迭代 119（DEV_LOG.md），新增 `sync_auth` 命令 + `stop_hermes_agent` 命令

### 3.4 检查更新报错 10054

**症状**：点击"检查更新"报 `os error 10054`

**根因**：reqwest 默认 UA 被 TLS 指纹拦截

**修复位置**：[installer.rs](file:///d:/Lynn工作空间/LynnHub/desktop-native/src-tauri/src/installer.rs) 添加浏览器 UA + `http1_only()` + 备用 URL

### 3.5 HermesAgent Dashboard 启动失败

**症状**：点击"一键启动 Dashboard"无效

**排查步骤**：
1. 日志搜索 `Dashboard 不可用` 或 `hermes exe not found`
2. 检查 `hermes.exe` 是否在 PATH 或 `%APPDATA%\Lynx\hermes-agent\` 下
3. 检查 9119 端口是否被占用：`netstat -ano | findstr :9119`

**修复**：
- 重新点击"一键安装 AI 环境"
- 或手动执行 `hermes dashboard --port 9119 --no-open`

### 3.6 安装包"未知发布者"

**症状**：Windows 安装时 UAC 提示"未知发布者"

**根因**：安装包未签名或 PFX 证书未配置

**修复位置**：[scripts/deploy/build.ps1](file:///d:/Lynn工作空间/LynnHub/scripts/deploy/build.ps1) 集成 signtool 签名步骤

**待办**：用户提供 PFX 证书密码后重新签名

---

## 4. 安卓端常见问题

### 4.1 无法连接 WS 网关

**症状**：安卓端显示"未连接服务器"

**排查步骤**：
```bash
adb logcat -s QisiApp | grep -i ws
```

**常见根因**：
- 服务器 3001 端口未开放
- 用户 Token 失效（重新登录）
- 网络不通（切换 WiFi / 4G 测试）

### 4.2 AI 对话无响应

**症状**：发送消息无回复

**排查步骤**：
```bash
adb logcat -s QisiApp OkHttp
```

**常见根因**：
- OkHttp 超时设置过短
- 服务端 API 不可达（用 curl 测试）

### 4.3 远程操控 PC 无响应

**症状**：点击"远程启动 PC Agent"无反应

**根因**：
- PC 端未登录或 WS 未连接
- PC 端 HermesAgent 未启动
- 设备 ID 不匹配

**修复**：在 PC 端检查 WS 连接状态，确保 HermesAgent 已启动

---

## 5. 服务器端常见问题

### 5.1 服务器 OOM 宕机

**症状**：服务器无响应，SSH 连接失败

**根因**：在服务器执行了 `npm install` / `cargo build` 等大内存操作

**严格约束**：详见 [DEVELOPMENT_SPEC.md](file:///d:/Lynn工作空间/LynnHub/DEVELOPMENT_SPEC.md) 第零章「服务器零构建硬约束」

**修复**：
1. 阿里云控制台强制重启
2. 排查最近操作，确认未在服务器执行禁令命令
3. 重启后 `pm2 restart all`

### 5.2 Next.js 静态资源 404

**症状**：网页加载后 CSS / JS 404

**根因**：`.next/static` 未完全替换，BUILD_ID 不匹配

**修复**：
```bash
# 本地重新构建
npm run build
# 上传 standalone + static 到服务器
scp -r .next/standalone/* root@server:/opt/lynx/
scp -r .next/static root@server:/opt/lynx/.next/
# 重启
pm2 restart lynx-app
```

### 5.3 PM2 日志撑满磁盘

**症状**：服务器磁盘 100% 满

**根因**：未配置 pm2-logrotate

**修复**：
```bash
bash /opt/lynx/scripts/deploy/setup-pm2-logrotate.sh
pm2 save
```

---

## 6. 数据库相关

### 6.1 MySQL 启动失败

**症状**：`pm2 logs lynx-app` 报 `ECONNREFUSED 127.0.0.1:3306`

**修复**：
```bash
# Windows
net start MySQL84
# Linux
systemctl start mysql
```

### 6.2 Prisma Client 版本不匹配

**症状**：服务端报 `Prisma Client initialization failed`

**修复**：
```bash
# 本地
npx prisma generate
# 上传 standalone（已包含 prisma client）到服务器
```

---

## 7. 性能问题

### 7.1 Trae Solo 卡顿

**根因**：文件 watcher 监控了 `node_modules` / `.next` / `target` 等大目录

**修复**：详见 [project_memory.md](file:///c:/Users/lynnd/.trae-cn/memory/projects/-d-Lynn-----LynnHub/project_memory.md) Hard Constraints，确保 `.vscode/settings.json` 排除大目录

### 7.2 cargo-target 目录膨胀（10GB+）

**根因**：多次桌面端构建累积

**修复**：
```powershell
# 设置统一 CARGO_TARGET_DIR
$env:CARGO_TARGET_DIR = "D:\Lynn工作空间\LynnHub\cargo-target"
# 构建后清理
cargo clean
```

### 7.3 桌面端 .next 缓存导致 HMR 失效

**修复**：
```bash
cd desktop-native
rm -rf node_modules/.vite
npm run dev
```

---

## 8. 安全风险

### 8.1 硬编码凭据

**已知风险**：72 处硬编码凭据（服务器密码 28 处 + Gitee Token 42 处 + Android 签名密码 2 处）

**修复建议**（待用户决策）：
- 服务器密码：迁移到 `.env` 文件 + SSH 密钥认证
- Gitee Token：迁移到 GitHub Secrets / 环境变量
- Android 签名密码：迁移到 `local.properties`（已 gitignore）

### 8.2 PFX 证书泄露

**风险**：代码签名证书含私钥，泄露后可被用于签署恶意软件

**修复**：`.gitignore` 已排除 `*.pfx`，证书仅本地保留

---

## 9. 求助清单

如以上方案均无法解决问题，请提供以下信息以便排查：

1. **问题复现步骤**（截图 / 录屏最佳）
2. **设备信息**：操作系统 / 浏览器版本 / 桌面端版本 / 安卓版本
3. **日志文件**：
   - Web：设置 → 诊断 → 导出客户端日志 + 服务端日志
   - 桌面端：`%APPDATA%\Lynx\logs\` 最新 `.log` 文件
   - 安卓端：`adb logcat -d > qisi-android.log`
4. **时间点**：问题发生的精确时间（便于在日志中定位）
5. **预期行为 vs 实际行为**

---

## 10. 相关文档

- [日志系统说明](./LOG_SYSTEM.md)
- [开发部署迭代规范](file:///d:/Lynn工作空间/LynnHub/DEVELOPMENT_SPEC.md)
- [开发日志](file:///d:/Lynn工作空间/LynnHub/DEV_LOG.md)
- [用户指南](./USER_GUIDE.md)
- [API 文档](./API.md)

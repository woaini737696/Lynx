# 日志系统说明文档

> 本文档说明奇思三端（Web / 桌面 / 安卓）日志系统的架构、写入方式、查看与导出方法。后续任何需求测试、bug 验证修复，**优先使用日志系统定位问题**，而非依靠 console.print 或临时调试代码。

---

## 1. 架构总览

| 端 | 日志器 | 落盘位置 | 轮转策略 | 用途 |
|----|--------|----------|----------|------|
| Web 服务端 | `pino`（[src/lib/logger.ts](file:///d:/Lynn工作空间/LynnHub/src/lib/logger.ts)） | PM2 `/opt/lynx/logs/out.log` + `error.log` | pm2-logrotate 每日 / 50M | 服务端 API / WS / AI 调用日志 |
| Web 客户端 | `clientLog`（[src/lib/client-logger.ts](file:///d:/Lynn工作空间/LynnHub/src/lib/client-logger.ts)） | 内存环形缓冲区（100 条） | 不落盘 | 浏览器端事件（AI 对话 / 语音 / 飞书 / WS） |
| 桌面端 | `flexi_logger`（Rust，[desktop-native/src-tauri/src/lib.rs](file:///d:/Lynn工作空间/LynnHub/desktop-native/src-tauri/src/lib.rs)） | `%APPDATA%/Lynx/logs/qisi-desktop_YYYY-MM-DD.log` | 每日轮转 | Rust 后端所有命令执行日志 |
| 安卓端 | `android.util.Log` + 自封装 `AppLog` | Logcat | 系统默认 | 调试期通过 adb logcat 查看 |

---

## 2. Web 服务端日志（pino）

### 2.1 模块化助手

[src/lib/logger.ts](file:///d:/Lynn工作空间/LynnHub/src/lib/logger.ts) 提供 `serverLog` 模块化助手，按业务模块分 namespace：

```typescript
import { serverLog } from "@/lib/logger";

// 6 个模块：ai / voice / feishu / ws / auth / generic
serverLog.ai.info({ userId, sessionId, durationMs }, "chat-completion-success");
serverLog.ws.warn({ userId, reason }, "ws-disconnect");
serverLog.auth.error({ userId, error }, "login-failed");
```

**统一字段**：`module / event / userId / sessionId / error / durationMs`，便于后续接入 ELK / Loki 日志聚合系统检索。

### 2.2 PM2 日志轮转

服务器部署后必须执行一次 [scripts/deploy/setup-pm2-logrotate.sh](file:///d:/Lynn工作空间/LynnHub/scripts/deploy/setup-pm2-logrotate.sh)：

```bash
# 在服务器执行
bash /opt/lynx/scripts/deploy/setup-pm2-logrotate.sh
```

配置参数：
- `max_size`: 50M（单文件超过 50M 触发轮转）
- `retain`: 14（保留 14 份历史日志）
- `compress`: true（gzip 压缩旧日志）
- `dateFormat`: YYYY-MM-DD_HH-mm-ss
- `rotateInterval`: `0 0 * * *`（每日 0 点强制轮转）

PM2 配置文件：[deploy/pm2/ecosystem.config.cjs](file:///d:/Lynn工作空间/LynnHub/deploy/pm2/ecosystem.config.cjs)
- `lynx-app` 进程：`/opt/lynx/logs/out.log` + `error.log`
- `lynx-ws-gateway` 进程：`/opt/lynx/logs/ws-out.log` + `ws-error.log`

### 2.3 服务端日志读取 API

`GET /api/logs/server?limit=200` （[src/app/api/logs/server/route.ts](file:///d:/Lynn工作空间/LynnHub/src/app/api/logs/server/route.ts)）

- 读取 PM2 `out.log` 末尾 N 行（默认 200，最大 1000）
- 返回格式：`{ success, logs: [{ ts, raw }], total }`
- 本地开发环境（无 PM2 日志）返回空数组 + note 提示

---

## 3. Web 客户端日志（clientLog）

### 3.1 环形缓冲区

[src/lib/client-logger.ts](file:///d:/Lynn工作空间/LynnHub/src/lib/client-logger.ts) 提供零 Node.js 依赖的客户端日志器：

```typescript
import { clientLog } from "@/lib/client-logger";

clientLog.ai.info("chat-stream-start", { sessionId, model });
clientLog.ws.warn("ws-connect-failed", { url, retryCount });
clientLog.feishu.error("oauth-callback-error", { error });

// 读取最近 100 条
const logs = clientLog.getBuffer();
// 清空缓冲区（用户主动清空）
clientLog.clearBuffer();
```

**特性**：
- 100 条环形缓冲区，超出自动丢弃最旧记录
- 模块名与服务端 `serverLog` 一一对应（ai / voice / feishu / ws / auth / generic）
- 不引入 pino，避免 Webpack 打包到客户端 chunk

### 3.2 诊断页导出

打开 **设置 → 诊断**（[/settings/diagnostics](file:///d:/Lynn工作空间/LynnHub/src/app/settings/diagnostics/page.tsx)），点击「日志导出」卡片中的按钮：

- **导出客户端日志**：下载 `client-logs-YYYY-MM-DDTHH-mm-ss.json`，含最近 100 条浏览器端事件
- **导出服务端日志**：调用 `/api/logs/server?limit=200`，下载 `server-logs-YYYY-MM-DDTHH-mm-ss.json`，含最近 200 条 PM2 日志

导出 JSON 格式：
```json
{
  "exportedAt": "2026-07-06T12:00:00.000Z",
  "count": 100,
  "logs": [
    { "ts": "2026-07-06 12:00:00 +0800", "module": "ai", "level": "info", "event": "chat-stream-start", "data": {...} }
  ]
}
```

---

## 4. 桌面端日志（flexi_logger）

### 4.1 日志初始化

[desktop-native/src-tauri/src/lib.rs](file:///d:/Lynn工作空间/LynnHub/desktop-native/src-tauri/src/lib.rs) 在 `run()` 启动时初始化：

```rust
// 日志文件位置：%APPDATA%/Lynx/logs/qisi-desktop_YYYY-MM-DD.log
flexi_logger::Logger::try_with_str("info")
    .log_to_file(FileSpec::default().directory(&log_dir).basename("qisi-desktop").suffix("log"))
    .duplicate_to_stderr(Duplicate::Info)  // 同时输出到 stderr 便于开发期调试
    .rotate(Age::Day)                       // 每日轮转
    .write_mode(WriteMode::BufferAndFlush)  // 缓冲写入提升性能
    .start()
```

### 4.2 日志文件位置

| 操作系统 | 路径 |
|----------|------|
| Windows | `%APPDATA%\Lynx\logs\qisi-desktop_YYYY-MM-DD.log` |
| macOS | `~/Library/Application Support/Lynx/logs/qisi-desktop_YYYY-MM-DD.log` |
| Linux | `~/.local/share/Lynx/logs/qisi-desktop_YYYY-MM-DD.log` |

### 4.3 Rust 端日志写入

桌面端所有 Rust 命令使用标准 `log` crate 宏写入日志：

```rust
log::info!("奇思桌面端启动中...");
log::info!("sync_auth 完成: token={}, endpoint={}", token_status, endpoint);
log::warn!("Dashboard 不可用: {}", e);
log::error!("WS 连接失败: {}", e);
```

### 4.4 桌面端日志导出 Tauri 命令

`read_desktop_logs(limit?: usize) -> Vec<String>`（[lib.rs](file:///d:/Lynn工作空间/LynnHub/desktop-native/src-tauri/src/lib.rs)）

- 自动找到最新的 `.log` 文件
- 读取末尾 N 行（默认 200）
- 前端可通过 `invoke('read_desktop_logs', { limit: 200 })` 调用

### 4.5 开发期查看

```bash
# 启动桌面端开发模式，stderr 同时输出日志
cd desktop-native && npm run dev
```

生产环境日志仅在文件中，需通过诊断页或文件管理器查看。

---

## 5. 安卓端日志

### 5.1 日志器

安卓端使用系统 `android.util.Log`，封装在 `AppLog`（如需新增可创建 `com.lynnhub.app.util.AppLog`）：

```kotlin
import android.util.Log

object AppLog {
    private const val TAG = "QisiApp"
    fun d(msg: String) = Log.d(TAG, msg)
    fun i(msg: String) = Log.i(TAG, msg)
    fun w(msg: String, t: Throwable? = null) = Log.w(TAG, msg, t)
    fun e(msg: String, t: Throwable? = null) = Log.e(TAG, msg, t)
}
```

### 5.2 查看方式

```bash
# 连接设备后查看实时日志
adb logcat -s QisiApp

# 查看所有奇思相关日志（包含 OkHttp / Retrofit）
adb logcat | grep -E "QisiApp|OkHttp|Retrofit"

# 导出日志到文件
adb logcat -d > qisi-android.log
```

---

## 6. 日志排查工作流

### 6.1 标准 bug 定位流程

```
用户报告 bug
  ↓
① 复现问题，记录操作步骤
  ↓
② Web 端：打开「设置 → 诊断 → 日志导出」
   桌面端：前往 %APPDATA%\Lynx\logs\ 读取最新 .log
   安卓端：adb logcat -s QisiApp
  ↓
③ 在日志中搜索关键字（事件名 / error / 时间戳）
  ↓
④ 根据日志中的 module / event 字段定位代码位置
  ↓
⑤ 修复后再次复现，确认日志中不再出现 error
```

### 6.2 关键事件名速查

| 模块 | 事件名 | 含义 |
|------|--------|------|
| ai | `chat-stream-start` / `chat-completion-success` / `chat-completion-failed` | AI 对话流式起止 |
| ai | `persist-assistant-idempotent-hit` / `failed-all-retries` | 助理消息持久化 |
| voice | `tts-success` / `tts-failed` / `asr-success` / `asr-failed` | 语音合成 / 识别 |
| feishu | `oauth-callback-error` / `task-sync-failed` | 飞书 OAuth / 任务同步 |
| ws | `ws-connect-failed` / `ws-disconnect` / `ws-status-changed` | WebSocket 连接 |
| auth | `login-failed` / `sync-auth` / `signout` | 登录 / 登出 / Token 同步 |

---

## 7. 注意事项

1. **不要在客户端日志中记录敏感信息**：token / 密码 / 用户隐私字段必须脱敏后再写入
2. **日志级别使用规范**：
   - `info`：正常业务流转节点
   - `warn`：可恢复异常（如重试成功）
   - `error`：不可恢复错误（需要人工介入）
3. **桌面端 flexi_logger 初始化失败会 panic**：如果遇到桌面端启动崩溃，先检查 `%APPDATA%\Lynx\logs\` 目录是否可写
4. **PM2 日志轮转必须在服务器执行一次 setup 脚本**：否则日志会无限增长撑满磁盘
5. **诊断页导出的日志 JSON 文件含用户 ID / Session ID**：分享给开发者时建议先脱敏

---

## 8. 相关文件

| 文件 | 说明 |
|------|------|
| [src/lib/logger.ts](file:///d:/Lynn工作空间/LynnHub/src/lib/logger.ts) | 服务端 pino 日志器 + serverLog 模块化助手 |
| [src/lib/client-logger.ts](file:///d:/Lynn工作空间/LynnHub/src/lib/client-logger.ts) | 客户端环形缓冲区日志器 |
| [src/app/api/logs/server/route.ts](file:///d:/Lynn工作空间/LynnHub/src/app/api/logs/server/route.ts) | 服务端日志读取 API |
| [src/app/settings/diagnostics/page.tsx](file:///d:/Lynn工作空间/LynnHub/src/app/settings/diagnostics/page.tsx) | 诊断页（含日志导出 UI） |
| [desktop-native/src-tauri/src/lib.rs](file:///d:/Lynn工作空间/LynnHub/desktop-native/src-tauri/src/lib.rs) | 桌面端 flexi_logger 初始化 + read_desktop_logs 命令 |
| [scripts/deploy/setup-pm2-logrotate.sh](file:///d:/Lynn工作空间/LynnHub/scripts/deploy/setup-pm2-logrotate.sh) | PM2 日志轮转配置脚本 |
| [deploy/pm2/ecosystem.config.cjs](file:///d:/Lynn工作空间/LynnHub/deploy/pm2/ecosystem.config.cjs) | PM2 进程配置（含日志路径） |

---

## 9. 排查指南

详见 [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)

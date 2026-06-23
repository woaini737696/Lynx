# 飞书 Webhook 实时同步配置指南

本指南说明如何将飞书任务事件通过 Webhook 实时推送到 LynnHub，实现任务变更的自动同步。

## 架构概览

```
飞书任务中心 ──(事件订阅)──> Webhook URL ──> /api/lark-webhook
                                                      │
                                          ┌───────────┴───────────┐
                                          │                       │
                                   事件入队（内存）         触发 runSync()
                                          │
                          前端每 10s 轮询 /api/lark-webhook/events
                                          │
                                  发现新事件 → 刷新任务列表
```

- **接收端**：`POST /api/lark-webhook`（Next.js API Route）
- **事件队列**：`GET /api/lark-webhook/events`（前端轮询）
- **处理逻辑**：`src/lib/lark-webhook-handler.ts`

## 支持的事件类型

| 事件类型                  | 说明       |
| ------------------------- | ---------- |
| `task.task.created`       | 任务创建   |
| `task.task.updated`       | 任务更新   |
| `task.task.completed`     | 任务完成   |
| `task.task.deleted`       | 任务删除   |
| `task.task.reopened`      | 任务重开   |

收到上述任一事件后，服务端会：
1. 将事件记录到内存队列（最多 50 条，供前端轮询）
2. 用事件 ID 去重（最近 100 个，保证幂等性）
3. 调用 `runSync()` 刷新同步状态

## 配置步骤

### 步骤 1：安装隧道工具

本地开发环境需要将内网端口暴露到公网，供飞书回调。推荐使用 Cloudflare Tunnel 或 ngrok。

**方案 A：Cloudflare Tunnel（推荐，免费且稳定）**

```bash
# Windows (PowerShell)
winget install --id Cloudflare.cloudflared

# macOS
brew install cloudflared

# Linux
sudo apt install cloudflared
```

**方案 B：ngrok**

```bash
# 安装后需要注册并配置 authtoken
ngrok config add-authtoken <YOUR_TOKEN>
```

### 步骤 2：暴露本地端口

确保 LynnHub dev server 已在 `http://localhost:3000` 运行：

```bash
npm run dev
```

另开一个终端，启动隧道：

**Cloudflare Tunnel：**
```bash
cloudflared tunnel --url http://localhost:3000
```

输出示例：
```
Your quick Tunnel has been created! Visit it at:
  https://xxxx-xxxx-xxxx.trycloudflare.com
```

**ngrok：**
```bash
ngrok http 3000
```

输出示例：
```
Forwarding  https://xxxx-xxxx.ngrok-free.app -> http://localhost:3000
```

记下这个公网 URL，下一步会用到。

### 步骤 3：飞书开放平台配置事件订阅

1. 打开 [飞书开放平台](https://open.feishu.cn/) 并登录
2. 进入你为 LynnHub 创建的企业自建应用
3. 左侧菜单选择 **「事件与回调」** → **「事件配置」**
4. 编辑 **「请求地址」**，填入：
   ```
   https://xxxx-xxxx.trycloudflare.com/api/lark-webhook
   ```
5. 点击 **「验证」**，飞书会发送 URL 验证请求
   - 服务端收到 `{ type: "url_verification", challenge, token }` 并返回 `{ challenge }`
   - 验证通过后即可保存
6. 在 **「事件订阅」** 页面，添加以下事件：
   - `task.task.created`（任务创建）
   - `task.task.updated`（任务更新）
   - `task.task.completed`（任务完成）
   - `task.task.deleted`（任务删除）
   - `task.task.reopened`（任务重开）
7. 发布应用版本（如需审批，请联系管理员）

### 步骤 4：设置环境变量（可选，用于安全校验）

在飞书开放平台的 **「事件与回调」** 页面可以看到 **「Encrypt Key」** 和 **「Verification Token」**。
将 Verification Token 配置到环境变量，服务端会校验每个请求的 token 是否匹配。

在项目根目录创建或编辑 `.env.local`：

```bash
# 飞书 Webhook 验证 Token（从飞书开放平台获取）
LARK_WEBHOOK_TOKEN=your_verification_token_here
```

> 若未配置 `LARK_WEBHOOK_TOKEN`，服务端会跳过 token 校验（仅适合本地开发）。

### 步骤 5：测试 Webhook

1. 确保隧道和 dev server 都在运行
2. 在飞书任务中心创建 / 完成 / 编辑一个任务
3. 观察 dev server 控制台，应看到 webhook 请求日志
4. 打开 LynnHub 的 `/ai/lark-tasks` 页面，任务列表应在 10 秒内自动刷新

**手动测试 URL 验证：**
```bash
curl -X POST http://localhost:3000/api/lark-webhook \
  -H "Content-Type: application/json" \
  -d '{"type":"url_verification","challenge":"test_challenge_123","token":"xxx"}'
```

预期返回：
```json
{ "challenge": "test_challenge_123" }
```

**手动测试事件通知：**
```bash
curl -X POST http://localhost:3000/api/lark-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "schema": "2.0",
    "header": {
      "event_id": "test-evt-001",
      "event_type": "task.task.created",
      "token": "xxx"
    },
    "event": {
      "task": { "guid": "task-guid-1", "summary": "测试任务" }
    }
  }'
```

预期返回：
```json
{ "processed": true, "deduplicated": false }
```

**查看事件队列：**
```bash
curl http://localhost:3000/api/lark-webhook/events
```

## 前端实时刷新机制

- 前端页面 `/ai/lark-tasks` 每 **10 秒**轮询 `GET /api/lark-webhook/events?since=<lastTimestamp>`
- 发现新事件后自动调用 `fetchTasks()` 刷新任务列表
- 轮询使用 `since` 参数避免重复处理已见事件
- 事件队列保存在服务端内存中（最多 50 条），重启服务后会清空

## 注意事项

1. **隧道稳定性**：Cloudflare Tunnel 的免费临时 URL 每次重启会变化，需在飞书后台更新。生产环境建议使用固定域名。
2. **幂等性**：服务端用事件 ID 去重（最近 100 个），飞书重试不会导致重复同步。
3. **同步延迟**：webhook 触发 `runSync()` 是同步调用（lark-cli 超时 15s），极端情况下可能阻塞响应。飞书会在超时后重试。
4. **内存队列**：事件队列和去重缓存都在内存中，服务重启后清空。这对实时刷新场景足够，无需持久化。
5. **生产部署**：生产环境应将 webhook 接收端部署到公网可访问的服务器，无需隧道。建议配置 `LARK_WEBHOOK_TOKEN` 并启用 HTTPS。

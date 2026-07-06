# 奇思 API 文档

> 所有 API 均为 Next.js App Router 路由，基础路径为 `/api`。
> 除认证接口外，所有接口均需要登录（通过 NextAuth.js Session Cookie 鉴权）。
> 标注「仅 admin」的接口需要管理员角色。
> 统一错误响应格式：`{ "error": "错误信息" }`，HTTP 状态码 4xx/5xx。

---

## 1. 认证（/api/auth/*）

基于 NextAuth.js v5（Auth.js）实现，使用 Credentials Provider（用户名 + 密码，bcrypt 哈希验证）。

### POST /api/auth/callback/credentials
用户登录（凭据校验）
- 权限：公开
- 限流：10 次/分钟（防暴力破解）
- 请求体：`{ username: string, password: string }`
- 响应：设置 Session Cookie 后重定向

### POST /api/auth/signout
退出登录
- 权限：需要登录
- 响应：清除 Session Cookie 后重定向

### GET /api/auth/session
获取当前会话信息
- 权限：公开
- 响应：`{ user: { id, name, email, role } } | null`

---

## 2. 灵感管理（/api/ideas）

### GET /api/ideas
获取 Inbox 灵感列表
- 权限：需要登录
- 响应：`{ ideas: Idea[] }`
- 说明：返回 status 为 inbox 的灵感，按创建时间倒序，最多 50 条

### POST /api/ideas
创建灵感（闪电输入）
- 权限：需要登录
- 请求体：`{ content: string, source?: "lightning" | "conversation", status?: "inbox" | "board" | "graveyard" }`
- 响应：`{ id: string, success: true }`
- 说明：content 最大 5000 字符，异步写入记忆图谱

### PATCH /api/ideas/[id]
处理 Inbox 灵感
- 权限：需要登录（仅本人或 admin）
- 请求体：
  - 拖入看板：`{ action: "board", column: "northstar" | "campaign" | "task" }`
  - 延后：`{ action: "postpone" }`
  - 放弃入墓地：`{ action: "abandon", reason: string, reviveCondition: string }`
- 响应：
  - board：`{ task: Task, success: true }`
  - abandon：`{ graveyard: Graveyard, success: true }`
- 说明：看板列有满额阻断（北极星≤3，战役≤5，任务≤10），超限返回 409

### GET /api/ideas/revive-check
AI 巡检复活条件
- 权限：需要登录
- 响应：`{ suggestions: ReviveSuggestion[] }`
- 说明：检查墓地灵感的复活条件是否被最近 7 天的新灵感命中，优先级：embedding 语义匹配 > AI 文本判断 > 关键词匹配

---

## 3. 任务管理（/api/tasks）

### GET /api/tasks
获取看板任务列表
- 权限：需要登录
- 响应：`{ tasks: Task[] }`
- 说明：返回 status 为 active 或 done 的任务，按列和位置排序

### POST /api/tasks
创建看板任务
- 权限：需要登录
- 请求体：`{ content: string, column: "northstar" | "campaign" | "task" }`
- 响应：`{ task: Task, success: true }`
- 说明：content 最大 5000 字符，满额阻断返回 409

### PATCH /api/tasks/[id]
更新任务状态/位置
- 权限：需要登录（仅本人或 admin）
- 请求体：`{ status?: "active" | "done" | "dropped", column?: "northstar" | "campaign" | "task", position?: number }`
- 响应：`{ task: Task, success: true }`
- 说明：跨列移动时检查目标列满额

### DELETE /api/tasks/[id]
删除任务
- 权限：需要登录（仅本人或 admin）
- 响应：`{ success: true }`
- 说明：软删除，将 status 设为 dropped

---

## 4. 对话资产（/api/conversations）

### GET /api/conversations
获取对话资产列表
- 权限：需要登录
- 响应：`{ conversations: Conversation[] }`
- 说明：按捕获时间倒序，最多 30 条

### POST /api/conversations
捕获对话资产（含 AI 提取）
- 权限：需要登录
- 请求体：`{ source: string, title?: string, rawContent: string, useAI?: boolean, fileData?: string, filename?: string }`
- 响应：`{ conversation: Conversation, success: true, pdfParseStatus?: "local" | "ai-fallback" | "failed" | "skipped" }`
- 说明：
  - source 可选值：kimi / trae-solo / claude / codex / gpt / file-md / file-html / file-txt / file-csv / file-json / file-image / file-pdf
  - useAI 为 true 且配置 AI_API_KEY 时，自动提取结论 / 待办 / 提示词 / 数据
  - PDF 支持 base64 fileData 传入，本地解析失败时 AI 视觉降级

---

## 5. 认知库（/api/cognitions）

### GET /api/cognitions
获取认知列表
- 权限：需要登录
- 响应：`{ cognitions: Cognition[] }`
- 说明：按创建时间倒序，最多 50 条

### POST /api/cognitions
AI 提取认知
- 权限：需要登录
- 请求体：`{ content: string, source?: string }`
- 响应：`{ created: Cognition[], count: number, success: true }`
- 说明：AI 自动提炼方法论（method）/ 经验（experience）/ 提示词（prompt）三类认知，批量入库

---

## 6. 记忆图谱（/api/memory）

### GET /api/memory
获取记忆图谱数据
- 权限：需要登录
- 响应：`{ nodes: MemoryNode[], edges: Edge[], stats: { total, edges, isolated, mode } }`
- 说明：返回节点和边数据，用于力导向图可视化，最多 100 个节点

### POST /api/memory
重建记忆图谱
- 权限：需要登录
- 请求体：`{ force?: boolean }`
- 响应：`{ success: true, total: number, processed: number, skipped: number, edges: number, mode: string, threshold: number }`
- 说明：从 Idea/Conversation/Cognition 同步到 Memory 表，生成 embedding，计算相似度连边。AI 模式阈值 0.8，TF-IDF 降级模式阈值 0.3

### GET /api/memory/search
语义搜索
- 权限：需要登录
- 查询参数：`q`（关键词）, `limit`（默认 10，上限 100）, `offset`（默认 0）
- 响应：`{ results: SearchResult[], query: string, limit: number, offset: number, total: number }`
- 说明：query 向量化后与所有 Memory embedding 比相似度，返回 top N

### PATCH /api/memory/[id]
更新记忆标签
- 权限：需要登录
- 请求体：`{ label: string }`
- 响应：`{ success: true, id: string, label: string }`
- 说明：同步更新源实体（Idea.content / Conversation.title / Cognition.content）

### DELETE /api/memory/[id]
删除记忆节点
- 权限：需要登录
- 响应：`{ success: true, id: string }`
- 说明：同时清理其他节点 connections 中对该节点的引用

---

## 7. 灵感墓地（/api/graveyard）

### GET /api/graveyard
获取灵感墓地列表
- 权限：需要登录（非 admin 仅看自己的）
- 响应：`{ items: GraveyardItem[] }`
- 说明：包含原始灵感内容、放弃原因、复活条件，按放弃时间倒序

### PATCH /api/graveyard
复活灵感
- 权限：需要登录（仅本人或 admin）
- 请求体：`{ graveyardId: string }`
- 响应：`{ success: true }`
- 说明：将灵感从墓地恢复到 Inbox

---

## 8. 今日聚焦（/api/focus）

### GET /api/focus
获取今日聚焦
- 权限：需要登录
- 响应：`{ dailyFocus: DailyFocus | null }`
- 说明：如果今天还没生成，自动从 active 任务中取前 3 条生成

### PATCH /api/focus
完成/取消完成聚焦卡片
- 权限：需要登录
- 请求体：`{ itemId: string, completed: boolean }`
- 响应：`{ success: true, allDone: boolean }`
- 说明：全部完成时自动将对应 task 标记为 done

---

## 9. 技能管理（/api/skills）

### GET /api/skills
获取技能列表
- 权限：需要登录
- 查询参数：`category`（分类筛选，all 表示全部）
- 响应：`{ skills: Skill[] }`

### POST /api/skills
创建技能
- 权限：需要登录
- 请求体：`{ name: string, description: string, category?: string, content?: string, parameters?: SkillParameter[], promptTemplate?: string, source?: string, tags?: string[] }`
- 响应：`{ skill: Skill, success: true }`

### GET /api/skills/[id]
获取单个技能
- 权限：需要登录（仅本人或 admin）
- 查询参数：`export=1` 时导出为 Markdown 文件
- 响应：`{ skill: Skill }` 或 Markdown 文件下载

### PATCH /api/skills/[id]
更新技能
- 权限：需要登录（仅本人或 admin）
- 请求体：`{ name?, description?, category?, content?, parameters?, promptTemplate?, tags?, source? }`
- 响应：`{ skill: Skill, success: true }`
- 说明：更新前自动保存版本快照，最多保留 20 个版本

### DELETE /api/skills/[id]
删除技能
- 权限：需要登录（仅本人或 admin）
- 响应：`{ success: true }`

### GET /api/skills/[id]/versions
获取技能版本历史
- 权限：需要登录
- 响应：`{ versions: SkillVersion[] }`

### GET /api/skills/[id]/versions/[version]
获取指定版本详情
- 权限：需要登录
- 响应：`{ version: SkillVersionDetail }`

### POST /api/skills/[id]/rollback
回滚到指定版本
- 权限：需要登录
- 请求体：`{ versionId: string }`
- 响应：`{ success: true }`

### POST /api/skills/import
从 Markdown 导入技能
- 权限：需要登录
- 请求体：`{ markdown: string }`
- 响应：`{ imported: number, failed: number, success: true }`

### POST /api/skills/generate
AI 生成技能
- 权限：需要登录
- 请求体：`{ workLog: string, conversation?: ChatMessage[] }`
- 响应：`{ skill: Partial<Skill>, fallback?: boolean, fallbackReason?: string, mock?: boolean }`

---

## 10. AI 聊天（/api/ai/chat）

### POST /api/ai/chat
AI 对话
- 权限：需要登录
- 限流：20 次/分钟
- 请求体：`{ messages: ChatMessage[], provider?: "deepseek" | "mimo", model?: string, reasoningMode?: "fast" | "standard" | "deep", temperature?: number, maxTokens?: number, stream?: boolean }`
- 响应：
  - 非流式：`{ content: string, provider: string, model: string, usage: object }`
  - 流式（stream=true）：SSE 格式 `data: { type: "chunk" | "done" | "error", ... }\n\n`
- 说明：messages 中 content 支持字符串或多模态数组（文本 + 图片）

### GET /api/ai/chat/sessions
获取对话会话列表
- 权限：需要登录
- 查询参数：`limit`（默认 30，上限 100）
- 响应：`{ sessions: ChatSession[] }`

### POST /api/ai/chat/sessions
创建对话会话
- 权限：需要登录
- 请求体：`{ title?: string, provider?: string, model?: string }`
- 响应：`{ session: ChatSession }`（201）

### GET /api/ai/chat/sessions/[id]
获取会话详情（含所有消息）
- 权限：需要登录（仅本人或 admin）
- 响应：`{ session: ChatSession & { messages: ChatMessage[] } }`

### PUT /api/ai/chat/sessions/[id]
更新会话
- 权限：需要登录（仅本人或 admin）
- 请求体：`{ title?, pinned?, provider?, model? }`
- 响应：`{ session: ChatSession }`

### DELETE /api/ai/chat/sessions/[id]
删除会话（级联删除消息）
- 权限：需要登录（仅本人或 admin）
- 响应：`{ success: true }`

---

## 11. AI 工作流（/api/ai/flows）

### GET /api/ai/flows
获取工作流列表
- 权限：需要登录
- 响应：`{ flows: Flow[] }`

### POST /api/ai/flows
创建工作流
- 权限：需要登录
- 请求体：`{ name: string, description?: string, nodes?: FlowNode[], edges?: FlowEdge[], enabled?: boolean }`
- 响应：`{ flow: Flow }`（201）

### GET /api/ai/flows/[id]
获取单个工作流
- 权限：需要登录
- 响应：`{ flow: Flow }`

### PUT /api/ai/flows/[id]
更新工作流
- 权限：需要登录
- 请求体：`{ name?, description?, nodes?, edges?, enabled?, lastRun? }`
- 响应：`{ flow: Flow }`

### DELETE /api/ai/flows/[id]
删除工作流
- 权限：需要登录
- 响应：`{ flow: Flow }`

### POST /api/ai/flows/[id]/execute
执行工作流
- 权限：需要登录
- 响应：执行结果

### GET /api/ai/flows/[id]/executions
获取工作流执行历史
- 权限：需要登录
- 响应：`{ executions: Execution[] }`

### GET /api/ai/flows/executions
获取所有工作流执行历史
- 权限：需要登录
- 响应：`{ executions: Execution[] }`

### GET /api/ai/flows/scheduler/status
获取工作流调度器状态
- 权限：需要登录
- 响应：`{ status: object }`

---

## 12. 全文搜索（/api/search）

### GET /api/search
全文搜索
- 权限：需要登录
- 查询参数：
  - `q`：关键词（必填）
  - `limit`：每页数量（默认 10，上限 50）
  - `offset`：偏移量（默认 0）
  - `types`：搜索类型，逗号分隔（idea / task / cognition / memory / skill），默认全部
- 响应：`{ results: SearchResult[], total: number, q: string, limit: number, offset: number }`
- 说明：搜索结果 snippet 中匹配关键词用 `<mark>` 标签高亮

---

## 13. 用户管理（/api/users）

### GET /api/users
获取用户列表
- 权限：仅 admin
- 响应：`{ users: User[] }`

### POST /api/users
创建用户
- 权限：仅 admin
- 请求体：`{ username: string, password: string, email?: string, displayName?: string, role?: "admin" | "editor" | "viewer" }`
- 响应：`{ user: User, success: true }`
- 说明：密码至少 6 位，用户名最大 64 字符

### GET /api/users/[id]
获取用户详情
- 权限：仅 admin
- 响应：`{ user: User }`

### PATCH /api/users/[id]
更新用户
- 权限：仅 admin
- 请求体：`{ email?, displayName?, role?, active?, password? }`
- 响应：`{ user: User, success: true }`

### DELETE /api/users/[id]
删除用户
- 权限：仅 admin
- 响应：`{ success: true }`
- 说明：不能删除自己，不能删除最后一个 admin

---

## 14. 数据备份（/api/backup）

### GET /api/backup/export
导出数据
- 权限：需要登录（admin 导出全部，普通用户导出自己的）
- 限流：5 次/分钟
- 查询参数：`type`（all | ideas | tasks | conversations | cognitions | memories | skills | flows，默认 all）
- 响应：`{ exportedAt: string, version: "1.0", data: { [type]: any[] } }`

### POST /api/backup/import
导入数据
- 权限：仅 admin
- 限流：3 次/分钟
- 请求体：`{ data: { ideas?, tasks?, conversations?, cognitions?, memories?, skills?, flows? } }`
- 响应：`{ success: true, stats: { [type]: number }, importedAt: string }`
- 说明：导入时跳过已存在的 ID（upsert）

---

## 15. 飞书机器人（/api/lark-bot）

### POST /api/lark-bot/test
发送飞书测试消息
- 权限：需要登录
- 请求体：`{ webhookUrl: string, message?: string, webhookToken?: string }`
- 响应：`{ success: boolean, status: number, durationMs: number, response: any, error?: string }`
- 说明：支持飞书自定义机器人签名校验（HMAC-SHA256）

---

## 16. 推送通知（/api/push）

### GET /api/push/subscribe
查询订阅状态
- 权限：需要登录
- 响应：`{ subscribed: boolean, count: number }`

### POST /api/push/subscribe
订阅推送
- 权限：需要登录
- 请求体：`{ endpoint: string, keys: { p256dh: string, auth: string } }`
- 响应：`{ success: true, id: string }`

### DELETE /api/push/subscribe
取消订阅
- 权限：需要登录
- 请求体：`{ endpoint: string }`
- 响应：`{ success: true }`

### GET /api/push/test
获取 VAPID 公钥
- 权限：需要登录
- 响应：`{ publicKey: string, configured: true }`

### POST /api/push/test
发送测试推送
- 权限：需要登录
- 响应：`{ success: boolean, total: number, successCount: number, failedCount: number, results: any[] }`
- 说明：向当前用户的所有订阅发送测试通知，失效订阅自动清除

---

## 17. 系统设置（/api/settings）

### GET /api/settings
获取系统配置状态
- 权限：需要登录
- 响应：`{ db: { status, url, counts }, ai: { chatProvider, chatModel, chatBaseURL, embeddingEnabled, embeddingModel, embeddingMode }, envFilePath, envExamplePath }`
- 说明：不暴露 API Key 本身，只返回是否已配置

### GET /api/settings/diagnostics
系统诊断
- 权限：仅 admin
- 响应：数据库表计数、Embedding 缓存命中率、Flows 调度器状态、灵感状态分布等

---

## 18. 开发日志（/api/dev-log）

### GET /api/dev-log
读取开发日志
- 权限：需要登录
- 响应：`{ content: string, path: "DEV_LOG.md" }`
- 说明：读取项目根目录的 DEV_LOG.md 文件，缓存 30 秒

---

## 数据模型参考

### Idea（灵感）
```typescript
{ id: string, content: string, source: "lightning" | "conversation", status: "inbox" | "board" | "graveyard", tags: string[], createdAt: string }
```

### Task（任务）
```typescript
{ id: string, content: string, column: "northstar" | "campaign" | "task", status: "active" | "done" | "dropped", position: number, sourceId?: string, createdAt: string }
```

### Conversation（对话资产）
```typescript
{ id: string, source: string, title: string, rawContent: string, conclusions: string[], todos: string[], prompts: string[], data: string[], capturedAt: string }
```

### Cognition（认知）
```typescript
{ id: string, type: "method" | "experience" | "prompt", content: string, source: string, tags: string[], createdAt: string }
```

### Skill（技能）
```typescript
{ id: string, name: string, description: string, category: string, content: string, parameters: SkillParameter[], promptTemplate: string, source: string, tags: string[], usageCount: number, createdAt: string, updatedAt: string }
```

### User（用户）
```typescript
{ id: string, username: string, email?: string, displayName?: string, role: "admin" | "editor" | "viewer", active: boolean, createdAt: string }
```

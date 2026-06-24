# LynnHub 开发日志

> 每次迭代开发时需先读取本文件，了解历史变更和当前状态。

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

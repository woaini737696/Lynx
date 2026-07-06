# 奇思 产品官网内容展示方案

> 品牌名：奇思（原名 LynnHub / Lynx）
> Slogan：**不用学AI，什么都能干**
> 定位：个人 / 团队认知操作系统，一个会自主学习、成长、进化的超级 AI 助理
> 三端互通：Web + Windows 桌面（Tauri）+ Android APP，可互相操控

本文档为 奇思 官网的内容骨架与视觉呈现方案，每个章节给出：标题、副标题、核心卖点、视觉呈现方式、对应代码模块路径。整体风格参考豆包 / Linear / Vercel：简洁有力、少形容词、多具体能力描述；视觉延续现有站点深色科技底（#030816）+ 橙色点缀（#f59e0b），玻璃拟态 + 透视网格。

---

## 0. 全站信息架构

```
Navbar（固定吸顶，毛玻璃）
├─ Hero（首屏，透视网格 + slogan + 三端下载）
├─ 核心叙事条（一句话定位 + 三个关键数字）
├─ 四大核心功能板块
│   ├─ 01 AI 工作流
│   ├─ 02 自动蒸馏技能
│   ├─ 03 智能记忆图谱
│   └─ 04 AGI 级 AI 能力
├─ 超级 AI 助理专区（会学习 / 会成长 / 会进化）
├─ 三端互通（互相操控演示）
├─ 开箱即用（零配置 + 本地优先）
├─ 团队版方案（AI 员工团队）
├─ 适用场景（个人 / 团队 / 研发）
├─ 技术架构（架构图 + 技术栈）
├─ 数据安全与隐私
└─ Footer（三端下载入口 + 备案信息）
```

对应已有站点骨架：`web_Lynx/src/App.tsx`（Navbar → Hero → Capabilities → Terminal → Footer），本方案在 Capabilities 与 Terminal 之间扩展为多章节。

---

## 1. 产品定位与核心叙事

**标题**：奇思 是你的认知操作系统
**副标题**：不是又一个 AI 聊天框，而是一个会自主学习、成长、进化的超级助理——它住在你的工作流里，三端互通，开箱即用。

**核心卖点**：
- **会进化的助理**：每次对话都会沉淀记忆与技能，越用越懂你，从"工具"进化成"会成长的同事"
- **三端可互相操控**：手机一句话，让 PC 上的 Hermes 打开浏览器抓数据；Web 端编排工作流，桌面端本地执行
- **AGI 级执行力**：不止生成文字，还能控制屏幕、跑 Shell、调浏览器、操作本地文件
- **认知复利**：灵感 → 决策 → 认知 → 记忆，全链路自动沉淀，形成可复利的知识网络
- **零学习成本**：不用学提示词工程，不用学工作流配置，直接用自然语言下达任务

**视觉呈现方式**：
- 核心叙事条（一条横向带状区域）：左侧一句定位文案，右侧三个动态数字计数器（"3 端互通 / 60+ 预置技能 / 12 岗位工作空间"）
- 背景一条极细的橙色脉冲线贯穿，象征"认知流"
- 鼠标悬停数字时弹出对应能力 tooltip

**对应代码模块**：
- 产品理念：`README.md`、`docs/USER_GUIDE.md`（"灵感收敛 · 工作聚焦 · 记忆复利"）
- 三端架构：`src/`（Web）、`desktop/src-tauri/`（桌面）、`mobile/src/`（安卓）
- 预置技能：`prisma/seed-skills.ts`（60 个技能 / 12 岗位）
- 岗位工作空间：`prisma/schema.prisma` → `ProfessionWorkspace`

---

## 2. Hero 区

**主标题**：奇思 AI 工作台
**副标题（slogan 强化）**：不用学AI，什么都能干。一个会自己成长的超级助理，住在你的三端工作台里。

**CTA**：
- 主按钮：「免费下载」（hover 展开三端下拉：Web 版 / Windows 桌面版 / 安卓 APP）
- 次按钮：「观看演示」（打开视频弹窗，播放 `web_Lynx/public/demo-video.mp4`）

**辅助信任元素**（标题下方一行细字）：
- "本地优先 · 数据自主 · 开源协议 MIT"
- "Web + Windows + Android 三端实时同步"

**视觉呈现方式**：
- 沿用现有 `web_Lynx/src/sections/Hero.tsx` + `PerspectiveGridWarp` 透视网格背景
- 全屏 100vh，深色底 `#030816`，主标题 `#F0F4F8`，slogan 透明度 0.55
- 主标题、副标题、CTA 三段错峰入场动画（cubic-bezier(0.22,1,0.36,1)）
- 底部渐变过渡到下一章节
- 右下角悬浮一个"AI 正在工作"的微型终端动画（打字机效果循环演示一条 Hermes 指令）

**对应代码模块**：
- 现有实现：`web_Lynx/src/sections/Hero.tsx`、`web_Lynx/src/sections/VideoModal.tsx`
- 三端下载入口逻辑：`desktop/src-tauri/src/lib.rs`（`check_for_updates` / Tauri updater 端点 `/api/desktop/update`）

---

## 3. 四大核心功能板块

> 本章节是官网的"肌肉"，必须用最强的视觉密度展示四大能力。建议采用左右交替布局：奇数板块左文右图，偶数板块左图右文，每个板块独立一屏滚动高度。

---

### 3.1 板块一：AI 工作流

**标题**：AI 工作流——可视化编排，自动执行，三端联动
**副标题**：拖几个节点，把重复劳动交给 AI。支持定时调度、条件分支、Hermes 本地执行，跑完自动推送结果。

**核心卖点**：
- **9 种节点自由编排**：触发器 / LLM 调用 / 条件分支 / HTTP 请求 / 数据库读写 / 数据转换 / Hermes 本地执行 / 延时 / 输出
- **图遍历执行引擎**：支持 true/false 条件分支图遍历，错误自动中断，未命中节点标记 skipped
- **定时调度 + 手动触发**：cron 表达式定时跑（如每日 9:00 生成周报），亦可一键手动执行
- **执行历史可回溯**：每次执行落库 `FlowExecution`，记录每节点耗时、token、输出、错误
- **输出直达业务**：结果可写入认知库 / 生成新技能 / 推送 Web Push 通知 / 回传对话

**视觉呈现方式**：
- 静态图：一张工作流画布截图，节点用橙色连线，条件分支处有 true/false 标签
- 动画：节点逐个亮起 → 数据沿连线流动 → 输出节点弹出"已写入认知库"气泡
- 代码演示卡：右侧终端实时打印一次"晨报工作流"的执行日志（节点名 + 耗时 + token）

**对应代码模块**：
- 执行引擎：`src/lib/flow-engine.ts`（`executeFlowInternal` / `executeFlowWithEdges` / 9 种 `executeXxxNode`）
- 调度器：`src/lib/flow-scheduler.ts`
- 存储：`src/lib/flow-store.ts`、`prisma/schema.prisma` → `Flow` / `FlowExecution`
- 页面：`src/app/ai/flows/page.tsx`
- API：`src/app/api/ai/flows/route.ts`、`src/app/api/ai/flows/[id]/route.ts`

---

### 3.2 板块二：自动蒸馏技能

**标题**：自动蒸馏技能——从工作中自动长出可复用技能
**副标题**：不用手写提示词模板。Hermes 每完成一次任务就自动 /learn 沉淀技能，重复做两次后下次自动执行。

**核心卖点**：
- **7 类预置蒸馏模板**：财务预测 / 数据周报 / 代码审查 / 知识蒸馏 / 会议纪要 / PRD 生成 / 竞品分析，参数化填空即用
- **Hermes /learn 自动沉淀**：任务完成后自动生成 YAML+MD 技能文件，回写 `Skill` 表（`source: hermes-learned`）
- **技能市场（公共广场）**：发布分享码一键导入，兼容 agentskills.io 开放标准，支持评分评论
- **版本管理 + 一键回滚**：每次编辑自动存版本快照（最多 20 版），可随时回滚
- **TaskPattern 任务模式学习**：做一遍 → 系统记录模式 → 第二次自动启用 → 第三次起自动执行

**视觉呈现方式**：
- 左侧：技能市场瀑布流卡片（含评分星级、下载次数、分类标签）
- 右侧：一个"技能蒸馏"动画——用户对话 → Hermes 执行 → /learn 齿轮转动 → 技能卡飞入"我的技能库"
- 底部小卡片：TaskPattern 时间轴（第1次手动 → 第2次记录 → 第3次自动执行打勾）

**对应代码模块**：
- 蒸馏模板：`src/lib/distill-templates.ts`（`DISTILL_TEMPLATES` 7 个模板）
- 技能解析：`src/lib/skill-parser.ts`（Markdown + YAML frontmatter 解析 / 序列化）
- Hermes 学习闭环：`docs/hermes-usage-guide.md` 第 3.2 节、`src/app/api/ai/distill/route.ts`
- 技能市场：`src/app/skills/market/page.tsx`、`src/app/api/skills/route.ts`
- 任务模式学习：`prisma/schema.prisma` → `TaskPattern`（`autoExecute` / `executionCount` / `autoExecutedCount`）
- API：`src/app/api/hermes/skills/*`、`src/app/api/skills/[id]/versions`

---

### 3.3 板块三：智能记忆图谱

**标题**：智能记忆图谱——语义记忆 + 自动关联 + 复利增长
**副标题**：每条灵感、对话、认知写入时自动向量化，与历史记忆计算相似度自动连边。用得越久，图谱越密，AI 记得越多。

**核心卖点**：
- **自动建图**：Idea / Conversation / Cognition 写入时异步生成 embedding，与全部历史记忆算余弦相似度，超阈值自动连边
- **双模降级**：AI 向量优先（BGE-M3，阈值 0.8），无 Key 时自动降级 TF-IDF（阈值 0.3），功能不中断
- **3D 力导向可视化**：节点支持滚轮缩放 + 点击聚焦，按类型筛选，孤立节点统计
- **语义搜索**：query 向量化后与全库 embedding 比相似度，返回 top N，AI 助理长期记忆即来源于此
- **三端实时同步**：Web 写入 → 数据库 → 桌面 / 移动端拉取，记忆跨设备一致

**视觉呈现方式**：
- 主视觉：一张 3D 力导向图谱，节点缓慢漂浮，相似节点用橙色细线相连
- 交互：鼠标拖拽节点，点击节点弹出关联的灵感 / 认知 / 对话卡片
- 侧栏数据条：总节点数 / 连边数 / 孤立节点数 / 当前模式（AI 向量 / TF-IDF）实时计数
- 动画：写入一条新灵感 → 新节点飞入图谱 → 自动连线 → 连线高亮闪烁

**对应代码模块**：
- 记忆写入与连边：`src/lib/memory-sync.ts`（`updateConnectionsFor` / `writeMemoryForIdea/Conversation/Cognition`）
- 向量与相似度：`src/lib/embedding.ts`（`embedText` / `cosineSimilarity` / `float32ToBuffer`）
- 语义匹配：`src/lib/semantic-match.ts`（`findSemanticMatches` 批量匹配）
- 页面：`src/app/memory/page.tsx`
- API：`src/app/api/memory/route.ts`、`src/app/api/memory/search/route.ts`
- 数据模型：`prisma/schema.prisma` → `Memory` / `EmbeddingCache`
- AI 能力判定：`src/lib/ai.ts`（`hasAIEmbedding`）

---

### 3.4 板块四：AGI 级别 AI 能力

**标题**：AGI 级 AI 能力——屏幕感知 + RPA 操控 + Hermes 自主 Agent + 语音对话 + 多模态
**副标题**：不只是聊天。奇思 能看见你的屏幕、控制你的鼠标键盘、跑 Shell、调浏览器、用语音跟你对话。

**核心卖点**：
- **屏幕感知 + 桌面 RPA**：截图识别、启动应用、鼠标键盘控制（Computer Use），执行时支持紧急停止
- **浏览器自动化**：打开 URL、导航提取页面数据（复用 agent-browser CLI），跨平台路径自动解析
- **Shell 命令执行**：批量处理文件、跑脚本、数据处理，沙箱化授权
- **Hermes 自主 Agent**：持久化 Profile 跨会话记忆、/learn 持续学习、Cron 主动汇报、Computer Use 桌面控制
- **全双工语音对话**：VAD 语音活动检测、短停顿 AI 后缀音"嗯"、超时主动打断、TTS 语音合成 + 音色克隆
- **多模态视觉**：上传图片理解、PDF 本地解析失败 AI 视觉降级

**视觉呈现方式**：
- 四宫格能力卡片，每格一个微动效：
  - 屏幕感知：模拟截图框扫描桌面元素
  - RPA 操控：鼠标光标自动移动点击
  - Hermes Agent：终端流式输出任务执行过程
  - 语音对话：声波波形随音量起伏 + "嗯"后缀音气泡
- 底部一行三档授权模式切换器（approve / once / free），hover 展开说明

**对应代码模块**：
- 桌面 RPA：`desktop/src-tauri/src/rpa/desktop.rs`、`desktop/src-tauri/src/rpa/browser.rs`、`desktop/src-tauri/src/rpa/shell.rs`、`desktop/src-tauri/src/rpa/file.rs`
- Hermes 路由执行：`desktop/src-tauri/src/hermes/mod.rs`（`router::route_and_execute`）
- 三档授权：`desktop/src-tauri/src/auth.rs`（`check_permission_by_level` / L1/L2/L3 / `request_approval`）
- 语音 VAD：`src/lib/voice-vad.ts`、`src/lib/voice-tts-stream.ts`、`src/lib/voice-asr-stream.ts`、`src/lib/voice-backchannel.ts`
- 音色克隆：`src/app/api/ai/voice-clone/route.ts`
- 多模态：`src/app/api/ai/chat/route.ts`（images 字段）、`src/lib/file-parser.ts`（PDF 解析）
- 紧急停止：`desktop/src-tauri/src/lib.rs`（`EMERGENCY_STOP` AtomicBool）

---

## 4. 超级 AI 助理专区

**标题**：一个会自主学习、成长、进化的超级助理
**副标题**：普通助理是"工具"，奇思 是"会成长的同事"。它有记忆、会学习、能主动找你。

**核心卖点（三大进化机制）**：
- **Hermes 学习管道**：每次任务带 `--learn` 执行 → 自动生成技能文件 → 回写数据库 → 下次复用。坚持 2-4 周，技能库从 0 长到几十个
- **bad 标注反馈学习**：对不满意回复标 bad → 系统写入 `feedback-learning.jsonl` → 下次对话注入"用户历史反馈"上下文，避免重复犯错
- **巡检自动发现模式**：PatrolRule 按 cron 定时跑，自动检查灵感去重 / Graveyard 复活 / 积压预警，发现问题主动推送

**进化指标卡（4 个动态数字）**：
| 指标 | 1 周里程碑 | 1 月里程碑 |
|------|-----------|-----------|
| 持久化记忆条数 | 10-20 条 | 50+ 条 |
| 已学习技能数 | 3-5 个 | 15+ 个 |
| 任务模式数 | 2-3 个 | 10+ 个 |
| 自动执行次数 | 0 | 5+ 次 |

**视觉呈现方式**：
- 顶部：一张"进化时间轴"（Day1 基础调教 → Day7 技能积累 → Day14 自动执行 → Day30 超级助理成型）
- 中部：四个指标卡，数字随滚动递增动画，下方进度条对比 1 周 / 1 月
- 底部：一段对比表——"普通 AI 助理 vs 奇思"（记忆 / 学习 / 成长 / 执行 / 主动性 五维对比）
- 背景：神经元生长动画，随滚动线条逐渐变密变亮

**对应代码模块**：
- Hermes 学习闭环：`docs/hermes-usage-guide.md` 第 3.2 / 8.3 节
- bad 标注反馈学习：`src/lib/hermes-learner.ts`（`processFeedbackReports` / `getFeedbackContext`）、`prisma/schema.prisma` → `ChatMessage.feedback`
- 巡检调度：`src/lib/patrol-scheduler.ts`（cron 注册）、`src/lib/patrol-runner.ts`、`src/lib/patrol-templates.ts`
- 巡检规则：`prisma/schema.prisma` → `PatrolRule` / `PatrolLog`
- 主动汇报：`prisma/schema.prisma` → `HermesReport`、`src/app/api/hermes/reports/route.ts`
- 接管模式：`prisma/schema.prisma` → `AISetting.hermesTakeover` / `hermesAutoReport`

---

## 5. 三端互通能力

**标题**：三端互通——Web + Windows + Android，互相操控
**副标题**：同一套数据、同一个助理、三种入口。手机一句话，PC 上的 Hermes 帮你把活干了。

**核心卖点**：
- **Web 端（Next.js 14）**：全功能工作台，端口 5176，浏览器直接用，PWA 可装主屏
- **Windows 桌面端（Tauri 2.x + Rust）**：内置 HermesAgent 本地进程、RPA 能力、自动更新、系统托盘、紧急停止
- **Android APP（uni-app）**：今日聚焦 / 看板 / AI 助理 / 飞书任务 / 记忆认知，五 Tab 原生体验
- **互相操控**：安卓端 / Web 端 → 云端 API → WS 网关（端口 3001）转发 → 目标 PC 执行 → 流式回传进度
- **数据实时同步**：会话、灵感、任务、记忆全部按用户归属落库，三端拉取一致

**视觉呈现方式**：
- 三设备并排插画（笔记本 / 手机 / 桌面），中间用橙色数据流连线
- 动画演示：手机输入"帮我把 PC 上 D 盘的 CSV 按日期重命名" → 指令经云端 → PC 执行 → 进度条流式回传 → 手机收到完成通知
- 下方指令状态流转图：pending → dispatched → executing → completed/failed

**对应代码模块**：
- Web 端：`src/app/`（全部页面）
- 桌面端：`desktop/src-tauri/src/lib.rs`、`desktop/src-tauri/src/ws_client.rs`（WS 客户端注册 + 心跳 + 远程指令处理）
- 移动端：`mobile/src/pages/`（index / board / ai/chat / tasks / memory / inbox / login）、`mobile/src/pages.json`（五 Tab）
- WS 网关：`src/lib/ws-gateway.ts`、`scripts/start-ws-gateway.js`
- 多端协同：`prisma/schema.prisma` → `PcSession` / `RemoteCommand`
- 远程指令 API：`src/app/api/hermes/execute/route.ts`、`src/app/api/pc-sessions/route.ts`
- 桥接组件：`src/components/layout/`（`DesktopBridge` 全局挂载 session 同步）

---

## 6. 开箱即用特性

**标题**：开箱即用——零配置、本地优先、数据自主
**副标题**：装上就能用，不用学AI，什么都能干。所有数据在你自己的机器上。

**核心卖点**：
- **零配置启动**：`npm install` → 配 `.env` → `prisma db push` → 4 个 seed 脚本一键初始化（管理员 / 角色 / 60 技能 / 巡检规则）
- **本地优先存储**：MySQL 数据目录 `D:\LynnHub\mysql_data`，禁止 C 盘；Hermes profile 本地化 `.lynnhub/hermes-profiles/`
- **数据自主**：本地文件操作不自动上传，仅返回操作结果摘要；用户级 AI Key 可自配，留空用全局
- **一键部署 AI 环境**：桌面端「安装 Hermes Agent」按钮，自动 `pip install hermes-agent` + 配置模型 + 测试连接
- **自动更新**：Tauri Updater 启动延迟 5s 检查，semver 比较，有更新弹窗引导

**视觉呈现方式**：
- 终端演示卡：逐行打字展示初始化命令序列（npm install → prisma db push → seed → npm run dev → Ready）
- 右侧三张特性卡：本地优先 / 数据自主 / 一键部署，每卡一个图标 + 一句话
- 底部一行：默认账号提示 `admin / admin123`（首登改密）

**对应代码模块**：
- 快速开始：`README.md`（安装 / seed 脚本）
- 磁盘规范：`DEVELOPMENT_SPEC.md` §2.1（D 盘强制 / MySQL 目录 / Hermes profile 路径）
- 一键安装：`desktop/src-tauri/src/installer.rs`、`desktop/src-tauri/src/lib.rs` → `install_ai_env` / `detect_ai_env`
- 自动更新：`desktop/src-tauri/src/lib.rs` → `check_for_updates`、`src/app/api/desktop/update/route.ts`
- 用户级 AI Key：`prisma/schema.prisma` → `User.userDeepseekApiKey` / `userMimoApiKey` / `userAiProvider`
- 本地化承诺：`DEVELOPMENT_SPEC.md` §9.5（数据安全承诺）

---

## 7. 团队版方案

**标题**：团队版——AI 员工团队，快速搭建
**副标题**：解决企业 AI 化焦虑。12 个岗位定制化工作空间，35 项细粒度权限，多用户隔离，开箱即用。

**核心卖点**：
- **12 岗位工作空间**：PM / 设计 / 前端 / 后端 / 数据 / 运营 / 市场 / HR / 财务 / 项目 / 创作者 / 创始人，每岗位独立技能白名单 + System Prompt + 模型限制
- **35 项细粒度权限**：admin / editor / viewer 内置角色 + 自定义角色，权限按 key 数组配置
- **权限缓存版本号**：角色变更时 `permissionVersion` 递增，多实例缓存自动失效，避免脏读
- **多用户数据隔离**：所有查询 `where: { userId }`，普通用户不可见他人数据，admin 可查全量
- **词元统计看板**：今日 / 昨日 / 近 7 天 / 累计四卡，按 provider 柱状图，用户消耗排行榜（金银铜）

**视觉呈现方式**：
- 顶部：12 个岗位图标网格，hover 展开该岗位的可用技能 / 模型 / 工具白名单
- 中部：权限矩阵示意图（角色 × 权限点，勾选态高亮）
- 底部：词元统计看板 mockup（四卡 + 柱状图 + 排行榜）

**对应代码模块**：
- 岗位工作空间：`prisma/schema.prisma` → `ProfessionWorkspace`（4 维定制：quickCommands / systemPrompt / defaultProvider / allowedTools）
- 角色权限：`prisma/schema.prisma` → `Role` / `User.permissionVersion`、`prisma/seed-roles.ts`
- 权限校验：`src/lib/permissions.ts`、`src/middleware.ts`（`requireAuth` / `requireAdmin` / `requirePermission`）
- 用户管理：`src/app/admin/users/page.tsx`、`src/app/api/users/route.ts`
- 词元统计：`src/app/admin/token-stats/page.tsx`、`prisma/schema.prisma` → `ChatMessage.tokens`
- 职业空间管理：`src/app/admin/`（roles / token-stats / users）

---

## 8. 适用场景

**标题**：谁在用 奇思
**副标题**：从个人认知复利到团队 AI 化，覆盖四类典型用户。

**场景一：个人认知复利**
- 用户画像：知识工作者、独立开发者、终身学习者
- 价值：灵感不丢失、决策有依据、记忆可检索、认知可复利
- 典型用法：闪电输入捕获灵感 → 看板聚焦执行 → 完成后 AI 自动提取认知 → 记忆图谱自动连边

**场景二：团队 AI 化**
- 用户画像：中小企业、创业团队、部门负责人
- 价值：解决"AI 不知道怎么用"的焦虑，12 岗位开箱即用，权限隔离
- 典型用法：admin 配岗位工作空间 → 成员按角色登录 → 各自用专属技能 → 词元统计控成本

**场景三：知识工作者**
- 用户画像：产品经理、研究员、内容创作者
- 价值：对话资产捕获（Kimi/Claude/Codex）→ AI 提取结论待办 → 沉淀认知库
- 典型用法：粘贴对话 → AI 自动提炼方法论 / 经验 / 提示词 → 关联记忆图谱

**场景四：研发团队**
- 用户画像：前端 / 后端 / 全栈工程师
- 价值：代码审查蒸馏模板、Hermes 跑 Shell 批处理、工作流自动生成周报
- 典型用法：用代码审查模板审 PR → Hermes 批量重命名文件 → 工作流定时跑构建检查

**视觉呈现方式**：
- 四宫格场景卡，每卡：用户图标 + 画像描述 + 价值点 + 一句典型用法
- 每卡悬停翻转，背面展示对应功能模块入口
- 卡片间用橙色虚线连接，象征"同一套系统服务不同角色"

**对应代码模块**：
- 灵感生命周期：`src/app/inbox/page.tsx`、`src/app/board/page.tsx`、`src/app/graveyard/page.tsx`、`src/app/converge/page.tsx`
- 对话资产：`src/app/assets/page.tsx`、`src/app/api/conversations/route.ts`（Kimi/Claude/Codex 捕获 + AI 提取）
- 认知库：`src/app/cognition/page.tsx`、`src/lib/cognition-extract.ts`
- 代码审查模板：`src/lib/distill-templates.ts` → `code-review`
- 飞书任务同步：`src/app/ai/lark-tasks/page.tsx`、`src/lib/lark-sync.ts`、`src/lib/lark-webhook-handler.ts`

---

## 9. 技术架构亮点

**标题**：技术架构——为 AGI 级工作台而生
**副标题**：Next.js + Tauri + Android + Prisma，统一 API 信封，权限缓存版本号，SSE 断连恢复，本地化 Hermes。

**架构分层**：
```
┌─────────────────────────────────────────────┐
│  三端入口                                    │
│  Web(Next.js 14) │ Windows(Tauri 2.x+Rust) │ Android(uni-app) │
└─────────────────────────────────────────────┘
                      ↕
┌─────────────────────────────────────────────┐
│  统一 API 层（Next.js API Routes）           │
│  统一信封 {success,data} + requireAuth 鉴权  │
│  SSE 流式 + WS 网关(3001) 多端协同           │
└─────────────────────────────────────────────┘
                      ↕
┌─────────────────────────────────────────────┐
│  能力层                                       │
│  AI Provider(DeepSeek/MiMo) │ Embedding(BGE-M3) │
│  Flow Engine │ Memory Sync │ Hermes Learner │
│  Patrol Scheduler │ Semantic Match           │
└─────────────────────────────────────────────┘
                      ↕
┌─────────────────────────────────────────────┐
│  数据层（Prisma + MySQL 8.4）                │
│  本地优先：D:\LynnHub\mysql_data             │
│  Hermes Profile：.lynnhub/hermes-profiles/   │
└─────────────────────────────────────────────┘
```

**核心卖点**：
- **统一 API 信封**：`{success:true,data}` / `{success:false,error:{code,message}}`，鉴权层接入统一信封，禁止裸 `NextResponse.json`
- **权限缓存版本号**：`User.permissionVersion` 角色变更递增，多实例缓存自动失效
- **SSE 流式 + 断连恢复**：AI 对话 `stream=true` 走 SSE，`data: {type:"chunk"|"done"|"error"}` 格式
- **内存缓存策略**：5 分钟 TTL + 按 key 失效 + 并发请求去重（Promise 复用防击穿）
- **WS 网关独立进程**：端口 3001，独立于 Next.js，PC 在线状态 + 远程指令路由 + 30s 心跳
- **本地化 Hermes**：每用户独立 profile，`buildHermesEnv()` 重定向 LOCALAPPDATA 环境隔离
- **Tauri Updater**：semver 比较 + 签名校验 + 启动延迟检查

**视觉呈现方式**：
- 主视觉：上方架构图（四层分层卡片，橙色箭头连接）
- 右侧：技术栈 logo 墙（Next.js / Tauri / Rust / Prisma / MySQL / DeepSeek / MiMo / BGE-M3）
- 底部：三条特性横条（统一信封 / 权限版本号 / WS 网关），每条一句话 + 代码片段

**对应代码模块**：
- 统一信封：`src/lib/api-response.ts`（`successResponse` / `listResponse` / `errorResponse`）
- 鉴权：`src/auth.ts`、`src/lib/auth-utils.ts`、`src/middleware.ts`
- 权限版本号：`prisma/schema.prisma` → `User.permissionVersion`
- SSE 流式：`src/app/api/ai/chat/route.ts`（stream=true）
- 内存缓存：`DEVELOPMENT_SPEC.md` §1.8（`withCache` 5min TTL + `invalidateCache`）
- WS 网关：`src/lib/ws-gateway.ts`、`scripts/start-ws-gateway.js`
- Hermes 本地化：`DEVELOPMENT_SPEC.md` §5.1（`buildHermesEnv` / profile 路径）
- 技术栈：`README.md`（技术栈表）

---

## 10. 数据安全与隐私

**标题**：数据安全与隐私——本地优先，数据自主
**副标题**：你的数据在你自己的机器上。Hermes 在本地跑，文件不自动上传，操作全程审计。

**核心卖点**：
- **本地优先存储**：MySQL 数据目录强制 D 盘，Hermes profile 项目内隔离，禁止 C 盘写任何项目数据
- **三档授权模式**：approve（每次弹窗）/ once（一次授权）/ free（仅记录），L1/L2/L3 分级控制
- **授权目录白名单**：用户配置 `authDirectories`，白名单外目录拒绝访问
- **操作审计日志**：所有 L2/L3 操作记录 `AgentAuditLog`（action / level / authMode / approved / result / durationMs）
- **数据安全承诺**：本地文件操作不自动上传，仅返回操作结果摘要
- **紧急停止**：AtomicBool 全局标志 + 执行前后双检查 + 5s 自动重置，托盘一键触发

**视觉呈现方式**：
- 三档授权模式切换器交互演示（点击切换 → 弹窗行为变化）
- 审计日志表格 mockup（时间 / 操作 / 等级 / 授权模式 / 审批 / 结果）
- 安全承诺徽章墙：本地优先 / 不自动上传 / 全程审计 / 紧急停止 / 白名单 / bcrypt 密码

**对应代码模块**：
- 本地优先：`DEVELOPMENT_SPEC.md` §2.1（磁盘规范）、`desktop/src-tauri/src/lib.rs` → `AppState.authorized_dirs`
- 三档授权：`desktop/src-tauri/src/auth.rs`（`check_permission_by_level` / `request_approval`）
- 审计日志：`prisma/schema.prisma` → `AgentAuditLog`
- 紧急停止：`desktop/src-tauri/src/lib.rs` → `EMERGENCY_STOP` / `emergency_stop`
- 安全承诺：`DEVELOPMENT_SPEC.md` §9.5
- 密码哈希：`docs/API.md`（bcrypt）、`prisma/schema.prisma` → `User.passwordHash`

---

## 11. Footer 文案与下载入口

**标题**：准备好开启了吗？
**副标题**：选择适合你的平台，体验 AI 驱动的全新工作方式。

**三端下载卡片**：
| 平台 | 描述 | 入口 |
|------|------|------|
| Web 版 | 浏览器直接使用 | 在线访问（端口 5176 / 生产域名） |
| Windows | 桌面客户端 | 下载安装包（`release/Lynx.exe`） |
| 安卓 APP | 移动端应用 | 下载 APK |

**底部信息**：
- 左侧：奇思 logo + "© 2026 Lynn"
- 右侧导航：服务条款 / 隐私政策 / 联系我们
- 备案信息行（可选）

**slogan 强化（Footer 顶部）**：
> 不用学AI，什么都能干。

**视觉呈现方式**：
- 沿用现有 `web_Lynx/src/sections/Footer.tsx` + `ConvergenceRays` 收敛光线背景
- 深色底 `#030816`，三端卡片玻璃拟态（`ios-glass`），hover 高亮
- 顶部 200px 渐变过渡，标题"准备好开启了吗？"错峰入场
- 底部分隔线 + 版权 + 导航链接

**对应代码模块**：
- 现有实现：`web_Lynx/src/sections/Footer.tsx`
- 三端产物：`release/Lynx.exe`（Windows）、`mobile/`（安卓构建 `scripts/build-android.py`）
- 桌面更新端点：`src/app/api/desktop/update/route.ts`
- Web 入口：`src/app/page.tsx`

---

## 附录 A：全站视觉规范

| 维度 | 规范 |
|------|------|
| 主底色 | `#030816`（深空蓝黑） |
| 主文字 | `#F0F4F8` |
| 次文字 | `rgba(240,244,248,0.55)` |
| 强调色 | `#f59e0b`（琥珀橙，CTA / 连线 / 高亮） |
| 玻璃拟态 | `backdrop-filter: blur(24px)` + `border: 1px solid rgba(255,255,255,0.1)` |
| 字体 | 系统字体栈，标题 `font-semibold tracking-tight` |
| 圆角 | 卡片 16px，按钮 12px |
| 动效曲线 | `cubic-bezier(0.22, 1, 0.36, 1)` |
| 滚动 | Lenis 平滑滚动（`lerp: 0.08`） |
| 入场 | IntersectionObserver 触发，`translateY(30px) → 0` + opacity 渐变 |
| 移动端 | 检测 UA 显示 `MobileBanner` 引导下载 APP |

> 注：现有 `web_Lynx` 站点采用深蓝科技底（与开发规范 §3 的"橙黑灰"略有差异），实际落地时以深色底 + 橙色点缀（CTA / 强调元素）统一，既保留科技感又呼应品牌橙。

---

## 附录 B：章节与代码模块映射总表

| 官网章节 | 核心代码路径 |
|---------|-------------|
| Hero | `web_Lynx/src/sections/Hero.tsx` |
| AI 工作流 | `src/lib/flow-engine.ts`、`src/lib/flow-scheduler.ts`、`src/app/ai/flows/` |
| 自动蒸馏技能 | `src/lib/distill-templates.ts`、`src/lib/skill-parser.ts`、`src/app/skills/market/`、`prisma/schema.prisma` → `TaskPattern` |
| 智能记忆图谱 | `src/lib/memory-sync.ts`、`src/lib/embedding.ts`、`src/lib/semantic-match.ts`、`src/app/memory/` |
| AGI 级 AI 能力 | `desktop/src-tauri/src/rpa/`、`desktop/src-tauri/src/hermes/`、`src/lib/voice-*.ts`、`desktop/src-tauri/src/auth.rs` |
| 超级 AI 助理 | `src/lib/hermes-learner.ts`、`src/lib/patrol-scheduler.ts`、`prisma/schema.prisma` → `HermesReport` / `ChatMessage.feedback` |
| 三端互通 | `desktop/src-tauri/src/ws_client.rs`、`src/lib/ws-gateway.ts`、`mobile/src/`、`prisma/schema.prisma` → `PcSession` / `RemoteCommand` |
| 开箱即用 | `desktop/src-tauri/src/installer.rs`、`src/app/api/desktop/update/route.ts`、`README.md` |
| 团队版 | `prisma/schema.prisma` → `ProfessionWorkspace` / `Role`、`src/app/admin/`、`src/lib/permissions.ts` |
| 适用场景 | `src/app/inbox/`、`src/app/board/`、`src/app/assets/`、`src/app/cognition/`、`src/lib/lark-sync.ts` |
| 技术架构 | `src/lib/api-response.ts`、`src/auth.ts`、`src/middleware.ts`、`src/lib/ws-gateway.ts` |
| 数据安全 | `desktop/src-tauri/src/auth.rs`、`desktop/src-tauri/src/lib.rs`、`prisma/schema.prisma` → `AgentAuditLog` |
| Footer | `web_Lynx/src/sections/Footer.tsx`、`release/Lynx.exe`、`mobile/` |

---

## 附录 C：落地优先级建议

| 优先级 | 章节 | 理由 |
|--------|------|------|
| P0 | Hero / 四大核心功能 / Footer | 首屏冲击 + 核心卖点 + 转化入口 |
| P1 | 超级 AI 助理 / 三端互通 / 开箱即用 | 差异化护城河，突出"会进化"和"互相操控" |
| P2 | 团队版 / 适用场景 / 技术架构 / 数据安全 | 商业化与信任建设，B 端决策必看 |

> 建议首版上线 P0 + P1，P2 作为第二迭代补充。所有章节内容均已在代码中找到实现依据，可直接驱动 UI 制作。

---

*本方案基于 奇思（原名 LynnHub / Lynx）代码库深度梳理生成，所有卖点均有对应代码模块支撑，文档版本 v1.0。*

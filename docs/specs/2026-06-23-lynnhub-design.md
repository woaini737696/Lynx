# LynnHub 个人认知操作系统 · 设计文档

> 日期：2026-06-23
> 状态：Phase 1 开发中
> 原则：极简 · 深色 · 捕获优先 · 复利记忆

## 1. 项目定位

LynnHub 是一套为个人定制的 AI 工作空间，解决以下痛点：

1. 灵感来得快忘得快
2. 工作想到哪做到哪，无优先级
3. 和 AI 聊完就忘，对话资产浪费
4. 过往经验没有复利
5. 缺少专属 AI 工作流
6. 记忆无法持久化

**核心逻辑**：用户只输入灵感和 AI 对话，系统自动管理、规划、输出。

## 2. 设计原则

- 极简，零学习成本
- 默认深色主题
- 捕获比整理重要 100 倍
- 简单比功能完整更重要
- 阻断 > 提醒（用机制替代意志力）
- 仪式 > 自律
- 复利 > 完成

## 3. 技术栈

| 层 | 选型 | 理由 |
|---|---|---|
| 框架 | Next.js 14 (App Router) | 全栈一体，单仓库部署 |
| 语言 | TypeScript | 类型安全 |
| 样式 | Tailwind CSS | 深色主题开箱即用 |
| 组件 | shadcn/ui | 可定制，无运行时依赖 |
| 状态 | Zustand | 轻量，适合个人工具 |
| 数据库 | MySQL + Prisma ORM | 本地已装，ECS 友好，类型安全 |
| Mock | @faker-js/faker | 中文 mock 数据 |
| AI (Phase 2+) | Vercel AI SDK | OpenAI 兼容统一接口 |
| 部署 | Docker + Nginx (ECS) | 本地 npm dev，云端 Docker |

## 4. 三层架构

```
捕获层 (Capture)  → 3秒录入 · 零分类 · 全局快捷键
  - 闪电输入浮窗 (Ctrl+Space)
  - 对话资产粘贴 (Kimi/Claude/Codex)
  - AI 对话接入 (Webhook)

收敛层 (Converge) → 防止发散 · 强制优先级 · 满额阻断
  - 决策看板 (北极星3/战役5/任务10)
  - 今日聚焦 (每日3张卡片 · 物理隔离)
  - 收敛仪式 (23:00 强制收敛)

复利层 (Compound) → 记忆持久化 · 越用越强
  - 记忆图谱 (自动关联网络)
  - 灵感墓地 (复活条件检查)
  - 认知库 (方法论/经验/提示词)
```

## 5. 八大功能模块

### 5.1 闪电输入
- 全局快捷键 Ctrl+Space 弹出浮窗
- 单一文本框，3 秒录入，零分类
- 自动入 Inbox，23:00 收敛时分类
- Esc 关闭，Enter 保存

### 5.2 对话资产
- 粘贴 Kimi/Claude/Codex 对话
- AI 自动提取：结论 / 待办 / 数据 / 提示词
- 来源标记，可搜索
- 入库自动关联记忆图谱

### 5.3 决策看板
- 三列：北极星(≤3) / 战役(≤5) / 任务(≤10)
- 满额物理阻断，无法新增
- 拖拽排序，跨列移动
- 强制做减法

### 5.4 今日聚焦
- 每日自动生成 3 张卡片
- 卡片来自决策看板任务
- 物理隔离，只显示 3 张，隐藏其他
- 完成全部解锁看板视图

### 5.5 收敛仪式
- 每晚 23:00 强制弹出
- 逐条处理 Inbox
- 三个动作：拖入看板 / 延后 / 放弃
- 必须处理完才能关闭

### 5.6 记忆图谱
- 所有输入自动嵌入向量
- 相似度 > 0.8 自动连边
- 力导向图可视化
- 点击节点查看关联

### 5.7 灵感墓地
- 放弃的想法保留
- 必填：放弃原因 + 复活条件
- 系统监测新输入，命中复活条件自动提醒
- 防止后悔，启用未来复活

### 5.8 认知库
- 自动提取：方法论 / 经验 / 提示词
- 来源：对话 + 灵感 + 手动
- 全文搜索，标签筛选
- 复利积累，越用越强

## 6. 数据模型

### ideas (灵感)
- id, content, source(lightning|conversation), status(inbox|board|graveyard)
- tags[], embedding(blob), createdAt
- 关联：→ tasks, → memories, → graveyard

### conversations (对话资产)
- id, source(kimi|claude|codex), title, rawContent
- conclusions[], todos[], prompts[], data[]
- capturedAt, embedding(blob)
- 关联：→ ideas, → memories, → cognitions

### tasks (决策看板任务)
- id, content, column(northstar|campaign|task), position
- status(active|done|dropped), sourceId, createdAt
- 约束：northstar≤3, campaign≤5, task≤10

### memories (记忆节点)
- id, type(idea|conversation|cognition), refId
- content, embedding(blob), connections[]
- strength, createdAt

### graveyard (灵感墓地)
- id, originalIdeaId, reason, reviveCondition
- abandonedAt, revivedAt

### cognitions (认知库)
- id, type(method|experience|prompt), content
- source(conversation|idea|manual), sourceId
- tags[], embedding(blob), createdAt

### daily_focus (今日聚焦)
- id, date, cardIds[3], generatedAt
- status(pending|completed)

## 7. 界面布局

- **顶栏**：全局捕获栏（Ctrl+Space 唤起闪电输入）+ Inbox 计数
- **左侧**：64px 极简图标导航（今日聚焦/看板/对话/记忆/认知/墓地）
- **主区**：上下文内容，默认落地"今日聚焦"
- **配色**：#0a0a0a 背景，#f6ad55 主色（北极星），#63b3ed（战役），#68d391（任务）

## 8. 开发路线图

### Phase 1 · Mock 骨架（本次）
- 项目初始化 + 深色主题
- 闪电输入浮窗 + Ctrl+Space
- 今日聚焦 3 卡片
- 决策看板三列 + 满额阻断
- 7 张表 Prisma schema
- faker 中文 mock 数据
- 对话资产/记忆图谱/灵感墓地/认知库 mock 页

### Phase 2 · 捕获闭环
- 对话资产 AI 提取
- 收敛仪式定时器
- 灵感墓地复活监测
- 认知库自动提取

### Phase 3 · 记忆复利
- 嵌入向量 + 相似度连边
- 记忆图谱可视化
- 语义搜索

### Phase 4 · 部署上线
- Docker 镜像
- Nginx 反代 + HTTPS
- 数据备份
- 阿里云 ECS 部署

## 9. AI Provider 接入计划 (Phase 2+)

统一使用 Vercel AI SDK，OpenAI 兼容协议：
- Claude (Anthropic) - 推理/认知库提取
- Kimi (Moonshot) - 长上下文/对话资产提取
- DeepSeek - 国内直连
- GPT-5.6 - 通用
- 通过环境变量切换 provider

# 全局体验与飞书任务下发 Spec

## Why
用户反馈 5 个问题：(1) 悬浮抽屉用 iframe 加载整个 AI 助理页面，弹出"整个系统页面"且慢，应改为极简聊天窗口快速弹出；(2) 未登录时悬浮按钮只提示"未登录"无后续引导，应弹窗引导重新登录；(3) 系统无右上角用户头像菜单，无法查看个人资料/退出登录；(4) 技能管理/市场分类不实用，应按岗位/职位分类；(5) 无法通过 AI 助理一句话生成飞书任务并下发。这些问题影响核心使用体验和工作效率。

## What Changes
- **悬浮抽屉改为极简聊天组件**：废弃 iframe 方案，新建 `AssistantChat.tsx` 轻量聊天组件（仅消息列表+输入框+发送+流式响应），不含技能面板/设置/全双工语音等重功能，保证快速弹出/收回，丝滑动效，点击空白处收回
- **未登录弹窗引导**：悬浮按钮检测未登录时，弹窗提示"登录已过期，请重新登录"+跳转登录页按钮
- **新增顶部 header 栏 + 用户菜单**：AppShell 新增顶部 header（logo+页面标题+右上角用户头像+昵称），hover 出现下拉菜单：个人资料设置（头像/昵称/姓名/职业/角色，数据持久化到 User 表）+ 退出登录（跳转登录页）
- **User 表扩展**：新增 `profession String?`（职业）和 `avatarUrl String?`（头像URL）字段
- **技能岗位分类**：CATEGORIES 替换为 12 个岗位分类（产品经理/设计师/前端工程师/后端工程师/数据分析师/运营/市场/HR/财务/项目经理/内容创作者/创业者）+ Hermes + 自定义，每类预置代表性技能
- **AI 助理一句话生成飞书任务**：新增 `createLarkTask` AI 工具，AI 解析自然语言提取任务标题/负责人/截止时间 → 聊天中显示任务卡片预览 → 用户点击"下发到飞书"确认 → 调用 lark-cli 创建飞书任务 → 返回任务链接
- **BREAKING**：悬浮抽屉不再加载完整 AI 助理页面，仅保留轻量聊天；技能分类体系变更

## Impact
- **Affected specs**：
  - AI 助理能力（悬浮入口轻量化 + 飞书任务工具）
  - 用户管理能力（个人资料设置 + 退出登录）
  - 技能管理能力（岗位分类）
  - 布局能力（新增顶部 header 栏）
- **Affected code**：
  - `src/components/ai/AssistantChat.tsx`（新建）— 极简聊天组件
  - `src/components/ai/AssistantDrawer.tsx` — 改用 AssistantChat 替代 iframe
  - `src/components/ai/AssistantGlobalEntry.tsx` — 未登录检测+弹窗
  - `prisma/schema.prisma` — User 新增 `profession` / `avatarUrl`
  - `src/components/layout/AppShell.tsx` — 新增顶部 header 栏
  - `src/components/layout/UserMenu.tsx`（新建）— 用户头像菜单
  - `src/app/settings/profile/page.tsx`（新建）— 个人资料设置页
  - `src/app/api/user/profile/route.ts`（新建）— 个人资料读写 API
  - `src/app/skills/page.tsx` — CATEGORIES 改为岗位分类
  - `src/app/skills/market/page.tsx` — 同步岗位分类
  - `prisma/seed-skills.ts`（新建或扩展）— 12 岗位预置技能
  - `src/lib/ai-assistant-tools.ts` — 新增 `createLarkTask` 工具
  - `src/lib/lark-sync.ts` — 暴露创建飞书任务函数
  - `src/app/ai/assistant/page.tsx` — 飞书任务卡片渲染+确认下发

## ADDED Requirements

### Requirement: AI 助理极简聊天抽屉
系统 SHALL 提供极简 AI 助理聊天抽屉，废弃 iframe 加载完整页面的方式。抽屉仅包含消息列表+输入框+发送按钮+流式响应，不含技能面板/设置/全双工语音等重功能，保证快速弹出/收回。

#### Scenario: 快速弹出极简聊天
- **WHEN** 用户点击右下角悬浮按钮或按 Alt+J
- **THEN** 右侧抽屉滑出（duration-200 丝滑动画）
- **AND** 抽屉内立即显示聊天界面（消息列表+输入框），无 iframe 加载延迟
- **AND** 点击抽屉外空白处快速收回（duration-200）

#### Scenario: 轻量聊天功能
- **WHEN** 抽屉打开
- **THEN** 用户可输入文字发送给 AI
- **AND** AI 流式响应显示在消息列表
- **AND** 支持多轮对话上下文
- **AND** 不包含技能面板/设置/全双工语音等重功能（这些功能在完整 AI 助理页面使用）

### Requirement: 未登录弹窗引导
系统 SHALL 在悬浮按钮检测到未登录状态时，弹窗提示"登录已过期，请重新登录"，并提供跳转登录页按钮。

#### Scenario: 未登录弹窗引导
- **WHEN** 用户点击悬浮按钮且未登录
- **THEN** 弹窗显示"登录已过期，请重新登录"
- **AND** 弹窗有"去登录"按钮，点击跳转到登录页
- **AND** 不打开聊天抽屉

### Requirement: 顶部 header 栏 + 用户菜单
系统 SHALL 在所有页面顶部显示 header 栏，左侧 logo+页面标题，右侧用户头像+昵称。hover 用户区域显示下拉菜单：个人资料设置、退出登录。

#### Scenario: 用户头像菜单显示
- **WHEN** 用户登录后访问任意页面
- **THEN** 顶部 header 栏右侧显示用户头像+昵称
- **AND** hover 头像区域显示下拉菜单
- **AND** 菜单含"个人资料设置"和"退出登录"两个选项

#### Scenario: 个人资料设置
- **WHEN** 用户点击"个人资料设置"
- **THEN** 跳转到个人资料设置页
- **AND** 可设置头像（URL 上传）、昵称、姓名、职业
- **AND** 显示当前用户角色（admin/editor/viewer，只读）
- **AND** 保存后数据持久化到 User 表

#### Scenario: 退出登录
- **WHEN** 用户点击"退出登录"
- **THEN** 调用 NextAuth signOut
- **AND** 跳转到登录页

### Requirement: 技能岗位分类
系统 SHALL 将技能管理/市场的分类改为 12 个岗位分类：产品经理/设计师/前端工程师/后端工程师/数据分析师/运营/市场/HR/财务/项目经理/内容创作者/创业者，外加 Hermes 和自定义分类。每个岗位分类预置代表性技能。

#### Scenario: 岗位分类展示
- **WHEN** 用户访问技能管理/市场页面
- **THEN** 侧边栏显示 12 个岗位分类 + Hermes + 自定义
- **AND** 点击分类显示该岗位下的技能
- **AND** 每个岗位分类有代表性预置技能

### Requirement: AI 助理一句话生成飞书任务
系统 SHALL 支持用户在 AI 助理中用自然语言描述任务，AI 解析提取任务标题/负责人/截止时间，在聊天中显示任务卡片预览，用户确认后下发到飞书创建任务。

#### Scenario: 一句话生成飞书任务
- **WHEN** 用户在 AI 助理输入"给张三下发任务：本周五前完成需求文档评审"
- **THEN** AI 解析提取：标题="完成需求文档评审"、负责人="张三"、截止时间="本周五"
- **AND** 聊天中显示飞书任务卡片预览（标题/负责人/截止时间）
- **AND** 卡片有"下发到飞书"按钮
- **WHEN** 用户点击"下发到飞书"
- **THEN** 调用 lark-cli 创建飞书任务
- **AND** 返回飞书任务链接
- **AND** 在聊天中显示创建成功+任务链接

## MODIFIED Requirements

### Requirement: AI 助理全局悬浮入口
悬浮抽屉内容从 iframe 加载 `/ai/assistant` 改为内嵌 `AssistantChat` 极简聊天组件。点击抽屉外空白处收回（桌面端也支持）。动画 duration 从 300ms 改为 200ms 提升丝滑感。

### Requirement: AppShell 布局
AppShell 新增顶部 header 栏（h-14），Sidebar 和 main 区域高度调整为 `flex-1`。

## REMOVED Requirements

### Requirement: 悬浮抽屉 iframe 加载
**Reason**：iframe 加载完整页面慢且包含重功能，不符合"极简快速弹出"需求
**Migration**：改为 AssistantChat 极简组件

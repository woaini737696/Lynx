# 数据持久化与全双工语音升级 Spec

## Why
用户反馈 4 个核心问题：(1) 飞书机器人配置反复丢失（根因：存 localStorage）；(2) 自测产生的 e2e 脏数据污染记忆图谱且无清理机制；(3) AI 助理无全局入口，必须切换页面才能使用；(4) 全双工语音仍是"点击录音→说话→点击结束→发送"半双工模式，未达到 Soul APP 那种自然对话效果。这些问题严重影响数据可信度和核心使用体验，且缺乏编码规范约束导致反复发生。

## What Changes
- **飞书配置持久化到数据库**：AISetting 表新增 `larkWebhookUrl` / `larkWebhookToken` 字段，[lark-bot/page.tsx](file:///d:/Lynn工作空间/LynnHub/src/app/settings/lark-bot/page.tsx) 从 localStorage 迁移到数据库读写；旧 localStorage 数据一次性迁移到数据库后清除
- **e2e 脏数据清理**：编写一次性清理脚本，按内容前缀（`E2E` / `E2E测试` / `测试灵感`）清理 Idea/Task/Memory/Cognition 表；e2e 测试加 `afterEach` 自动清理
- **AI 助理全局悬浮入口**：[layout.tsx](file:///d:/Lynn工作空间/LynnHub/src/app/layout.tsx) 新增右下角悬浮按钮 + 右侧抽屉面板（40% 宽度）+ `Alt+J` 快捷键唤出/收起；抽屉内嵌 AI 助理，不遮挡主内容
- **全双工语音重写（Soul 级别）**：重写 [assistant/page.tsx](file:///d:/Lynn工作空间/LynnHub/src/app/ai/assistant/page.tsx) 语音模块，实现：接通后持续 VAD 监听 + **流式 ASR（边说边转文字边理解）** → 短停顿（<1.5s）AI 回"嗯"反馈 → 长静音（>1.5s）判定说完**立即提交已累积的流式 ASR 文字**（无需等说完才开始理解，话说完立马输出回复） → 流式 TTS 播放（边生成边播）→ 用户开口立即打断 TTS → AI 可主动提问或主动打断
- **关键技术点**：采用 Web Speech API `SpeechRecognition`（连续模式）做流式 ASR，边说边输出实时文字并显示在输入框，VAD 仅用于判定"说完时机"；话说完时 LLM 已有完整文字，立即开始流式生成回复，实现"说完即答"
- **BREAKING**：全双工语音交互逻辑完全重写，旧的"点击录音/点击结束"按钮模式废弃
- **编码规范新增**：DEVELOPMENT_SPEC.md 新增「数据持久化规范」和「自测数据清理规范」两节，作为强制约束

## Impact
- **Affected specs**：
  - 飞书通知能力（依赖 webhook 配置持久化）
  - AI 助理能力（全局入口 + 全双工语音）
  - 记忆图谱能力（脏数据清理）
  - 开发规范（新增 2 节强制规范）
- **Affected code**：
  - `prisma/schema.prisma` — AISetting 新增 2 字段
  - `src/app/settings/lark-bot/page.tsx` — 读写改为数据库
  - `src/app/api/ai/settings/route.ts` — 支持新字段读写
  - `src/app/api/lark-bot/test/route.ts` — 从数据库读配置
  - `src/lib/hermes-client.ts` — `runLarkCliService` 等推送逻辑从数据库读 webhook
  - `scripts/cleanup-e2e-data.ts`（新建）— 一次性清理脚本
  - `e2e/*.spec.ts` — 加 afterEach 清理
  - `src/app/layout.tsx` — 全局悬浮入口
  - `src/components/ai/AssistantDrawer.tsx`（新建）— 抽屉组件
  - `src/app/ai/assistant/page.tsx` — 全双工语音重写
  - `src/lib/voice-vad.ts`（新建）— VAD 引擎封装
  - `DEVELOPMENT_SPEC.md` — 新增 2 节规范

## ADDED Requirements

### Requirement: 飞书机器人配置数据库持久化
系统 SHALL 将飞书机器人 Webhook URL 和 Token 持久化存储在数据库 AISetting 表中，不再使用 localStorage。用户在设置页保存配置后，刷新浏览器、清理浏览器数据、换设备登录均不丢失。

#### Scenario: 保存配置后跨会话保留
- **WHEN** 用户在设置→飞书机器人页面填写 Webhook URL 和 Token 并点击保存
- **THEN** 配置写入数据库 AISetting 表的 `larkWebhookUrl` / `larkWebhookToken` 字段
- **AND** 清理浏览器 localStorage 后重新打开页面，配置仍在

#### Scenario: 旧 localStorage 数据迁移
- **WHEN** 用户首次打开新版飞书配置页，且 localStorage 存在旧配置
- **THEN** 系统自动将 localStorage 配置迁移到数据库
- **AND** 迁移成功后清除 localStorage 中的旧键

### Requirement: 自测数据清理规范
系统 SHALL 在 DEVELOPMENT_SPEC.md 新增「自测数据清理规范」，强制要求：每次自测产生的测试数据（含 e2e 测试、手动 API 测试、脚本验证），必须在自测完成后立即清理，禁止遗留脏数据污染生产数据库。

#### Scenario: e2e 测试自动清理
- **WHEN** e2e 测试用例执行完成（无论成功或失败）
- **THEN** `afterEach` 钩子自动清理该用例创建的所有数据（按内容前缀 `E2E` 匹配）

#### Scenario: 一次性脏数据清理
- **WHEN** 运行 `npx tsx scripts/cleanup-e2e-data.ts`
- **THEN** 清理所有 content 以 `E2E` / `E2E测试` / `测试灵感` 开头的 Idea/Task/Memory/Cognition 记录
- **AND** 输出清理数量统计

### Requirement: AI 助理全局悬浮入口
系统 SHALL 在所有页面右下角显示 AI 助理悬浮按钮，点击从右侧滑出抽屉面板（桌面端 40% 宽度，移动端全屏），支持 `Alt+J` 快捷键唤出/收起。用户可在任意页面边对话边操作主内容。

#### Scenario: 悬浮按钮全局可见
- **WHEN** 用户访问 LynnHub 任意页面（除 AI 助理页面本身）
- **THEN** 右下角显示 AI 助理悬浮按钮
- **AND** 点击按钮从右侧滑出抽屉面板
- **AND** 抽屉打开时主内容不被遮挡，可继续操作

#### Scenario: 快捷键唤出
- **WHEN** 用户在任意页面按下 `Alt+J`
- **THEN** AI 助理抽屉滑出（若已收起）或收起（若已打开）

### Requirement: 全双工语音通话（Soul 级别）
系统 SHALL 实现类似 Soul APP 的全双工语音通话：接通后持续监听，无需点击录音/结束按钮。**核心标准：边说边理解（流式 ASR），话说完立马输出回复**。AI 能区分"停顿"和"说完"，短停顿回"嗯"反馈表示在听，长静音判定说完后**立即提交已累积的流式 ASR 文字**给 LLM（无需等说完才开始理解），LLM 流式生成回复，流式 TTS 播放，用户开口立即打断 TTS，AI 可主动提问或打断用户。

#### Scenario: 边说边理解（流式 ASR）
- **WHEN** 用户在全双工通话中开始说话
- **THEN** 系统通过流式 ASR（Web Speech API SpeechRecognition 连续模式）实时将语音转为文字
- **AND** 实时文字显示在输入框，用户能看到识别进度
- **AND** VAD 同步运行，仅用于判定"说完时机"（不依赖 ASR 完成事件）
- **AND** 边说边累积文字，不等说完才开始理解

#### Scenario: 话说完立马输出回复
- **WHEN** VAD 检测到长静音（>1.5s）判定用户说完
- **THEN** 立即提交当前累积的流式 ASR 完整文字给 LLM
- **AND** LLM 流式生成回复（已有 SSE 能力）
- **AND** 流式 TTS 边生成边播放（首字延迟 <500ms）
- **AND** 端到端延迟（用户说完→AI 开口首字）< 1.5 秒

#### Scenario: 接通后持续对话
- **WHEN** 用户点击"接通语音通话"按钮
- **THEN** 进入全双工模式，持续监听麦克风 + 持续流式 ASR
- **AND** 用户说话无需点击任何按钮
- **AND** 检测到短停顿（<1.5s）AI 回"嗯"等反馈音表示在听
- **AND** 检测到长静音（>1.5s）判定用户说完，自动发送给 AI
- **AND** AI 回复以流式 TTS 播放（边生成边播，降低延迟）
- **AND** TTS 播放中用户开口说话，立即打断 TTS 并重新监听

#### Scenario: AI 主动打断
- **WHEN** 用户说话冗长（>15s）或偏离主题
- **THEN** AI 可在合适时机主动插话打断（基于流式 ASR 文字判断）
- **AND** 打断后 AI 提问或引导话题

#### Scenario: 自然对话体验
- **WHEN** 全双工通话进行中
- **THEN** 端到端延迟（用户说完→AI 开口首字）< 1.5 秒（流式 ASR + 流式 LLM + 流式 TTS）
- **AND** TTS 采用流式播放（首字延迟 < 500ms）
- **AND** VAD 准确区分"停顿"和"说完"，不抢话、不漏听
- **AND** 边说边理解，说完即答，达到 Soul APP 自然对话标准

## MODIFIED Requirements

### Requirement: AI 助理语音模块
原"点击录音→说话→点击结束→发送"半双工模式改为全双工持续监听模式。保留文本输入模式作为 fallback。语音通话按钮文案从"开始录音"改为"接通语音通话"，结束按钮改为"挂断"。

### Requirement: 飞书机器人设置页
[lark-bot/page.tsx](file:///d:/Lynn工作空间/LynnHub/src/app/settings/lark-bot/page.tsx) 读写目标从 localStorage 改为数据库 API（`/api/ai/settings`）。页面加载时从数据库拉取配置，保存时写入数据库。

## REMOVED Requirements

### Requirement: 飞书配置 localStorage 存储
**Reason**：localStorage 会因清理浏览器、换设备、换浏览器而丢失，不符合数据持久化要求
**Migration**：首次加载时检测 localStorage 旧键，自动迁移到数据库后清除

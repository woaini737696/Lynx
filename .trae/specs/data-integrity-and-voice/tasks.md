# Tasks

## 任务 1：飞书机器人配置持久化到数据库
- [ ] Task 1.1：`prisma/schema.prisma` AISetting 表新增 `larkWebhookUrl String?` 和 `larkWebhookToken String?` 字段，运行 `npx prisma db push` 同步
- [ ] Task 1.2：`src/app/api/ai/settings/route.ts` GET 返回 `larkWebhookUrl`/`larkWebhookToken`，PUT 接受并保存这两个字段
- [ ] Task 1.3：`src/app/settings/lark-bot/page.tsx` 改为从 `/api/ai/settings` 拉取配置，保存时 PUT 到数据库；首次加载检测 localStorage 旧键自动迁移到数据库后清除
- [ ] Task 1.4：`src/app/api/lark-bot/test/route.ts` 改为从数据库读 webhook 配置（兼容前端传入的临时配置用于测试按钮）
- [ ] Task 1.5：`src/lib/hermes-client.ts` 中所有推送飞书的逻辑（`generateProactiveReport` / `executeCronJobViaAssistant` 等）改为从数据库读 webhook
- [ ] Task 1.6：验证：保存配置→清理 localStorage→刷新页面，配置仍在

## 任务 2：e2e 脏数据清理 + 规范
- [ ] Task 2.1：新建 `scripts/cleanup-e2e-data.ts`，按 content 前缀（`E2E` / `E2E测试` / `测试灵感`）清理 Idea/Task/Memory/Cognition 表，输出清理数量统计
- [ ] Task 2.2：运行清理脚本，清空现有记忆图谱和各表中的 e2e 脏数据
- [ ] Task 2.3：`e2e/helpers/auth.ts` 新增 `cleanupTestData(request, prefixes)` 辅助函数，按前缀清理
- [ ] Task 2.4：所有 `e2e/*.spec.ts` 加 `afterEach` 调用清理函数，清理本用例创建的 `E2E*` 数据
- [ ] Task 2.5：`DEVELOPMENT_SPEC.md` 新增「§1.5 数据持久化规范」和「§1.6 自测数据清理规范」两节强制规范

## 任务 3：AI 助理全局悬浮入口
- [ ] Task 3.1：新建 `src/components/ai/AssistantDrawer.tsx`，实现右侧抽屉面板（桌面端 40% 宽度，移动端全屏），内嵌 AI 助理完整功能，支持滑出/收起动画
- [ ] Task 3.2：新建 `src/components/ai/AssistantFloatingButton.tsx`，右下角悬浮按钮 + `Alt+J` 快捷键监听，控制抽屉开合
- [ ] Task 3.3：`src/app/layout.tsx` 在全局挂载悬浮按钮 + 抽屉组件，AI 助理页面本身不显示悬浮按钮
- [ ] Task 3.4：抽屉内 AI 助理复用 `/ai/assistant` 页面逻辑（提取为可复用组件或 iframe），保持功能一致
- [ ] Task 3.5：验证：任意页面悬浮按钮可见、点击滑出、Alt+J 唤出/收起、抽屉内可正常对话

## 任务 4：全双工语音重写（Soul 级别）
- [x] Task 4.1：新建 `src/lib/voice-vad.ts`，封装 Web Audio API VAD 引擎：实时音量+频谱分析、说话开始/结束事件、短停顿（<1.5s）反馈触发、长静音（>1.5s）说完判定
- [x] Task 4.2：新建 `src/lib/voice-asr-stream.ts`，封装 Web Speech API `SpeechRecognition`（连续模式）流式 ASR：边说边输出实时文字、累积完整文字、VAD 判定说完时立即提交累积文字（不等说完才开始理解）
- [x] Task 4.3：新建 `src/lib/voice-tts-stream.ts`，实现流式 TTS 播放：接收 AI 流式响应，按句分割，边生成边播放，首字延迟 <500ms，支持立即停止
- [x] Task 4.4：新建 `src/lib/voice-backchannel.ts`，AI 后缀音反馈：短停顿时播放"嗯"/"嗯哼"等反馈音，表示在听
- [x] Task 4.5：重写 `src/app/ai/assistant/page.tsx` 语音模块（全双工模式）：
  - 接通后持续 VAD 监听 + 持续流式 ASR（边说边转文字显示在输入框）
  - VAD 检测长静音（>1.5s）判定说完，立即提交累积的流式 ASR 文字给 LLM
  - LLM 流式响应→流式 TTS 播放（说完即答，端到端延迟 <1.5s）
  - TTS 播放中检测用户开口→立即打断 TTS→重新监听
  - 短停顿（<1.5s）AI 回"嗯"反馈
  - 按钮：接通/挂断，废弃旧的开始录音/结束录音
  - stale closure 修复：useEffect 同步 sendVoiceRef/handleVoiceSpeechEndRef，VAD onSpeechEnd 与 fallback 录音均通过 ref 调用，避免读到旧 messages
- [x] Task 4.6：实现 AI 主动打断逻辑：检测用户说话冗长（>15s）或偏离主题（基于流式 ASR 文字判断），AI 在合适时机插话
- [ ] Task 4.7：验证：边说边显示文字、短停顿 AI 回"嗯"、说完立即提交、流式 TTS、用户开口打断 TTS、端到端延迟 <1.5s（需浏览器手动测试）

## 任务 5：自测与规范落地
- [x] Task 5.1：`npx tsc --noEmit` TypeScript 编译通过
- [ ] Task 5.2：运行 `npx playwright test` e2e 测试通过，且 `afterEach` 清理生效无脏数据残留
- [ ] Task 5.3：手动验证飞书配置持久化、悬浮入口、全双工语音核心场景
- [ ] Task 5.4：更新 `DEV_LOG.md` 新增迭代30
- [ ] Task 5.5：`git add` + `commit` + `push origin master`

# Task Dependencies
- Task 2.5（规范）可与其他任务并行
- Task 1.1（schema）是 Task 1.2-1.5 的前置依赖
- Task 4.1-4.3（VAD/TTS/后缀音引擎）是 Task 4.4（重写语音模块）的前置依赖
- Task 3.1-3.2（抽屉+按钮组件）是 Task 3.3（layout 挂载）的前置依赖
- Task 5（自测）依赖 Task 1-4 全部完成

# Checklist

## 任务 1：飞书机器人配置持久化
- [ ] AISetting 表新增 `larkWebhookUrl` / `larkWebhookToken` 字段，`npx prisma db push` 同步成功
- [ ] `/api/ai/settings` GET 返回两个新字段，PUT 接受并保存
- [ ] `lark-bot/page.tsx` 从数据库拉取配置，保存写入数据库（不再用 localStorage）
- [ ] 首次加载检测 localStorage 旧键，自动迁移到数据库后清除
- [ ] `/api/lark-bot/test` 从数据库读 webhook 配置
- [ ] `hermes-client.ts` 推送飞书逻辑从数据库读 webhook
- [ ] 验证：保存配置→清理 localStorage→刷新页面，配置仍在

## 任务 2：e2e 脏数据清理 + 规范
- [ ] `scripts/cleanup-e2e-data.ts` 脚本存在且可运行
- [ ] 运行清理脚本后，记忆图谱和各表无 `E2E*` 前缀脏数据
- [ ] `e2e/helpers/auth.ts` 新增 `cleanupTestData` 辅助函数
- [ ] 所有 `e2e/*.spec.ts` 加 `afterEach` 清理钩子
- [ ] e2e 测试运行后数据库无 `E2E*` 残留
- [ ] `DEVELOPMENT_SPEC.md` 新增「§1.5 数据持久化规范」
- [ ] `DEVELOPMENT_SPEC.md` 新增「§1.6 自测数据清理规范」

## 任务 3：AI 助理全局悬浮入口
- [ ] `AssistantDrawer.tsx` 组件存在，右侧抽屉桌面端 40% 宽度、移动端全屏
- [ ] `AssistantFloatingButton.tsx` 右下角悬浮按钮 + `Alt+J` 快捷键监听
- [ ] `layout.tsx` 全局挂载悬浮按钮 + 抽屉
- [ ] AI 助理页面本身不显示悬浮按钮
- [ ] 抽屉内 AI 助理功能完整（对话/技能/语音）
- [ ] 验证：任意页面悬浮按钮可见、点击滑出、Alt+J 唤出/收起

## 任务 4：全双工语音重写
- [x] `voice-vad.ts` VAD 引擎封装：实时音量+频谱分析、说话开始/结束事件
- [x] `voice-asr-stream.ts` 流式 ASR：Web Speech API SpeechRecognition 连续模式，边说边输出文字、累积完整文字
- [x] `voice-tts-stream.ts` 流式 TTS：按句分割、边生成边播、首字延迟 <500ms、支持立即停止
- [x] `voice-backchannel.ts` 后缀音反馈：短停顿播放"嗯"
- [x] `assistant/page.tsx` 语音模块重写为全双工：接通后持续 VAD + 流式 ASR
- [x] 边说边显示实时 ASR 文字在输入框（用户能看到识别进度）
- [x] VAD 短停顿（<1.5s）触发 AI 回"嗯"反馈
- [x] VAD 长静音（>1.5s）判定说完，立即提交累积的流式 ASR 文字给 LLM
- [x] LLM 流式响应→流式 TTS 播放（说完即答）
- [x] TTS 播放中用户开口→立即打断 TTS→重新监听
- [x] 按钮文案：接通/挂断（废弃旧的开始录音/结束录音）
- [x] AI 主动打断逻辑：用户说话 >15s 或偏离主题时插话（基于流式 ASR 文字判断）
- [x] stale closure 修复：useEffect 同步 ref，VAD/fallback 通过 ref 调用最新提交函数
- [ ] 验证：端到端延迟 <1.5s（说完→AI 开口首字）、边说边理解、说完即答、不抢话不漏听（需浏览器手动测试）

## 任务 5：自测与规范落地
- [x] `npx tsc --noEmit` 编译通过
- [ ] `npx playwright test` e2e 测试通过
- [ ] e2e 测试后数据库无脏数据残留
- [ ] 手动验证飞书配置持久化核心场景
- [ ] 手动验证悬浮入口核心场景
- [ ] 手动验证全双工语音核心场景
- [ ] `DEV_LOG.md` 新增迭代30
- [ ] `git commit` + `push origin master` 成功
- [ ] `git log origin/master..HEAD` 为空（无未推送提交）

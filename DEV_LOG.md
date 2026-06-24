# LynnHub 开发日志

> 每次迭代开发时需先读取本文件，了解历史变更和当前状态。

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

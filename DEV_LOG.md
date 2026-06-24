# LynnHub 开发日志

> 每次迭代开发时需先读取本文件，了解历史变更和当前状态。

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

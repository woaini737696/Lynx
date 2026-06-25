# Hermes Agent 使用指南

> Hermes Agent 是 NousResearch 开发的开源本地 AI 代理框架，支持 Computer Use（桌面控制）、Shell 命令执行、MCP 工具集成、Skills Hub 技能市场、以及基于持久化 Profile 的自我进化。LynnHub 把 Hermes Agent 深度融入 AI 助理，让助理拥有**跨会话记忆、持续学习、自动成长、主动汇报**四大能力，从一个"问一句答一句"的聊天机器人，进化成会主动帮你干活的超级助理。

> **如果你开启 Hermes 后"没感觉到有什么作用"，99% 是因为没有开启「Hermes 接管模式（模式 C）」、或模型未配置、或 Hermes 服务未运行。请先按第 2 章完成安装与配置，再按第 3.5 节开启接管模式，最后按第 5、6 章实际使用。**

---

## 1. Hermes Agent 是什么

### 1.1 简介
Hermes Agent 是一个开源的**本地 AI 代理框架**，核心能力包括：

- **Computer Use**：控制鼠标、键盘、浏览器，完成桌面级自动化操作
- **Shell 执行**：执行任意命令行任务（文件处理、脚本运行、数据处理）
- **MCP 工具集成**：接入 Model Context Protocol 工具生态
- **Skills Hub**：技能市场，可安装/复用/分享技能
- **持久化 Profile**：每个用户独立记忆目录，跨会话保留
- **自我进化（/learn）**：任务完成后自动学习新技能，越用越强

### 1.2 与普通 AI 助理的区别

| 维度 | 普通 AI 助理（LLM 直连） | Hermes Agent 驱动的助理（模式 C） |
|------|--------------------------|-----------------------------------|
| 记忆 | 仅当前会话，刷新即忘 | 持久化 Profile，**跨会话/跨天保留** |
| 学习 | 不会学习 | 每次任务后 **/learn 自动学习新技能** |
| 成长 | 永远是初始状态 | 技能越积越多，**自动成长** |
| 执行 | 只能调用 LynnHub 内置工具 | 可执行**真实操作**（控制桌面、跑 Shell、调 MCP） |
| 主动性 | 被动等用户提问 | **定时主动汇报**，发现问题主动通知 |
| 上下文 | 不记得之前说过什么 | 能引用"你上周说的那件事" |

> 一句话：普通助理是"工具"，Hermes 助理是"会成长的同事"。

---

## 2. 安装与启动

### 2.1 一键安装
进入 **设置 → Hermes Agent**，点击「安装 Hermes Agent」按钮。系统会自动执行 `pip install hermes-agent`，安装完成后状态变为「已安装」。

**安装要求：**
- **Python**：3.11 / 3.12 / 3.13（任一版本）
- **pip**：已包含在 Python 安装中
- **操作系统**：Windows 10+ / macOS / Linux
- **磁盘空间**：约 500MB（含依赖）

**安装路径：**
- Windows：`%APPDATA%\Python\Python313\Scripts\hermes.exe`（pip --user 模式）
- macOS / Linux：`/usr/local/bin/hermes` 或 `~/.local/bin/hermes`

> 如果 `hermes` 不在 PATH 中，LynnHub 会自动查找常见安装路径，无需手动配置环境变量。

### 2.2 启动 Dashboard 服务
点击「启动服务」按钮，系统会执行：
```bash
hermes dashboard --port 9119 --no-open --skip-build
```
- **端口**：默认 9119
- **后台运行**：进程在后台运行，关闭 LynnHub 不影响 Hermes 服务
- **自动启动**：开启「自动启动」开关后，每次 LynnHub 启动时自动拉起 Hermes Dashboard
- **停止服务**：点击「停止服务」，系统通过端口查找进程并终止

### 2.3 配置 LLM 模型（前置条件，必做）
Hermes 必须配置 LLM 模型才能工作。LynnHub 支持 **DeepSeek** 和 **MiMo** 两种模型，可切换。

**一键配置（推荐）：**
1. 先在 LynnHub 中配置好 DeepSeek API Key（设置 → AI 助理 → DeepSeek 配置，或根目录 `.env` 设置 `DEEPSEEK_API_KEY`）
2. 进入 **设置 → Hermes Agent**，点击「配置模型」按钮
3. 系统会自动把 DeepSeek 密钥写入 Hermes 的 `.env`，并执行 `hermes config set model` 设置默认模型
4. 配置成功后显示 `provider / model` 信息

**切换模型：**
- DeepSeek → MiMo：在 AI 助理设置中切换默认 Provider，重新点击「配置模型」
- 模型配置写入 Hermes 的 `.env` 文件（`DEEPSEEK_API_KEY` / `DEEPSEEK_BASE_URL` / `DEEPSEEK_MODEL`）

> ⚠️ **模型未配置是"Hermes 没作用"的头号原因。** 配置前 Hermes 无法执行任何任务，接管模式会静默回退到普通 LLM 模式（不报错，但你看不到任何变化）。

### 2.4 测试连接
点击「测试连接」按钮，系统按以下顺序检测：
1. **HTTP 检测**（优先）：请求 `GET http://localhost:9119/`，返回 200 即成功
2. **命令行检测**（回退）：执行 `hermes status`，输出含版本信息即成功

连接成功后会返回 Hermes 版本号和支持的能力列表。**请务必确认测试连接通过后再进行后续操作。**

---

## 3. 五大核心功能

### 3.1 持久化 Profile（跨会话记忆）

**原理：** 每个用户拥有独立的 profile 目录，记忆、技能、会话完全隔离且跨会话保留：

```
~/.lynnhub/hermes-profiles/<userId>/hermes/
├── logs/        # 日志
├── skills/      # /learn 自动生成的技能
├── memory/      # 持久化记忆（跨会话保留）
└── sessions/    # 会话历史
```

**核心价值：** 你昨天跟 Hermes 说的话、做过的任务，今天打开浏览器它依然记得。这是普通 AI 助理做不到的。

**查看记忆状态：**
- **设置 → Hermes Agent → Profile 状态**：显示记忆条数、技能数、会话数
- 或调用 API：`GET /api/hermes/profile`

返回字段：
| 字段 | 说明 |
|------|------|
| `exists` | profile 是否已创建 |
| `memoryCount` | 持久化记忆条数 |
| `skillsCount` | 已学习技能数 |
| `sessionsCount` | 会话历史数 |
| `profileDir` | profile 目录绝对路径 |

> 💡 **首次使用时记忆为空是正常的**，需要多次对话积累。坚持使用 1-2 天后记忆开始发挥作用。

### 3.2 /learn 自动学习

**原理：** 开启接管模式后，每次任务完成 Hermes 会自动执行 `--learn`，把这次任务的解决方法提炼成一个新技能，保存到 `profile/skills/` 目录。

**学习闭环：**
1. 用户下达任务 → Hermes 执行（带 `--learn`）
2. 任务完成后，Hermes 在 `profile/skills/` 生成 YAML/MD 格式的 skill 文件
3. LynnHub 自动扫描 `profile/skills/`，把新技能同步到 LynnHub Skill 表（`source: "hermes-learned"`）
4. 下次遇到类似任务，Hermes 可直接复用已学技能

**查看学到的技能：**
- **AI 助理 → 技能面板 → Hermes Tab**：查看所有 Hermes 技能（含自动学习的）
- 或调用 API：`GET /api/hermes/skills/learned`（文件系统级别）/ `GET /api/hermes/skills`（含同步到数据库的）
- 手动触发同步：`POST /api/hermes/skills/sync`

> 💡 这是 Hermes "越用越强"的关键。重复做几次同类任务，Hermes 就能学会你的工作流。

### 3.3 Hermes Cron 接管巡检

**原理：** 将 LynnHub 的 AI 巡检规则（PatrolRule）一键迁移为 Hermes Cron 任务。迁移后，Hermes 会按 cron 表达式定时自动执行巡检，并主动汇报结果。

**操作步骤：**
1. 在 LynnHub 中先配置好巡检规则（巡检对象、触发时间、提示词）
2. 进入 **设置 → Hermes Agent → 巡检接管**，点击「接管巡检」
3. 系统调用 `POST /api/hermes/patrol-takeover`，把每条启用的 PatrolRule 转换为 Hermes Cron 任务
4. 迁移成功后，Hermes 按 `triggerTime`（支持 `HH:mm` 或 cron 表达式）自动执行

**迁移逻辑：**
- `triggerTime` 为 `HH:mm` 格式 → 自动转为 cron（如 `09:30` → `30 9 * * *`）
- 巡检提示词注入 Hermes 任务 prompt
- 巡检结果通过主动汇报推送（见第 4 章）

### 3.4 Skills 双向同步

LynnHub 与 Hermes 的技能库双向打通：

| 方向 | 操作 | API | 说明 |
|------|------|-----|------|
| LynnHub → Hermes | 导出技能 | `POST /api/hermes/skills/export`（body: `{skillId}`） | 把 LynnHub Skill 导出为 Hermes skill 文件（YAML front matter + MD）到 `profile/skills/` |
| Hermes → LynnHub | 导入技能 | `POST /api/hermes/skills/import`（body: `{fileName}`） | 从 `profile/skills/` 导入指定 skill 文件到 LynnHub Skill 表 |
| 自动同步 | /learn 回写 | `POST /api/hermes/skills/sync` | 扫描 `profile/skills/`，把 /learn 自动生成的技能批量同步到数据库 |

**操作入口：**
- **AI 助理 → 技能面板 → Hermes Tab**：查看、执行、导入导出技能
- `source` 字段标识技能来源：`hermes-learned`（自动学习）/ `hermes-imported`（手动导入）/ 其他

### 3.5 模式 C：接管 AI 助理（最关键的功能）

> **这是让用户"感觉到 Hermes 作用"的核心开关。不开这个，Hermes 只是后台工具；开了这个，AI 助理才真正由 Hermes 驱动。**

**开启后效果：**
- AI 助理的每次对话都由 Hermes Agent 处理（而非直接调 LLM）
- 自动注入**持久化记忆上下文**：Hermes 会搜索 profile/memory 中相关记忆，注入 prompt，能引用之前的对话
- 自动注入**用户当前状态**：进行中任务数、收件箱灵感数
- 自动注入**成长状态**：已学技能数、记忆条数、会话数
- 任务完成后自动 `--learn`，并异步同步新技能到数据库
- **失败时自动回退**到普通 LLM + Function Calling 模式（保证可用性）

**如何开启：**
1. 确认 Hermes 已安装、服务已启动、模型已配置、测试连接通过
2. 进入 **AI 助理 → 设置 → Hermes 接管模式（模式 C）**，打开开关
3. 开启后对话框回复会标注 `provider: hermes`，表示当前由 Hermes 驱动

**接管模式的 prompt 构建（`buildAssistantPrompt`）：**
```
## 你之前的记忆（跨会话保留）
[1] ... [5] ...                       ← 从 profile/memory 搜索的相关记忆

## 用户当前状态
- 进行中任务：N 个
- 收件箱灵感：M 条

## 你的成长状态
- 已学习技能：X 个
- 持久化记忆：Y 条
- 会话历史：Z 个

## 用户请求
<用户输入>

## 行为要求
- 你是 LynnHub 的 AI 超级助理，由 Hermes Agent 驱动...
- 基于你之前的记忆和上下文回应，能引用之前的对话内容...
- 任务完成后会自动学习（--learn）...
```

> ⚠️ **为什么开了接管还是没变化？** 见第 8 章 FAQ Q1。最常见原因：Hermes 服务没启动 / 模型没配置 / 静默回退到了 LLM 模式（你没察觉）。

---

## 4. 主动汇报（模式 C 核心能力）

### 4.1 原理
Hermes Cron 定时分析你的 LynnHub 数据（任务、灵感、认知），生成结构化汇报，存入 `HermesReport` 表，并通过 **Web Push 跨平台推送**到你的浏览器/设备。

### 4.2 汇报类型

| 类型 | 说明 | 触发方式 |
|------|------|----------|
| `daily` | 每日汇报：昨日进度总结 + 今日建议 | cron 定时 |
| `weekly` | 每周汇报：本周回顾 + 下周规划 | cron 定时 |
| `patrol` | 巡检汇报：系统状态检查结果 | 巡检接管后自动 |

### 4.3 汇报内容结构
- 当前进度总结（任务、灵感、认知的变化）
- 需要关注的事项（即将到期、积压、异常）
- 建议的下一步行动（2-3 条具体建议）
- 鼓励和反思（基于认知库中的经验）

### 4.4 如何开启
1. 进入 **AI 助理 → 设置 → 主动汇报（定时分析数据并推送）**，打开开关
2. 配置 Cron 表达式（默认 `0 9 * * *`，即每天早上 9:00）
3. 确保已订阅 Web Push 通知（浏览器授权通知权限）
4. 可点击「立即生成」按钮手动测试（调用 `POST /api/hermes/proactive-report`，body: `{type: "daily"}`）

### 4.5 查看历史汇报
- API：`GET /api/hermes/reports?type=daily&page=1&pageSize=10`
- 支持按类型筛选（`daily` / `weekly` / `patrol` / `all`）
- 清空历史：`DELETE /api/hermes/reports`

返回字段：`id` / `type` / `title` / `content` / `trigger` / `pushed` / `pushChannel` / `durationMs` / `error` / `createdAt`

---

## 5. 如何发挥最大价值

### 5.1 让 Hermes 记住你的偏好

**做法：** 开启接管模式后，主动告诉 Hermes 你的工作习惯、偏好、上下文。Hermes 会写入持久化记忆，后续对话自动应用。

**示例对话：**
```
你：我习惯每天早上先处理收件箱灵感，把可行的转成任务，再开始做任务。
    我不喜欢长篇大论，回复尽量简短。我用飞书办公，重要事项发飞书通知。
Hermes：收到，已记住你的工作习惯：
  1. 早晨先清收件箱 → 灵感转任务 → 再做任务
  2. 回复风格：简短
  3. 重要事项：飞书通知
  后续我会按这个节奏帮你。

（第二天）
你：今天有什么要处理的？
Hermes：早上好。按你的习惯，建议先清收件箱——目前有 3 条灵感待处理：
  1. ... 2. ... 3. ...
  其中第 2 条我判断可执行，要转成任务吗？
  看板上有 2 个进行中任务：...
```

### 5.2 让 Hermes 学会你的工作流

**做法：** 把重复性任务交给 Hermes 执行。Hermes 会自动 /learn，把解决方法沉淀成技能，下次遇到同类任务直接复用。

**示例：**
```
你：帮我把今天收件箱里关于"写作"的灵感，整理成一篇大纲，存到任务"本周文章"下。
Hermes：（执行：搜索灵感 → 筛选写作相关 → 生成大纲 → 创建子任务）
      完成。已整理 4 条写作灵感为大纲，挂到"本周文章"下。
      （后台：/learn 生成技能 "灵感整理为大纲"）

（一周后）
你：再帮我整理一下写作灵感
Hermes：（自动复用已学技能，直接执行，速度更快）
```

**查看学会的技能：** AI 助理 → 技能面板 → Hermes Tab，`source: hermes-learned` 的就是自动学到的。

### 5.3 让 Hermes 主动汇报

**做法：** 开启主动汇报 + 巡检接管，让 Hermes 从"被动应答"变成"主动找你"。

- **每天早上**：收到 Hermes 推送的昨日总结 + 今日建议
- **巡检接管后**：Hermes 自动检查系统状态，发现问题主动推送

**示例推送：**
```
🤖 每日汇报 - 2026/6/25

## 进度总结
- 昨日完成任务 2 个，新增灵感 5 条
- 看板积压任务 8 个（环比 +2）

## 需要关注
- 任务"修复登录 bug"已积压 3 天，建议优先处理
- 收件箱有 5 条灵感未整理

## 建议行动
1. 先处理积压的登录 bug
2. 花 15 分钟清收件箱
3. 今日聚焦"本周文章"任务
```

---

## 6. 使用案例（10 个具体场景）

### 案例 1：每日晨报
**场景：** 每天早上自动收到昨日总结和今日建议，不用自己翻看板。
**操作步骤：**
1. 开启 Hermes 接管模式 + 主动汇报
2. 设置 Cron 为 `0 9 * * *`（每天 9:00）
3. 订阅 Web Push 通知
**预期效果：** 每天 9:00 收到推送，包含进度总结、关注事项、行动建议
**示例对话：**
```
你：（无需操作，Hermes 主动推送）
🤖 每日汇报 - 2026/6/25
昨日完成 2 任务，新增 5 灵感。建议今日：1. 修登录 bug 2. 清收件箱...
```

### 案例 2：任务自动化
**场景：** 用自然语言让 Hermes 自动创建、分类、完成任务。
**操作步骤：** 开启接管模式，直接对话。
**预期效果：** Hermes 调用工具自动操作看板
**示例对话：**
```
你：把收件箱里"研究 WebGPU"这条转成任务，放到 task 列，优先级标高
Hermes：已创建任务"研究 WebGPU"（task 列，高优先级）。要我现在开始拆解步骤吗？
```

### 案例 3：灵感整理
**场景：** 收件箱灵感越来越多，让 Hermes 整理成结构化任务。
**操作步骤：** 开启接管模式，让 Hermes 批量处理灵感。
**预期效果：** 灵感被归类、去重、转化为可执行任务
**示例对话：**
```
你：把收件箱里关于"AI 助理"的灵感整理一下，合并成一个任务，附上原始灵感
Hermes：找到 4 条相关灵感：
  1. 语音输入 2. 多模态 3. 主动提醒 4. 跨设备
  已合并为任务"AI 助理增强（含 4 条灵感）"，挂到 task 列。
```

### 案例 4：记忆检索
**场景：** 问 Hermes"我之前说过什么"，引用持久化记忆。
**操作步骤：** 开启接管模式，直接问。
**预期效果：** Hermes 搜索 profile/memory 返回相关记忆
**示例对话：**
```
你：我上周说要在周末做什么来着？
Hermes：你上周三提到"周末要整理 Q2 的认知库，把重复的合并"，周五又补充了"顺便把过期的归档"。要我现在开始整理吗？
```

### 案例 5：技能学习
**场景：** 让 Hermes 学习一个新工作流，下次自动应用。
**操作步骤：** 开启接管模式，让 Hermes 执行一次完整任务流程。
**预期效果：** /learn 自动生成技能，技能面板可见
**示例对话：**
```
你：帮我把今天完成的任务导出成 Markdown 清单，按列分组
Hermes：（执行：查已完成任务 → 按列分组 → 生成 MD）
      完成。已生成清单：
      ## Done
      - 任务A - 任务B ...
      （后台 /learn 生成技能 "导出已完成任务为MD"）

你：（技能面板 → Hermes Tab 可看到新技能"导出已完成任务为MD"）
```

### 案例 6：巡检接管
**场景：** Hermes 按 cron 检查系统状态，发现问题主动汇报。
**操作步骤：**
1. 配置巡检规则（如每日检查积压任务）
2. 设置 → Hermes Agent → 巡检接管
3. 开启主动汇报
**预期效果：** Hermes 定时巡检，异常主动推送
**示例对话：**
```
你：（无需操作）
🤖 巡检汇报 - 2026/6/25
⚠️ 发现 2 个问题：
1. 任务"修登录bug"积压 3 天，超过阈值
2. 收件箱有 8 条灵感未处理（超过 5 条阈值）
建议：优先处理登录 bug，今晚花 20 分钟清收件箱。
```

### 案例 7：跨会话上下文
**场景：** 关闭浏览器后重新打开，Hermes 记得之前的对话。
**操作步骤：** 开启接管模式，正常对话即可。
**预期效果：** 跨会话记忆自动生效
**示例对话：**
```
（周一）
你：我在写一篇关于 Hermes 的文章，大纲分三部分：是什么、怎么用、最佳实践。
Hermes：记下了。三部分大纲：是什么/怎么用/最佳实践。需要我帮你扩展哪部分？

（周三，重新打开浏览器）
你：接着写那篇文章吧
Hermes：好，继续你的 Hermes 文章（是什么/怎么用/最佳实践）。上次停在"怎么用"，
      要继续写"最佳实践"部分吗？我建议加入持久化记忆和 /learn 两个亮点。
```

### 案例 8：批量数据处理
**场景：** 让 Hermes 执行 shell 命令批量处理文件。
**操作步骤：** 在 AI 工作流中添加 Hermes 节点（shell 模式），或直接对话让 Hermes 执行。
**预期效果：** Hermes 执行 shell 命令完成批量操作
**示例对话：**
```
你：把 D:\导出 目录下所有 csv 文件按日期重命名为 YYYYMMDD-原名.csv
Hermes：（shell 模式执行：遍历文件 → 解析日期 → 重命名）
      完成，已重命名 23 个 csv 文件。
```

### 案例 9：Computer Use
**场景：** 让 Hermes 控制桌面完成复杂操作。
**操作步骤：** 在 AI 工作流添加 Hermes 节点（computer_use 模式），或对话指定。
**预期效果：** Hermes 控制鼠标键盘完成操作
**示例对话：**
```
你：用 Hermes 打开浏览器，访问 github.com，搜索 hermes-agent，截图保存
Hermes：（computer_use：打开浏览器 → 输入 URL → 搜索 → 截图）
      完成，截图已保存到 D:\screenshots\github-search.png
```
> ⚠️ computer_use 会控制你的鼠标键盘，执行时请勿干扰。需安装 `trycua` 依赖。

### 案例 10：自动成长
**场景：** 长期使用后 Hermes 积累的技能越来越多，成为个性化超级助理。
**操作步骤：** 持续使用接管模式 2-4 周。
**预期效果：** 技能库从 0 增长到几十个，Hermes 越来越懂你
**示例对话：**
```
（使用 1 个月后）
你：看看我现在有多少技能了
Hermes：你目前共有 37 个技能（其中 Hermes 自动学习 24 个）：
  - 灵感整理为大纲（自动学习，使用 8 次）
  - 导出已完成任务为MD（自动学习，使用 5 次）
  - 每日巡检推送（自动学习，使用 30 次）
  - ...
  最近一个月你的任务完成效率提升了约 40%。
```

---

## 7. 最佳实践：Hermes 高级用户的日常

> 一个把 Hermes 用到极致的用户，典型的一天是这样的：

### 早上 9:00 —— 被 Hermes 叫醒
- 手机/浏览器收到 Hermes 的**每日汇报推送**
- 内容：昨日完成情况、今日聚焦任务、收件箱待清理、潜在风险
- 不用自己打开看板，Hermes 已经帮你梳理好了

### 工作中 —— 全程 Hermes 接管
- AI 助理开启**接管模式**，所有对话都由 Hermes 处理
- Hermes 记得你的偏好（回复简短、重要事项发飞书、早晨先清收件箱）
- 重复性任务交给 Hermes，它自动 /learn 沉淀技能
- 偶尔问"我上周说过什么"，Hermes 引用持久化记忆回答

### 中午 —— 巡检自动跑
- Hermes Cron 按巡检规则自动检查系统
- 发现积压任务/异常，**主动推送**巡检汇报
- 不用人工盯盘

### 晚上 —— Hermes 自动学习
- 当天执行过的任务，Hermes 自动 /learn 生成新技能
- 新技能同步到技能面板，下次可复用
- 跨会话记忆持续积累

### 长期 —— 越用越强
- 2-4 周后，技能库积累 20-50 个个性化技能
- Hermes 越来越懂你的工作流，响应越来越快
- 从"工具"进化成"会成长的同事"

**高级用户的 5 个习惯：**
1. **一定开启接管模式** —— 不开等于没用
2. **主动告诉 Hermes 偏好** —— 让记忆发挥作用
3. **重复任务交给 Hermes** —— 触发 /learn 沉淀技能
4. **开启主动汇报 + 巡检接管** —— 让 Hermes 主动找你
5. **坚持使用 2 周以上** —— 记忆和技能需要时间积累

---

## 8. 持续调教训练：让 Hermes 越来越懂你

> Hermes 出厂是通用模型，不懂你的工作习惯。通过**持续调教**，Hermes 会记住你的偏好、学习你的工作流、积累专属技能，2-4 周后从"通用助理"进化成"个性化超级助理"。本章是 Hermes 用得好的核心秘诀。

### 8.1 调教的四大方式

| 方式 | 原理 | 见效速度 | 操作难度 |
|------|------|----------|----------|
| **记忆调教** | 告诉 Hermes 偏好/习惯/上下文，写入持久化记忆 | 立即 | ⭐ |
| **技能强化** | 重复任务交给 Hermes，触发 /learn 沉淀技能 | 1-3 天 | ⭐⭐ |
| **任务模式学习** ⭐ | 做一遍→自动学习→下次自动做（TaskPattern） | 2 次 | ⭐⭐ |
| **反馈纠正** | 答错时纠正，更新记忆 | 立即 | ⭐ |

---

### 8.2 记忆调教：告诉 Hermes 你的偏好

**做法：** 开启接管模式后，主动告诉 Hermes 你的工作习惯、偏好、上下文。Hermes 会写入 `profile/memory/`，后续对话自动应用。

**示例对话：**
```
你：我习惯每天早上先处理收件箱灵感，把可行的转成任务，再开始做任务。
    我不喜欢长篇大论，回复尽量简短。我用飞书办公，重要事项发飞书通知。
    我的时区是东八区，工作时间 9:00-18:00。

Hermes：已记住你的工作习惯：
  1. 早晨先清收件箱 → 灵感转任务 → 再做任务
  2. 回复风格：简短
  3. 重要事项：飞书通知
  4. 时区：UTC+8，工作时间 9:00-18:00
  后续我会按这个节奏帮你。
```

**调教要点：**
- ✅ 一次性告诉多个偏好（Hermes 会分别记忆）
- ✅ 跨天补充（"对了，我周末不工作"）
- ✅ 具体而非抽象（"回复不超过 3 句话" 比 "简短" 更好）
- ❌ 不要假设 Hermes 记得 —— 第一次说的时候明确强调"记住这个"

**查看记忆：** 设置 → Hermes Agent → Profile 状态，或 API `GET /api/hermes/profile`

---

### 8.3 技能强化：重复任务触发 /learn

**做法：** 把重复性任务交给 Hermes 执行。每次完成后 Hermes 自动执行 `--learn`，把解决方法沉淀成 YAML/MD 格式的技能文件，保存到 `profile/skills/`。

**学习闭环：**
1. 用户下达任务 → Hermes 执行（带 `--learn`）
2. 任务完成后，在 `profile/skills/` 生成技能文件
3. LynnHub 自动扫描同步到数据库（`source: "hermes-learned"`）
4. 下次遇到类似任务，Hermes 复用已学技能，速度更快

**示例：**
```
你：帮我把今天收件箱里关于"写作"的灵感，整理成一篇大纲，存到任务"本周文章"下。

Hermes：（执行：搜索灵感 → 筛选写作相关 → 生成大纲 → 创建子任务）
      完成。已整理 4 条写作灵感为大纲，挂到"本周文章"下。
      （后台：/learn 生成技能 "灵感整理为大纲"）

（一周后）
你：再帮我整理一下写作灵感
Hermes：（自动复用已学技能 "灵感整理为大纲"，直接执行，速度更快）
```

**触发 /learn 的技巧：**
- ✅ 任务描述要**完整具体**（"把收件箱里关于写作的灵感整理成大纲" 比 "整理灵感" 更容易学到好技能）
- ✅ 同类任务**做 2-3 次**，技能会越练越精
- ✅ 让 Hermes **解释它怎么做的**（"说说你的步骤"），有助于学习
- ❌ 一次性的任务不需要 /learn（"今天天气怎样"）

**查看学会的技能：** AI 助理 → 技能面板 → Hermes Tab，`source: hermes-learned` 的就是自动学到的

---

### 8.4 任务模式学习：做一遍 → 自动做 ⭐（核心功能）

> 这是你最想要的"自动帮我工作"功能。系统会学习你的任务执行模式，**做一遍后下次同类任务自动执行**。

#### 8.4.1 工作原理

```
第 1 次：你手动执行任务 "创建灵感：xxx"
        ↓ 系统自动记录任务模式（TaskPattern）
        ↓ 提取关键词、生成 hermesPrompt、保存 steps

第 2 次：你又执行同类任务 "创建灵感：yyy"
        ↓ 系统识别到已存在类似模式
        ↓ executionCount +1，达到 2 次
        ↓ 自动启用 autoExecute = true

第 3 次起：你输入 "创建灵感：zzz"
        ↓ 系统检查匹配模式（findMatchingPattern）
        ↓ 命中！自动通过 Hermes 执行（executePatternAutomatically）
        ↓ 你不需要做任何事，任务已完成
```

#### 8.4.2 操作步骤

**Step 1：开启 Hermes 接管模式**（默认已开启）
- AI 助理 → 设置 → 「Hermes 接管模式（模式 C）」开关应为开启
- 状态栏显示绿色 "🤖 Hermes Agent 模式"

**Step 2：正常使用 AI 助理执行任务**
- 每次对话后，系统自动调用 `learnTaskPattern` 学习
- 你不需要做任何额外操作

**Step 3：查看已学习的模式**
- AI 助理页面 → 底部「任务模式学习」面板
- 或 API：`GET /api/hermes/patterns`
- 显示：模式关键词、执行次数、是否自动执行、最后执行时间

**Step 4：管理自动执行开关**
- 在任务模式面板，每个模式有 `autoExecute` 开关
- 手动开启/关闭：`PATCH /api/hermes/patterns/{id}`（body: `{autoExecute: true/false}`）
- 删除模式：`DELETE /api/hermes/patterns/{id}`

**Step 5：手动触发自动执行检查**
- 点击「检查自动执行」按钮
- 或 API：`POST /api/hermes/patterns/auto-check`
- 系统扫描最近任务，匹配到模式则自动执行

#### 8.4.3 什么样的任务适合自动执行？

| 适合 ✅ | 不适合 ❌ |
|--------|----------|
| 重复性高的任务（创建灵感、完成看板任务） | 一次性的创意任务（写一首诗） |
| 步骤固定的任务（导出报告、整理数据） | 需要人工判断的任务（评审方案） |
| 参数化任务（"创建灵感：{内容}"） | 模糊任务（"想想怎么做"） |
| 低风险任务（添加标签、更新状态） | 高风险任务（删除数据、发布上线） |

#### 8.4.4 调教技巧

1. **前 2 次手动执行时，描述要一致**
   - ✅ 第1次："创建灵感：研究 WebGPU" / 第2次："创建灵感：学习 React 19"
   - ❌ 第1次："加个灵感 WebGPU" / 第2次："帮我记一下要学 React"
   - 描述一致 → 关键词提取更准 → 匹配率更高

2. **关键词要明确**
   - 系统从任务描述提取关键词（如"创建灵感"、"导出报告"）
   - 关键词越明确，误触发越少

3. **定期清理不用的模式**
   - 任务模式面板 → 删除执行次数低或不再用的模式
   - 避免"模式污染"影响匹配准确率

4. **关注 autoExecute 状态**
   - 默认执行 2 次后自动开启
   - 如果不想自动执行，手动关闭开关

---

### 8.5 反馈纠正：让 Hermes 不犯同样的错

**做法：** Hermes 答错了？直接告诉它正确答案。它会更新记忆，下次不犯同样错误。

**示例对话：**
```
你：帮我完成今天的每日聚焦任务
Hermes：好的，我帮你把"写周报"标记为完成。
你：不对，"写周报"还没完成，我只想完成"回复邮件"。
    记住：完成每日聚焦任务时，要逐个确认，不要批量完成。

Hermes：抱歉，已更新记忆：
  - 完成每日聚焦任务时，逐个确认，不批量完成
  - "写周报"保持未完成
  下次我会逐个确认。
```

**纠正技巧：**
- ✅ 明确指出**错在哪里** + **正确做法是什么**
- ✅ 强调"记住这个" / "以后这样做"
- ✅ 给出**原因**（"因为批量完成会让我漏掉未做完的"）
- ❌ 不要只说"错了"而不说正确答案
- ❌ 不要发脾气（Hermes 会记住你的情绪，但不会因此变聪明）

---

### 8.6 模型选择策略

不同任务适合不同模型，Hermes 支持切换：

| 模型 | 适合场景 | 特点 |
|------|----------|------|
| **DeepSeek**（默认） | 代码、推理、结构化任务、中文理解 | 推理强、速度快、中文好 |
| **MiMo** | 语音对话、多模态、创意写作、情感理解 | 语音自然、多模态、创意佳 |
| **Auto**（推荐） | 通用场景 | 自动选择最合适的模型 |

**切换方式：**
- AI 助理 → 设置 → 选择 Hermes 使用的模型
- 或 API：`POST /api/hermes/configure-model`（body: `{provider: "deepseek"|"mimo"|"auto"}`）
- Auto 模式会读取 `AISetting.defaultProvider` 自动选择

**调教建议：**
- 日常对话用 Auto
- 写代码时手动切 DeepSeek
- 语音通话时手动切 MiMo

---

### 8.7 调教进度评估

通过以下指标评估 Hermes 的"成长进度"：

| 指标 | 查看位置 | 里程碑 |
|------|----------|--------|
| 记忆条数 | 设置 → Hermes Agent → Profile 状态 | 1周：10-20条 / 1月：50+条 |
| 技能数 | 技能面板 → Hermes Tab | 1周：3-5个 / 1月：15+个 |
| 任务模式数 | AI助理 → 任务模式学习 | 1周：2-3个 / 1月：10+个 |
| 自动执行次数 | 任务模式面板 → autoExecutedCount | 1月：5+次 |
| 跨会话引用 | 对话中 Hermes 是否引用之前内容 | 1周后应能引用 |

**如果 1 周后记忆仍是 0：**
1. 检查接管模式是否真的开启（状态栏显示绿色徽章）
2. 检查 Hermes 服务是否运行（设置 → 状态应为「运行中」）
3. 检查模型是否配置（点击「配置模型」）
4. 检查是否静默回退（对话返回的 `provider` 是否为 `hermes`）

---

### 8.8 调教最佳实践清单

**每日必做：**
- [ ] 开启 Hermes 接管模式（默认已开启）
- [ ] 用 AI 助理执行日常任务（触发 /learn 和 TaskPattern）
- [ ] Hermes 答错时及时纠正

**每周必做：**
- [ ] 查看任务模式学习面板，清理无用模式
- [ ] 查看技能面板 Hermes Tab，了解新学到的技能
- [ ] 主动告诉 Hermes 本周的新偏好/新上下文

**每月必做：**
- [ ] 评估调教进度（记忆数、技能数、模式数）
- [ ] 调整 autoExecute 开关（关闭误触发的模式）
- [ ] 删除过期的记忆/技能（保持精简）

---

### 8.9 完整调教案例：从 0 到超级助理（30 天）

**Day 1-3：基础调教**
```
你：我是产品经理，主要做 LynnHub 项目。工作时间 9:00-18:00，时区 UTC+8。
    回复尽量简短，不超过 3 句话。重要事项发飞书通知。
    每天早上先清收件箱，再做任务。

Hermes：已记住你的工作习惯...
```

**Day 4-7：技能积累**
- 每天用 Hermes 执行 3-5 个任务（创建灵感、整理看板、导出报告）
- Hermes 自动 /learn 生成 3-5 个技能
- 任务模式学习开始记录

**Day 8-14：自动执行启动**
- 重复任务执行 2 次后，autoExecute 自动开启
- 同类任务开始自动执行
- 记忆条数达到 10-20 条，跨会话引用开始生效

**Day 15-30：超级助理成型**
- 技能库 15+ 个，覆盖主要工作流
- 任务模式 10+ 个，50% 重复任务自动执行
- Hermes 主动汇报每天推送
- 跨会话记忆成熟，能引用一周前的对话

**预期效果：**
- 每天节省 30-60 分钟重复劳动
- 任务完成效率提升 30-50%
- 从"工具"进化成"会成长的同事"

---

## 9. 常见问题

### Q1：为什么开启 Hermes 接管后感觉没变化？
**这是最常见的抱怨，按顺序排查：**
1. **Hermes 服务是否运行？** 设置 → Hermes Agent → 状态应为「运行中」。没运行就点「启动服务」。
2. **模型是否配置？** 点击「配置模型」，确认返回 `configured: true`。**模型未配置时 Hermes 会静默回退到普通 LLM 模式，不报错但你看不到任何变化。**
3. **测试连接是否通过？** 点击「测试连接」，确认返回版本号。
4. **接管开关是否真的开了？** AI 助理 → 设置 →「Hermes 接管模式（模式 C）」开关是否勾选。
5. **是否静默回退了？** 接管模式下 Hermes 执行失败会自动回退到 LLM 模式（不报错）。检查对话返回的 `provider` 字段，是 `hermes` 才说明真的在用 Hermes。

### Q2：Hermes 学到的技能在哪里？
文件系统：`~/.lynnhub/hermes-profiles/<userId>/hermes/skills/`
数据库：LynnHub Skill 表，`source = "hermes-learned"`
查看入口：AI 助理 → 技能面板 → Hermes Tab

### Q3：如何切换 Hermes 使用的模型？
- **设置 → Hermes Agent → 配置模型**（一键配置，复用 LynnHub 的 DeepSeek/MiMo 密钥）
- 切换 Provider：AI 助理设置中切换默认 Provider（DeepSeek / MiMo），重新点击「配置模型」
- 模型配置写入 Hermes 的 `.env` 文件

### Q4：Hermes 记忆能持续多久？
**永久。** 记忆存储在 `~/.lynnhub/hermes-profiles/<userId>/hermes/memory/`，跨会话、跨重启保留，除非手动删除 profile 目录。

### Q5：如何重置 Hermes 记忆？
删除 profile 目录：
```bash
# Windows
rmdir /s /q "%USERPROFILE%\.lynnhub\hermes-profiles\<userId>"

# macOS / Linux
rm -rf ~/.lynnhub/hermes-profiles/<userId>
```
删除后下次使用会自动重建空 profile。

### Q6：启动失败，提示「无法获取进程 PID」
1. 终端执行 `pip show hermes-agent` 确认已安装
2. 执行 `where hermes`（Windows）或 `which hermes`（macOS/Linux）确认在 PATH 中
3. 确认 Python Scripts 目录位置，LynnHub 会自动查找 `%APPDATA%\Python\Python313\Scripts\hermes.exe`

### Q7：测试连接失败
1. 确认已点击「启动服务」且状态显示「运行中」
2. 检查端口 9119 是否被占用：`netstat -ano | findstr :9119`
3. 端口被占用则停止服务后重新启动

### Q8：任务执行超时
在工作流节点或 API 请求中增加 `timeout` 参数（单位秒，最大 600）。Hermes CLI 执行较慢（10-60 秒），复杂任务耐心等待。

### Q9：computer_use 模式无法控制桌面
1. 执行 `pip install trycua`
2. macOS：系统偏好设置 → 安全性与隐私 → 隐私 → 辅助功能 → 添加终端
3. Windows：以管理员身份运行

### Q10：技能列表为空
在终端执行 `hermes skills list` 初始化技能市场，或访问 [Hermes Skills Hub](https://github.com/NousResearch/hermes-skills) 手动安装。

---

## 10. API 参考

### Hermes Dashboard HTTP API（服务启动后可用）
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/` | 健康检查 + 版本信息 |
| POST | `/api/task` | 执行任务 |
| GET | `/api/skills` | 获取技能列表 |
| POST | `/api/skills/:id/execute` | 执行指定技能 |

### LynnHub Hermes API
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/hermes/config` | 获取 Hermes 配置 |
| PUT | `/api/hermes/config` | 更新配置 |
| GET | `/api/hermes/status` | 检测安装/运行状态 |
| POST | `/api/hermes/install` | 安装/启动/停止 |
| POST | `/api/hermes/test` | 测试连接 |
| POST | `/api/hermes/execute` | 执行任务 |
| GET | `/api/hermes/skills` | 获取技能列表 |
| GET | `/api/hermes/skills/learned` | 列出 profile 下文件系统级 learned skills |
| POST | `/api/hermes/skills/sync` | 手动触发同步 /learn 生成的 skills 到数据库 |
| POST | `/api/hermes/skills/export` | 导出 LynnHub Skill 到 Hermes（body: `{skillId}`） |
| POST | `/api/hermes/skills/import` | 从 Hermes 导入 skill 到 LynnHub（body: `{fileName}`） |
| GET | `/api/hermes/profile` | 获取用户 profile 状态（记忆数/技能数/会话数） |
| POST | `/api/hermes/memory/search` | 搜索持久化记忆 |
| GET | `/api/hermes/cron` | 列出 Hermes cron jobs |
| POST | `/api/hermes/cron` | 创建 cron job（body: `{schedule, prompt}`） |
| DELETE | `/api/hermes/cron/[id]` | 删除指定 cron job |
| POST | `/api/hermes/patrol-takeover` | Hermes Cron 接管 AI 巡检 |
| POST | `/api/hermes/proactive-report` | 生成主动汇报（body: `{type: daily\|weekly\|patrol}`） |
| GET | `/api/hermes/reports` | 获取汇报历史（query: `type, page, pageSize`） |
| DELETE | `/api/hermes/reports` | 清空汇报历史 |
| POST | `/api/hermes/configure-model` | 一键配置 Hermes 的 LLM 模型 |
| GET | `/api/hermes/configure-model` | 查询 Hermes 模型配置状态 |

### 命令行
```bash
# 启动 Dashboard
hermes dashboard --port 9119 --no-open --skip-build

# 检测状态
hermes status

# 执行任务（命令行模式）
hermes -z "你的任务描述" --cli --yolo

# 列出技能
hermes skills list

# Cron 管理
hermes cron list
hermes cron add --schedule "0 9 * * *" --prompt "任务描述" --yolo
hermes cron delete <jobId>

# 模型配置
hermes config set model deepseek-chat
hermes config show
```

---

## 11. 注意事项

1. **模型配置是前置条件**：未配置 LLM 模型时 Hermes 无法工作，接管模式会静默回退到普通 LLM 模式（不报错，但 Hermes 不生效）。**这是"开了 Hermes 没感觉"的头号原因。**

2. **接管模式必须手动开启**：仅安装 Hermes 不会改变 AI 助理行为，必须在 AI 助理设置中打开「Hermes 接管模式（模式 C）」开关。

3. **Hermes CLI 执行较慢**：单次任务通常 10-60 秒（含模型推理 + 工具调用），复杂任务更久。请耐心等待，或在 API/工作流中调大 `timeout`（最大 600 秒）。

4. **持久化记忆首次为空**：新 profile 的 memory/skills/sessions 计数都是 0，需要多次对话积累才能体现价值。坚持使用 1-2 天后记忆开始生效。

5. **静默回退机制**：接管模式下 Hermes 执行失败时，会自动回退到普通 LLM + Function Calling 模式，保证可用性。但这意味着你可能"以为在用 Hermes，实际在用 LLM"。检查对话返回的 `provider` 字段确认（`hermes` = Hermes 驱动，其他 = 回退到 LLM）。

6. **`--yolo` 参数**：命令行模式默认使用 `--yolo` 跳过确认，请确保任务描述清晰可控。

7. **桌面控制权限**：`computer_use` 模式会控制你的鼠标和键盘，执行时请勿干扰，且不要在重要操作时启用。

8. **Shell 执行安全**：`shell` 模式可执行任意命令，请勿执行来源不明的技能。

9. **网络隔离**：Hermes Dashboard 默认监听 `localhost:9119`，不对外暴露。如需远程访问请配置防火墙和认证。

10. **Profile 隔离**：每个用户独立 profile（`~/.lynnhub/hermes-profiles/<userId>/`），记忆/技能/会话完全隔离，不会串用户。

---

## 12. 参考链接

- **Hermes Agent 官方仓库**：https://github.com/NousResearch/hermes-agent
- **Skills Hub**：https://github.com/NousResearch/hermes-skills
- **trycua（桌面控制）**：https://github.com/trycua/cua
- **LynnHub API 文档**：见 `docs/API.md`
- **LynnHub 开发规范**：见 `DEVELOPMENT_SPEC.md`

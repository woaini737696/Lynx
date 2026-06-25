# Hermes Agent 使用说明

> Hermes Agent 是 NousResearch 开发的开源本地 AI 代理框架，支持桌面控制、Shell 命令执行、技能市场和 MCP 工具集成。LynnHub 通过 Hermes Agent 实现本地 AI 自动化能力。

---

## 一、安装

### 1. 一键安装
进入 **设置 → Hermes Agent 集成**，点击「安装 Hermes Agent」按钮。系统会自动执行 `pip install hermes-agent`，安装完成后状态变为「已安装」。

### 2. 安装要求
- **Python**：3.11 / 3.12 / 3.13（任一版本）
- **pip**：已包含在 Python 安装中
- **操作系统**：Windows 10+ / macOS / Linux
- **磁盘空间**：约 500MB（含依赖）

### 3. 安装路径说明
- **Windows**：默认安装到 `%APPDATA%\Python\Python313\Scripts\hermes.exe`（pip --user 模式）
- **macOS / Linux**：通常在 `/usr/local/bin/hermes` 或 `~/.local/bin/hermes`

> 如果 `hermes` 不在系统 PATH 中，LynnHub 会自动查找常见安装路径，无需手动配置环境变量。

---

## 二、启动服务

### 1. 启动 Dashboard
点击「启动服务」按钮，系统会执行：
```bash
hermes dashboard --port 9119 --no-open --skip-build
```
- **端口**：默认 9119（Hermes Dashboard 标准端口）
- **后台运行**：进程在后台运行，关闭 LynnHub 不影响 Hermes 服务
- **启动确认**：系统会等待 1.5 秒确认进程存活后返回成功

### 2. 自动启动
开启「自动启动」开关后，每次 LynnHub 服务启动时会自动拉起 Hermes Dashboard。

### 3. 停止服务
点击「停止服务」按钮，系统会通过端口查找进程并终止：
- Windows：`netstat -ano | findstr :9119` + `taskkill /PID <pid> /F`
- macOS / Linux：`lsof -ti :9119` + `kill -9 <pid>`

---

## 三、测试连接

点击「测试连接」按钮，系统会按以下顺序检测：

1. **HTTP 检测**（优先）：请求 `GET http://localhost:9119/`，若返回 200 则连接成功
2. **命令行检测**（回退）：执行 `hermes status` 命令，若输出包含版本信息则连接成功

> 连接成功后会返回 Hermes 版本号和支持的能力列表。

---

## 四、在 AI 助理中使用

### 1. 启用 Hermes 集成
在设置页面打开「启用 Hermes 集成」开关。启用后，AI 助理会获得 3 个 Hermes 工具：

| 工具名 | 功能 | 示例指令 |
|--------|------|----------|
| `executeHermesTask` | 执行任意 Hermes 任务 | "用 Hermes 帮我打开浏览器搜索天气" |
| `listHermesSkills` | 列出 Hermes 技能市场 | "看看 Hermes 有哪些技能" |
| `executeHermesSkill` | 执行指定技能 | "执行 Hermes 的代码审查技能" |

### 2. 任务执行模式
- **HTTP 模式**（优先）：通过 `POST /api/task` 调用 Dashboard API
- **命令行模式**（回退）：执行 `hermes -z "任务描述" --cli --yolo`

两种模式自动切换，无需手动选择。HTTP 模式响应更快，命令行模式兼容性更好。

### 3. 技能面板
在 AI 助理对话页点击「技能」按钮，切换到「Hermes」标签页，可查看和执行 Hermes 技能市场的技能。

---

## 五、在 AI 工作流中使用

### 1. 添加 Hermes 节点
在 AI 工作流编辑器中，右键画布添加「Hermes」类型节点。

### 2. 节点配置
| 参数 | 说明 |
|------|------|
| **执行模式** | `computer_use`（桌面控制）/ `shell`（命令行）/ `auto`（自动选择） |
| **任务提示词** | 自然语言描述任务，如"打开浏览器并访问 github.com" |
| **工作目录** | shell 模式下的工作目录（可选） |
| **超时时间** | 默认 120 秒，最长 600 秒 |

### 3. 使用场景示例
- **自动化办公**：打开 Excel、填写表格、发送邮件
- **文件处理**：批量重命名、格式转换、目录整理
- **开发辅助**：运行测试、部署代码、查看日志
- **信息采集**：爬取网页、截图存档、数据提取

---

## 六、常见问题

### Q1：启动失败，提示「无法获取进程 PID」
**原因**：hermes.exe 未正确安装或路径找不到。
**解决**：
1. 在终端执行 `pip show hermes-agent` 确认已安装
2. 执行 `where hermes`（Windows）或 `which hermes`（macOS/Linux）确认在 PATH 中
3. 若不在 PATH 中，确认 Python Scripts 目录位置，LynnHub 会自动查找 `%APPDATA%\Python\Python313\Scripts\hermes.exe`

### Q2：测试连接失败
**原因**：Dashboard 服务未启动或端口被占用。
**解决**：
1. 确认已点击「启动服务」且状态显示「运行中」
2. 检查端口 9119 是否被其他程序占用：`netstat -ano | findstr :9119`
3. 若端口被占用，停止服务后重新启动

### Q3：任务执行超时
**原因**：任务复杂度超过超时时间。
**解决**：在工作流节点或 API 请求中增加 `timeout` 参数（单位秒，最大 600）。

### Q4：computer_use 模式无法控制桌面
**原因**：需要安装 trycua 依赖，且部分系统需要辅助功能权限。
**解决**：
1. 执行 `pip install trycua`
2. macOS：系统偏好设置 → 安全性与隐私 → 隐私 → 辅助功能 → 添加终端
3. Windows：以管理员身份运行

### Q5：技能列表为空
**原因**：Hermes Skills Hub 未初始化。
**解决**：在终端执行 `hermes skills list` 初始化技能市场，或访问 [Hermes Skills Hub](https://github.com/NousResearch/hermes-skills) 手动安装技能。

---

## 七、API 参考

### HTTP API（Dashboard 启动后可用）
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/` | 健康检查 + 版本信息 |
| POST | `/api/task` | 执行任务 |
| GET | `/api/skills` | 获取技能列表 |
| POST | `/api/skills/:id/execute` | 执行指定技能 |

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
```

### LynnHub API
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/hermes/config` | 获取 Hermes 配置 |
| PUT | `/api/hermes/config` | 更新配置 |
| GET | `/api/hermes/status` | 检测安装/运行状态 |
| POST | `/api/hermes/install` | 安装/启动/停止 |
| POST | `/api/hermes/test` | 测试连接 |
| POST | `/api/hermes/execute` | 执行任务 |
| GET | `/api/hermes/skills` | 获取技能列表 |

---

## 八、安全注意事项

1. **`--yolo` 参数**：命令行模式默认使用 `--yolo` 跳过确认，请确保任务描述清晰可控
2. **桌面控制权限**：`computer_use` 模式会控制你的鼠标和键盘，请勿在重要操作时启用
3. **Shell 执行**：`shell` 模式可执行任意命令，请勿执行来源不明的技能
4. **网络隔离**：Hermes Dashboard 默认监听 `localhost:9119`，不对外暴露。如需远程访问请配置防火墙和认证

---

## 九、参考链接

- **Hermes Agent 官方仓库**：https://github.com/NousResearch/hermes-agent
- **Skills Hub**：https://github.com/NousResearch/hermes-skills
- **trycua（桌面控制）**：https://github.com/trycua/cua
- **LynnHub API 文档**：见 `docs/API.md`

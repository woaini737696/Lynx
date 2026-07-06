# Hermes Agent - 奇思本地 AI 代理框架

奇思 HermesAgent 是一个轻量级本地 AI 代理框架，为 奇思超级助理提供：

- **桌面控制**：截图、鼠标键盘操作（通过 奇思桌面端 RPA 能力）
- **Shell 命令执行**：执行系统命令和脚本
- **浏览器自动化**：打开网页、提取数据
- **技能中心**：自主学习和技能管理
- **持久化记忆**：跨会话上下文保留
- **LLM 任务执行**：通过 OpenAI 兼容 API 执行自然语言任务

## 安装

```bash
pip install hermes-agent
```

## 使用

```bash
# 查看版本
hermes --version

# 查看状态
hermes status

# 启动 Dashboard（管理界面）
hermes dashboard --port 9119 --no-open

# 执行任务（自然语言）
hermes -z "帮我整理桌面文件" --yolo

# 配置模型
hermes config show
hermes config set model deepseek-chat

# 技能管理
hermes skills list

# 定时任务
hermes cron list
hermes cron add --schedule "0 9 * * *" --prompt "生成每日汇报"
```

## 配置

在 `~/.local/share/hermes/.env` 或 `%LOCALAPPDATA%/hermes/.env` 配置 LLM：

```
DEEPSEEK_API_KEY=your-key
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
DEEPSEEK_MODEL=deepseek-chat
```

或使用 MiMo：

```
MIMO_API_KEY=your-key
MIMO_BASE_URL=https://api.mimo.com/v1
MIMO_MODEL=mimo-chat
```

## 许可证

MIT License - © 2026 Lynn

"""LLM 任务执行：通过 OpenAI 兼容 API 执行自然语言任务

支持真正的 RPA 动作执行（打开浏览器/启动应用/运行命令），
LLM 输出 <action>{...}</action> 标签时实际执行对应操作。
"""

import json
import os
import re
import sys
import subprocess
import urllib.request
import urllib.error
from typing import Optional

from .config import get_llm_config, is_model_configured


def call_llm(prompt: str, system: Optional[str] = None, timeout: int = 120) -> dict:
    """
    调用 OpenAI 兼容 API（DeepSeek/MiMo 等）

    返回 {success, content, error, usage}
    """
    llm = get_llm_config()
    if not llm["api_key"]:
        return {
            "success": False,
            "content": "",
            "error": "LLM API Key 未配置。请在 .env 中设置 DEEPSEEK_API_KEY 或 MIMO_API_KEY",
        }

    url = llm["base_url"].rstrip("/") + "/chat/completions"
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    body = json.dumps({
        "model": llm["model"],
        "messages": messages,
        "stream": False,
        "temperature": 0.3,
        "max_tokens": 4096,
    }).encode("utf-8")

    req = urllib.request.Request(
        url,
        data=body,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {llm['api_key']}",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
            usage = data.get("usage", {})
            return {
                "success": True,
                "content": content,
                "error": None,
                "usage": usage,
                "model": llm["model"],
                "provider": llm["provider"],
            }
    except urllib.error.HTTPError as e:
        err_body = ""
        try:
            err_body = e.read().decode("utf-8")[:500]
        except Exception:
            pass
        return {
            "success": False,
            "content": "",
            "error": f"LLM API HTTP {e.code}: {err_body}",
        }
    except urllib.error.URLError as e:
        return {
            "success": False,
            "content": "",
            "error": f"LLM API 网络错误: {e.reason}",
        }
    except Exception as e:
        return {
            "success": False,
            "content": "",
            "error": f"LLM 调用异常: {e}",
        }


# ============ RPA 动作执行 ============

# 系统提示：要求 LLM 在需要 OS 操作时输出结构化动作标签
SYSTEM_PROMPT = (
    "你是 奇思超级助理（Hermes Agent），一个真正能操控电脑的本地 AI 代理。\n"
    "你不是聊天机器人，你是真正能执行操作系统动作的代理。\n\n"
    "## 核心规则（最高优先级，必须遵守）\n"
    "当用户请求涉及任何操作系统动作（打开浏览器/网址、启动应用、运行命令、打开文件等），\n"
    "你【必须】输出 <action> 标签来真正执行操作。\n"
    "【绝对禁止】输出\"我无法直接控制你的设备\"、\"你可以按以下步骤手动操作\"、\n"
    "\"请手动打开\"等教程式文本——你【可以】也【必须】通过 <action> 标签真正执行。\n\n"
    "## 动作标签格式\n"
    "<action>{\"type\":\"open_url\",\"url\":\"https://github.com\"}</action>\n"
    "<action>{\"type\":\"open_app\",\"app\":\"notepad\"}</action>\n"
    "<action>{\"type\":\"run_command\",\"command\":\"echo hello\"}</action>\n\n"
    "## 动作类型说明\n"
    "- open_url：打开 URL（用默认浏览器）。url 字段必填，含 http(s)://\n"
    "- open_app：启动应用程序。app 字段必填（如 notepad / calc / explorer / mspaint）\n"
    "- run_command：运行 shell 命令。command 字段必填，单条命令\n"
    "- 多个动作可依次输出多个 <action> 标签\n\n"
    "## 示例\n"
    "用户：打开浏览器\n"
    "你：<action>{\"type\":\"open_url\",\"url\":\"https://www.bing.com\"}</action>\n\n"
    "用户：打开GitHub\n"
    "你：<action>{\"type\":\"open_url\",\"url\":\"https://github.com\"}</action>\n\n"
    "用户：打开记事本\n"
    "你：<action>{\"type\":\"open_app\",\"app\":\"notepad\"}</action>\n\n"
    "用户：你好\n"
    "你：你好！有什么可以帮你的？\n\n"
    "## 关键约束\n"
    "- 操作类任务【必须】输出 <action> 标签，不能用文字描述代替\n"
    "- 纯文本问答（如\"你好\"、\"解释XX概念\"）不需要 <action> 标签\n"
    "- 在动作标签前可以用中文简要说明（不超过1句），如\"正在为你打开GitHub\"\n"
    "- 不要输出虚假的\"已执行\"声明——动作由系统实际执行后才会标记为成功\n"
)


def parse_actions(text: str) -> list:
    """从 LLM 输出中解析所有 <action>{...}</action> 标签"""
    actions = []
    for match in re.finditer(r"<action>\s*(\{.*?\})\s*</action>", text, re.DOTALL):
        try:
            action = json.loads(match.group(1))
            if isinstance(action, dict) and "type" in action:
                actions.append(action)
        except json.JSONDecodeError:
            continue
    return actions


def execute_rpa_action(action: dict) -> dict:
    """
    实际执行单个 RPA 动作

    返回 {success, output, error}
    """
    action_type = action.get("type", "")

    try:
        if action_type == "open_url":
            url = action.get("url", "").strip()
            if not url:
                return {"success": False, "output": "", "error": "open_url 缺少 url 参数"}
            # 用 webbrowser 真实打开默认浏览器
            import webbrowser
            if webbrowser.open(url):
                return {
                    "success": True,
                    "output": f"已用默认浏览器打开：{url}",
                    "error": None,
                }
            # webbrowser.open 返回 False 时尝试通过命令行强制打开
            if sys.platform == "win32":
                os.startfile(url)  # type: ignore[attr-defined]
                return {
                    "success": True,
                    "output": f"已用系统默认应用打开：{url}",
                    "error": None,
                }
            return {
                "success": False,
                "output": "",
                "error": f"webbrowser.open 返回 False，可能未配置默认浏览器（url={url}）",
            }

        elif action_type == "open_app":
            app = action.get("app", "").strip()
            if not app:
                return {"success": False, "output": "", "error": "open_app 缺少 app 参数"}
            # 跨平台启动应用
            if sys.platform == "win32":
                # Windows: 直接用 startfile 打开（可执行文件名或路径）
                try:
                    os.startfile(app)  # type: ignore[attr-defined]
                    return {
                        "success": True,
                        "output": f"已启动应用：{app}",
                        "error": None,
                    }
                except OSError as e:
                    return {
                        "success": False,
                        "output": "",
                        "error": f"启动应用失败：{app}（{e}）",
                    }
            elif sys.platform == "darwin":
                # macOS: 用 open 命令
                proc = subprocess.Popen(
                    ["open", "-a", app],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.PIPE,
                    start_new_session=True,
                )
                return {
                    "success": True,
                    "output": f"已启动应用：{app}（pid={proc.pid}）",
                    "error": None,
                }
            else:
                # Linux: 直接尝试执行
                proc = subprocess.Popen(
                    [app],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.PIPE,
                    start_new_session=True,
                )
                return {
                    "success": True,
                    "output": f"已启动应用：{app}（pid={proc.pid}）",
                    "error": None,
                }

        elif action_type == "run_command":
            command = action.get("command", "").strip()
            if not command:
                return {"success": False, "output": "", "error": "run_command 缺少 command 参数"}
            # 在独立子进程中执行命令（不阻塞）
            shell = sys.platform != "win32"
            proc = subprocess.Popen(
                command,
                shell=shell,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                start_new_session=True,
            )
            try:
                stdout, stderr = proc.communicate(timeout=30)
                if proc.returncode == 0:
                    return {
                        "success": True,
                        "output": (stdout or "").strip()[:2000] or f"命令执行完成（pid={proc.pid}）",
                        "error": None,
                    }
                return {
                    "success": False,
                    "output": (stdout or "").strip()[:2000],
                    "error": f"命令退出码 {proc.returncode}：{(stderr or '').strip()[:500]}",
                }
            except subprocess.TimeoutExpired:
                proc.kill()
                return {
                    "success": True,
                    "output": f"命令已启动并运行超过 30s（pid={proc.pid}，已强制结束）",
                    "error": None,
                }

        else:
            return {
                "success": False,
                "output": "",
                "error": f"未知的动作类型：{action_type}（仅支持 open_url / open_app / run_command）",
            }

    except Exception as e:
        return {
            "success": False,
            "output": "",
            "error": f"动作执行异常：{e}",
        }


def strip_action_tags(text: str) -> str:
    """移除 <action>...</action> 标签，仅保留可读文本"""
    return re.sub(r"<action>.*?</action>", "", text, flags=re.DOTALL).strip()


def execute_task(prompt: str, yolo: bool = False, timeout: int = 120) -> dict:
    """
    执行自然语言任务

    流程：
    1. 调用 LLM 生成回复（可能含 <action> 标签）
    2. 解析 <action> 标签
    3. 实际执行每个动作（open_url / open_app / run_command）
    4. 返回结果，包含 executed 标记和动作执行详情

    返回 {success, output, error, durationMs, executed, actions_executed}
    """
    import time
    start = time.time()

    if not is_model_configured():
        return {
            "success": False,
            "output": "",
            "error": (
                "Hermes 未配置 LLM 模型。请在 .env 中设置：\n"
                "  DEEPSEEK_API_KEY=your-key\n"
                "  DEEPSEEK_MODEL=deepseek-chat\n"
                "或通过 奇思桌面端「一键配置模型」自动配置。"
            ),
            "durationMs": int((time.time() - start) * 1000),
            "executed": False,
            "actions_executed": [],
        }

    result = call_llm(prompt, system=SYSTEM_PROMPT, timeout=timeout)

    duration_ms = int((time.time() - start) * 1000)

    if not result["success"]:
        return {
            "success": False,
            "output": "",
            "error": result["error"],
            "durationMs": duration_ms,
            "executed": False,
            "actions_executed": [],
        }

    llm_output = result["content"] or "(任务已完成，无输出)"
    actions = parse_actions(llm_output)
    readable_text = strip_action_tags(llm_output)

    # 没有 action 标签：需要判断是纯文本任务还是"假成功"
    # 检测"教程式文本"特征——LLM 说了"无法直接控制""手动操作"等但没生成 action 标签
    fake_success_keywords = [
        "无法直接控制", "无法控制你的设备", "你可以按以下步骤",
        "请手动", "手动打开", "手动操作", "请按以下步骤",
        "你可以通过以下方式", "步骤如下",
    ]
    is_fake_success = any(kw in readable_text for kw in fake_success_keywords)

    if is_fake_success:
        # LLM 输出了教程式文本但没有真正执行 → 标记为失败
        return {
            "success": False,
            "output": readable_text,
            "error": "HermesAgent 未能生成可执行的动作标签（LLM 返回了教程式文本而非 <action> 标签）。请重试或换一种描述方式。",
            "durationMs": duration_ms,
            "usage": result.get("usage"),
            "model": result.get("model"),
            "executed": False,
            "actions_executed": [],
        }

    # 没有 action 标签：纯文本任务（问答、生成、分析）→ 返回成功
    if not actions:
        return {
            "success": True,
            "output": readable_text,
            "error": None,
            "durationMs": duration_ms,
            "usage": result.get("usage"),
            "model": result.get("model"),
            "executed": False,
            "actions_executed": [],
        }

    # 有 action 标签：实际执行每个动作
    actions_executed = []
    all_success = True
    for action in actions:
        exec_result = execute_rpa_action(action)
        actions_executed.append({
            "type": action.get("type"),
            "params": action,
            "success": exec_result["success"],
            "output": exec_result["output"],
            "error": exec_result["error"],
        })
        if not exec_result["success"]:
            all_success = False

    # 拼装最终输出：可读文本 + 动作执行详情
    parts = []
    if readable_text:
        parts.append(readable_text)
    parts.append("")
    parts.append("【RPA 动作执行结果】")
    for i, a in enumerate(actions_executed, 1):
        status = "✓" if a["success"] else "✗"
        params_str = json.dumps(a["params"], ensure_ascii=False)
        parts.append(f"{status} 动作{i}：{a['type']} {params_str}")
        if a["success"]:
            parts.append(f"   → {a['output']}")
        else:
            parts.append(f"   → 失败：{a['error']}")

    return {
        "success": all_success,
        "output": "\n".join(parts),
        "error": None if all_success else "部分动作执行失败，详见输出",
        "durationMs": duration_ms,
        "usage": result.get("usage"),
        "model": result.get("model"),
        "executed": True,
        "actions_executed": actions_executed,
    }

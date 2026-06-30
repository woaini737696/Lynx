"""LLM 任务执行：通过 OpenAI 兼容 API 执行自然语言任务"""

import json
import sys
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
        "temperature": 0.7,
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


def execute_task(prompt: str, yolo: bool = False, timeout: int = 120) -> dict:
    """
    执行自然语言任务

    yolo=True 时跳过确认（自动执行模式）
    返回 {success, output, error, durationMs}
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
                "或通过 Lynx 桌面端「一键配置模型」自动配置。"
            ),
            "durationMs": int((time.time() - start) * 1000),
        }

    # 系统提示：定义 Hermes 的角色和能力
    system_prompt = (
        "你是 Lynx 超级助理（Hermes Agent），一个本地 AI 代理框架。\n"
        "你可以帮助用户执行各种任务：\n"
        "- 回答问题和提供建议\n"
        "- 生成文本内容（报告、邮件、代码等）\n"
        "- 分析和整理信息\n"
        "- 提供操作指导\n\n"
        "请用中文回复，简洁友好。如果任务需要操作系统或执行命令，"
        "请说明操作步骤，Lynx 桌面端会通过 RPA 能力执行。"
    )

    result = call_llm(prompt, system=system_prompt, timeout=timeout)

    duration_ms = int((time.time() - start) * 1000)

    if result["success"]:
        return {
            "success": True,
            "output": result["content"] or "(任务已完成，无输出)",
            "error": None,
            "durationMs": duration_ms,
            "usage": result.get("usage"),
            "model": result.get("model"),
        }
    return {
        "success": False,
        "output": "",
        "error": result["error"],
        "durationMs": duration_ms,
    }

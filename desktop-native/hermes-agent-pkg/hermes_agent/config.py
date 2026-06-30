"""配置管理：读取 .env 和 config.yaml"""

import os
import sys
from pathlib import Path
from typing import Optional


def get_data_dir() -> Path:
    """获取 Hermes 数据目录（跨平台）"""
    if sys.platform == "win32":
        base = os.environ.get("LOCALAPPDATA") or str(Path.home() / "AppData" / "Local")
    else:
        base = os.environ.get("XDG_DATA_HOME") or str(Path.home() / ".local" / "share")
    return Path(base) / "hermes"


def get_env_path() -> Path:
    return get_data_dir() / ".env"


def get_config_path() -> Path:
    return get_data_dir() / "config.yaml"


def ensure_dirs():
    """确保目录结构存在"""
    d = get_data_dir()
    for sub in ["", "logs", "skills", "memory", "sessions"]:
        (d / sub).mkdir(parents=True, exist_ok=True)


def parse_env(path: Path) -> dict:
    """解析 .env 文件为字典"""
    result = {}
    if not path.exists():
        return result
    try:
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" not in line:
                continue
            k, _, v = line.partition("=")
            result[k.strip()] = v.strip()
    except Exception:
        pass
    return result


def get_env() -> dict:
    """获取合并后的环境配置（.env + 系统环境变量，.env 优先）"""
    file_env = parse_env(get_env_path())
    merged = dict(os.environ)
    merged.update(file_env)
    return merged


def get_llm_config() -> dict:
    """获取 LLM 配置，返回 {provider, api_key, base_url, model}"""
    env = get_env()
    # 优先 MiMo，回退 DeepSeek
    if env.get("MIMO_API_KEY"):
        return {
            "provider": "mimo",
            "api_key": env["MIMO_API_KEY"],
            "base_url": env.get("MIMO_BASE_URL", "https://api.mimo.com/v1"),
            "model": env.get("MIMO_MODEL", "mimo-chat"),
        }
    if env.get("DEEPSEEK_API_KEY"):
        return {
            "provider": "deepseek",
            "api_key": env["DEEPSEEK_API_KEY"],
            "base_url": env.get("DEEPSEEK_BASE_URL", "https://api.deepseek.com/v1"),
            "model": env.get("DEEPSEEK_MODEL", "deepseek-chat"),
        }
    return {"provider": None, "api_key": "", "base_url": "", "model": ""}


def is_model_configured() -> bool:
    return bool(get_llm_config()["api_key"])


def save_env(updates: dict):
    """更新 .env 文件（保留其它键）"""
    ensure_dirs()
    path = get_env_path()
    existing = parse_env(path)
    existing.update(updates)
    lines = [f"{k}={v}" for k, v in existing.items()]
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def show_config() -> str:
    """返回配置摘要文本"""
    env = parse_env(get_env_path())
    llm = get_llm_config()
    lines = [
        "Hermes Agent Configuration",
        "=" * 40,
        f"Data Dir: {get_data_dir()}",
        f"Provider: {llm['provider'] or '(not set)'}",
        f"Model: {llm['model'] or '(not set)'}",
        f"Base URL: {llm['base_url'] or '(not set)'}",
        f"API Key: {'******' if llm['api_key'] else '(not set)'}",
    ]
    # 列出其它 .env 键
    extra = {k: v for k, v in env.items() if not k.startswith(("DEEPSEEK_", "MIMO_"))}
    if extra:
        lines.append("")
        lines.append("Additional env:")
        for k, v in extra.items():
            lines.append(f"  {k}={v}")
    return "\n".join(lines)


def set_model(model_name: str) -> str:
    """设置默认模型，自动判断 provider"""
    llm = get_llm_config()
    env_updates = {}
    # 判断 provider：含 deepseek 用 DeepSeek，含 mimo 用 MiMo
    name_lower = model_name.lower()
    if "deepseek" in name_lower or "mimo" not in name_lower:
        env_updates["DEEPSEEK_MODEL"] = model_name
        if not llm.get("api_key"):
            return "Warning: DEEPSEEK_API_KEY not set. Please configure it in .env"
    elif "mimo" in name_lower:
        env_updates["MIMO_MODEL"] = model_name
        if not llm.get("api_key"):
            return "Warning: MIMO_API_KEY not set. Please configure it in .env"
    save_env(env_updates)
    return f"Model set to: {model_name}"

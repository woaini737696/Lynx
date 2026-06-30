"""Cron 定时任务管理：基于文件的简易 cron 管理"""

import json
import uuid
from pathlib import Path
from typing import List
from .config import get_data_dir


def get_cron_file() -> Path:
    return get_data_dir() / "cron_jobs.json"


def load_cron_jobs() -> List[dict]:
    """加载所有 cron 任务"""
    path = get_cron_file()
    if not path.exists():
        return []
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(data, list):
            return data
        return []
    except Exception:
        return []


def save_cron_jobs(jobs: List[dict]):
    """保存 cron 任务"""
    path = get_cron_file()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(jobs, ensure_ascii=False, indent=2), encoding="utf-8")


def add_cron_job(schedule: str, prompt: str, yolo: bool = False) -> dict:
    """添加 cron 任务"""
    jobs = load_cron_jobs()
    job = {
        "id": str(uuid.uuid4())[:8],
        "schedule": schedule,
        "prompt": prompt,
        "enabled": True,
        "yolo": yolo,
        "createdAt": _now_iso(),
    }
    jobs.append(job)
    save_cron_jobs(jobs)
    return job


def delete_cron_job(job_id: str) -> bool:
    """删除 cron 任务"""
    jobs = load_cron_jobs()
    filtered = [j for j in jobs if j["id"] != job_id]
    if len(filtered) == len(jobs):
        return False
    save_cron_jobs(filtered)
    return True


def format_cron_table(jobs: List[dict]) -> str:
    """格式化 cron 任务列表为表格"""
    if not jobs:
        return "暂无定时任务。通过 `hermes cron add` 创建。"
    lines = [f"{'ID':<10} {'Schedule':<20} {'Enabled':<10} {'Prompt'}"]
    lines.append("-" * 80)
    for j in jobs:
        prompt = (j.get("prompt") or "")[:40]
        enabled = "true" if j.get("enabled") else "false"
        lines.append(f"{j['id'][:10]:<10} {j.get('schedule', '')[:20]:<20} {enabled:<10} {prompt}")
    return "\n".join(lines)


def _now_iso() -> str:
    from datetime import datetime
    return datetime.now().isoformat()

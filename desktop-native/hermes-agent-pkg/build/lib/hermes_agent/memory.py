"""记忆管理：扫描 profile/memory 目录下的记忆文件"""

from pathlib import Path
from typing import List
from .config import get_data_dir


def get_memory_dir() -> Path:
    return get_data_dir() / "memory"


def list_memory() -> List[dict]:
    """列出所有记忆文件"""
    memory_dir = get_memory_dir()
    if not memory_dir.exists():
        return []

    memories = []
    for f in sorted(memory_dir.iterdir()):
        if f.suffix not in (".txt", ".md", ".json", ".yaml", ".yml"):
            continue
        try:
            content = f.read_text(encoding="utf-8")
            stat = f.stat()
            memories.append({
                "fileName": f.name,
                "content": content[:500],
                "size": stat.st_size,
                "modified": stat.st_mtime,
            })
        except Exception:
            pass
    return memories


def search_memory(query: str, limit: int = 10) -> List[dict]:
    """关键词搜索记忆"""
    memories = list_memory()
    if not memories:
        return []

    query_lower = query.lower()
    query_words = [w for w in query_lower.split() if len(w) > 1]

    results = []
    for m in memories:
        content_lower = m["content"].lower()
        score = 0
        for w in query_words:
            if w in content_lower:
                score += 1
        if query_lower and query_lower in content_lower:
            score += 5
        if score > 0:
            results.append({**m, "score": score})

    results.sort(key=lambda x: x["score"], reverse=True)
    return results[:limit]


def memory_status() -> dict:
    """返回记忆状态摘要"""
    memory_dir = get_memory_dir()
    if not memory_dir.exists():
        return {"exists": False, "count": 0, "dir": str(memory_dir)}

    files = [f for f in memory_dir.iterdir() if f.suffix in (".txt", ".md", ".json", ".yaml", ".yml")]
    return {
        "exists": True,
        "count": len(files),
        "dir": str(memory_dir),
    }

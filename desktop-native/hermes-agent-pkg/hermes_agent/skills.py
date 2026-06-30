"""技能管理：列出和管理 Hermes profile 下的技能文件"""

import os
from pathlib import Path
from typing import List
from .config import get_data_dir


def get_skills_dir() -> Path:
    return get_data_dir() / "skills"


def list_skills() -> List[dict]:
    """列出所有技能（扫描 skills 目录下的 .md/.yaml/.yml 文件）"""
    skills_dir = get_skills_dir()
    if not skills_dir.exists():
        return []

    skills = []
    for f in sorted(skills_dir.iterdir()):
        if f.suffix not in (".md", ".yaml", ".yml"):
            continue
        try:
            content = f.read_text(encoding="utf-8")
            parsed = _parse_skill_file(content, f.name)
            skills.append(parsed)
        except Exception:
            skills.append({
                "id": f.stem,
                "name": f.stem,
                "description": "",
                "category": "general",
                "fileName": f.name,
            })
    return skills


def _parse_skill_file(content: str, filename: str) -> dict:
    """解析技能文件（YAML front matter + Markdown 正文）"""
    # 简易 YAML front matter 解析
    if content.startswith("---"):
        parts = content.split("---", 2)
        if len(parts) >= 3:
            front_matter = parts[1].strip()
            body = parts[2].strip()
            meta = {}
            for line in front_matter.splitlines():
                if ":" in line:
                    k, _, v = line.partition(":")
                    meta[k.strip()] = v.strip().strip('"\'')
            return {
                "id": meta.get("name", filename.rsplit(".", 1)[0]).lower().replace(" ", "_"),
                "name": meta.get("name", filename.rsplit(".", 1)[0]),
                "description": meta.get("description", ""),
                "category": meta.get("category", "general"),
                "tags": [t.strip() for t in meta.get("tags", "").split(",") if t.strip()],
                "content": body[:500],
                "fileName": filename,
            }

    # 纯 Markdown
    lines = content.splitlines()
    h1 = next((l[2:].strip() for l in lines if l.startswith("# ")), filename.rsplit(".", 1)[0])
    return {
        "id": h1.lower().replace(" ", "_"),
        "name": h1,
        "description": "",
        "category": "general",
        "content": content[:500],
        "fileName": filename,
    }


def format_skills_table(skills: List[dict]) -> str:
    """格式化技能列表为表格文本"""
    if not skills:
        return "暂无技能。通过 Lynx 桌面端使用超级助理后，会自动学习新技能。"

    lines = [f"{'ID':<30} {'名称':<20} {'分类':<15} {'描述'}"]
    lines.append("-" * 90)
    for s in skills:
        desc = (s.get("description") or "")[:40]
        lines.append(f"{s['id'][:30]:<30} {s['name'][:20]:<20} {s.get('category', '')[:15]:<15} {desc}")
    return "\n".join(lines)

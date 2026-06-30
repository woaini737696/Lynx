"""Hermes Agent CLI 入口

支持子命令：
  hermes --version          查看版本
  hermes status             查看状态
  hermes dashboard          启动 Dashboard
  hermes -z "prompt" --yolo 执行任务
  hermes config show        查看配置
  hermes config set model X 设置模型
  hermes skills list        列出技能
  hermes cron list          列出定时任务
  hermes cron add           添加定时任务
  hermes cron delete <id>   删除定时任务
  hermes memory status      查看记忆状态
  hermes memory search <q>  搜索记忆
"""

import argparse
import json
import sys
from typing import Optional

from . import __version__
from .config import (
    ensure_dirs,
    get_data_dir,
    get_llm_config,
    is_model_configured,
    show_config,
    set_model,
)


def main(argv: Optional[list] = None):
    """CLI 主入口"""
    parser = argparse.ArgumentParser(
        prog="hermes",
        description="Hermes Agent - Lynx 本地 AI 代理框架",
    )
    parser.add_argument("--version", action="store_true", help="显示版本号")
    parser.add_argument("-z", "--prompt", type=str, help="执行自然语言任务")
    parser.add_argument("--yolo", action="store_true", help="跳过确认，自动执行")

    subparsers = parser.add_subparsers(dest="command", help="子命令")

    # status
    subparsers.add_parser("status", help="查看 Agent 状态")

    # dashboard
    dash_parser = subparsers.add_parser("dashboard", help="启动 Dashboard HTTP 服务")
    dash_parser.add_argument("--port", type=int, default=9119, help="端口号（默认 9119）")
    dash_parser.add_argument("--no-open", action="store_true", help="不自动打开浏览器")

    # config
    config_parser = subparsers.add_parser("config", help="配置管理")
    config_sub = config_parser.add_subparsers(dest="config_command")
    config_sub.add_parser("show", help="查看配置")
    set_parser = config_sub.add_parser("set", help="设置配置项")
    set_parser.add_argument("key", choices=["model"], help="配置项")
    set_parser.add_argument("value", help="配置值")

    # skills
    skills_parser = subparsers.add_parser("skills", help="技能管理")
    skills_sub = skills_parser.add_subparsers(dest="skills_command")
    skills_sub.add_parser("list", help="列出技能")

    # cron
    cron_parser = subparsers.add_parser("cron", help="定时任务管理")
    cron_sub = cron_parser.add_subparsers(dest="cron_command")
    cron_sub.add_parser("list", help="列出定时任务")
    cron_add = cron_sub.add_parser("add", help="添加定时任务")
    cron_add.add_argument("--schedule", required=True, help="Cron 表达式")
    cron_add.add_argument("--prompt", required=True, help="任务提示词")
    cron_add.add_argument("--yolo", action="store_true", help="自动执行")
    cron_delete = cron_sub.add_parser("delete", help="删除定时任务")
    cron_delete.add_argument("job_id", help="任务 ID")

    # memory
    mem_parser = subparsers.add_parser("memory", help="记忆管理")
    mem_sub = mem_parser.add_subparsers(dest="memory_command")
    mem_sub.add_parser("status", help="查看记忆状态")
    mem_search = mem_sub.add_parser("search", help="搜索记忆")
    mem_search.add_argument("query", help="搜索关键词")
    mem_search.add_argument("--limit", type=int, default=10, help="返回数量")

    args = parser.parse_args(argv)

    # --version
    if args.version:
        print(f"hermes-agent {__version__}")
        return 0

    # -z 执行任务
    if args.prompt:
        from .executor import execute_task
        result = execute_task(args.prompt, yolo=args.yolo)
        if result["success"]:
            print(result["output"])
            if result.get("usage"):
                print(f"\n---\n耗时: {result.get('durationMs', 0)}ms · 模型: {result.get('model', '?')}", file=sys.stderr)
            return 0
        else:
            print(f"Error: {result['error']}", file=sys.stderr)
            return 1

    # 子命令
    if args.command == "status":
        return _cmd_status()
    elif args.command == "dashboard":
        return _cmd_dashboard(args)
    elif args.command == "config":
        return _cmd_config(args)
    elif args.command == "skills":
        return _cmd_skills(args)
    elif args.command == "cron":
        return _cmd_cron(args)
    elif args.command == "memory":
        return _cmd_memory(args)

    # 无命令时显示帮助
    parser.print_help()
    return 0


def _cmd_status() -> int:
    """hermes status"""
    ensure_dirs()
    llm = get_llm_config()
    status = {
        "version": __version__,
        "configured": is_model_configured(),
        "provider": llm["provider"],
        "model": llm["model"],
        "dataDir": str(get_data_dir()),
        "status": "ready" if is_model_configured() else "not_configured",
    }
    print("Hermes Agent Status")
    print("=" * 40)
    print(f"Version: {__version__}")
    print(f"Status: {status['status']}")
    print(f"Provider: {llm['provider'] or '(not set)'}")
    print(f"Model: {llm['model'] or '(not set)'}")
    print(f"Data Dir: {get_data_dir()}")
    if is_model_configured():
        print("\n✅ Hermes Agent 已就绪")
    else:
        print("\n⚠️  LLM 未配置，请运行 `hermes config set model deepseek-chat` 并在 .env 设置 API Key")
    return 0


def _cmd_dashboard(args) -> int:
    """hermes dashboard"""
    from .dashboard import start_dashboard
    return start_dashboard(port=args.port, open_browser=not args.no_open)


def _cmd_config(args) -> int:
    """hermes config show / set"""
    if args.config_command == "show":
        print(show_config())
        return 0
    elif args.config_command == "set":
        if args.key == "model":
            result = set_model(args.value)
            print(result)
            return 0
    print("Usage: hermes config show | hermes config set model <name>")
    return 1


def _cmd_skills(args) -> int:
    """hermes skills list"""
    from .skills import list_skills, format_skills_table
    if args.skills_command == "list" or args.skills_command is None:
        skills = list_skills()
        print(format_skills_table(skills))
        return 0
    print("Usage: hermes skills list")
    return 1


def _cmd_cron(args) -> int:
    """hermes cron list / add / delete"""
    from .cron import load_cron_jobs, add_cron_job, delete_cron_job, format_cron_table
    if args.cron_command == "list" or args.cron_command is None:
        jobs = load_cron_jobs()
        print(format_cron_table(jobs))
        return 0
    elif args.cron_command == "add":
        job = add_cron_job(args.schedule, args.prompt, yolo=args.yolo)
        print(f"已添加定时任务: {job['id']}")
        print(f"  Schedule: {job['schedule']}")
        print(f"  Prompt: {job['prompt']}")
        return 0
    elif args.cron_command == "delete":
        if delete_cron_job(args.job_id):
            print(f"已删除定时任务: {args.job_id}")
            return 0
        else:
            print(f"未找到任务: {args.job_id}", file=sys.stderr)
            return 1
    print("Usage: hermes cron list | add | delete")
    return 1


def _cmd_memory(args) -> int:
    """hermes memory status / search"""
    from .memory import memory_status, search_memory
    if args.memory_command == "status" or args.memory_command is None:
        status = memory_status()
        print("Hermes Memory Status")
        print("=" * 40)
        print(f"Exists: {status['exists']}")
        print(f"Count: {status['count']}")
        print(f"Dir: {status['dir']}")
        return 0
    elif args.memory_command == "search":
        results = search_memory(args.query, limit=args.limit)
        if not results:
            print(f"未找到与 '{args.query}' 相关的记忆")
            return 0
        print(f"找到 {len(results)} 条相关记忆:")
        print("-" * 60)
        for i, r in enumerate(results, 1):
            print(f"\n[{i}] {r['fileName']} (score: {r['score']})")
            print(r["content"][:200])
        return 0
    print("Usage: hermes memory status | search <query>")
    return 1


if __name__ == "__main__":
    sys.exit(main())

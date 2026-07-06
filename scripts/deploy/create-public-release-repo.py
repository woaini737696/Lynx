"""
创建公开 Gitee Release 仓库 + 迁移附件
1. 创建公开仓库 lynn-hub-release
2. 创建 Release v1.0.2
3. 上传 Electron + APK 附件
4. 输出公开下载链接
"""
import os
import sys
import requests
from pathlib import Path

# 添加 scripts/deploy 目录到 path 以导入 _config
sys.path.insert(0, str(Path(__file__).resolve().parent))
from _config import get_gitee_token

# 禁用所有代理
os.environ["NO_PROXY"] = "*"
os.environ["no_proxy"] = "*"
for key in ["HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy"]:
    os.environ.pop(key, None)

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DOWNLOADS_DIR = PROJECT_ROOT / "downloads"

GITEE_OWNER = "shenzhens-emotions-are-booming_0"
GITEE_TOKEN = get_gitee_token()
GITEE_API_BASE = "https://gitee.com/api/v5"

# 新的公开 Release 仓库
NEW_REPO_NAME = "lynn-hub-release"
NEW_REPO_DESC = "Lynx AI 超级助理 - 安装包发布仓库（公开下载）"

VERSION = "1.0.2"
TAG_NAME = f"v{VERSION}"
RELEASE_NAME = f"Lynx {VERSION} - Electron 主架构版本"

ELECTRON_EXE = DOWNLOADS_DIR / f"Lynx_{VERSION}_x64-setup.exe"
APK_FILE = DOWNLOADS_DIR / "Lynx-android.apk"

session = requests.Session()
session.trust_env = False


def log(msg, level="INFO"):
    prefix = {"INFO": "[INFO]", "OK": "[OK]  ", "WARN": "[WARN]", "ERR": "[ERR] "}
    print(f"{prefix.get(level, '[INFO]')} {msg}")


def create_public_repo():
    """创建公开仓库（如果不存在）"""
    # 先检查是否已存在
    try:
        resp = session.get(
            f"{GITEE_API_BASE}/repos/{GITEE_OWNER}/{NEW_REPO_NAME}",
            params={"access_token": GITEE_TOKEN},
            timeout=15,
        )
        if resp.status_code == 200:
            repo = resp.json()
            log(f"仓库已存在: {repo['full_name']} (private={repo['private']})", "WARN")
            return repo
    except Exception:
        pass

    log(f"创建公开仓库: {NEW_REPO_NAME}...")
    resp = session.post(
        f"{GITEE_API_BASE}/user/repos",
        data={
            "access_token": GITEE_TOKEN,
            "name": NEW_REPO_NAME,
            "description": NEW_REPO_DESC,
            "private": False,
            "auto_init": True,
        },
        timeout=30,
    )
    if resp.status_code in (200, 201):
        repo = resp.json()
        log(f"仓库创建成功: {repo['full_name']} (private={repo['private']})", "OK")
        return repo
    else:
        log(f"仓库创建失败: {resp.status_code} {resp.text[:300]}", "ERR")
        return None


def create_release(repo_name):
    """在指定仓库创建 Release"""
    # 检查是否已存在
    try:
        resp = session.get(
            f"{GITEE_API_BASE}/repos/{GITEE_OWNER}/{repo_name}/releases/tags/{TAG_NAME}",
            params={"access_token": GITEE_TOKEN},
            timeout=15,
        )
        if resp.status_code == 200:
            existing = resp.json()
            log(f"Release {TAG_NAME} 已存在 (id={existing['id']})，复用", "WARN")
            return existing
    except Exception:
        pass

    body = f"""Lynx AI 超级助理 桌面端 v{VERSION}

## 更新内容
- Electron 主架构（完整本地能力：HermesAgent管理 + WS网关 + 系统托盘 + 全局快捷键 + 自动更新）
- 安装包瘦身（locales 仅保留 zh-CN/en-US，69.17MB）
- GPU 加速（液态玻璃动画更流畅）
- IPC 错误处理优化（safeHandle 统一包装）
- Store 防抖写入（避免阻塞主进程）
- WS 网关优雅关闭

## 下载
- Windows 桌面端: Lynx_{VERSION}_x64-setup.exe (69.17 MB)
- Android 移动端: Lynx-android.apk (4.03 MB)

## 安装说明
1. Windows: 下载 .exe 双击安装
2. Android: 下载 .apk 允许未知来源安装

用Lynx AI，人人都是超级个体
"""
    resp = session.post(
        f"{GITEE_API_BASE}/repos/{GITEE_OWNER}/{repo_name}/releases",
        data={
            "access_token": GITEE_TOKEN,
            "tag_name": TAG_NAME,
            "name": RELEASE_NAME,
            "body": body,
            "target_commitish": "master",
            "prerelease": False,
        },
        timeout=30,
    )
    if resp.status_code in (200, 201):
        release = resp.json()
        log(f"Release 创建成功: id={release['id']}, tag={release['tag_name']}", "OK")
        return release
    else:
        log(f"Release 创建失败: {resp.status_code} {resp.text[:300]}", "ERR")
        return None


def upload_attachment(repo_name, release_id, file_path, name=None):
    display_name = name or file_path.name
    url = f"{GITEE_API_BASE}/repos/{GITEE_OWNER}/{repo_name}/releases/{release_id}/attach_files"
    log(f"上传: {display_name} ({file_path.stat().st_size / 1024 / 1024:.2f} MB)...")

    with open(file_path, "rb") as f:
        files = {"file": (display_name, f, "application/octet-stream")}
        data = {"access_token": GITEE_TOKEN}
        resp = session.post(url, files=files, data=data, timeout=600)

    if resp.status_code in (200, 201):
        log(f"上传成功: {display_name}", "OK")
        return resp.json()
    else:
        log(f"上传失败: {resp.status_code} {resp.text[:300]}", "ERR")
        return None


def get_download_urls(repo_name, release_id):
    resp = session.get(
        f"{GITEE_API_BASE}/repos/{GITEE_OWNER}/{repo_name}/releases/{release_id}",
        params={"access_token": GITEE_TOKEN},
        timeout=15,
    )
    if resp.status_code != 200:
        return {}
    release = resp.json()
    urls = {}
    for asset in release.get("assets", []):
        urls[asset["name"]] = asset.get("browser_download_url") or asset.get("url", "")
    return urls


def main():
    log("=" * 60)
    log("  创建公开 Release 仓库 + 上传附件")
    log("=" * 60)

    # 1. 创建公开仓库
    log("[1/4] 创建公开仓库...")
    repo = create_public_repo()
    if not repo:
        sys.exit(1)

    # 2. 创建 Release
    log("\n[2/4] 创建 Release...")
    release = create_release(NEW_REPO_NAME)
    if not release:
        sys.exit(1)
    release_id = release["id"]

    # 3. 上传附件
    log("\n[3/4] 上传附件...")
    if ELECTRON_EXE.exists():
        upload_attachment(NEW_REPO_NAME, release_id, ELECTRON_EXE)
    if APK_FILE.exists():
        upload_attachment(NEW_REPO_NAME, release_id, APK_FILE)

    # 4. 获取下载链接
    log("\n[4/4] 获取公开下载链接...")
    urls = get_download_urls(NEW_REPO_NAME, release_id)

    log("\n" + "=" * 60)
    log("  公开下载链接（用于官网）")
    log("=" * 60)
    for name, url in urls.items():
        log(f"  {name}: {url}", "OK")

    log(f"\nRelease 页面: https://gitee.com/{GITEE_OWNER}/{NEW_REPO_NAME}/releases/tag/{TAG_NAME}", "OK")
    log(f"仓库地址: https://gitee.com/{GITEE_OWNER}/{NEW_REPO_NAME}", "OK")


if __name__ == "__main__":
    main()

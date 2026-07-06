"""
Gitee Release 附件上传脚本
功能：
1. 从服务器下载 APK（如果本地没有）
2. 创建 Gitee Release 发行版
3. 上传 Electron 安装包 + Android APK 作为附件
4. 输出下载链接供官网使用

用法: python scripts/deploy/upload-to-gitee-release.py
"""
import os
import sys
import requests
import paramiko
from pathlib import Path

# 添加 scripts/deploy 目录到 path 以导入 _config
sys.path.insert(0, str(Path(__file__).resolve().parent))
from _config import get_ssh_config, get_gitee_token

# ============ 配置 ============
PROJECT_ROOT = Path(__file__).resolve().parents[2]
DOWNLOADS_DIR = PROJECT_ROOT / "downloads"

# Gitee 配置（token 从 git remote URL 提取）
GITEE_OWNER = "shenzhens-emotions-are-booming_0"
GITEE_REPO = "lynn-hub"
GITEE_TOKEN = get_gitee_token()
GITEE_API_BASE = "https://gitee.com/api/v5"

# 服务器配置（用于下载 APK）
_ssh = get_ssh_config()
SERVER_IP = _ssh["host"]
SSH_USER = _ssh["user"]
SSH_PASSWORD = _ssh["password"]
REMOTE_APK_PATH = "/opt/lynx/download/Lynx-android.apk"

# 版本信息
VERSION = "1.0.2"
TAG_NAME = f"v{VERSION}"
RELEASE_NAME = f"Lynx {VERSION} - Electron 主架构版本"

# 本地文件
ELECTRON_EXE = DOWNLOADS_DIR / f"Lynx_{VERSION}_x64-setup.exe"
APK_FILE = DOWNLOADS_DIR / "Lynx-android.apk"


def log(msg, level="INFO"):
    prefix = {"INFO": "[INFO]", "OK": "[OK]  ", "WARN": "[WARN]", "ERR": "[ERR] "}
    print(f"{prefix.get(level, '[INFO]')} {msg}")


def download_apk_from_server():
    """从服务器下载 APK 到本地 downloads/"""
    if APK_FILE.exists():
        log(f"APK 已存在: {APK_FILE} ({APK_FILE.stat().st_size / 1024 / 1024:.2f} MB)", "OK")
        return True

    log("从服务器下载 APK...")
    try:
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        client.connect(SERVER_IP, 22, SSH_USER, SSH_PASSWORD, timeout=15)
        sftp = client.open_sftp()
        sftp.get(REMOTE_APK_PATH, str(APK_FILE))
        sftp.close()
        client.close()
        log(f"APK 下载完成: {APK_FILE} ({APK_FILE.stat().st_size / 1024 / 1024:.2f} MB)", "OK")
        return True
    except Exception as e:
        log(f"APK 下载失败: {e}", "ERR")
        return False


def create_release():
    """创建 Gitee Release 发行版"""
    url = f"{GITEE_API_BASE}/repos/{GITEE_OWNER}/{GITEE_REPO}/releases"
    body = {
        "access_token": GITEE_TOKEN,
        "tag_name": TAG_NAME,
        "name": RELEASE_NAME,
        "body": """Lynx AI 超级助理 桌面端 v{version}

## 更新内容
- Electron 主架构（完整本地能力：HermesAgent管理 + WS网关 + 系统托盘 + 全局快捷键 + 自动更新）
- 安装包瘦身（locales 仅保留 zh-CN/en-US，69.17MB）
- GPU 加速（液态玻璃动画更流畅）
- IPC 错误处理优化（safeHandle 统一包装）
- Store 防抖写入（避免阻塞主进程）
- WS 网关优雅关闭

## 下载
- **Windows 桌面端**: Lynx_{version}_x64-setup.exe (69.17 MB)
- **Android 移动端**: Lynx-android.apk

## 安装说明
1. Windows: 下载 .exe 双击安装
2. Android: 下载 .apk 允许未知来源安装

不用学AI，什么都能干
""".format(version=VERSION),
        "target_commitish": "master",
        "prerelease": False,
    }

    # 先检查是否已存在同名 release
    try:
        resp = requests.get(f"{GITEE_API_BASE}/repos/{GITEE_OWNER}/{GITEE_REPO}/releases/tags/{TAG_NAME}",
                            params={"access_token": GITEE_TOKEN}, timeout=15)
        if resp.status_code == 200:
            existing = resp.json()
            log(f"Release {TAG_NAME} 已存在 (id={existing['id']})，将复用", "WARN")
            return existing
    except Exception:
        pass

    resp = requests.post(url, data=body, timeout=30)
    if resp.status_code in (200, 201):
        release = resp.json()
        log(f"Release 创建成功: id={release['id']}, tag={release['tag_name']}", "OK")
        return release
    else:
        log(f"Release 创建失败: {resp.status_code} {resp.text}", "ERR")
        return None


def upload_attachment(release_id, file_path, name=None):
    """上传附件到 Gitee Release"""
    url = f"{GITEE_API_BASE}/repos/{GITEE_OWNER}/{GITEE_REPO}/releases/{release_id}/attach_files"
    display_name = name or file_path.name
    log(f"上传附件: {display_name} ({file_path.stat().st_size / 1024 / 1024:.2f} MB)...")

    with open(file_path, "rb") as f:
        files = {"file": (display_name, f, "application/octet-stream")}
        data = {"access_token": GITEE_TOKEN}
        resp = requests.post(url, files=files, data=data, timeout=300)

    if resp.status_code in (200, 201):
        result = resp.json()
        log(f"附件上传成功: {display_name}", "OK")
        return result
    else:
        log(f"附件上传失败: {resp.status_code} {resp.text[:200]}", "ERR")
        return None


def get_release_download_urls(release_id):
    """获取 Release 中所有附件的下载链接"""
    url = f"{GITEE_API_BASE}/repos/{GITEE_OWNER}/{GITEE_REPO}/releases/{release_id}"
    resp = requests.get(url, params={"access_token": GITEE_TOKEN}, timeout=15)
    if resp.status_code != 200:
        log(f"获取 Release 信息失败: {resp.status_code}", "ERR")
        return {}

    release = resp.json()
    urls = {}
    for asset in release.get("assets", []):
        urls[asset["name"]] = asset.get("browser_download_url") or asset.get("url", "")
    return urls


def main():
    log("=" * 60)
    log("  Gitee Release 附件上传")
    log("=" * 60)

    # 1. 检查本地文件
    log("[1/5] 检查本地文件...")
    if not ELECTRON_EXE.exists():
        log(f"Electron 安装包不存在: {ELECTRON_EXE}", "ERR")
        sys.exit(1)
    log(f"  Electron: {ELECTRON_EXE.name} ({ELECTRON_EXE.stat().st_size / 1024 / 1024:.2f} MB)", "OK")

    # 2. 下载 APK
    log("[2/5] 准备 APK...")
    if not download_apk_from_server():
        log("APK 准备失败，继续上传 Electron（跳过 APK）", "WARN")

    # 3. 创建 Release
    log("[3/5] 创建 Gitee Release...")
    release = create_release()
    if not release:
        log("Release 创建失败，退出", "ERR")
        sys.exit(1)
    release_id = release["id"]

    # 4. 上传附件
    log("[4/5] 上传附件...")
    upload_attachment(release_id, ELECTRON_EXE)
    if APK_FILE.exists():
        upload_attachment(release_id, APK_FILE)

    # 5. 获取下载链接
    log("[5/5] 获取下载链接...")
    urls = get_release_download_urls(release_id)

    log("")
    log("=" * 60)
    log("  下载链接（用于官网配置）")
    log("=" * 60)
    for name, url in urls.items():
        log(f"  {name}: {url}", "OK")

    log("")
    log(f"Release 页面: https://gitee.com/{GITEE_OWNER}/{GITEE_REPO}/releases/tag/{TAG_NAME}", "OK")
    log("")
    log("完成！请将上述链接配置到官网下载按钮。")


if __name__ == "__main__":
    main()

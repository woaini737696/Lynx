"""上传 QisiSetup-1.0.11.exe 到 Gitee Release v1.0.11"""
import requests
import sys
from pathlib import Path

GITEE_OWNER = "shenzhens-emotions-are-booming_0"
GITEE_REPO = "lynn-hub-release"
GITEE_TOKEN = "12293158d567645bf7b3d16dcad8e005"
GITEE_API = "https://gitee.com/api/v5"
TAG = "v1.0.11"
VERSION = "1.0.11"

EXE_PATH = Path(r"d:\Lynn工作空间\LynnHub\desktop-electron\release-final\QisiSetup-1.0.11.exe")

def log(msg, level="INFO"):
    prefix = {"INFO": "[INFO]", "OK": "[OK]  ", "WARN": "[WARN]", "ERR": "[ERR] "}
    print(f"{prefix.get(level, '[INFO]')} {msg}")

def main():
    if not EXE_PATH.exists():
        log(f"文件不存在: {EXE_PATH}", "ERR")
        sys.exit(1)
    log(f"文件: {EXE_PATH.name} ({EXE_PATH.stat().st_size / 1024 / 1024:.2f} MB)", "OK")

    # 1. 检查 Release 是否已存在
    log(f"[1/3] 检查 Release {TAG}...")
    resp = requests.get(f"{GITEE_API}/repos/{GITEE_OWNER}/{GITEE_REPO}/releases/tags/{TAG}",
                        params={"access_token": GITEE_TOKEN}, timeout=15)
    release = resp.json() if resp.status_code == 200 else None
    if release and release.get("id"):  # Release 已存在
        release_id = release["id"]
        log(f"Release {TAG} 已存在 (id={release_id})，复用", "WARN")
        # 检查是否已有同名附件
        for asset in release.get("assets", []):
            if asset["name"] == EXE_PATH.name:
                log(f"附件 {EXE_PATH.name} 已存在，先删除旧附件...", "WARN")
                del_resp = requests.delete(
                    f"{GITEE_API}/repos/{GITEE_OWNER}/{GITEE_REPO}/releases/{release_id}/attach_files",
                    params={"access_token": GITEE_TOKEN, "asset_id": asset["id"]},
                    timeout=15
                )
                log(f"删除旧附件: {del_resp.status_code}")
    else:
        # 2. 创建 Release
        log(f"[2/3] 创建 Release {TAG}...")
        body = {
            "access_token": GITEE_TOKEN,
            "tag_name": TAG,
            "name": f"奇思 {VERSION}",
            "body": f"""奇思 - AI超级助理 桌面端 v{VERSION}

## 更新内容
- 修复发布者签名（CN=LynnHub 代码签名证书，UAC 显示 LynnHub）
- 修复任务栏图标（rcedit 嵌入 icon.ico）
- 修复安装界面（白底+品牌色横条 BMP）
- 修复许可证协议乱码（UTF-8 BOM）
- afterPack 钩子自动化 rcedit + 签名

## 下载
- Windows 桌面端: QisiSetup-{VERSION}.exe ({EXE_PATH.stat().st_size / 1024 / 1024:.2f} MB)

## 安装说明
下载 .exe 双击安装即可

用Lynx AI，人人都是超级个体
""",
            "target_commitish": "master",
            "prerelease": False,
        }
        resp = requests.post(f"{GITEE_API}/repos/{GITEE_OWNER}/{GITEE_REPO}/releases",
                             data=body, timeout=30)
        if resp.status_code not in (200, 201):
            log(f"创建 Release 失败: {resp.status_code} {resp.text}", "ERR")
            sys.exit(1)
        release = resp.json()
        release_id = release["id"]
        log(f"Release 创建成功: id={release_id}", "OK")

    # 3. 上传附件
    log(f"[3/3] 上传附件 {EXE_PATH.name}...")
    url = f"{GITEE_API}/repos/{GITEE_OWNER}/{GITEE_REPO}/releases/{release_id}/attach_files"
    with open(EXE_PATH, "rb") as f:
        files = {"file": (EXE_PATH.name, f, "application/octet-stream")}
        data = {"access_token": GITEE_TOKEN}
        resp = requests.post(url, files=files, data=data, timeout=300)

    if resp.status_code in (200, 201):
        log(f"附件上传成功!", "OK")
    else:
        log(f"附件上传失败: {resp.status_code} {resp.text[:200]}", "ERR")
        sys.exit(1)

    # 4. 获取下载链接
    log("获取下载链接...")
    resp = requests.get(f"{GITEE_API}/repos/{GITEE_OWNER}/{GITEE_REPO}/releases/{release_id}",
                        params={"access_token": GITEE_TOKEN}, timeout=15)
    if resp.status_code == 200:
        release = resp.json()
        for asset in release.get("assets", []):
            log(f"  {asset['name']}: {asset.get('browser_download_url') or asset.get('url', '')}", "OK")

    log("")
    log(f"Release 页面: https://gitee.com/{GITEE_OWNER}/{GITEE_REPO}/releases/tag/{TAG}", "OK")
    log("完成!")

if __name__ == "__main__":
    main()

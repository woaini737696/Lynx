"""上传 v1.0.13 到 Gitee Release（桌面端 + Android APK）"""
import requests
import sys
from pathlib import Path

GITEE_OWNER = "shenzhens-emotions-are-booming_0"
GITEE_REPO = "lynn-hub-release"
GITEE_TOKEN = "12293158d567645bf7b3d16dcad8e005"
GITEE_API = "https://gitee.com/api/v5"
TAG = "v1.0.13"
VERSION = "1.0.13"

EXE_PATH = Path(r"D:\LynnHub\packages\1.0.13\QisiSetup-1.0.13.exe")
APK_PATH = Path(r"D:\LynnHub\packages\1.0.13\QisiApp-0.1.8.apk")

def log(msg, level="INFO"):
    prefix = {"INFO": "[INFO]", "OK": "[OK]  ", "WARN": "[WARN]", "ERR": "[ERR] "}
    print(f"{prefix.get(level, '[INFO]')} {msg}", flush=True)

def main():
    if not EXE_PATH.exists():
        log(f"桌面端安装包不存在: {EXE_PATH}", "ERR")
        sys.exit(1)
    log(f"桌面端: {EXE_PATH.name} ({EXE_PATH.stat().st_size / 1024 / 1024:.2f} MB)", "OK")
    if APK_PATH.exists():
        log(f"Android: {APK_PATH.name} ({APK_PATH.stat().st_size / 1024 / 1024:.2f} MB)", "OK")
    else:
        log("Android APK 不存在，仅上传桌面端", "WARN")

    # 1. 检查/创建 Release
    log(f"[1/4] 检查 Release {TAG}...")
    resp = requests.get(f"{GITEE_API}/repos/{GITEE_OWNER}/{GITEE_REPO}/releases/tags/{TAG}",
                        params={"access_token": GITEE_TOKEN}, timeout=15)
    release = resp.json() if resp.status_code == 200 else None
    if release and release.get("id"):
        release_id = release["id"]
        log(f"Release {TAG} 已存在 (id={release_id})，复用", "WARN")
    else:
        log(f"[2/4] 创建 Release {TAG}...")
        body = {
            "access_token": GITEE_TOKEN,
            "tag_name": TAG,
            "name": f"奇思 {VERSION}",
            "body": f"""奇思 - AI工作台 v{VERSION}

## 更新内容
- 修复 WS 连接失败（JWT 刷新机制，避免 token 过期）
- 修复 Lynx 超级助理完全不可用（移除前置 WS 检查，解耦）
- 修复 HermesAgent 检查更新失败（增强 pip 查找 + stderr 捕获）
- 修复安装界面样式（NSIS installer.nsh 注入 BMP）
- 修复安装流程（签名安装包 + 覆盖安装支持）
- License 文字改为「奇思 - AI工作台」
- 信任证书 bat 文件全英文（避免乱码）
- 飞书 OAuth redirect_uri 配置

## 下载
- Windows 桌面端: QisiSetup-{VERSION}.exe ({EXE_PATH.stat().st_size / 1024 / 1024:.2f} MB)
- Android 移动端: QisiApp-0.1.8.apk

## 安装说明
1. Windows: 下载 .exe 双击安装（推荐先运行「信任奇思证书.bat」）
2. Android: 下载 .apk 允许未知来源安装

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
    for file_path in [EXE_PATH, APK_PATH]:
        if not file_path.exists():
            continue
        log(f"[3/4] 上传 {file_path.name}...")
        url = f"{GITEE_API}/repos/{GITEE_OWNER}/{GITEE_REPO}/releases/{release_id}/attach_files"
        with open(file_path, "rb") as f:
            files = {"file": (file_path.name, f, "application/octet-stream")}
            data = {"access_token": GITEE_TOKEN}
            resp = requests.post(url, files=files, data=data, timeout=600)

        if resp.status_code in (200, 201):
            log(f"  {file_path.name} 上传成功!", "OK")
        else:
            log(f"  {file_path.name} 上传失败: {resp.status_code} {resp.text[:200]}", "ERR")

    # 4. 获取下载链接
    log("[4/4] 获取下载链接...")
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

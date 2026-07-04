"""上传 v1.0.14 到 Gitee Release（桌面端 + Android）"""
import requests
import sys
from pathlib import Path

GITEE_OWNER = "shenzhens-emotions-are-booming_0"
GITEE_REPO = "lynn-hub-release"
GITEE_TOKEN = "12293158d567645bf7b3d16dcad8e005"
GITEE_API = "https://gitee.com/api/v5"
TAG = "v1.0.14"
VERSION = "1.0.14"

EXE_PATH = Path(r"D:\LynnHub\packages\1.0.14\QisiSetup-1.0.14.exe")
APK_PATH = Path(r"D:\LynnHub\packages\1.0.13\QisiApp-0.1.8.apk")  # 复用 v0.1.8


def log(msg, level="INFO"):
    prefix = {"INFO": "[INFO]", "OK": "[OK]  ", "WARN": "[WARN]", "ERR": "[ERR] "}
    print(f"{prefix.get(level, '[INFO]')} {msg}")


def main():
    if not EXE_PATH.exists():
        log(f"EXE 不存在: {EXE_PATH}", "ERR")
        sys.exit(1)
    log(f"桌面端: {EXE_PATH.name} ({EXE_PATH.stat().st_size/1024/1024:.2f} MB)", "OK")
    if APK_PATH.exists():
        log(f"Android: {APK_PATH.name} ({APK_PATH.stat().st_size/1024/1024:.2f} MB)", "OK")
    else:
        log(f"Android APK 不存在: {APK_PATH}", "WARN")

    # 1. 检查 Release
    log(f"[1/4] 检查 Release {TAG}...")
    resp = requests.get(f"{GITEE_API}/repos/{GITEE_OWNER}/{GITEE_REPO}/releases/tags/{TAG}",
                        params={"access_token": GITEE_TOKEN}, timeout=15)
    release = resp.json() if resp.status_code == 200 else None
    if release and release.get("id"):
        release_id = release["id"]
        log(f"Release {TAG} 已存在 (id={release_id})，复用", "WARN")
        for asset in release.get("assets", []):
            if asset["name"] in (EXE_PATH.name, APK_PATH.name):
                log(f"删除旧附件 {asset['name']}...", "WARN")
                requests.delete(
                    f"{GITEE_API}/repos/{GITEE_OWNER}/{GITEE_REPO}/releases/{release_id}/attach_files",
                    params={"access_token": GITEE_TOKEN, "asset_id": asset["id"]},
                    timeout=15
                )
    else:
        log(f"[2/4] 创建 Release {TAG}...")
        body = {
            "access_token": GITEE_TOKEN,
            "tag_name": TAG,
            "name": f"奇思 {VERSION}",
            "body": f"""奇思 - AI工作台 桌面端 v{VERSION}

## 更新内容
- 修复桌面端空白界面（renderer/ 未打包）
- 修复安装界面样式（自定义 BMP：深空蓝 + Logo + 奇思 + AI工作台 Slogan）
- 修复覆盖安装（taskkill 关闭旧进程）
- License 文字改为"奇思 - AI工作台"
- bat 文件全英文
- NSIS 安装包签名（CN=LynnHub）

## 下载
- Windows 桌面端: QisiSetup-{VERSION}.exe ({EXE_PATH.stat().st_size/1024/1024:.2f} MB)
- Android: QisiApp-0.1.8.apk ({APK_PATH.stat().st_size/1024/1024:.2f} MB)

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
    log(f"[3/4] 上传 QisiSetup-{VERSION}.exe...")
    url = f"{GITEE_API}/repos/{GITEE_OWNER}/{GITEE_REPO}/releases/{release_id}/attach_files"
    with open(EXE_PATH, "rb") as f:
        files = {"file": (EXE_PATH.name, f, "application/octet-stream")}
        data = {"access_token": GITEE_TOKEN}
        resp = requests.post(url, files=files, data=data, timeout=600)
    if resp.status_code in (200, 201):
        log(f"EXE 上传成功!", "OK")
    else:
        log(f"EXE 上传失败: {resp.status_code} {resp.text[:200]}", "ERR")
        sys.exit(1)

    if APK_PATH.exists():
        log(f"上传 {APK_PATH.name}...")
        with open(APK_PATH, "rb") as f:
            files = {"file": (APK_PATH.name, f, "application/octet-stream")}
            data = {"access_token": GITEE_TOKEN}
            resp = requests.post(url, files=files, data=data, timeout=300)
        if resp.status_code in (200, 201):
            log(f"APK 上传成功!", "OK")
        else:
            log(f"APK 上传失败: {resp.status_code} {resp.text[:200]}", "ERR")

    # 4. 获取下载链接
    log("[4/4] 获取下载链接...")
    resp = requests.get(f"{GITEE_API}/repos/{GITEE_OWNER}/{GITEE_REPO}/releases/{release_id}",
                        params={"access_token": GITEE_TOKEN}, timeout=15)
    if resp.status_code == 200:
        for asset in resp.json().get("assets", []):
            url = asset.get("browser_download_url") or asset.get("url", "")
            log(f"  {asset['name']}: {url}", "OK")

    log("")
    log(f"Release 页面: https://gitee.com/{GITEE_OWNER}/{GITEE_REPO}/releases/tag/{TAG}", "OK")
    log("完成!")


if __name__ == "__main__":
    main()

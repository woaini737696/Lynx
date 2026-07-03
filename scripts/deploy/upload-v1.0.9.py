"""Upload QisiSetup-1.0.9.exe to Gitee lynn-hub-release repo"""
import requests
import os

GITEE_OWNER = "shenzhens-emotions-are-booming_0"
GITEE_REPO = "lynn-hub-release"
GITEE_TOKEN = "12293158d567645bf7b3d16dcad8e005"
GITEE_API = "https://gitee.com/api/v5"
TAG = "v1.0.9"
FILE = r"d:\Lynn工作空间\LynnHub\desktop-electron\release\QisiSetup-1.0.9.exe"

print(f"[1] File size: {os.path.getsize(FILE)/1024/1024:.2f} MB")

# Check if release exists
resp = requests.get(
    f"{GITEE_API}/repos/{GITEE_OWNER}/{GITEE_REPO}/releases/tags/{TAG}",
    params={"access_token": GITEE_TOKEN},
    timeout=15,
)
if resp.status_code == 200 and resp.json() is not None:
    release = resp.json()
    release_id = release["id"]
    print(f"[2] Release {TAG} exists (id={release_id}), reusing")
else:
    body = {
        "access_token": GITEE_TOKEN,
        "tag_name": TAG,
        "name": "奇思 v1.0.9",
        "body": "奇思 AI超级助理 v1.0.9\n\n更新内容: 全局改名奇思, 发布者签名lynn, NSIS白色安装界面, 托盘图标修复, WS连接修复, 检查更新修复, Lynx助理SSE修复, 飞书OAuth每用户同步",
        "target_commitish": "master",
        "prerelease": False,
    }
    resp = requests.post(
        f"{GITEE_API}/repos/{GITEE_OWNER}/{GITEE_REPO}/releases",
        data=body,
        timeout=30,
    )
    if resp.status_code in (200, 201):
        release = resp.json()
        release_id = release["id"]
        print(f"[2] Release created (id={release_id})")
    else:
        print(f"[2] ERROR: {resp.status_code} {resp.text[:200]}")
        exit(1)

# Upload attachment
print("[3] Uploading QisiSetup-1.0.9.exe...")
with open(FILE, "rb") as f:
    files = {"file": ("QisiSetup-1.0.9.exe", f, "application/octet-stream")}
    data = {"access_token": GITEE_TOKEN}
    resp = requests.post(
        f"{GITEE_API}/repos/{GITEE_OWNER}/{GITEE_REPO}/releases/{release_id}/attach_files",
        files=files,
        data=data,
        timeout=300,
    )

if resp.status_code in (200, 201):
    print("[3] Upload SUCCESS")
    result = resp.json()
    print(f"    URL: {result.get('browser_download_url', 'N/A')}")
else:
    print(f"[3] Upload FAILED: {resp.status_code} {resp.text[:200]}")

# Get all download URLs
resp = requests.get(
    f"{GITEE_API}/repos/{GITEE_OWNER}/{GITEE_REPO}/releases/{release_id}",
    params={"access_token": GITEE_TOKEN},
    timeout=15,
)
if resp.status_code == 200:
    release = resp.json()
    print("[4] All attachments:")
    for asset in release.get("assets", []):
        print(f"    {asset['name']}: {asset.get('browser_download_url', 'N/A')}")

"""将 lynn-hub-release 仓库切换为公开，并验证 Release 附件下载链接"""
import requests
import os
import sys
from pathlib import Path

# 添加 scripts/deploy 目录到 path 以导入 _config
sys.path.insert(0, str(Path(__file__).resolve().parent))
from _config import get_gitee_token

os.environ["NO_PROXY"] = "*"
os.environ["no_proxy"] = "*"

OWNER = "shenzhens-emotions-are-booming_0"
REPO = "lynn-hub-release"
TOKEN = get_gitee_token()
session = requests.Session()
session.trust_env = False
API = "https://gitee.com/api/v5"

# 1) 切换为公开
print("=== 切换仓库为公开 ===")
r = session.patch(
    f"{API}/repos/{OWNER}/{REPO}",
    params={"access_token": TOKEN},
    json={"private": False, "name": REPO},
    timeout=30,
)
print("status:", r.status_code)
if r.status_code == 200:
    data = r.json()
    print("private:", data.get("private"))
    print("html_url:", data.get("html_url"))
else:
    print("error:", r.text[:500])

# 2) 列出 Releases 和附件
print("\n=== 列出 Releases ===")
r = session.get(
    f"{API}/repos/{OWNER}/{REPO}/releases",
    params={"access_token": TOKEN},
    timeout=30,
)
print("status:", r.status_code)
if r.status_code == 200:
    for rel in r.json():
        print(f"\nRelease #{rel.get('id')} - {rel.get('tag_name')}")
        print(f"  name: {rel.get('name')}")
        for att in rel.get("assets", [] or []):
            print(f"  attachment: {att.get('name')}")
            print(f"    url: {att.get('browser_download_url')}")

# 3) 测试公开下载链接（不带 token）
print("\n=== 测试公开下载链接（无 token）===")
r = session.get(
    f"{API}/repos/{OWNER}/{REPO}/releases",
    timeout=30,
)
if r.status_code == 200:
    for rel in r.json():
        for att in rel.get("assets", [] or []):
            url = att.get("browser_download_url")
            if url:
                # HEAD 请求测试可访问性
                hr = session.head(url, allow_redirects=True, timeout=30)
                print(f"  {att.get('name')}: HTTP {hr.status_code}")

"""下载服务器 HermesAgent .whl + latest.json 到本地 desktop-electron/resources/"""
import requests
from pathlib import Path
import json

BASE = "https://ai.lynxdo.com"
LOCAL_DIR = Path(r"d:\Lynn工作空间\LynnHub\desktop-electron\resources")

# 1. 获取 latest.json
print("[1/3] 获取 latest.json...")
r = requests.get(f"{BASE}/api/hermes/latest-json", timeout=15)
r.raise_for_status()
latest = r.json()
print(f"  版本: {latest['version']}")
print(f"  wheel: {latest['wheel']}")

# 2. 下载 .whl
wheel_file = latest['wheel']
print(f"\n[2/3] 下载 {wheel_file}...")
r = requests.get(f"{BASE}/api/hermes/download-wheel", params={"file": wheel_file}, timeout=60)
r.raise_for_status()
print(f"  大小: {len(r.content)} 字节 ({len(r.content)/1024:.2f} KB)")

# 3. 保存到 resources/
LOCAL_DIR.mkdir(parents=True, exist_ok=True)

whl_path = LOCAL_DIR / wheel_file
whl_path.write_bytes(r.content)
print(f"\n[3/3] 保存到: {whl_path}")

# 保存 latest.json 副本
latest_path = LOCAL_DIR / "latest.json"
latest_path.write_text(json.dumps(latest, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"  latest.json: {latest_path}")

print(f"\n[OK] 内置资源准备完成")
print(f"  - {whl_path.name} ({whl_path.stat().st_size} bytes)")
print(f"  - latest.json ({latest_path.stat().st_size} bytes)")

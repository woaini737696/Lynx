# -*- coding: utf-8 -*-
"""
绕过 index.lock 恢复所有被 git rm 删除的文件
使用 git ls-tree + git cat-file 批量恢复，不需要 index
"""
import subprocess
import os
import sys
from pathlib import Path

ROOT = Path(r"d:\Lynn工作空间\LynnHub")
os.chdir(str(ROOT))

# 1. 获取 HEAD 中所有文件列表
print("[1/3] 获取 HEAD 文件列表...")
result = subprocess.run(
    ["git", "ls-tree", "-r", "--name-only", "HEAD"],
    capture_output=True, text=True, encoding="utf-8", errors="replace"
)
if result.returncode != 0:
    print(f"[ERROR] git ls-tree 失败: {result.stderr}")
    sys.exit(1)

files = [f for f in result.stdout.strip().split("\n") if f]
print(f"  HEAD 包含 {len(files)} 个文件")

# 2. 检查哪些文件缺失
missing = []
for f in files:
    full_path = ROOT / f
    if not full_path.exists():
        missing.append(f)
print(f"  缺失文件: {len(missing)}")

if not missing:
    print("[OK] 所有文件都存在，无需恢复")
    sys.exit(0)

# 3. 批量恢复缺失文件
print(f"[2/3] 恢复 {len(missing)} 个文件...")
restored = 0
failed = 0
for i, f in enumerate(missing):
    full_path = ROOT / f
    try:
        # 确保目录存在
        full_path.parent.mkdir(parents=True, exist_ok=True)
        # 用 git show 恢复文件内容
        result = subprocess.run(
            ["git", "show", f"HEAD:{f}"],
            capture_output=True
        )
        if result.returncode == 0:
            full_path.write_bytes(result.stdout)
            restored += 1
        else:
            failed += 1
            if failed <= 5:
                print(f"  [FAIL] {f}: {result.stderr.decode('utf-8', errors='replace')[:100]}")
    except Exception as e:
        failed += 1
        if failed <= 5:
            print(f"  [FAIL] {f}: {e}")

    if (i + 1) % 100 == 0:
        print(f"  进度: {i+1}/{len(missing)} (恢复 {restored}, 失败 {failed})")

print(f"[3/3] 完成: 恢复 {restored}/{len(missing)}, 失败 {failed}")
print(f".gitignore 存在: {(ROOT / '.gitignore').exists()}")

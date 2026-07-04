"""清理临时构建目录"""
import shutil
from pathlib import Path

base = Path(r"d:\Lynn工作空间\LynnHub\desktop-electron")

# 需要清理的目录（旧构建产物）
to_clean = [
    base / "release-build",
    base / "release-v1.0.10",
    base / "release-v1.0.11",
]

# 保留 release-final（当前 v1.0.11 构建产物）
print("=== 清理临时构建目录 ===\n")

total_freed = 0
for d in to_clean:
    if d.exists():
        # 计算大小
        size = sum(f.stat().st_size for f in d.rglob("*") if f.is_file())
        size_mb = size / 1024 / 1024
        print(f"[清理] {d.name}: {size_mb:.2f} MB")
        try:
            shutil.rmtree(d)
            print(f"  [OK] 已删除")
            total_freed += size
        except Exception as e:
            print(f"  [ERR] 删除失败: {e}")
    else:
        print(f"[跳过] {d.name} 不存在")

print(f"\n总释放: {total_freed/1024/1024:.2f} MB")

# 检查 release-final 保留
final = base / "release-final"
if final.exists():
    size = sum(f.stat().st_size for f in final.rglob("*") if f.is_file())
    print(f"\n[保留] release-final: {size/1024/1024:.2f} MB (当前 v1.0.11 构建产物)")

# 清理 deploy/dist 下的部署包
deploy_dist = Path(r"d:\Lynn工作空间\LynnHub\deploy\dist")
if deploy_dist.exists():
    for f in deploy_dist.glob("*.tar.gz"):
        size = f.stat().st_size
        print(f"\n[清理] {f.name}: {size/1024/1024:.2f} MB")
        try:
            f.unlink()
            print(f"  [OK] 已删除")
            total_freed += size
        except Exception as e:
            print(f"  [ERR] 删除失败: {e}")

print(f"\n=== 清理完成，总释放 {total_freed/1024/1024:.2f} MB ===")

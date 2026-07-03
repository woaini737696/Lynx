"""用 git-filter-repo Python API 清理历史中的大文件和非法路径
设置 core.protectNTFS=false 解决 D:/cargo-target-native 非法路径问题
"""
import subprocess
import os
import sys

os.chdir(r"D:\Lynn工作空间\LynnHub")

# 关键：禁用 NTFS 保护，让 git 能处理含 D: 盘符的非法路径
subprocess.run(["git", "config", "core.protectNTFS", "false"], check=True)
subprocess.run(["git", "config", "core.longpaths", "true"], check=True)

# 确认备份分支存在，并创建 bundle 备份（双重保险）
r = subprocess.run(["git", "rev-parse", "backup-before-cleanup"], capture_output=True, text=True)
if r.returncode != 0:
    print("ERROR: 备份分支 backup-before-cleanup 不存在，终止清理")
    sys.exit(1)
print(f"备份分支存在: {r.stdout.strip()[:12]}")

# 创建 bundle 备份（本地文件，不占用 Gitee 配额）
bundle_path = r"D:\Lynn工作空间\LynnHub\backup-original-history.bundle"
print(f"\n创建 bundle 备份: {bundle_path}")
r = subprocess.run(["git", "bundle", "create", bundle_path, "--all"], capture_output=True, text=True)
if r.returncode == 0:
    size_mb = os.path.getsize(bundle_path) / (1024 * 1024)
    print(f"bundle 创建成功: {size_mb:.1f} MB")
else:
    print(f"bundle 创建失败: {r.stderr}")
    print("继续清理（备份分支仍在）")

# 删除备份分支：filter-repo 会处理所有 ref，保留备份分支会导致旧 commits 仍可达，gc 无法清理
print("\n删除 backup-before-cleanup 分支（已在 bundle 中备份）")
subprocess.run(["git", "branch", "-D", "backup-before-cleanup"], capture_output=True, text=True)

# 清理前大小
r = subprocess.run(["git", "count-objects", "-vH"], capture_output=True, text=True)
for line in r.stdout.splitlines():
    if "size-pack" in line:
        print(f"清理前 {line}")

# 导入 git-filter-repo
import git_filter_repo as fr

print("\n=== 执行 git-filter-repo ===")
# 要从历史中移除的路径（--invert-paths 表示删除这些路径）
paths_to_remove = [
    ".m2",
    "public/downloads/hermes_agent-0.17.0-py3-none-any.whl",
    "desktop-native/src-tauri/vendor",
    "desktop/node_modules",
    # 非法路径：含 D: 盘符
    "desktop-native/src-tauri/D:/cargo-target-native",
]

# 构建 filter-repo 参数
args = fr.FilteringOptions.parse_args([
    "--force",
    "--invert-paths",
    *[f"--path={p}" for p in paths_to_remove],
])

print(f"移除路径: {paths_to_remove}")

# 执行过滤
repo_filter = fr.RepoFilter(args)
repo_filter.run()

# 清理后操作
print("\n=== 过滤完成，清理 reflog + gc ===")
subprocess.run(["git", "reflog", "expire", "--expire=now", "--all"], check=True)
subprocess.run(["git", "gc", "--prune=now", "--aggressive"], check=False)

# 最终大小
print("\n=== 最终大小 ===")
r = subprocess.run(["git", "count-objects", "-vH"], capture_output=True, text=True)
for line in r.stdout.splitlines():
    if "size-pack" in line:
        print(f"清理后 {line}")

# 验证大文件
print("\n=== 验证 >1MB 的大文件 ===")
r = subprocess.run(
    'git rev-list --objects --all | git cat-file --batch-check="%(objecttype) %(objectname) %(objectsize) %(rest)"',
    shell=True, capture_output=True, text=True
)
big_files = []
for line in r.stdout.splitlines():
    parts = line.split(' ', 3)
    if len(parts) >= 4 and parts[0] == 'blob':
        try:
            size = int(parts[2])
            if size > 1048576:
                big_files.append((size, parts[3]))
        except ValueError:
            pass
big_files.sort(reverse=True)
if big_files:
    print(f"剩余 {len(big_files)} 个 >1MB 文件:")
    for size, path in big_files[:15]:
        print(f"  {size/1048576:.2f} MB  {path}")
else:
    print("无 >1MB 大文件，清理成功！")

# 检查并恢复 remotes（filter-repo 会移除 origin）
print("\n=== 检查/恢复 remotes ===")
r = subprocess.run(["git", "remote", "-v"], capture_output=True, text=True)
current_remotes = r.stdout
for name, url in remotes_backup.items():
    if name not in current_remotes:
        print(f"恢复 remote: {name} -> {url}")
        subprocess.run(["git", "remote", "add", name, url], capture_output=True, text=True)
    else:
        print(f"remote {name} 仍存在")

print("\n=== 清理完成 ===")
print(f"原始历史备份: {bundle_path}")
print("如需回滚: git fetch backup-original-history.bundle 'refs/heads/*:refs/heads/*'")

"""
部署 Next.js standalone 到服务器
1. 打包 standalone + static + public
2. 确保 Prisma query engine Linux 版本
3. 上传并解压
4. 确保 start-with-env.js + 重启 PM2
"""
import sys
import os
import tarfile
import io
import shutil

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ssh_exec import exec_cmd, upload_file

LOCAL_ROOT = r"d:\Lynn工作空间\LynnHub"
STANDALONE_DIR = os.path.join(LOCAL_ROOT, ".next", "standalone")
STATIC_DIR = os.path.join(LOCAL_ROOT, ".next", "static")
PUBLIC_DIR = os.path.join(LOCAL_ROOT, "public")
TAR_PATH = r"d:\LynnHub\Temp\lynx-standalone.tar.gz"

# 服务器路径
REMOTE_APP_DIR = "/opt/lynx/app"
REMOTE_TAR = "/tmp/lynx-standalone.tar.gz"

print("=" * 60)
print("步骤1: 检查 Prisma query engine 文件")
print("=" * 60)
# 查找本地的 Prisma engine 文件
prisma_engines = []
for root, dirs, files in os.walk(os.path.join(LOCAL_ROOT, "node_modules", ".prisma", "client")):
    for f in files:
        if "query_engine" in f or "libquery_engine" in f:
            full = os.path.join(root, f)
            size = os.path.getsize(full)
            prisma_engines.append((full, size))
            print(f"  {f} ({size} bytes)")

# 查找 Linux 版本的 engine
linux_engine = None
for full, size in prisma_engines:
    fname = os.path.basename(full)
    if "debian" in fname or "linux" in fname:
        linux_engine = full
        print(f"\n[OK] 找到 Linux engine: {fname}")
        break

if not linux_engine:
    print("[WARN] 未找到 Linux Prisma engine，尝试从 node_modules/@prisma/client 查找")
    for root, dirs, files in os.walk(os.path.join(LOCAL_ROOT, "node_modules", "@prisma", "engines")):
        for f in files:
            if "debian" in f or ("linux" in f and "query" in f):
                linux_engine = os.path.join(root, f)
                print(f"  [OK] {f}")
                break

print("\n" + "=" * 60)
print("步骤2: 打包 standalone + static + public 为 tar.gz")
print("=" * 60)

# 确保临时目录存在
os.makedirs(os.path.dirname(TAR_PATH), exist_ok=True)

# 删除旧 tar
if os.path.exists(TAR_PATH):
    os.remove(TAR_PATH)

# 打包
file_count = 0
with tarfile.open(TAR_PATH, "w:gz") as tar:
    # 1. standalone 目录（包含 server.js + node_modules）
    print("添加 standalone 目录...")
    for root, dirs, files in os.walk(STANDALONE_DIR):
        # 跳过 .pyc 缓存等
        dirs[:] = [d for d in dirs if d not in ('__pycache__', '.cache')]
        for f in files:
            local_path = os.path.join(root, f)
            # 相对于 standalone 目录的路径
            arcname = os.path.relpath(local_path, STANDALONE_DIR)
            # 在服务器上放到 /opt/lynx/app/
            tar.add(local_path, arcname=arcname, recursive=False)
            file_count += 1
            if file_count % 500 == 0:
                print(f"  已打包 {file_count} 个文件...")

    # 2. static 目录（放到 .next/static/）
    print("添加 static 目录...")
    static_base = os.path.join(STATIC_DIR)
    for root, dirs, files in os.walk(static_base):
        for f in files:
            local_path = os.path.join(root, f)
            arcname = os.path.join(".next", "static", os.path.relpath(local_path, static_base))
            tar.add(local_path, arcname=arcname, recursive=False)
            file_count += 1

    # 3. public 目录
    print("添加 public 目录...")
    for root, dirs, files in os.walk(PUBLIC_DIR):
        for f in files:
            local_path = os.path.join(root, f)
            arcname = os.path.join("public", os.path.relpath(local_path, PUBLIC_DIR))
            tar.add(local_path, arcname=arcname, recursive=False)
            file_count += 1

    # 4. 确保 Linux Prisma engine 在 node_modules/.prisma/client/
    if linux_engine:
        engine_name = os.path.basename(linux_engine)
        # 检查 standalone 中是否已有
        standalone_engine = os.path.join(STANDALONE_DIR, "node_modules", ".prisma", "client", engine_name)
        if not os.path.exists(standalone_engine):
            print(f"添加 Linux Prisma engine: {engine_name}")
            tar.add(linux_engine, arcname=f"node_modules/.prisma/client/{engine_name}")
            file_count += 1

tar_size = os.path.getsize(TAR_PATH)
print(f"\n[OK] 打包完成: {file_count} 个文件, {tar_size / 1024 / 1024:.1f} MB")

print("\n" + "=" * 60)
print("步骤3: 上传 tar.gz 到服务器")
print("=" * 60)
upload_file(TAR_PATH, REMOTE_TAR)

print("\n" + "=" * 60)
print("步骤4: 服务器解压并部署")
print("=" * 60)
# 备份当前 server.js
code, out, err = exec_cmd("cp /opt/lynx/app/server.js /opt/lynx/app/server.js.bak 2>&1")
print("备份 server.js:", out, err)

# 解压前保留 start-with-env.js 和 .env
code, out, err = exec_cmd("cp /opt/lynx/app/start-with-env.js /tmp/start-with-env.js 2>&1; cp /opt/lynx/app/.env /tmp/lynx.env.bak 2>&1; cp /opt/lynx/app/ecosystem.config.cjs /tmp/ecosystem.config.cjs 2>&1")
print("备份关键文件:", out, err)

# 清理旧文件（保留 node_modules 以加快部署）
# 实际上直接覆盖解压即可
code, out, err = exec_cmd(f"cd {REMOTE_APP_DIR} && tar xzf {REMOTE_TAR} 2>&1 && echo '解压成功'")
print("解压:", out, err)

# 恢复 start-with-env.js 和 .env
code, out, err = exec_cmd("cp /tmp/start-with-env.js /opt/lynx/app/start-with-env.js 2>&1; cp /tmp/lynx.env.bak /opt/lynx/app/.env 2>&1; cp /tmp/ecosystem.config.cjs /opt/lynx/app/ecosystem.config.cjs 2>&1")
print("恢复关键文件:", out, err)

# 清理 tar 文件
exec_cmd(f"rm -f {REMOTE_TAR}")

print("\n" + "=" * 60)
print("步骤5: 重启 PM2（使用 start-with-env.js）")
print("=" * 60)
code, out, err = exec_cmd("pm2 delete lynx-app 2>&1; sleep 1; cd /opt/lynx/app && PORT=5176 pm2 start start-with-env.js --name lynx-app --cwd /opt/lynx/app 2>&1")
print(out, err)

code, out, err = exec_cmd("pm2 save 2>&1")
print(out, err)

print("\n" + "=" * 60)
print("步骤6: 等待启动并验证")
print("=" * 60)
import time
time.sleep(8)

code, out, err = exec_cmd("pm2 status 2>&1 | head -15")
print(out, err)

code, out, err = exec_cmd("pm2 logs lynx-app --lines 10 --nostream 2>&1")
print(out, err)

print("\n" + "=" * 60)
print("步骤7: 测试关键端点")
print("=" * 60)
code, out, err = exec_cmd("curl -sI https://ai.lynxdo.com/ | head -5")
print("首页:", out)

code, out, err = exec_cmd("curl -sI https://ai.lynxdo.com/downloads/hermes_agent-0.17.0-py3-none-any.whl | head -5")
print(".whl 下载:", out)

code, out, err = exec_cmd("curl -s http://127.0.0.1:3001/devices?userId=test 2>&1")
print("ws-gateway /devices:", out)

print("\n部署完成！")

"""
最小化部署：只更新服务器 desktop-electron/package.json，让 app-version API 返回 v1.0.11
避免完整 Next.js 重新构建（耗时且服务器零编译规范）
"""
import paramiko
import sys
from pathlib import Path

SERVER_IP = "47.119.185.135"
SSH_USER = "root"
SSH_PASSWORD = "Ee9527ffss"

LOCAL_PKG = Path(r"d:\Lynn工作空间\LynnHub\desktop-electron\package.json")
REMOTE_PKG = "/opt/lynx/app/desktop-electron/package.json"

def main():
    if not LOCAL_PKG.exists():
        print(f"[ERR] 本地文件不存在: {LOCAL_PKG}")
        sys.exit(1)

    print(f"=== 上传 {LOCAL_PKG.name} 到服务器 ===")
    try:
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        client.connect(SERVER_IP, 22, SSH_USER, SSH_PASSWORD, timeout=15)
        print("[OK] SSH 连接成功")
    except Exception as e:
        print(f"[ERR] SSH 连接失败: {e}")
        sys.exit(1)

    # 备份旧文件
    print("\n[1/4] 备份旧 package.json...")
    stdin, stdout, stderr = client.exec_command(f"cp {REMOTE_PKG} {REMOTE_PKG}.bak.$(date +%s) 2>&1")
    print(stdout.read().decode("utf-8", errors="replace"))

    # 上传新文件
    print("[2/4] 上传新 package.json...")
    sftp = client.open_sftp()
    sftp.put(str(LOCAL_PKG), REMOTE_PKG)
    sftp.close()
    print(f"[OK] 上传完成: {LOCAL_PKG} -> {REMOTE_PKG}")

    # 验证文件
    print("\n[3/4] 验证服务器上的 package.json...")
    stdin, stdout, stderr = client.exec_command(f"cat {REMOTE_PKG} | head -5")
    print(stdout.read().decode("utf-8", errors="replace"))

    # 重启 lynx-app 让 API 重新读取
    print("[4/4] 重启 lynx-app PM2 进程...")
    stdin, stdout, stderr = client.exec_command("pm2 reload lynx-app 2>&1")
    print(stdout.read().decode("utf-8", errors="replace"))
    err = stderr.read().decode("utf-8", errors="replace")
    if err:
        print(f"[stderr] {err}")

    # 等待 3 秒让进程稳定
    import time
    print("\n等待 3 秒让进程稳定...")
    time.sleep(3)

    # 验证 API
    print("\n=== 验证 app-version API ===")
    stdin, stdout, stderr = client.exec_command("curl -s http://127.0.0.1:5176/api/hermes/app-version")
    out = stdout.read().decode("utf-8", errors="replace")
    print(f"本地 curl: {out}")

    stdin, stdout, stderr = client.exec_command("curl -s https://ai.lynxdo.com/api/hermes/app-version")
    out = stdout.read().decode("utf-8", errors="replace")
    print(f"公网 curl: {out}")

    client.close()
    print("\n[OK] 部署完成")

if __name__ == "__main__":
    main()

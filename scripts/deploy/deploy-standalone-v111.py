"""
安全部署 Next.js standalone 到服务器
- 打包 .next/standalone（排除 .env, .lark-sync-state.json）
- 上传到 /tmp/lynx-deploy.tar.gz
- 备份当前 /opt/lynx/app -> /opt/lynx/backup/app-{timestamp}
- 解压新版到 /opt/lynx/app
- 保留旧 .env 和 .lark-sync-state.json
- PM2 reload lynx-app
- 验证 API
"""
import paramiko
import sys
import tarfile
import time
from pathlib import Path

# 添加 scripts/deploy 目录到 path 以导入 _config
sys.path.insert(0, str(Path(__file__).resolve().parent))
from _config import get_ssh_config

_ssh = get_ssh_config()
SERVER_IP = _ssh["host"]
SSH_USER = _ssh["user"]
SSH_PASSWORD = _ssh["password"]

STANDALONE_DIR = Path(r"d:\Lynn工作空间\LynnHub\.next\standalone")
TAR_PATH = Path(r"d:\Lynn工作空间\LynnHub\deploy\dist\standalone-deploy.tar.gz")

# 服务器路径
REMOTE_TAR = "/tmp/standalone-deploy.tar.gz"
REMOTE_APP_DIR = "/opt/lynx/app"
REMOTE_BACKUP_DIR = "/opt/lynx/backup"

def log(msg, level="INFO"):
    prefix = {"INFO": "[INFO]", "OK": "[OK]  ", "WARN": "[WARN]", "ERR": "[ERR] "}
    print(f"{prefix.get(level, '[INFO]')} {msg}")

def make_tar():
    """打包 standalone 目录，排除运行时文件"""
    if not STANDALONE_DIR.exists():
        log(f"standalone 目录不存在: {STANDALONE_DIR}", "ERR")
        sys.exit(1)

    TAR_PATH.parent.mkdir(parents=True, exist_ok=True)
    log(f"打包 {STANDALONE_DIR} -> {TAR_PATH}")

    EXCLUDE = {".env", ".env.production", ".lark-sync-state.json"}
    with tarfile.open(TAR_PATH, "w:gz") as tar:
        for item in STANDALONE_DIR.iterdir():
            if item.name in EXCLUDE:
                log(f"  跳过运行时文件: {item.name}", "WARN")
                continue
            tar.add(item, arcname=item.name)

    size_mb = TAR_PATH.stat().st_size / 1024 / 1024
    log(f"打包完成: {TAR_PATH.name} ({size_mb:.2f} MB)", "OK")

def run_remote(client, cmd, label=None, timeout=120):
    if label:
        print(f"\n=== {label} ===")
    print(f"$ {cmd}")
    stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    if out:
        print(out.rstrip())
    if err:
        print(f"[stderr] {err.rstrip()}")
    return out, err

def main():
    # 1. 打包
    log("=" * 60)
    log("  Next.js standalone 部署")
    log("=" * 60)
    make_tar()

    # 2. SSH 连接
    print()
    log(f"SSH 连接 {SERVER_IP}...")
    try:
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        client.connect(SERVER_IP, 22, SSH_USER, SSH_PASSWORD, timeout=15)
        log("SSH 连接成功", "OK")
    except Exception as e:
        log(f"SSH 连接失败: {e}", "ERR")
        sys.exit(1)

    # 3. 上传 tar
    print()
    log(f"[1/6] 上传 {TAR_PATH.name} ({TAR_PATH.stat().st_size/1024/1024:.2f} MB)...")
    sftp = client.open_sftp()
    sftp.put(str(TAR_PATH), REMOTE_TAR)
    sftp.close()
    log("上传完成", "OK")

    # 4. 备份当前版本
    ts = int(time.time())
    backup_path = f"{REMOTE_BACKUP_DIR}/app-{ts}"
    run_remote(client, f"mkdir -p {REMOTE_BACKUP_DIR}", "[2/6] 创建备份目录")
    run_remote(client, f"cp -r {REMOTE_APP_DIR} {backup_path} 2>&1 | tail -3", f"[3/6] 备份当前版本 -> {backup_path}")
    run_remote(client, f"du -sh {backup_path}", "备份大小")

    # 5. 解压新版（保留 .env 和 .lark-sync-state.json）
    run_remote(client, f"cd {REMOTE_APP_DIR} && tar -xzf {REMOTE_TAR} 2>&1 | tail -5", "[4/6] 解压新版到 /opt/lynx/app")
    run_remote(client, f"ls -la {REMOTE_APP_DIR}/ | head -15", "解压后目录")

    # 6. PM2 reload
    run_remote(client, "pm2 reload lynx-app 2>&1", "[5/6] PM2 reload lynx-app")
    time.sleep(5)

    # 7. 验证 API
    print()
    log("[6/6] 验证 API...")
    out, _ = run_remote(client, "curl -s http://127.0.0.1:5176/api/hermes/app-version 2>&1")
    out2, _ = run_remote(client, "curl -s https://ai.lynxdo.com/api/hermes/app-version 2>&1")

    # 8. 健康检查
    run_remote(client, "curl -s -o /dev/null -w 'health: %{http_code}\\n' http://127.0.0.1:5176/api/health", "健康检查")

    # 9. PM2 状态
    run_remote(client, "pm2 list 2>&1 | head -15", "PM2 状态")

    # 清理临时文件
    run_remote(client, f"rm -f {REMOTE_TAR}", "清理服务器临时文件")

    client.close()
    print()
    log("部署完成", "OK")

if __name__ == "__main__":
    main()

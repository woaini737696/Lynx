"""验证服务器代码版本与本地/GitHub同步"""
import paramiko
import sys
from pathlib import Path

# 添加 scripts/deploy 目录到 path 以导入 _config
sys.path.insert(0, str(Path(__file__).resolve().parent))
from _config import get_ssh_config

_ssh = get_ssh_config()
SERVER_IP = _ssh["host"]
SSH_USER = _ssh["user"]
SSH_PASSWORD = _ssh["password"]

def main():
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        c.connect(SERVER_IP, 22, SSH_USER, SSH_PASSWORD, timeout=15)
    except Exception as e:
        print(f"[ERR] SSH连接失败: {e}")
        sys.exit(1)

    cmds = [
        ("PM2进程列表", "pm2 list 2>&1 | head -20"),
        ("Web端健康检查", "curl -s -o /dev/null -w '%{http_code}' https://ai.lynxdo.com/api/health"),
        ("健康检查body", "curl -s https://ai.lynxdo.com/api/health"),
        ("应用版本", "cd /opt/lynx/app && cat package.json 2>/dev/null | grep -E 'version|name' | head -5"),
        ("关键文件清单", "ls -la /opt/lynx/app/server.js /opt/lynx/app/start-with-env.js /opt/lynx/app/scripts/start-ws-gateway.js /opt/lynx/app/scripts/ws-gateway.compiled.js 2>&1"),
        ("lynx-app进程信息", "pm2 info lynx-app 2>&1 | grep -E 'version|uptime|status|script path' | head -10"),
        ("lynx-ws-gateway进程信息", "pm2 info lynx-ws-gateway 2>&1 | grep -E 'version|uptime|status|script path' | head -10"),
        ("git仓库状态", "cd /opt/lynx && git log --oneline -3 2>&1 || echo '服务器无git仓库（正常，仅部署产物）'"),
    ]
    for label, cmd in cmds:
        stdin, stdout, stderr = c.exec_command(cmd, timeout=30)
        out = stdout.read().decode('utf-8', errors='replace').strip()
        err = stderr.read().decode('utf-8', errors='replace').strip()
        print(f"=== {label} ===")
        print(out if out else err)
        print()
    c.close()

if __name__ == "__main__":
    main()

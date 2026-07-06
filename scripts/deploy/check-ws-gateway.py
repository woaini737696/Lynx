"""
SSH 检查 ws-gateway 服务器端状态 + WebSocket 端口监听 + 测试 WS 连接
"""
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

def run(client, cmd, label=None):
    if label:
        print(f"\n=== {label} ===")
    print(f"$ {cmd}")
    stdin, stdout, stderr = client.exec_command(cmd, timeout=30)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    if out:
        print(out.rstrip())
    if err:
        print(f"[stderr] {err.rstrip()}")
    return out

def main():
    print(f"=== SSH 检查 ws-gateway ===")
    try:
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        client.connect(SERVER_IP, 22, SSH_USER, SSH_PASSWORD, timeout=15)
        print("[OK] SSH 连接成功")
    except Exception as e:
        print(f"[ERR] SSH 连接失败: {e}")
        sys.exit(1)

    # 1. ws-gateway PM2 详情
    run(client, "pm2 describe lynx-ws-gateway 2>&1 | head -25", "1. ws-gateway PM2 详情")

    # 2. ws-gateway 日志
    run(client, "tail -30 /opt/lynx/logs/ws-out.log 2>/dev/null", "2. ws-gateway out.log")
    run(client, "tail -30 /opt/lynx/logs/ws-error.log 2>/dev/null", "2b. ws-gateway error.log")

    # 3. 端口监听 3001
    run(client, "ss -tlnp | grep 3001", "3. 端口 3001 监听")

    # 4. nginx WS 代理配置
    run(client, "grep -A 10 'api/ws/agent' /etc/nginx/sites-enabled/lynxdo", "4. Nginx WS 代理配置")

    # 5. 测试 WS 连接（用 wscat 或 curl）
    run(client, "which wscat 2>&1 || echo 'wscat not installed'", "5. wscat 可用性")

    # 6. 用 curl 测试 WS 升级
    run(client, """curl -s -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" -H "Sec-WebSocket-Version: 13" -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" --max-time 3 http://127.0.0.1:3001/ 2>&1 | head -20""", "6. 本地 WS 升级测试 (3001)")

    run(client, """curl -s -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" -H "Sec-WebSocket-Version: 13" -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" --max-time 3 https://ai.lynxdo.com/api/ws/agent 2>&1 | head -20""", "7. 公网 WS 升级测试")

    # 8. 检查 ws-gateway.js 代码
    run(client, "cat /opt/lynx/app/scripts/start-ws-gateway.js 2>&1 | head -30", "8. start-ws-gateway.js")

    client.close()
    print("\n[OK] 检查完成")

if __name__ == "__main__":
    main()

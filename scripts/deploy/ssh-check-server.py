"""
SSH 检查服务器状态（PM2/Nginx/端口/进程）
"""
import paramiko
import sys

SERVER_IP = "47.119.185.135"
SSH_USER = "root"
SSH_PASSWORD = "Ee9527ffss"

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
    print(f"=== SSH 连接 {SERVER_IP} ===")
    try:
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        client.connect(SERVER_IP, 22, SSH_USER, SSH_PASSWORD, timeout=15)
        print("[OK] SSH 连接成功")
    except Exception as e:
        print(f"[ERR] SSH 连接失败: {e}")
        sys.exit(1)

    # 1. 系统基础状态
    run(client, "uname -a; uptime; free -m; df -h /", "1. 系统基础")

    # 2. PM2 进程
    run(client, "pm2 list 2>&1 || echo 'pm2 not found'", "2. PM2 进程")

    # 3. Nginx 状态
    run(client, "systemctl status nginx --no-pager 2>&1 | head -20", "3. Nginx 状态")

    # 4. 端口监听
    run(client, "ss -tlnp | grep -E ':(80|443|5176|3001|3000|3002)' ", "4. 端口监听")

    # 5. lynx-app 日志最近 30 行
    run(client, "tail -50 /opt/lynx/logs/error.log 2>/dev/null || echo 'no error.log'", "5. lynx-app error.log")

    run(client, "tail -30 /opt/lynx/logs/out.log 2>/dev/null || echo 'no out.log'", "5b. lynx-app out.log")

    # 6. 检查 ws-gateway 是否独立运行
    run(client, "pm2 describe lynx-ws-gateway 2>&1 | head -20 || echo 'no ws-gateway'", "6. ws-gateway PM2")

    # 7. 检查 /opt/lynx/app 是否存在
    run(client, "ls -la /opt/lynx/app/ 2>&1 | head -20", "7. /opt/lynx/app")

    # 8. 检查 nginx 配置
    run(client, "cat /etc/nginx/sites-enabled/lynxdo 2>/dev/null | head -80 || ls /etc/nginx/sites-enabled/ 2>&1", "8. Nginx 配置")

    # 9. 本地 curl 测试
    run(client, "curl -s -o /dev/null -w 'health: %{http_code}\\n' http://127.0.0.1:5176/api/health 2>&1", "9. 本地 curl health")
    run(client, "curl -s http://127.0.0.1:5176/api/hermes/app-version 2>&1 | head -5", "9b. 本地 curl app-version")

    client.close()
    print("\n[OK] SSH 检查完成")

if __name__ == "__main__":
    main()

"""
检查 IP 是否被服务器封禁
- fail2ban 状态
- nginx 限流配置
- /var/log 中的封禁记录
- 阿里云盾提示
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
    print(f"=== 检查 IP 封禁 ===")
    try:
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        client.connect(SERVER_IP, 22, SSH_USER, SSH_PASSWORD, timeout=15)
        print("[OK] SSH 连接成功")
    except Exception as e:
        print(f"[ERR] SSH 连接失败: {e}")
        sys.exit(1)

    # 1. fail2ban
    run(client, "systemctl status fail2ban --no-pager 2>&1 | head -5", "1. fail2ban 服务状态")
    run(client, "fail2ban-client status 2>&1 || echo 'fail2ban-client not available'", "1b. fail2ban jails")
    run(client, "iptables -L f2b-sshd -n 2>&1 || echo 'no f2b-sshd chain'", "1c. SSH 封禁列表")

    # 2. nginx 限流
    run(client, "grep -r 'limit_req' /etc/nginx/ 2>&1 | head -10", "2. nginx 限流配置")

    # 3. hosts.deny
    run(client, "cat /etc/hosts.deny 2>&1 | head -10", "3. hosts.deny")

    # 4. 检查 ai.lynxdo.com 完整 server block
    run(client, "grep -A 30 'server_name ai.lynxdo.com' /etc/nginx/sites-enabled/lynxdo | head -40", "4. ai.lynxdo.com server block")

    # 5. 检查 SSL 证书目录
    run(client, "ls -la /etc/letsencrypt/live/ 2>&1", "5. Let's Encrypt 证书目录")
    run(client, "ls -la /etc/letsencrypt/live/ai.lynxdo.com/ 2>&1 || echo 'ai.lynxdo.com 证书目录不存在'", "5b. ai.lynxdo.com 证书")

    # 6. nginx 进程是否监听 443 的 SSL
    run(client, "nginx -T 2>&1 | grep -E 'listen 443|ssl_certificate|server_name' | head -20", "6. nginx SSL 配置汇总")

    # 7. 最近的 nginx access.log 看是否有我的请求
    run(client, "tail -20 /var/log/nginx/access.log 2>/dev/null | head -20", "7. nginx access.log 最近")

    # 8. 阿里云盾/clound security
    run(client, "which aegis 2>&1; ls /usr/local/aegis 2>&1 | head -5; systemctl status aliyun-service --no-pager 2>&1 | head -5", "8. 阿里云盾")

    client.close()
    print("\n[OK] 检查完成")

if __name__ == "__main__":
    main()

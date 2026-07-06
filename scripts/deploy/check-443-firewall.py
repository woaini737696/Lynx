"""
SSH 排查 443 端口外部不可达问题
- 检查 nginx 443 监听
- 检查 iptables / ufw 防火墙
- 检查阿里云安全组（无法直接查，但可看 iptables）
- 检查 SSL 证书
- 测试外部访问
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
    print(f"=== SSH 排查 443 端口 ===")
    try:
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        client.connect(SERVER_IP, 22, SSH_USER, SSH_PASSWORD, timeout=15)
        print("[OK] SSH 连接成功")
    except Exception as e:
        print(f"[ERR] SSH 连接失败: {e}")
        sys.exit(1)

    # 1. nginx 443 监听
    run(client, "ss -tlnp | grep -E ':443|:80'", "1. nginx 端口监听")

    # 2. iptables 规则
    run(client, "iptables -L -n --line-numbers 2>&1 | head -40", "2. iptables 规则")

    # 3. ufw 状态
    run(client, "ufw status 2>&1 || echo 'ufw not installed'", "3. ufw 状态")

    # 4. firewalld 状态
    run(client, "systemctl status firewalld --no-pager 2>&1 | head -5 || echo 'firewalld not installed'", "4. firewalld 状态")

    # 5. nginx 配置测试
    run(client, "nginx -t 2>&1", "5. nginx 配置测试")

    # 6. SSL 证书有效期
    run(client, "openssl x509 -in /etc/letsencrypt/live/ai.lynxdo.com/cert.pem -noout -dates -subject 2>&1", "6. ai.lynxdo.com SSL 证书")

    run(client, "openssl x509 -in /etc/letsencrypt/live/www.lynxdo.com/cert.pem -noout -dates -subject 2>&1", "6b. www.lynxdo.com SSL 证书")

    # 7. nginx error.log 最近
    run(client, "tail -30 /var/log/nginx/error.log 2>/dev/null", "7. nginx error.log")

    # 8. 从服务器外部视角测试（用 curl 模拟）
    run(client, "curl -s -o /dev/null -w '公网 ai.lynxdo.com: %{http_code}, ssl_verify: %{ssl_verify_result}\\n' https://ai.lynxdo.com/api/health --max-time 10 2>&1", "8. 服务器自访问公网域名")

    # 9. 检查 nftables
    run(client, "nft list ruleset 2>&1 | head -30 || echo 'nft not installed'", "9. nftables 规则")

    # 10. 检查阿里云安全组提示
    run(client, "echo '阿里云安全组需在控制台检查：443端口是否对 0.0.0.0/0 开放'", "10. 安全组提示")

    client.close()
    print("\n[OK] 检查完成")

if __name__ == "__main__":
    main()

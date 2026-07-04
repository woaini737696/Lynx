"""检查服务器 HermesAgent 相关文件"""
import paramiko

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
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(SERVER_IP, 22, SSH_USER, SSH_PASSWORD, timeout=15)
    print("[OK] SSH 连接成功")

    # 1. 检查 public/downloads 目录
    run(client, "ls -lah /opt/lynx/app/public/downloads/ 2>&1", "1. public/downloads 目录")

    # 2. 检查 latest.json 内容
    run(client, "cat /opt/lynx/app/public/downloads/latest.json 2>&1", "2. latest.json 内容")

    # 3. 检查 .whl 文件
    run(client, "find /opt/lynx -name '*.whl' 2>/dev/null", "3. 所有 .whl 文件")

    # 4. 检查 nginx /downloads/ 配置
    run(client, "grep -A 5 'downloads' /etc/nginx/sites-enabled/lynxdo | head -20", "4. nginx /downloads/ 配置")

    # 5. 测试下载 latest.json
    run(client, "curl -s -o /dev/null -w 'latest-json: %{http_code}\\n' https://ai.lynxdo.com/api/hermes/latest-json", "5. latest-json API")

    # 6. 测试 download-wheel API
    run(client, "curl -s -o /dev/null -w 'download-wheel: %{http_code}\\n' 'https://ai.lynxdo.com/api/hermes/download-wheel?file=hermes_agent-0.18.0-py3-none-any.whl'", "6. download-wheel API")

    client.close()

if __name__ == "__main__":
    main()

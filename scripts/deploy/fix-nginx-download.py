"""修复nginx配置：删除错误位置的/download/块，在正确位置(www.lynxdo.com server块内)插入"""
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

NGINX_CONF = "/etc/nginx/sites-available/lynxdo"

def ssh_exec(c, cmd, timeout=30):
    stdin, stdout, stderr = c.exec_command(cmd, timeout=timeout)
    exit_code = stdout.channel.recv_exit_status()
    out = stdout.read().decode('utf-8', errors='replace').strip()
    err = stderr.read().decode('utf-8', errors='replace').strip()
    return exit_code, out, err

def main():
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(SERVER_IP, 22, SSH_USER, SSH_PASSWORD, timeout=15)

    # 1. 备份当前配置
    code, out, err = ssh_exec(c, f"cp {NGINX_CONF} {NGINX_CONF}.bak.fix-download")
    print(f"[1] 备份: {NGINX_CONF}.bak.fix-download")

    # 2. 读取配置文件
    sftp = c.open_sftp()
    with sftp.file(NGINX_CONF, 'r') as f:
        content = f.read().decode('utf-8')

    # 3. 删除错误插入在文件顶部的 /download/ 块
    bad_block = """    # 安装包下载（官网下载入口，无s）
    location /download/ {
        alias /opt/lynx/download/;
        autoindex on;
        autoindex_exact_size off;
        autoindex_localtime on;
    }
"""
    if bad_block in content:
        content = content.replace(bad_block, "", 1)
        print("[2] 已删除错误位置的 /download/ 块")
    else:
        print("[2] 未找到错误的 /download/ 块（可能已被清理）")

    # 4. 在 www.lynxdo.com server 块的 location /downloads/ 之前插入 /download/
    download_block = """    # 安装包下载（官网下载入口，无s）
    location /download/ {
        alias /opt/lynx/download/;
        autoindex on;
        autoindex_exact_size off;
        autoindex_localtime on;
    }

    # 安装包下载（HermesAgent .whl 等）"""
    old_downloads = "    # 安装包下载（HermesAgent .whl 等）"

    # 只在 www.lynxdo.com server 块中插入（第一次出现）
    if "/download/" not in content.split(old_downloads)[0]:
        content = content.replace(old_downloads, download_block, 1)
        print("[3] 已在 www.lynxdo.com 块插入 /download/ location")
    else:
        print("[3] /download/ 已存在，跳过插入")

    # 5. 写回配置
    with sftp.file(NGINX_CONF, 'w') as f:
        f.write(content)
    sftp.close()
    print("[4] 配置已写回")

    # 6. 测试 nginx 配置
    code, out, err = ssh_exec(c, "nginx -t 2>&1")
    print(f"[5] nginx -t: {out}")
    if code != 0:
        print(f"[ERR] nginx配置测试失败: {err}")
        sys.exit(1)

    # 7. 重载 nginx
    code, out, err = ssh_exec(c, "systemctl reload nginx 2>&1")
    if code != 0:
        print(f"[ERR] nginx重载失败: {err}")
        sys.exit(1)
    print("[6] nginx 已重载")

    # 8. 验证 /download/ 是否可访问
    code, out, _ = ssh_exec(c, "curl -s -o /dev/null -w '%{http_code}' https://www.lynxdo.com/download/Lynx-windows-setup.exe")
    print(f"[7] 桌面端下载 HTTP: {out}")
    code, out, _ = ssh_exec(c, "curl -s -o /dev/null -w '%{http_code}' https://www.lynxdo.com/download/Lynx-android.apk")
    print(f"[8] 安卓下载 HTTP: {out}")
    code, out, _ = ssh_exec(c, "curl -s -o /dev/null -w '%{http_code}' https://www.lynxdo.com/")
    print(f"[9] 官网首页 HTTP: {out}")

    c.close()
    print("\n[OK] 修复完成")

if __name__ == "__main__":
    main()

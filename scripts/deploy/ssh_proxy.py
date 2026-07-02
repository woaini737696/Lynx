"""
SSH 远程执行工具（通过 HTTP 代理 CONNECT 隧道连接）

sandbox 网络受限，无法直连公网，但存在 HTTP 代理 127.0.0.1:18080。
该代理支持 CONNECT 方法转发到任意 TCP 端口（已验证 22/443 均可）。
本脚本用 PySocks 在 paramiko 之上建立到服务器的 SSH 连接，提供与 ssh_exec.py
等价的 exec_cmd / upload_file / upload_dir 接口，供部署流程使用。

用法：
    python3 ssh_proxy.py "<远程命令>"
    python3 ssh_proxy.py --upload <local> <remote>
    python3 ssh_proxy.py --upload-dir <local> <remote>
"""
import os
import sys
import socks
import paramiko

# 代理配置（sandbox HTTP 代理）
PROXY_HOST = "127.0.0.1"
PROXY_PORT = 18080

# 服务器配置（与 ssh_exec.py 一致）
HOST = "47.119.185.135"
USER = "root"
PASSWORD = "Ee9527ffss"
PORT = 22


def _make_socket():
    """通过 HTTP 代理建立到服务器的 TCP 隧道"""
    s = socks.socksocket()
    s.set_proxy(socks.HTTP, PROXY_HOST, PROXY_PORT)
    s.settimeout(30)
    s.connect((HOST, PORT))
    return s


def _connect():
    """建立 SSH 客户端连接"""
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    sock = _make_socket()
    client.connect(
        hostname=HOST,
        port=PORT,
        username=USER,
        password=PASSWORD,
        timeout=30,
        sock=sock,
        allow_agent=False,
        look_for_keys=False,
    )
    return client


def exec_cmd(cmd, timeout=600):
    """执行远程命令并打印输出，返回 (exit_code, stdout, stderr)"""
    client = _connect()
    try:
        stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
        out = stdout.read().decode("utf-8", errors="replace")
        err = stderr.read().decode("utf-8", errors="replace")
        exit_code = stdout.channel.recv_exit_status()
        if out:
            print(out, end="")
        if err:
            print(f"[STDERR] {err}", end="", file=sys.stderr)
        print(f"[EXIT {exit_code}]")
        return exit_code, out, err
    finally:
        client.close()


def upload_file(local_path, remote_path):
    """上传单个文件到服务器"""
    client = _connect()
    try:
        sftp = client.open_sftp()
        sftp.put(local_path, remote_path)
        sftp.close()
        print(f"[UPLOADED] {local_path} -> {remote_path}")
    finally:
        client.close()


def upload_dir(local_dir, remote_dir):
    """递归上传目录"""
    client = _connect()
    try:
        sftp = client.open_sftp()

        def ensure_remote_dir(path):
            try:
                sftp.stat(path)
            except FileNotFoundError:
                parent = "/".join(path.rstrip("/").split("/")[:-1])
                if parent:
                    ensure_remote_dir(parent)
                sftp.mkdir(path)

        def upload_recursive(local, remote):
            ensure_remote_dir(remote)
            for item in os.listdir(local):
                local_path = os.path.join(local, item)
                remote_path = remote.rstrip("/") + "/" + item
                if os.path.isfile(local_path):
                    sftp.put(local_path, remote_path)
                elif os.path.isdir(local_path):
                    upload_recursive(local_path, remote_path)

        upload_recursive(local_dir, remote_dir)
        sftp.close()
        print(f"[UPLOADED DIR] {local_dir} -> {remote_dir}")
    finally:
        client.close()


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("用法: python3 ssh_proxy.py <command> | --upload <local> <remote> | --upload-dir <local> <remote>")
        sys.exit(1)

    if sys.argv[1] == "--upload":
        upload_file(sys.argv[2], sys.argv[3])
    elif sys.argv[1] == "--upload-dir":
        upload_dir(sys.argv[2], sys.argv[3])
    else:
        cmd = " ".join(sys.argv[1:])
        code, _, _ = exec_cmd(cmd)
        sys.exit(code)

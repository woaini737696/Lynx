"""
SSH 远程执行工具 - 用于阿里云服务器部署
使用 paramiko 库实现非交互式 SSH 操作
"""
import sys
import paramiko
import os
from pathlib import Path

# 添加 scripts/deploy 目录到 path 以导入 _config
sys.path.insert(0, str(Path(__file__).resolve().parent))
from _config import get_ssh_config

# 服务器配置
_ssh = get_ssh_config()
HOST = _ssh["host"]
USER = _ssh["user"]
PASSWORD = _ssh["password"]
PORT = 22


def exec_cmd(cmd, timeout=300):
    """执行远程命令并返回输出"""
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(HOST, port=PORT, username=USER, password=PASSWORD, timeout=15)
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
    """上传文件到服务器"""
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(HOST, port=PORT, username=USER, password=PASSWORD, timeout=15)
        sftp = client.open_sftp()
        sftp.put(local_path, remote_path)
        sftp.close()
        print(f"[UPLOADED] {local_path} -> {remote_path}")
    finally:
        client.close()


def upload_dir(local_dir, remote_dir):
    """递归上传目录"""
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(HOST, port=PORT, username=USER, password=PASSWORD, timeout=15)
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
        print("用法: python ssh_exec.py <command> | --upload <local> <remote> | --upload-dir <local> <remote>")
        sys.exit(1)

    if sys.argv[1] == "--upload":
        upload_file(sys.argv[2], sys.argv[3])
    elif sys.argv[1] == "--upload-dir":
        upload_dir(sys.argv[2], sys.argv[3])
    else:
        cmd = " ".join(sys.argv[1:])
        code, _, _ = exec_cmd(cmd)
        sys.exit(code)

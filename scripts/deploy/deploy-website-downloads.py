"""
Lynx 官网+下载包部署脚本
1. 上传桌面端exe和安卓apk到服务器 /opt/lynx/download/
2. 上传官网产物到 /opt/lynx/website/
3. 配置nginx /download/ 别名
4. 重载nginx
5. 健康检查
"""
import os
import sys
import paramiko

SERVER_IP = "47.119.185.135"
SSH_USER = "root"
SSH_PASSWORD = "Ee9527ffss"

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DESKTOP_EXE = os.path.join(PROJECT_ROOT, "downloads", "Lynx_1.0.4_x64-setup.exe")
ANDROID_APK_DIR = os.path.join(PROJECT_ROOT, "android", "app", "build", "outputs", "apk", "release")
WEBSITE_DIST = os.path.join(PROJECT_ROOT, "web_Lynx", "dist")


def log(msg, level="INFO"):
    color = {"INFO": "\033[36m", "OK": "\033[32m", "WARN": "\033[33m", "ERR": "\033[31m"}.get(level, "")
    reset = "\033[0m"
    print(f"{color}[{level}]{reset} {msg}")


def ssh_exec(client, cmd, timeout=120):
    stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    exit_code = stdout.channel.recv_exit_status()
    out = stdout.read().decode("utf-8", errors="replace").strip()
    err = stderr.read().decode("utf-8", errors="replace").strip()
    return exit_code, out, err


def upload_file(client, local_path, remote_path, remote_name):
    """上传单个文件并重命名"""
    if not os.path.exists(local_path):
        log(f"本地文件不存在: {local_path}", "ERR")
        return False
    size_mb = os.path.getsize(local_path) / 1024 / 1024
    log(f"上传 {os.path.basename(local_path)} ({size_mb:.2f} MB) -> {remote_path}/{remote_name}")
    sftp = client.open_sftp()
    try:
        # 确保远程目录存在
        parts = remote_path.split("/")
        cur = ""
        for p in parts:
            if not p:
                continue
            cur += "/" + p
            try:
                sftp.stat(cur)
            except IOError:
                sftp.mkdir(cur)
        sftp.put(local_path, f"{remote_path}/{remote_name}")
        # 校验
        remote_stat = sftp.stat(f"{remote_path}/{remote_name}")
        log(f"上传成功: 远程文件 {remote_stat.st_size / 1024 / 1024:.2f} MB", "OK")
    finally:
        sftp.close()
    return True


def upload_dir(client, local_dir, remote_dir):
    """递归上传整个目录"""
    if not os.path.isdir(local_dir):
        log(f"本地目录不存在: {local_dir}", "ERR")
        return False
    sftp = client.open_sftp()
    try:
        # 确保远程目录存在
        parts = remote_dir.split("/")
        cur = ""
        for p in parts:
            if not p:
                continue
            cur += "/" + p
            try:
                sftp.stat(cur)
            except IOError:
                sftp.mkdir(cur)
        # 清空远程目录旧内容
        try:
            for item in sftp.listdir(remote_dir):
                remote_item = f"{remote_dir}/{item}"
                try:
                    sftp.remove(remote_item)
                except IOError:
                    rmdir_recursive(sftp, remote_item)
        except IOError:
            pass

        def put_dir(local, remote):
            for item in os.listdir(local):
                local_path = os.path.join(local, item)
                remote_path = f"{remote}/{item}"
                if os.path.isdir(local_path):
                    try:
                        sftp.stat(remote_path)
                    except IOError:
                        sftp.mkdir(remote_path)
                    put_dir(local_path, remote_path)
                else:
                    sftp.put(local_path, remote_path)

        put_dir(local_dir, remote_dir)
        log(f"目录上传成功: {local_dir} -> {remote_dir}", "OK")
    finally:
        sftp.close()
    return True


def rmdir_recursive(sftp, remote_path):
    try:
        for item in sftp.listdir(remote_path):
            child = f"{remote_path}/{item}"
            try:
                rmdir_recursive(sftp, child)
            except IOError:
                sftp.remove(child)
        sftp.rmdir(remote_path)
    except IOError:
        pass


def find_apk():
    """查找构建好的APK文件"""
    if not os.path.isdir(ANDROID_APK_DIR):
        return None
    for f in os.listdir(ANDROID_APK_DIR):
        if f.endswith(".apk"):
            return os.path.join(ANDROID_APK_DIR, f)
    return None


def main():
    log("=" * 60, "INFO")
    log("  Lynx 官网 + 下载包部署", "INFO")
    log("=" * 60, "INFO")

    # 检查本地文件
    log("[1/6] 检查本地文件...")
    if not os.path.exists(DESKTOP_EXE):
        log(f"桌面端exe不存在: {DESKTOP_EXE}", "ERR")
        sys.exit(1)
    log(f"  桌面端exe: {os.path.getsize(DESKTOP_EXE) / 1024 / 1024:.2f} MB", "OK")

    apk_path = find_apk()
    if not apk_path:
        log("安卓APK未找到，跳过APK上传", "WARN")
    else:
        log(f"  安卓APK: {os.path.getsize(apk_path) / 1024 / 1024:.2f} MB ({os.path.basename(apk_path)})", "OK")

    if not os.path.isdir(WEBSITE_DIST):
        log(f"官网产物不存在: {WEBSITE_DIST}", "ERR")
        log("请先构建: cd web_Lynx && pnpm run build", "ERR")
        sys.exit(1)
    log(f"  官网产物: {WEBSITE_DIST}", "OK")

    # 连接服务器
    log("[2/6] 连接服务器...")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(SERVER_IP, 22, SSH_USER, SSH_PASSWORD, timeout=15)
    except Exception as e:
        log(f"SSH连接失败: {e}", "ERR")
        sys.exit(1)
    log("SSH连接成功", "OK")

    # 上传安装包
    log("[3/6] 上传安装包到 /opt/lynx/download/ ...")
    upload_file(client, DESKTOP_EXE, "/opt/lynx/download", "Lynx-windows-setup.exe")
    if apk_path:
        upload_file(client, apk_path, "/opt/lynx/download", "Lynx-android.apk")

    # 上传官网
    log("[4/6] 上传官网到 /opt/lynx/website/ ...")
    upload_dir(client, WEBSITE_DIST, "/opt/lynx/website")

    # 配置nginx /download/ 别名
    log("[5/6] 配置nginx /download/ 别名...")
    nginx_conf = "/etc/nginx/sites-available/lynxdo"
    # 检查是否已配置 /download/
    code, out, _ = ssh_exec(client, f"grep -c 'location /download/' {nginx_conf}")
    if "0" in out or code != 0:
        # 在 www.lynxdo.com server 块中添加 /download/ location
        # 使用 sed 在 location /downloads/ 之前插入 /download/
        add_cmd = f"""sed -i '/location \\/downloads\\//i\\    # 安装包下载（官网下载入口，无s）\\n    location /download/ {{\\n        alias /opt/lynx/download/;\\n        autoindex on;\\n        autoindex_exact_size off;\\n        autoindex_localtime on;\\n    }}\\n' {nginx_conf}"""
        code, out, err = ssh_exec(client, add_cmd)
        if code != 0:
            log(f"nginx配置修改失败: {err}", "ERR")
            sys.exit(1)
        log("nginx /download/ 别名已添加", "OK")
    else:
        log("nginx /download/ 别名已存在，跳过", "WARN")

    # 测试并重载nginx
    code, out, err = ssh_exec(client, "nginx -t 2>&1")
    log(f"nginx -t: {out}", "INFO")
    if code != 0:
        log(f"nginx配置测试失败: {err}", "ERR")
        sys.exit(1)
    code, out, err = ssh_exec(client, "systemctl reload nginx 2>&1")
    if code != 0:
        log(f"nginx重载失败: {err}", "ERR")
        sys.exit(1)
    log("nginx已重载", "OK")

    # 健康检查
    log("[6/6] 健康检查...")
    import time
    time.sleep(2)

    # 官网首页
    code, out, _ = ssh_exec(client, "curl -s -o /dev/null -w '%{http_code}' https://www.lynxdo.com/")
    log(f"官网首页: HTTP {out}", "OK" if out == "200" else "WARN")

    # 桌面端下载
    code, out, _ = ssh_exec(client, "curl -s -o /dev/null -w '%{http_code}' https://www.lynxdo.com/download/Lynx-windows-setup.exe")
    log(f"桌面端下载: HTTP {out}", "OK" if out == "200" else "WARN")

    # 安卓下载
    code, out, _ = ssh_exec(client, "curl -s -o /dev/null -w '%{http_code}' https://www.lynxdo.com/download/Lynx-android.apk")
    log(f"安卓下载: HTTP {out}", "OK" if out == "200" else "WARN")

    # 官网标题
    code, out, _ = ssh_exec(client, "curl -s https://www.lynxdo.com/ | grep -o '<title>[^<]*</title>'")
    log(f"官网标题: {out}", "INFO")

    # favicon
    code, out, _ = ssh_exec(client, "curl -s -o /dev/null -w '%{http_code}' https://www.lynxdo.com/lynx-logo-black.png")
    log(f"favicon: HTTP {out}", "OK" if out == "200" else "WARN")

    log("=" * 60, "OK")
    log("  部署完成!", "OK")
    log("=" * 60, "OK")
    log("官网地址: https://www.lynxdo.com/", "INFO")
    log("Web应用: https://ai.lynxdo.com/", "INFO")
    log("桌面端下载: https://www.lynxdo.com/download/Lynx-windows-setup.exe", "INFO")
    log("安卓下载: https://www.lynxdo.com/download/Lynx-android.apk", "INFO")

    client.close()


if __name__ == "__main__":
    main()

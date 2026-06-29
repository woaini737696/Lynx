"""
Lynx Web 端部署脚本（密码方式）
用法：python scripts/deploy/deploy-password.py
仅部署 Next.js standalone（无 schema 变更，跳过 prisma db push）
"""
import os
import sys
import time
import tarfile
import paramiko
from io import BytesIO

# ============ 配置 ============
SERVER_IP = "47.119.185.135"
SSH_USER = "root"
SSH_PASSWORD = "Ee9527ffss"
DEPLOY_DIR = "/opt/lynx"
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
STANDALONE_DIR = os.path.join(PROJECT_ROOT, ".next", "standalone")
STATIC_DIR = os.path.join(PROJECT_ROOT, ".next", "static")
PUBLIC_DIR = os.path.join(PROJECT_ROOT, "public")
ENV_PRODUCTION = os.path.join(PROJECT_ROOT, ".env.production")

TS = time.strftime("%Y%m%d-%H%M%S")
REMOTE_TMP = f"/tmp/lynx-deploy-{TS}"
REMOTE_ARCHIVE = f"{REMOTE_TMP}.tar.gz"


def log(msg, level="INFO"):
    color = {"INFO": "\033[36m", "OK": "\033[32m", "WARN": "\033[33m", "ERR": "\033[31m"}.get(level, "")
    reset = "\033[0m"
    print(f"{color}[{level}]{reset} {msg}")


def check_local():
    """校验本地构建产物是否就绪"""
    log("校验本地构建产物...")
    for path in [STANDALONE_DIR, STATIC_DIR, ENV_PRODUCTION]:
        if not os.path.exists(path):
            log(f"缺少: {path}", "ERR")
            sys.exit(1)
    server_js = os.path.join(STANDALONE_DIR, "server.js")
    if not os.path.exists(server_js):
        log(f"缺少 standalone/server.js", "ERR")
        sys.exit(1)
    # 检查 middleware 是否包含 CORS 标识（粗略验证）
    mw_path = os.path.join(STANDALONE_DIR, ".next", "server", "middleware.js")
    if os.path.exists(mw_path):
        with open(mw_path, "rb") as f:
            content = f.read()
        if b"tauri.localhost" in content or b"tauri://" in content or b"ALLOWED_TAURI" in content:
            log("✓ middleware 已含 Tauri CORS 配置", "OK")
        else:
            log("⚠ middleware 未检测到 Tauri CORS 标识（可能 minify 后字面量变化，继续部署）", "WARN")
    else:
        log(f"⚠ 未找到 {mw_path}（standalone 可能已合并 middleware）", "WARN")
    log("本地构建产物校验通过", "OK")


def pack_standalone():
    """打包 standalone + static + public + .env.production 到 tar.gz"""
    log("打包 standalone 产物...")
    buf = BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        # standalone 根目录内容（server.js + .next + node_modules）
        for item in os.listdir(STANDALONE_DIR):
            full = os.path.join(STANDALONE_DIR, item)
            arc = os.path.join("standalone", item)
            tar.add(full, arcname=arc)
        # .next/static（standalone 不含，需补齐）
        tar.add(STATIC_DIR, arcname="standalone/.next/static")
        # public（合并到 standalone/public）
        if os.path.exists(PUBLIC_DIR):
            tar.add(PUBLIC_DIR, arcname="standalone/public")
        # .env.production → standalone/.env
        tar.add(ENV_PRODUCTION, arcname="standalone/.env")
    size_mb = buf.tell() / 1024 / 1024
    buf.seek(0)
    log(f"打包完成: {size_mb:.2f} MB", "OK")
    return buf


def ssh_exec(client, cmd, timeout=120):
    """执行远程命令并返回输出"""
    stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    exit_code = stdout.channel.recv_exit_status()
    out = stdout.read().decode("utf-8", errors="replace").strip()
    err = stderr.read().decode("utf-8", errors="replace").strip()
    return exit_code, out, err


def main():
    check_local()

    log(f"连接服务器 {SSH_USER}@{SERVER_IP} ...")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(SERVER_IP, port=22, username=SSH_USER, password=SSH_PASSWORD, timeout=15)
    except Exception as e:
        log(f"SSH 连接失败: {e}", "ERR")
        sys.exit(1)
    log("SSH 连接成功", "OK")

    # 1. 准备远程临时目录
    log("[1/6] 准备远程临时目录...")
    code, _, err = ssh_exec(client, f"mkdir -p {REMOTE_TMP}")
    if code != 0:
        log(f"mkdir 失败: {err}", "ERR")
        sys.exit(1)

    # 2. 上传 tar.gz
    log("[2/6] 上传 standalone 打包文件...")
    archive_buf = pack_standalone()
    sftp = client.open_sftp()
    try:
        with sftp.file(REMOTE_ARCHIVE, "wb") as f:
            f.write(archive_buf.read())
        # 校验上传大小
        remote_stat = sftp.stat(REMOTE_ARCHIVE)
        log(f"上传完成: 远程文件 {remote_stat.st_size / 1024 / 1024:.2f} MB", "OK")
    finally:
        sftp.close()

    # 3. 备份当前版本
    log("[3/6] 备份当前版本...")
    backup_cmd = f"if [ -d {DEPLOY_DIR}/app ] && [ -f {DEPLOY_DIR}/app/server.js ]; then mv {DEPLOY_DIR}/app {DEPLOY_DIR}/backup/app-{TS} && echo BACKUP_OK; else echo NO_APP; fi"
    code, out, err = ssh_exec(client, backup_cmd)
    if "BACKUP_OK" in out:
        log(f"已备份到 backup/app-{TS}", "OK")
    elif "NO_APP" in out:
        log("服务器无现有 app 目录（首次部署）", "WARN")
    else:
        log(f"备份失败: {err}", "ERR")
        sys.exit(1)

    # 4. 解压新版本到 /opt/lynx/app（用 --strip-components=1 跳过 standalone/ 前缀，
    #    确保隐藏文件 .env/.next 也被正确解压，避免 mv * 不匹配 dotfiles 的坑）
    log("[4/6] 解压新版本...")
    extract_cmd = f"rm -rf {DEPLOY_DIR}/app && mkdir -p {DEPLOY_DIR}/app && tar -xzf {REMOTE_ARCHIVE} -C {DEPLOY_DIR}/app --strip-components=1 && rm -rf {REMOTE_TMP} {REMOTE_ARCHIVE}"
    code, out, err = ssh_exec(client, extract_cmd, timeout=180)
    if code != 0:
        log(f"解压失败: {err}", "ERR")
        sys.exit(1)
    log("解压完成", "OK")

    # 校验关键文件（含隐藏文件 .env/.next）
    code, out, _ = ssh_exec(client, f"ls -la {DEPLOY_DIR}/app/.env {DEPLOY_DIR}/app/server.js {DEPLOY_DIR}/app/.next/static/ 2>&1 | head -20")
    log(f"关键文件:\n{out}", "INFO")
    if ".env" not in out or "server.js" not in out:
        log("关键文件校验失败（.env 或 server.js 缺失）", "ERR")
        sys.exit(1)
    log("关键文件就位 (server.js + .env + .next/static)", "OK")

    # 5. 重启 PM2
    log("[5/6] 重启 PM2...")
    code, out, err = ssh_exec(client, f"cd {DEPLOY_DIR} && (pm2 reload ecosystem.config.cjs 2>&1 || pm2 start ecosystem.config.cjs 2>&1) && pm2 save 2>&1")
    log(f"PM2 输出: {out[:300]}", "INFO")
    if code != 0:
        log(f"PM2 重启失败: {err}", "ERR")
        sys.exit(1)
    log("PM2 已重启", "OK")

    # 6. 健康检查
    log("[6/6] 健康检查...")
    time.sleep(4)
    code, out, _ = ssh_exec(client, "curl -s -o /dev/null -w '%{http_code}' https://ai.lynxdo.com/api/health")
    if out == "200":
        log(f"健康检查通过: HTTP {out}", "OK")
    else:
        log(f"健康检查异常: HTTP {out}（服务可能还在启动中）", "WARN")
        # 看 PM2 日志
        code, out, _ = ssh_exec(client, "pm2 logs lynx-app --lines 15 --nostream 2>&1")
        log(f"PM2 日志:\n{out}", "INFO")

    # 测试 CORS 头（模拟 Tauri origin）
    log("验证 CORS 响应头（模拟 Tauri origin）...")
    cors_cmd = "curl -s -i -X OPTIONS -H 'Origin: https://tauri.localhost' -H 'Access-Control-Request-Method: POST' https://ai.lynxdo.com/api/auth/token 2>&1 | head -20"
    code, out, _ = ssh_exec(client, cors_cmd)
    log(f"CORS 响应:\n{out}", "INFO")
    if "access-control-allow-origin" in out.lower():
        log("✓ CORS 头已正确返回，桌面端 fetch 方案可正常工作", "OK")
    else:
        log("⚠ CORS 头未返回，请检查 middleware.ts 是否生效", "WARN")

    log("=" * 50, "OK")
    log("  部署完成!", "OK")
    log("=" * 50, "OK")
    log(f"应用地址: https://ai.lynxdo.com", "INFO")
    log(f"回滚命令: ssh {SSH_USER}@{SERVER_IP} 'cd {DEPLOY_DIR} && rm -rf app && mv backup/app-{TS} app && pm2 reload ecosystem.config.cjs'", "INFO")

    client.close()


if __name__ == "__main__":
    main()

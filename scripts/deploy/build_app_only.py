"""
精简部署脚本：仅构建主应用（跳过桌面端、官网），打包并上传到服务器。
用法: python build_app_only.py
"""
import os
import sys
import subprocess
import shutil
import tarfile
from pathlib import Path

# 项目根目录
PROJECT_ROOT = Path(r"d:\Lynn工作空间\LynnHub")
sys.path.insert(0, str(PROJECT_ROOT / "scripts" / "deploy"))
from _config import get_ssh_config

# 服务器配置
_ssh = get_ssh_config()
HOST = _ssh["host"]
USER = _ssh["user"]
PASSWORD = _ssh["password"]
PORT = 22

from ssh_exec import exec_cmd, upload_file

DIST_DIR = PROJECT_ROOT / "deploy" / "dist"
PKG_NAME = "lynx-deploy-fast"

def run(cmd, cwd=None, check=True, env=None):
    """运行本地命令"""
    print(f">>> {cmd}", flush=True)
    result = subprocess.run(
        cmd, shell=True, cwd=cwd or PROJECT_ROOT, env=env,
        capture_output=False, text=True
    )
    if check and result.returncode != 0:
        raise RuntimeError(f"命令失败: {cmd}")
    return result

def main():
    os.chdir(PROJECT_ROOT)
    print("=" * 60)
    print("  Lynx 精简部署（仅主应用）")
    print("=" * 60)

    # 1. 清理旧产物
    if DIST_DIR.exists():
        shutil.rmtree(DIST_DIR, ignore_errors=True)
    DIST_DIR.mkdir(parents=True, exist_ok=True)
    pkg_dir = DIST_DIR / PKG_NAME
    pkg_dir.mkdir(parents=True, exist_ok=True)

    # 2. 安装依赖
    print("\n[1/7] 安装依赖 npm ci...")
    run("npm ci --production=false", check=False)

    # 3. Prisma generate
    print("\n[2/7] Prisma generate...")
    run("npx prisma generate")

    # 4. 预编译 WS 网关
    print("\n[3/7] 预编译 WS 网关...")
    run("node scripts/compile-ws-gateway.mjs")
    if not (PROJECT_ROOT / "scripts" / "ws-gateway.compiled.js").exists():
        raise RuntimeError("ws-gateway.compiled.js 未生成")

    # 5. Next.js 构建
    print("\n[4/7] Next.js 构建 (standalone)...")
    run("npm run build")

    # 6. 打包 standalone 产物
    print("\n[5/7] 打包 standalone 产物...")
    standalone_dir = pkg_dir / "standalone"
    standalone_dir.mkdir(parents=True, exist_ok=True)

    # 复制 standalone server.js + node_modules
    src_standalone = PROJECT_ROOT / ".next" / "standalone"
    for item in src_standalone.iterdir():
        dst = standalone_dir / item.name
        if item.is_dir():
            shutil.copytree(item, dst, dirs_exist_ok=True)
        else:
            shutil.copy2(item, dst)

    # 复制 @prisma/client 和 .prisma/client
    prisma_dst = standalone_dir / "node_modules" / "@prisma" / "client"
    prisma_dst.mkdir(parents=True, exist_ok=True)
    shutil.copytree(PROJECT_ROOT / "node_modules" / "@prisma" / "client", prisma_dst, dirs_exist_ok=True)

    prisma_engine_dst = standalone_dir / "node_modules" / ".prisma" / "client"
    prisma_engine_dst.mkdir(parents=True, exist_ok=True)
    shutil.copytree(PROJECT_ROOT / "node_modules" / ".prisma" / "client", prisma_engine_dst, dirs_exist_ok=True)

    # 同时复制到 app 根目录 .prisma/client
    app_prisma = standalone_dir / ".prisma" / "client"
    app_prisma.mkdir(parents=True, exist_ok=True)
    engine_file = PROJECT_ROOT / "node_modules" / ".prisma" / "client" / "libquery_engine-debian-openssl-3.0.x.so.node"
    if engine_file.exists():
        shutil.copy2(engine_file, app_prisma)
    schema_file = PROJECT_ROOT / "node_modules" / ".prisma" / "client" / "schema.prisma"
    if schema_file.exists():
        shutil.copy2(schema_file, app_prisma)
    print("  Prisma Client + Linux Engine 已复制")

    # 复制 .next/static
    static_dst = standalone_dir / ".next" / "static"
    static_dst.mkdir(parents=True, exist_ok=True)
    shutil.copytree(PROJECT_ROOT / ".next" / "static", static_dst, dirs_exist_ok=True)

    # 复制 public
    if (PROJECT_ROOT / "public").exists():
        public_dst = standalone_dir / "public"
        if public_dst.exists():
            shutil.copytree(PROJECT_ROOT / "public", public_dst, dirs_exist_ok=True)
        else:
            shutil.copytree(PROJECT_ROOT / "public", public_dst)

    # 复制 prisma schema
    prisma_schema_dst = standalone_dir / "prisma"
    prisma_schema_dst.mkdir(parents=True, exist_ok=True)
    shutil.copy2(PROJECT_ROOT / "prisma" / "schema.prisma", prisma_schema_dst)

    # 复制预编译的 WS 网关
    scripts_dst = standalone_dir / "scripts"
    scripts_dst.mkdir(parents=True, exist_ok=True)
    shutil.copy2(PROJECT_ROOT / "scripts" / "ws-gateway.compiled.js", scripts_dst)
    shutil.copy2(PROJECT_ROOT / "scripts" / "start-ws-gateway.js", scripts_dst)
    print("  WS 网关预编译产物已复制")

    # 复制生产环境 .env
    env_prod = PROJECT_ROOT / ".env.production"
    if env_prod.exists():
        shutil.copy2(env_prod, standalone_dir / ".env")
        print("  生产环境 .env 已复制")
    else:
        raise RuntimeError(".env.production 不存在")

    # 复制 PM2 配置
    pm2_dst = pkg_dir / "pm2"
    pm2_dst.mkdir(parents=True, exist_ok=True)
    shutil.copy2(PROJECT_ROOT / "deploy" / "pm2" / "ecosystem.config.cjs", pm2_dst)

    # 复制 DEV_LOG.md（开发日志页面需要）
    dev_log = PROJECT_ROOT / "DEV_LOG.md"
    if dev_log.exists():
        shutil.copy2(dev_log, standalone_dir / "DEV_LOG.md")
        print("  DEV_LOG.md 已复制")

    # 复制 DEVELOPMENT_SPEC.md
    dev_spec = PROJECT_ROOT / "DEVELOPMENT_SPEC.md"
    if dev_spec.exists():
        shutil.copy2(dev_spec, standalone_dir / "DEVELOPMENT_SPEC.md")

    # 7. 打包
    print("\n[6/7] 打包 tar.gz...")
    archive_path = DIST_DIR / f"{PKG_NAME}.tar.gz"
    with tarfile.open(archive_path, "w:gz") as tar:
        tar.add(pkg_dir, arcname=PKG_NAME)
    size_mb = archive_path.stat().st_size / 1024 / 1024
    print(f"  打包完成: {archive_path} ({size_mb:.2f} MB)")

    # 8. 上传到服务器
    print("\n[7/7] 上传到服务器...")
    remote_path = f"/tmp/{PKG_NAME}.tar.gz"
    upload_file(str(archive_path), remote_path)
    print("  上传完成")

    print("\n" + "=" * 60)
    print("  本地构建+上传完成！")
    print("=" * 60)
    print(f"\n下一步在服务器执行：")
    print(f"  tar -xzf /tmp/{PKG_NAME}.tar.gz -C /tmp/")
    print(f"  rm -rf /opt/lynx/app_old && mv /opt/lynx/app /opt/lynx/app_old")
    print(f"  cp -a /tmp/{PKG_NAME}/standalone /opt/lynx/app")
    print(f"  cp /tmp/{PKG_NAME}/pm2/ecosystem.config.cjs /opt/lynx/")
    print(f"  pm2 delete all && pm2 start /opt/lynx/ecosystem.config.cjs")

if __name__ == "__main__":
    main()

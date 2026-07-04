# -*- coding: utf-8 -*-
"""
奇思桌面端 - 打包到本地测试目录
构建 .exe + 证书 + 信任工具 -> D:\\LynnHub\\packages\\<version>\\
用户下载测试，确认无误后再上传 Gitee Release

使用：python desktop-electron\\scripts\\build-to-local.py
"""
import json
import os
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path

PROJECT_ROOT = Path(r"d:\Lynn工作空间\LynnHub")
DESKTOP_DIR = PROJECT_ROOT / "desktop-electron"
PACKAGES_DIR = Path(r"D:\LynnHub\packages")

def run(cmd, cwd=None, check=True, **kwargs):
    """运行命令并实时输出"""
    print(f"$ {cmd}", flush=True)
    result = subprocess.run(cmd, cwd=cwd, shell=True, **kwargs)
    if check and result.returncode != 0:
        print(f"[ERROR] 命令失败 (exit={result.returncode})", flush=True)
        sys.exit(result.returncode)
    return result

def main():
    # 1. 读取版本号
    pkg = json.loads((DESKTOP_DIR / "package.json").read_text(encoding="utf-8"))
    version = pkg["version"]
    print(f"========== 奇思桌面端 v{version} 打包到本地 ==========")
    print(f"[1/5] 版本号: {version}")

    # 2. 准备输出目录
    out_dir = PACKAGES_DIR / version
    if out_dir.exists():
        shutil.rmtree(out_dir)
    out_dir.mkdir(parents=True)
    print(f"[2/5] 输出目录: {out_dir}")

    # 3. 构建
    print("[3/5] 开始构建 (npm run build:win)...")
    run("npm run build:win", cwd=str(DESKTOP_DIR))

    # 4. 查找生成的 .exe
    release_dir = DESKTOP_DIR / "release-v15"
    exe_name = f"QisiSetup-{version}.exe"
    exe_path = release_dir / exe_name
    if not exe_path.exists():
        print(f"[ERROR] 未找到安装包: {exe_path}")
        for f in release_dir.glob("*.exe"):
            print(f"  found: {f.name} ({f.stat().st_size/1024/1024:.2f} MB)")
        sys.exit(1)

    # 5. 复制文件
    print(f"[4/5] 复制文件到 {out_dir} ...")
    shutil.copy2(exe_path, out_dir / exe_name)
    exe_size_mb = round(exe_path.stat().st_size / 1024 / 1024, 2)
    print(f"  - {exe_name} ({exe_size_mb} MB)")

    # 证书公钥
    cer_path = DESKTOP_DIR / "build" / "lynn-code-sign.cer"
    if cer_path.exists():
        shutil.copy2(cer_path, out_dir / "lynn-code-sign.cer")
        print("  - lynn-code-sign.cer")

    # 信任证书脚本
    bat_path = DESKTOP_DIR / "build" / "信任奇思证书.bat"
    if bat_path.exists():
        shutil.copy2(bat_path, out_dir / "信任奇思证书.bat")
        print("  - 信任奇思证书.bat")

    # 6. 生成 README
    print("[5/5] 生成测试说明...")
    build_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    readme = f"""# 奇思桌面端 v{version} 测试包

## 文件清单
- QisiSetup-{version}.exe - 安装包（{exe_size_mb} MB）
- lynn-code-sign.cer - 代码签名证书（公钥）
- 信任奇思证书.bat - 一键信任证书脚本（无需管理员权限）

## 安装步骤

### 方式一：先信任证书（推荐，安装时不显示"未知发布者"）
1. 双击运行「信任奇思证书.bat」
2. 输入 Y 确认导入证书
3. 双击 QisiSetup-{version}.exe 安装

### 方式二：直接安装（会显示"未知发布者"警告）
1. 双击 QisiSetup-{version}.exe
2. 如出现 SmartScreen 警告，点击「更多信息」→「仍要运行」
3. 如出现"未知发布者"，点击「仍要运行」

## 测试要点
- [ ] TC1: 安装包可正常下载
- [ ] TC2: 信任证书后安装无"未知发布者"警告
- [ ] TC3: 安装界面正常（图标、侧边栏、License）
- [ ] TC4: 安装完成后任务栏图标正常
- [ ] TC5: 窗口可拖动
- [ ] TC6: 系统托盘图标正常
- [ ] TC7: HermesAgent 检查更新（配置模块）
- [ ] TC8: HermesAgent 一键安装（内置 .whl）
- [ ] TC9: WS 连接正常（设备上线）
- [ ] TC10: 飞书任务同步 Web 端
- [ ] TC11: Lynx 超级助理同步 Web 端

## 构建信息
- 构建时间: {build_time}
- 版本号: {version}
- 内置 HermesAgent: v0.18.0（离线可用）
- 证书: CN=LynnHub（有效期至 2029-06-30）

确认无误后，将上传到 Gitee Release 作为线上下载地址。
"""
    (out_dir / "README.md").write_text(readme, encoding="utf-8")
    print("  - README.md")

    # 完成
    print()
    print("========== 打包完成 ==========")
    print(f"输出目录: {out_dir}")
    print()
    for f in sorted(out_dir.iterdir()):
        size = f.stat().st_size
        if size > 1024 * 1024:
            print(f"  {f.name:<40} {size/1024/1024:.2f} MB")
        else:
            print(f"  {f.name:<40} {size/1024:.1f} KB")
    print()
    print("测试流程：")
    print(f"  1. 从 {out_dir} 下载所有文件")
    print("  2. 先运行「信任奇思证书.bat」")
    print(f"  3. 再安装 QisiSetup-{version}.exe")
    print("  4. 确认无误后通知上传 Gitee Release")

if __name__ == "__main__":
    main()

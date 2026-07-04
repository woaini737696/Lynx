# -*- coding: utf-8 -*-
"""
准备 desktop-electron/build/ 目录的所有资源：
1. 从 public/lynx-icon-512.png 生成 icon.ico
2. 从 public/lynx-icon-512.png 生成 installer-header.bmp（带 Logo + 奇思 + AI工作台）
3. 从 public/lynx-icon-512.png 生成 installer-sidebar.bmp（带 Logo + 奇思 + Slogan）
4. 复制 lynn-code-sign.cer（如果存在）
5. 复制 信任奇思证书.bat（如果存在）

用法：python desktop-electron/scripts/prepare-build-resources.py
"""
import os
import shutil
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

PROJECT_ROOT = Path(r"d:\Lynn工作空间\LynnHub")
DESKTOP_ELECTRON_DIR = PROJECT_ROOT / "desktop-electron"
BUILD_DIR = DESKTOP_ELECTRON_DIR / "build"
SOURCE_ICON = PROJECT_ROOT / "public" / "lynx-icon-512.png"

# 奇思品牌色
DEEP_SPACE_BLUE = (3, 8, 22)        # #030816 深空蓝
BRAND_BLUE = (43, 127, 255)         # #2B7FFF 品牌蓝
WHITE = (255, 255, 255)
LIGHT_GRAY = (160, 180, 208)        # #A0B4D0


def find_font(size, bold=False):
    candidates = [
        "C:/Windows/Fonts/msyhbd.ttc" if bold else "C:/Windows/Fonts/msyh.ttc",
        "C:/Windows/Fonts/msyh.ttc",
        "C:/Windows/Fonts/simhei.ttf",
        "C:/Windows/Fonts/Deng.ttf",
    ]
    for p in candidates:
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def make_icon_ico():
    """生成 icon.ico（多尺寸 Windows 图标）"""
    src = Image.open(SOURCE_ICON).convert("RGBA")
    sizes = [256, 128, 64, 48, 32, 16]
    frames = [src.resize((s, s), Image.LANCZOS) for s in sizes]
    out = BUILD_DIR / "icon.ico"
    frames[0].save(
        str(out), format="ICO",
        append_images=frames[1:],
        sizes=[(s, s) for s in sizes],
    )
    print(f"  [OK] icon.ico (sizes: {sizes})")


def make_installer_header_bmp():
    """
    生成 installer-header.bmp（150x57，安装页顶部右侧小图）
    深空蓝背景 + 奇思 logo + "奇思" + "AI工作台"
    """
    W, H = 150, 57
    img = Image.new("RGBA", (W, H), DEEP_SPACE_BLUE)
    draw = ImageDraw.Draw(img)

    # 左侧 logo（40x40）
    logo = Image.open(SOURCE_ICON).convert("RGBA")
    logo_small = logo.resize((40, 40), Image.LANCZOS)
    img.paste(logo_small, (8, 8), logo_small)

    # 右侧 "奇思"
    font = find_font(24, bold=True)
    draw.text((56, 14), "奇思", fill=WHITE, font=font)

    # 底部小字
    font_small = find_font(9)
    draw.text((56, 40), "AI工作台", fill=LIGHT_GRAY, font=font_small)

    # 转 24bit BMP（NSIS 不支持 alpha）
    bmp = Image.new("RGB", (W, H), DEEP_SPACE_BLUE)
    bmp.paste(img, (0, 0), img)
    out = BUILD_DIR / "installer-header.bmp"
    bmp.save(str(out), "BMP")
    print(f"  [OK] installer-header.bmp (150x57)")


def make_installer_sidebar_bmp():
    """
    生成 installer-sidebar.bmp（164x314，欢迎/完成页侧边大图）
    深空蓝渐变 + logo + "奇思" + Slogan
    """
    W, H = 164, 314
    img = Image.new("RGBA", (W, H), DEEP_SPACE_BLUE)
    draw = ImageDraw.Draw(img)

    # 垂直渐变
    for y in range(H):
        ratio = y / H
        r = int(DEEP_SPACE_BLUE[0] + (10 - DEEP_SPACE_BLUE[0]) * ratio)
        g = int(DEEP_SPACE_BLUE[1] + (25 - DEEP_SPACE_BLUE[1]) * ratio)
        b = int(DEEP_SPACE_BLUE[2] + (50 - DEEP_SPACE_BLUE[2]) * ratio)
        draw.line([(0, y), (W, y)], fill=(r, g, b))

    # 顶部 logo（72x72 居中）
    logo = Image.open(SOURCE_ICON).convert("RGBA")
    logo_large = logo.resize((72, 72), Image.LANCZOS)
    logo_x = (W - 72) // 2
    img.paste(logo_large, (logo_x, 30), logo_large)

    # 品牌名 "奇思"
    font_brand = find_font(32, bold=True)
    text = "奇思"
    bbox = draw.textbbox((0, 0), text, font=font_brand)
    tw = bbox[2] - bbox[0]
    draw.text(((W - tw) // 2, 115), text, fill=WHITE, font=font_brand)

    # Slogan
    font_slogan = find_font(14, bold=True)
    lines = ["奇思 AI工作台", "用Lynx AI", "人人都是超级个体"]
    for i, line in enumerate(lines):
        bbox = draw.textbbox((0, 0), line, font=font_slogan)
        tw = bbox[2] - bbox[0]
        y = 165 + i * 24
        color = WHITE if i == 0 else BRAND_BLUE
        draw.text(((W - tw) // 2, y), line, fill=color, font=font_slogan)

    # 底部装饰线 + 版权
    draw.line([(30, 270), (W - 30, 270)], fill=(43, 127, 255, 100), width=1)
    font_org = find_font(8)
    org_text = "© 2026 Lynn"
    bbox = draw.textbbox((0, 0), org_text, font=font_org)
    tw = bbox[2] - bbox[0]
    draw.text(((W - tw) // 2, 280), org_text, fill=LIGHT_GRAY, font=font_org)

    # 转 24bit BMP
    bmp = Image.new("RGB", (W, H), DEEP_SPACE_BLUE)
    bmp.paste(img, (0, 0), img)
    out = BUILD_DIR / "installer-sidebar.bmp"
    bmp.save(str(out), "BMP")
    print(f"  [OK] installer-sidebar.bmp (164x314)")


def copy_existing_files():
    """复制已存在的证书和 bat 文件"""
    # lynn-code-sign.cer
    cer_src = DESKTOP_ELECTRON_DIR / "build" / "lynn-code-sign.cer"
    # 可能在 desktop-native/src-tauri/lynn-code-sign.cer
    if not cer_src.exists():
        alt = PROJECT_ROOT / "desktop-native" / "src-tauri" / "lynn-code-sign.cer"
        if alt.exists():
            shutil.copy2(str(alt), str(cer_src))
            print(f"  [OK] lynn-code-sign.cer (from desktop-native)")

    # 信任奇思证书.bat - 检查 packages/1.0.13/
    bat_src = PROJECT_ROOT / "packages" / "1.0.13" / "信任奇思证书.bat"
    bat_dst = BUILD_DIR / "信任奇思证书.bat"
    if bat_src.exists() and not bat_dst.exists():
        shutil.copy2(str(bat_src), str(bat_dst))
        print(f"  [OK] 信任奇思证书.bat (from packages/1.0.13)")


def main():
    print("=" * 60)
    print("准备 desktop-electron/build/ 资源")
    print("=" * 60)

    if not SOURCE_ICON.exists():
        print(f"[ERROR] 源图标不存在: {SOURCE_ICON}")
        return False

    BUILD_DIR.mkdir(parents=True, exist_ok=True)
    print(f"输出目录: {BUILD_DIR}")
    print()

    print("[1/4] 生成 icon.ico...")
    make_icon_ico()

    print("[2/4] 生成 installer-header.bmp...")
    make_installer_header_bmp()

    print("[3/4] 生成 installer-sidebar.bmp...")
    make_installer_sidebar_bmp()

    print("[4/4] 复制已存在文件...")
    copy_existing_files()

    print()
    print("=" * 60)
    print("完成！build/ 目录内容：")
    print("=" * 60)
    for f in sorted(BUILD_DIR.iterdir()):
        size = f.stat().st_size
        if size > 1024 * 1024:
            print(f"  {f.name:<40} {size/1024/1024:.2f} MB")
        else:
            print(f"  {f.name:<40} {size/1024:.1f} KB")
    return True


if __name__ == "__main__":
    ok = main()
    exit(0 if ok else 1)

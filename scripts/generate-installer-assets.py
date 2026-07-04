#!/usr/bin/env python3
"""
Lynx 安装包图标资源生成器
用 Web 端 logo（黑底白猞猁）统一生成桌面端所有图标资源
包含：icon.ico / icon.png / nsis-header.bmp / nsis-sidebar.bmp
"""
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ICONS_DIR = os.path.join(ROOT, "desktop-native", "src-tauri", "icons")
SOURCE_LOGO = os.path.join(ROOT, "public", "lynx-logo-black.png")  # Web 端黑底白猞猁
SOURCE_ICON = os.path.join(ROOT, "public", "lynx-icon-512.png")    # 512 大图源

# Lynx 品牌色
DEEP_SPACE_BLUE = (3, 8, 22)       # #030816 深空蓝
BRAND_BLUE = (43, 127, 255)        # #2B7FFF 品牌蓝
WHITE = (255, 255, 255)
LIGHT_GRAY = (160, 180, 208)       # #A0B4D0
ACCENT_GREEN = (0, 212, 170)       # #00D4AA

os.makedirs(ICONS_DIR, exist_ok=True)


def find_font(size, bold=False):
    """查找系统中可用的中文字体"""
    candidates = [
        ("C:/Windows/Fonts/msyhbd.ttc" if bold else "C:/Windows/Fonts/msyh.ttc"),
        "C:/Windows/Fonts/msyh.ttc",
        "C:/Windows/Fonts/simhei.ttf",
        "C:/Windows/Fonts/Deng.ttf",
    ]
    for p in candidates:
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def make_icon_png():
    """生成 icon.png（512x512，用于 Linux/macOS）"""
    src = Image.open(SOURCE_ICON).convert("RGBA")
    src.save(os.path.join(ICONS_DIR, "icon.png"), "PNG")
    print("✓ icon.png (512x512)")


def make_icon_ico():
    """
    生成 icon.ico（多尺寸 Windows 图标，每个尺寸直接从 512 源 LANCZOS 一次重采样）
    避免双步重采样（512→256→16）导致的小尺寸图标模糊
    """
    src = Image.open(SOURCE_ICON).convert("RGBA")
    sizes = [256, 128, 64, 48, 32, 16]
    # 每个尺寸直接从 512 源重采样，保留最多高频细节
    frames = [src.resize((s, s), Image.LANCZOS) for s in sizes]
    # 主帧为最大尺寸（256），其余通过 append_images 一并写入 ICO
    frames[0].save(
        os.path.join(ICONS_DIR, "icon.ico"),
        format="ICO",
        append_images=frames[1:],
        sizes=[(s, s) for s in sizes],
    )
    print(f"✓ icon.ico (sizes: {sizes}, direct LANCZOS from 512 source)")


def make_nsis_header():
    """
    生成 nsis-header.bmp（150x57，安装向导顶部右侧小图）
    深空蓝背景 + Lynx logo + 品牌名
    """
    W, H = 150, 57
    img = Image.new("RGBA", (W, H), DEEP_SPACE_BLUE)
    draw = ImageDraw.Draw(img)

    # 左侧放 logo（缩放到 40x40）
    logo = Image.open(SOURCE_ICON).convert("RGBA")
    logo_small = logo.resize((40, 40), Image.LANCZOS)
    img.paste(logo_small, (8, 8), logo_small)

    # 右侧写 "奇思"（产品名）
    font = find_font(24, bold=True)
    draw.text((56, 14), "奇思", fill=WHITE, font=font)

    # 底部小字
    font_small = find_font(9)
    draw.text((56, 40), "AI工作台", fill=LIGHT_GRAY, font=font_small)

    # 转 BMP（24bit，NSIS 不支持 alpha）
    bmp = Image.new("RGB", (W, H), DEEP_SPACE_BLUE)
    bmp.paste(img, (0, 0), img)
    bmp.save(os.path.join(ICONS_DIR, "nsis-header.bmp"), "BMP")
    print("✓ nsis-header.bmp (150x57)")


def make_nsis_sidebar():
    """
    生成 nsis-sidebar.bmp（162x314，安装向导左侧大图）
    深空蓝渐变背景 + logo + 品牌名 + 宣传文案
    """
    W, H = 162, 314
    img = Image.new("RGBA", (W, H), DEEP_SPACE_BLUE)
    draw = ImageDraw.Draw(img)

    # 垂直渐变背景（深空蓝 → 稍亮的蓝）
    for y in range(H):
        ratio = y / H
        r = int(DEEP_SPACE_BLUE[0] + (10 - DEEP_SPACE_BLUE[0]) * ratio)
        g = int(DEEP_SPACE_BLUE[1] + (25 - DEEP_SPACE_BLUE[1]) * ratio)
        b = int(DEEP_SPACE_BLUE[2] + (50 - DEEP_SPACE_BLUE[2]) * ratio)
        draw.line([(0, y), (W, y)], fill=(r, g, b))

    # 顶部 logo（居中，72x72）
    logo = Image.open(SOURCE_ICON).convert("RGBA")
    logo_large = logo.resize((72, 72), Image.LANCZOS)
    logo_x = (W - 72) // 2
    img.paste(logo_large, (logo_x, 30), logo_large)

    # 品牌名 "奇思"（产品名）
    font_brand = find_font(32, bold=True)
    text = "奇思"
    bbox = draw.textbbox((0, 0), text, font=font_brand)
    tw = bbox[2] - bbox[0]
    draw.text(((W - tw) // 2, 115), text, fill=WHITE, font=font_brand)

    # 宣传文案（自动换行）
    font_slogan = find_font(14, bold=True)
    slogan_line1 = "奇思 AI工作台"
    slogan_line2 = "用Lynx AI"
    slogan_line3 = "人人都是超级个体"

    for i, line in enumerate([slogan_line1, slogan_line2, slogan_line3]):
        bbox = draw.textbbox((0, 0), line, font=font_slogan)
        tw = bbox[2] - bbox[0]
        y = 165 + i * 24
        color = WHITE if i == 0 else BRAND_BLUE
        draw.text(((W - tw) // 2, y), line, fill=color, font=font_slogan)

    # 底部装饰线 + 版本信息
    draw.line([(30, 270), (W - 30, 270)], fill=(43, 127, 255, 100), width=1)
    font_ver = find_font(9)
    ver_text = "v1.0.32"
    bbox = draw.textbbox((0, 0), ver_text, font=font_ver)
    tw = bbox[2] - bbox[0]
    draw.text(((W - tw) // 2, 280), ver_text, fill=LIGHT_GRAY, font=font_ver)

    font_org = find_font(8)
    org_text = "© 2026 Lynn"
    bbox = draw.textbbox((0, 0), org_text, font=font_org)
    tw = bbox[2] - bbox[0]
    draw.text(((W - tw) // 2, 295), org_text, fill=LIGHT_GRAY, font=font_org)

    # 转 BMP
    bmp = Image.new("RGB", (W, H), DEEP_SPACE_BLUE)
    bmp.paste(img, (0, 0), img)
    bmp.save(os.path.join(ICONS_DIR, "nsis-sidebar.bmp"), "BMP")
    print("✓ nsis-sidebar.bmp (162x314)")


def make_square_logos():
    """生成 Windows Store 所需的方形 logo"""
    src = Image.open(SOURCE_ICON).convert("RGBA")
    for size in [30, 44, 71, 89, 107, 142, 150, 284, 310]:
        name = f"Square{size}x{size}Logo.png"
        resized = src.resize((size, size), Image.LANCZOS)
        resized.save(os.path.join(ICONS_DIR, name), "PNG")
    # StoreLogo
    src.resize((50, 50), Image.LANCZOS).save(
        os.path.join(ICONS_DIR, "StoreLogo.png"), "PNG"
    )
    print("✓ Square logos + StoreLogo")


def make_tray_icon():
    """
    生成系统托盘专用高清图标（64x64 PNG）
    - 从 512 源 LANCZOS 一次性重采样，避免多步缩放模糊
    - 64x64 覆盖 Windows 200% DPI（32x32 物理像素），系统自动缩放到其他 DPI
    - Rust 端用 tauri::include_image!("icons/tray-icon.png") 加载
    """
    src = Image.open(SOURCE_ICON).convert("RGBA")
    tray = src.resize((64, 64), Image.LANCZOS)
    tray.save(os.path.join(ICONS_DIR, "tray-icon.png"), "PNG")
    print("✓ tray-icon.png (64x64, dedicated for system tray)")


def make_std_sizes():
    """生成标准尺寸 PNG"""
    src = Image.open(SOURCE_ICON).convert("RGBA")
    for size in [32, 64, 128, 256, 512]:
        name = f"{size}x{size}.png" if size != 256 else "512x512.png"
        if size == 256:
            src.resize((256, 256), Image.LANCZOS).save(
                os.path.join(ICONS_DIR, "128x128@2x.png"), "PNG"
            )
        else:
            src.resize((size, size), Image.LANCZOS).save(
                os.path.join(ICONS_DIR, name), "PNG"
            )
    print("✓ Standard PNG sizes")


if __name__ == "__main__":
    print("==> 生成 Lynx 安装包图标资源（同步 Web 端 logo）...")
    make_icon_png()
    make_icon_ico()
    make_nsis_header()
    make_nsis_sidebar()
    make_square_logos()
    make_tray_icon()
    make_std_sizes()
    print(f"\n==> 所有资源已生成到: {ICONS_DIR}")

"""
生成 desktop-native 安装包资源：
- desktop-native/assets/installer-logo.bmp  供 NSIS 安装界面使用
- desktop-native/src-tauri/icons/icon.png   高清黑底白色猞猁 logo
"""
from PIL import Image
import os

ROOT = r"d:\Lynn工作空间\LynnHub"
SRC = os.path.join(ROOT, "lynx-logos", "lynx-logo-256.png")
ASSETS_DIR = os.path.join(ROOT, "desktop-native", "assets")
ICON_DIR = os.path.join(ROOT, "desktop-native", "src-tauri", "icons")

os.makedirs(ASSETS_DIR, exist_ok=True)
os.makedirs(ICON_DIR, exist_ok=True)


def make_black_bg_logo(size: int, radius_ratio: float = 0.22) -> Image.Image:
    """生成黑底白色猞猁 Logo（圆角方形）。"""
    bg = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    from PIL import ImageDraw
    draw = ImageDraw.Draw(bg)
    radius = int(size * radius_ratio)
    draw.rounded_rectangle([(0, 0), (size - 1, size - 1)], radius=radius, fill=(3, 8, 22, 255))
    src = Image.open(SRC).convert("RGBA")
    inset = int(size * 0.12)
    logo_size = size - inset * 2
    logo = src.resize((logo_size, logo_size), Image.LANCZOS)
    bg.paste(logo, (inset, inset), logo)
    return bg


def main():
    # 1. 安装界面 BMP（白色背景，128x128）
    size = 128
    src = Image.open(SRC).convert("RGBA")
    inset = int(size * 0.12)
    logo_size = size - inset * 2
    logo = src.resize((logo_size, logo_size), Image.LANCZOS)
    bg = Image.new("RGBA", (size, size), (255, 255, 255, 255))
    bg.paste(logo, (inset, inset), logo)
    bmp_path = os.path.join(ASSETS_DIR, "installer-logo.bmp")
    bg.convert("RGB").save(bmp_path, format="BMP")
    print(f"生成: {bmp_path}")

    # 2. desktop-native 高清图标
    icon_png = make_black_bg_logo(512)
    icon_png.save(os.path.join(ICON_DIR, "icon.png"))
    print(f"更新: {os.path.join(ICON_DIR, 'icon.png')}")

    print("\n✅ desktop-native 安装资源生成完成")


if __name__ == "__main__":
    main()

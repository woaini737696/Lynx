"""
生成 NSIS 安装包品牌图（sidebar 164x314 + header 150x57）
使用 Web端 lynx-icon-512.png 作为 logo 叠加到深空蓝背景
"""
from PIL import Image, ImageDraw, ImageFilter
import os

WEB_PUBLIC = r"d:\Lynn工作空间\LynnHub\public"
ICONS_DIR = r"d:\Lynn工作空间\LynnHub\desktop-native\src-tauri\icons"

# 深空蓝背景色（与 logo 底色一致）
BG_COLOR = (3, 8, 22)  # #030816


def make_gradient_bg(w, h, top=(10, 20, 50), bottom=BG_COLOR):
    """生成竖向渐变背景"""
    bg = Image.new("RGB", (w, h), BG_COLOR)
    draw = ImageDraw.Draw(bg)
    for y in range(h):
        ratio = y / max(h - 1, 1)
        r = int(top[0] + (bottom[0] - top[0]) * ratio)
        g = int(top[1] + (bottom[1] - top[1]) * ratio)
        b = int(top[2] + (bottom[2] - top[2]) * ratio)
        draw.line([(0, y), (w, y)], fill=(r, g, b))
    return bg


def add_stars(img, count=80):
    """在背景上添加星空点缀"""
    import random
    random.seed(42)
    draw = ImageDraw.Draw(img, "RGBA")
    w, h = img.size
    for _ in range(count):
        x = random.randint(0, w - 1)
        y = random.randint(0, h - 1)
        size = random.choice([1, 1, 1, 2, 2, 3])
        alpha = random.randint(80, 200)
        draw.ellipse([x, y, x + size, y + size], fill=(255, 255, 255, alpha))
    return img


def make_sidebar_bmp():
    """NSIS sidebar: 164x314, 24bit BMP"""
    w, h = 164, 314
    # 渐变深空蓝背景
    bg = make_gradient_bg(w, h, top=(15, 30, 70), bottom=BG_COLOR)
    # 星空
    bg = add_stars(bg, count=60)
    bg = bg.convert("RGBA")

    # 叠加 logo（居中靠上）
    logo = Image.open(os.path.join(WEB_PUBLIC, "lynx-icon-512.png")).convert("RGBA")
    logo_size = 96
    logo = logo.resize((logo_size, logo_size), Image.LANCZOS)
    # 给 logo 加柔和光晕
    glow = Image.new("RGBA", (logo_size + 40, logo_size + 40), (0, 0, 0, 0))
    glow.paste(logo, (20, 20), logo)
    glow = glow.filter(ImageFilter.GaussianBlur(radius=8))
    bg.paste(glow, ((w - glow.width) // 2, 40), glow)
    bg.paste(logo, ((w - logo_size) // 2, 50), logo)

    # 标题文字
    draw = ImageDraw.Draw(bg, "RGBA")
    # 使用默认字体绘制 "奇思"
    try:
        font_large = ImageFont.truetype("arial.ttf", 24)
        font_small = ImageFont.truetype("arial.ttf", 11)
    except Exception:
        font_large = ImageFont.load_default()
        font_small = ImageFont.load_default()
    # 奇思 标题
    text = "奇思"
    bbox = draw.textbbox((0, 0), text, font=font_large)
    tw = bbox[2] - bbox[0]
    draw.text(((w - tw) // 2, 165), text, fill=(255, 255, 255, 255), font=font_large)
    # 副标题
    sub = "AI工作台"
    bbox2 = draw.textbbox((0, 0), sub, font=font_small)
    sw = bbox2[2] - bbox2[0]
    draw.text(((w - sw) // 2, 198), sub, fill=(180, 200, 230, 220), font=font_small)

    # 保存为 24bit BMP
    bg.convert("RGB").save(os.path.join(ICONS_DIR, "nsis-sidebar.bmp"), "BMP")
    print("Generated nsis-sidebar.bmp (164x314)")


def make_header_bmp():
    """NSIS header: 150x57, 24bit BMP"""
    w, h = 150, 57
    bg = make_gradient_bg(w, h, top=(15, 30, 70), bottom=BG_COLOR)
    bg = bg.convert("RGBA")

    # 左侧小 logo
    logo = Image.open(os.path.join(WEB_PUBLIC, "lynx-icon-512.png")).convert("RGBA")
    logo_size = 40
    logo = logo.resize((logo_size, logo_size), Image.LANCZOS)
    bg.paste(logo, (8, (h - logo_size) // 2), logo)

    # 文字
    draw = ImageDraw.Draw(bg, "RGBA")
    try:
        font = ImageFont.truetype("arial.ttf", 16)
        font_sm = ImageFont.truetype("arial.ttf", 10)
    except Exception:
        font = ImageFont.load_default()
        font_sm = ImageFont.load_default()
    draw.text((55, 12), "奇思", fill=(255, 255, 255, 255), font=font)
    draw.text((55, 33), "AI工作台", fill=(180, 200, 230, 220), font=font_sm)

    bg.convert("RGB").save(os.path.join(ICONS_DIR, "nsis-header.bmp"), "BMP")
    print("Generated nsis-header.bmp (150x57)")


if __name__ == "__main__":
    from PIL import ImageFont
    make_sidebar_bmp()
    make_header_bmp()
    print("All brand images generated successfully")

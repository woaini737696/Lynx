"""
Generate desktop-native installer assets:
- desktop-native/assets/installer-bg.bmp   NSIS custom page background (deep-sea glass)
- desktop-native/src-tauri/icons/icon.png  HD lynx icon
"""
from PIL import Image, ImageDraw, ImageFont
import os

ROOT = r"d:\Lynn工作空间\LynnHub"
SRC = os.path.join(ROOT, "lynx-logos", "lynx-logo-256.png")
ASSETS_DIR = os.path.join(ROOT, "desktop-native", "assets")
ICON_DIR = os.path.join(ROOT, "desktop-native", "src-tauri", "icons")

os.makedirs(ASSETS_DIR, exist_ok=True)
os.makedirs(ICON_DIR, exist_ok=True)

# Deep-sea palette
DEEP_TOP = (12, 26, 45)
DEEP_MID = (9, 20, 37)
DEEP_BOT = (6, 13, 24)
GLASS_FILL = (255, 255, 255, 15)        # ~6% white overlaid
GLASS_BORDER = (255, 255, 255, 36)      # ~14% white border
GLOW_BLUE = (59, 130, 246, 40)
TEXT_PRIMARY = (234, 239, 245)
TEXT_SECONDARY = (160, 170, 185)
TEXT_MUTED = (130, 142, 158)


def lerp(a, b, t):
    return int(a + (b - a) * t)


def lerp_color(c1, c2, t):
    return tuple(lerp(c1[i], c2[i], t) for i in range(len(c1)))


def find_font(preferred_names):
    font_root = os.path.join(os.environ.get("SystemRoot", r"C:\Windows"), "Fonts")
    for name in preferred_names:
        path = os.path.join(font_root, name)
        if os.path.exists(path):
            return path
    return None


def make_black_bg_logo(size: int, radius_ratio: float = 0.22) -> Image.Image:
    """HD lynx icon with a dark rounded-square background."""
    bg = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(bg)
    radius = int(size * radius_ratio)
    draw.rounded_rectangle([(0, 0), (size - 1, size - 1)], radius=radius, fill=(3, 8, 22, 255))
    src = Image.open(SRC).convert("RGBA")
    inset = int(size * 0.12)
    logo_size = size - inset * 2
    logo = src.resize((logo_size, logo_size), Image.LANCZOS)
    bg.paste(logo, (inset, inset), logo)
    return bg


def draw_gradient_bg(draw, width, height):
    for y in range(height):
        t = y / height
        if t < 0.5:
            color = lerp_color(DEEP_TOP, DEEP_MID, t / 0.5)
        else:
            color = lerp_color(DEEP_MID, DEEP_BOT, (t - 0.5) / 0.5)
        draw.line([(0, y), (width, y)], fill=color)


def add_glows(base):
    overlay = Image.new("RGBA", base.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    w, h = base.size
    # Top-left soft blue glow
    for r in range(180, 0, -2):
        alpha = int(30 * (r / 180) ** 2)
        draw.ellipse([(-60, -60), (r, r)], fill=(59, 130, 246, alpha))
    # Bottom-right soft blue glow
    for r in range(220, 0, -2):
        alpha = int(22 * (r / 220) ** 2)
        draw.ellipse([w - r, h - r, w + 60, h + 60], fill=(29, 78, 216, alpha))
    return Image.alpha_composite(base, overlay)


def draw_glass_panel(base):
    overlay = Image.new("RGBA", base.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    x, y, w, h, r = 40, 55, 440, 340, 24
    # Frosted fill
    draw.rounded_rectangle([(x, y), (x + w, y + h)], radius=r, fill=GLASS_FILL)
    # Thin border
    draw.rounded_rectangle([(x, y), (x + w, y + h)], radius=r, outline=GLASS_BORDER, width=1)
    # Top inner glow (simulate reflection)
    for i in range(18):
        alpha = int(20 * (1 - i / 18))
        yy = y + 1 + i
        draw.rounded_rectangle(
            [(x + 1, yy), (x + w - 1, yy + 1)],
            radius=max(r - 1, 0),
            fill=(255, 255, 255, alpha),
        )
    return Image.alpha_composite(base, overlay)


def draw_text_layer(base, fonts):
    draw = ImageDraw.Draw(base)
    w, h = base.size

    # Logo is drawn separately by NSIS; keep background clean behind it.
    # Product title
    title_font = fonts.get("title")
    if title_font:
        bbox = draw.textbbox((0, 0), "Lynx", font=title_font)
        tw = bbox[2] - bbox[0]
        draw.text(((w - tw) // 2, 192), "Lynx", font=title_font, fill=TEXT_PRIMARY)

    # Path label
    label_font = fonts.get("label")
    if label_font:
        draw.text((80, 242), "安装路径", font=label_font, fill=TEXT_SECONDARY)

    # Agreement note
    note_font = fonts.get("note")
    if note_font:
        text = "点击“立即安装”即表示同意软件许可协议"
        bbox = draw.textbbox((0, 0), text, font=note_font)
        tw = bbox[2] - bbox[0]
        draw.text(((w - tw) // 2, 366), text, font=note_font, fill=TEXT_MUTED)

    return base


def build_background() -> Image.Image:
    width, height = 520, 420
    base = Image.new("RGBA", (width, height), DEEP_TOP)
    draw = ImageDraw.Draw(base)
    draw_gradient_bg(draw, width, height)
    base = add_glows(base)
    base = draw_glass_panel(base)
    return base


def load_fonts():
    regular_path = find_font(["msyh.ttc", "msyh.ttf", "Microsoft YaHei.ttf"])
    bold_path = find_font(["msyhbd.ttc", "msyhbd.ttf", "Microsoft YaHei Bold.ttf"])
    fonts = {}
    try:
        if bold_path:
            fonts["title"] = ImageFont.truetype(bold_path, 28)
        if regular_path:
            fonts["label"] = ImageFont.truetype(regular_path, 12)
            fonts["note"] = ImageFont.truetype(regular_path, 10)
    except Exception as e:
        print(f"Font load warning: {e}")
    return fonts


def main():
    fonts = load_fonts()

    # 1. Installer custom page background
    bg = build_background()
    bg = draw_text_layer(bg, fonts)
    bg_path = os.path.join(ASSETS_DIR, "installer-bg.bmp")
    bg.convert("RGB").save(bg_path, format="BMP")
    print(f"Generated: {bg_path}")

    # 2. Installer logo (dark rounded square, overlays the glass panel)
    logo_bmp = make_black_bg_logo(128)
    logo_bmp_path = os.path.join(ASSETS_DIR, "installer-logo.bmp")
    logo_bmp.convert("RGB").save(logo_bmp_path, format="BMP")
    print(f"Generated: {logo_bmp_path}")

    # 3. HD desktop icon
    icon_png = make_black_bg_logo(512)
    icon_path = os.path.join(ICON_DIR, "icon.png")
    icon_png.save(icon_path)
    print(f"Updated: {icon_path}")

    print("\ndesktop-native installer assets generated.")


if __name__ == "__main__":
    main()

"""
Generate desktop-native installer assets:
- desktop-native/assets/installer-bg.bmp      NSIS custom page background (deep-sea glass)
- desktop-native/assets/installer-welcome.bmp MUI welcome/finish side bitmap (164x314)
- desktop-native/assets/installer-header.bmp  MUI header bitmap (150x57)
- desktop-native/src-tauri/icons/icon.png     HD lynx icon
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
GLASS_FILL_INPUT = (255, 255, 255, 10)  # ~4% white for input
GLASS_BORDER = (255, 255, 255, 36)      # ~14% white border
GLOW_BLUE = (59, 130, 246, 40)
TEXT_PRIMARY = (234, 239, 245)
TEXT_SECONDARY = (160, 170, 185)
TEXT_MUTED = (130, 142, 158)
BUTTON_TOP = (59, 130, 246)
BUTTON_BOT = (29, 78, 216)


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


def load_font(size, bold=False):
    names = ["msyhbd.ttc", "msyhbd.ttf", "msyh.ttc", "msyh.ttf", "simhei.ttf", "simsun.ttc", "simsunb.ttc", "arialbd.ttf"]
    if not bold:
        names = ["msyh.ttc", "msyh.ttf", "msyhbd.ttc", "msyhbd.ttf", "simhei.ttf", "simsun.ttc", "simsunb.ttc", "arial.ttf"]
    path = find_font(names)
    if path:
        try:
            return ImageFont.truetype(path, size)
        except Exception as e:
            print(f"Font load warning ({path}): {e}")
    print(f"Warning: falling back to default font for size={size} bold={bold}")
    return ImageFont.load_default()


def draw_text_centered(draw, text, y, font, fill, width):
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    x = (width - tw) // 2
    draw.text((x, y), text, font=font, fill=fill)


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


def build_background() -> Image.Image:
    """Full iOS liquid-glass installer background with all static visual elements."""
    width, height = 520, 420
    base = Image.new("RGBA", (width, height), DEEP_TOP)
    draw = ImageDraw.Draw(base)
    draw_gradient_bg(draw, width, height)
    base = add_glows(base)
    base = draw_glass_panel(base)

    # Recreate draw after composites
    draw = ImageDraw.Draw(base)

    # Logo (centered inside glass panel)
    logo_size = 96
    logo = make_black_bg_logo(logo_size)
    logo_x = (width - logo_size) // 2
    logo_y = 75
    base.paste(logo, (logo_x, logo_y), logo)

    # Fonts
    title_font = load_font(36, bold=True)
    subtitle_font = load_font(15)
    body_font = load_font(14)
    small_font = load_font(12)

    # Title
    draw_text_centered(draw, "Lynx", 180, title_font, TEXT_PRIMARY, width)
    # Subtitle
    draw_text_centered(draw, "AI 原生桌面端", 217, subtitle_font, TEXT_SECONDARY, width)
    # Path label
    draw.text((80, 242), "安装路径", font=small_font, fill=TEXT_MUTED)

    # Input box background (glass)
    overlay = Image.new("RGBA", base.size, (0, 0, 0, 0))
    ov_draw = ImageDraw.Draw(overlay)
    ov_draw.rounded_rectangle([(80, 260), (440, 294)], radius=8, fill=GLASS_FILL_INPUT)
    ov_draw.rounded_rectangle([(80, 260), (440, 294)], radius=8, outline=GLASS_BORDER, width=1)
    base = Image.alpha_composite(base, overlay)

    # Install button background (blue gradient, 14px radius)
    overlay = Image.new("RGBA", base.size, (0, 0, 0, 0))
    ov_draw = ImageDraw.Draw(overlay)
    btn_x, btn_y, btn_w, btn_h, btn_r = 80, 330, 360, 44, 14
    # Gradient fill clipped to rounded rect
    mask = Image.new("L", (btn_w, btn_h), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.rounded_rectangle([(0, 0), (btn_w - 1, btn_h - 1)], radius=btn_r, fill=255)
    btn_img = Image.new("RGBA", (btn_w, btn_h))
    btn_draw = ImageDraw.Draw(btn_img)
    for y in range(btn_h):
        t = y / btn_h
        color = lerp_color(BUTTON_TOP, BUTTON_BOT, t)
        btn_draw.line([(0, y), (btn_w, y)], fill=color)
    btn_img.putalpha(mask)
    overlay.paste(btn_img, (btn_x, btn_y), btn_img)
    # Subtle border
    ov_draw.rounded_rectangle([(btn_x, btn_y), (btn_x + btn_w, btn_y + btn_h)], radius=btn_r, outline=(255, 255, 255, 50), width=1)
    # Button text is rendered by NSIS so it can change per-state (e.g. 立即体验)
    base = Image.alpha_composite(base, overlay)

    # Progress track (hidden behind NSIS progress bar)
    overlay = Image.new("RGBA", base.size, (0, 0, 0, 0))
    ov_draw = ImageDraw.Draw(overlay)
    ov_draw.rounded_rectangle([(80, 346), (440, 356)], radius=5, fill=(255, 255, 255, 18))
    ov_draw.rounded_rectangle([(80, 346), (440, 356)], radius=5, outline=(255, 255, 255, 30), width=1)
    base = Image.alpha_composite(base, overlay)

    # Recreate draw after composites
    draw = ImageDraw.Draw(base)
    # Agreement text
    draw_text_centered(draw, "点击“立即安装”即表示同意软件许可协议", 384, small_font, TEXT_MUTED, width)

    return base


def build_welcome_bitmap() -> Image.Image:
    """MUI welcome/finish side bitmap: 164x314."""
    width, height = 164, 314
    base = Image.new("RGBA", (width, height), DEEP_TOP)
    draw = ImageDraw.Draw(base)
    for y in range(height):
        t = y / height
        color = lerp_color(DEEP_TOP, DEEP_BOT, t)
        draw.line([(0, y), (width, y)], fill=color)
    base = add_glows(base)

    # Glass panel behind logo
    overlay = Image.new("RGBA", base.size, (0, 0, 0, 0))
    ov_draw = ImageDraw.Draw(overlay)
    x, y, w, h, r = 14, 54, 136, 136, 20
    ov_draw.rounded_rectangle([(x, y), (x + w, y + h)], radius=r, fill=GLASS_FILL)
    ov_draw.rounded_rectangle([(x, y), (x + w, y + h)], radius=r, outline=GLASS_BORDER, width=1)
    base = Image.alpha_composite(base, overlay)

    # Logo
    logo = make_black_bg_logo(96)
    base.paste(logo, (34, 74), logo)

    return base


def build_header_bitmap() -> Image.Image:
    """MUI header bitmap: 150x57."""
    width, height = 150, 57
    base = Image.new("RGBA", (width, height), DEEP_TOP)
    draw = ImageDraw.Draw(base)
    for y in range(height):
        t = y / height
        color = lerp_color(DEEP_TOP, DEEP_MID, t)
        draw.line([(0, y), (width, y)], fill=color)

    # Subtle glass strip
    overlay = Image.new("RGBA", base.size, (0, 0, 0, 0))
    ov_draw = ImageDraw.Draw(overlay)
    ov_draw.rounded_rectangle([(6, 8), (width - 6, height - 8)], radius=10, fill=GLASS_FILL)
    ov_draw.rounded_rectangle([(6, 8), (width - 6, height - 8)], radius=10, outline=GLASS_BORDER, width=1)
    return Image.alpha_composite(base, overlay)


def main():
    # 1. Installer custom page background (includes logo, title, button, progress track)
    bg = build_background()
    bg_path = os.path.join(ASSETS_DIR, "installer-bg.bmp")
    bg.convert("RGB").save(bg_path, format="BMP")
    print(f"Generated: {bg_path}")

    # 2. MUI welcome/finish side bitmap
    welcome = build_welcome_bitmap()
    welcome_path = os.path.join(ASSETS_DIR, "installer-welcome.bmp")
    welcome.convert("RGB").save(welcome_path, format="BMP")
    print(f"Generated: {welcome_path}")

    # 4. MUI header bitmap
    header = build_header_bitmap()
    header_path = os.path.join(ASSETS_DIR, "installer-header.bmp")
    header.convert("RGB").save(header_path, format="BMP")
    print(f"Generated: {header_path}")

    # 5. HD desktop icon
    icon_png = make_black_bg_logo(512)
    icon_path = os.path.join(ICON_DIR, "icon.png")
    icon_png.save(icon_path)
    print(f"Updated: {icon_path}")

    print("\ndesktop-native installer assets generated.")


if __name__ == "__main__":
    main()

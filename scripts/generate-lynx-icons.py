"""
生成 Lynx 桌面端图标：白底黑色 X，圆角方形。
生成 icon.png (512x512), icon.ico (多尺寸), 以及 Tauri 需要的各尺寸 PNG。
"""
from PIL import Image, ImageDraw, ImageFont
import os
import math

ICON_DIR = r"d:\Lynn工作空间\LynnHub\desktop\src-tauri\icons"


def draw_x(draw, size, bg_color=(255, 255, 255), x_color=(0, 0, 0)):
    """绘制白底黑色 X 图标，圆角方形背景。"""
    # 圆角半径（约 22% 圆角，类似 App 图标）
    radius = int(size * 0.22)

    # 绘制圆角白色背景
    draw.rounded_rectangle(
        [(0, 0), (size - 1, size - 1)],
        radius=radius,
        fill=bg_color,
    )

    # 绘制 X 字母
    # 使用粗体，大小约为画布的 60%
    font_size = int(size * 0.6)
    try:
        # 尝试使用系统粗体字体
        font = ImageFont.truetype("arial.ttf", font_size)
    except (IOError, OSError):
        try:
            font = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", font_size)
        except (IOError, OSError):
            font = ImageFont.load_default()

    # 测量文字尺寸并居中
    text = "X"
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    x = (size - text_width) / 2 - bbox[0]
    y = (size - text_height) / 2 - bbox[1] - int(size * 0.02)

    draw.text((x, y), text, fill=x_color, font=font)


def make_icon(size):
    """生成指定尺寸的图标 Image。"""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw_x(draw, size)
    return img


def main():
    os.makedirs(ICON_DIR, exist_ok=True)

    # 生成主图标 PNG (512x512)
    icon_512 = make_icon(512)
    icon_512.save(os.path.join(ICON_DIR, "icon.png"))
    print("Generated icon.png (512x512)")

    # 生成 ICO（包含多尺寸）
    sizes_ico = [16, 24, 32, 48, 64, 128, 256]
    images_ico = [make_icon(s) for s in sizes_ico]
    # ICO 第一个图像作为主图像
    images_ico[0].save(
        os.path.join(ICON_DIR, "icon.ico"),
        format="ICO",
        sizes=[(s, s) for s in sizes_ico],
        append_images=images_ico[1:],
    )
    print(f"Generated icon.ico (sizes: {sizes_ico})")

    # 生成 Tauri 需要的各尺寸 PNG
    png_sizes = {
        "32x32.png": 32,
        "64x64.png": 64,
        "128x128.png": 128,
        "128x128@2x.png": 256,
    }
    for name, size in png_sizes.items():
        make_icon(size).save(os.path.join(ICON_DIR, name))
        print(f"Generated {name} ({size}x{size})")

    # Windows Store Logo 系列（正方形）
    store_sizes = {
        "Square30x30Logo.png": 30,
        "Square44x44Logo.png": 44,
        "Square71x71Logo.png": 71,
        "Square89x89Logo.png": 89,
        "Square107x107Logo.png": 107,
        "Square142x142Logo.png": 142,
        "Square150x150Logo.png": 150,
        "Square284x284Logo.png": 284,
        "Square310x310Logo.png": 310,
        "StoreLogo.png": 50,
    }
    for name, size in store_sizes.items():
        make_icon(size).save(os.path.join(ICON_DIR, name))
        print(f"Generated {name} ({size}x{size})")

    print("\nAll icons generated successfully!")


if __name__ == "__main__":
    main()

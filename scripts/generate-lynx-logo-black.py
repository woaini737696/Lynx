"""
生成 Lynx 黑底白色猞猁 Logo（圆角方形）。
输入：lynx-logos/lynx-logo-256.png（白色猞猁 + 透明背景）
输出：
  - public/lynx-icon-{64,128,192,256,512}.png  供 Web/PWA 使用
  - public/lynx-logo-black.png                   供 Web 通用
  - desktop/src-tauri/icons/icon.png + icon.ico + 各尺寸  供桌面端
  - web_Lynx/public/lynx-logo-black.png           供官网
  - android/app/src/main/res/mipmap-*/ic_launcher.png  供 Android
"""
from PIL import Image
import os

ROOT = r"d:\Lynn工作空间\LynnHub"
SRC = os.path.join(ROOT, "lynx-logos", "lynx-logo-256.png")


def make_black_bg_logo(size: int, radius_ratio: float = 0.22) -> Image.Image:
    """生成黑底白色猞猁 Logo（圆角方形）。"""
    # 1. 黑色圆角方形背景
    bg = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    from PIL import ImageDraw
    draw = ImageDraw.Draw(bg)
    radius = int(size * radius_ratio)
    draw.rounded_rectangle([(0, 0), (size - 1, size - 1)], radius=radius, fill=(3, 8, 22, 255))
    # 2. 叠加白色猞猁 logo（按比例缩放，留 12% 边距）
    src = Image.open(SRC).convert("RGBA")
    inset = int(size * 0.12)
    logo_size = size - inset * 2
    logo = src.resize((logo_size, logo_size), Image.LANCZOS)
    bg.paste(logo, (inset, inset), logo)  # 用 logo 的 alpha 作为 mask
    return bg


def main():
    # Web/PWA 多尺寸
    public_dir = os.path.join(ROOT, "public")
    os.makedirs(public_dir, exist_ok=True)
    web_sizes = [64, 128, 192, 256, 512]
    for s in web_sizes:
        img = make_black_bg_logo(s)
        img.save(os.path.join(public_dir, f"lynx-icon-{s}.png"))
        print(f"public/lynx-icon-{s}.png")
    # 通用黑底 logo（256）
    make_black_bg_logo(256).save(os.path.join(public_dir, "lynx-logo-black.png"))
    print("public/lynx-logo-black.png")

    # 桌面端图标
    icon_dir = os.path.join(ROOT, "desktop", "src-tauri", "icons")
    os.makedirs(icon_dir, exist_ok=True)
    # 主 icon.png (512)
    make_black_bg_logo(512).save(os.path.join(icon_dir, "icon.png"))
    print("desktop/src-tauri/icons/icon.png (512)")
    # ICO 多尺寸
    ico_sizes = [16, 24, 32, 48, 64, 128, 256]
    ico_images = [make_black_bg_logo(s) for s in ico_sizes]
    ico_images[0].save(
        os.path.join(icon_dir, "icon.ico"),
        format="ICO",
        sizes=[(s, s) for s in ico_sizes],
        append_images=ico_images[1:],
    )
    print(f"desktop/src-tauri/icons/icon.ico (sizes: {ico_sizes})")
    # Tauri PNG 尺寸
    for name, s in [("32x32.png", 32), ("64x64.png", 64), ("128x128.png", 128), ("128x128@2x.png", 256)]:
        make_black_bg_logo(s).save(os.path.join(icon_dir, name))
        print(f"desktop/src-tauri/icons/{name}")

    # 官网 logo
    web_lynx_public = os.path.join(ROOT, "web_Lynx", "public")
    os.makedirs(web_lynx_public, exist_ok=True)
    make_black_bg_logo(256).save(os.path.join(web_lynx_public, "lynx-logo-black.png"))
    print("web_Lynx/public/lynx-logo-black.png")

    # Android mipmap（替换 ic_launcher）
    android_res = os.path.join(ROOT, "android", "app", "src", "main", "res")
    if os.path.isdir(android_res):
        for d in os.listdir(android_res):
            if d.startswith("mipmap-"):
                launcher = os.path.join(android_res, d, "ic_launcher.png")
                if os.path.exists(launcher):
                    # 读取原尺寸
                    orig = Image.open(launcher)
                    s = orig.size[0]
                    make_black_bg_logo(s).save(launcher)
                    print(f"android/.../res/{d}/ic_launcher.png ({s})")
                round_launcher = os.path.join(android_res, d, "ic_launcher_round.png")
                if os.path.exists(round_launcher):
                    orig = Image.open(round_launcher)
                    s = orig.size[0]
                    make_black_bg_logo(s, radius_ratio=0.5).save(round_launcher)  # round 用更大圆角
                    print(f"android/.../res/{d}/ic_launcher_round.png ({s})")

    print("\n✅ 全部 Logo 生成完成（黑底白色猞猁，圆角方形）")


if __name__ == "__main__":
    main()

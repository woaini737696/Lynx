"""验证 NSIS BMP 资源尺寸和格式"""
import struct
from pathlib import Path

build_dir = Path(r"d:\Lynn工作空间\LynnHub\desktop-electron\build")

def read_bmp_info(filepath):
    with open(filepath, "rb") as f:
        data = f.read(54)  # BMP 头 + DIB 头

    # BMP 文件头（14字节）
    signature = data[0:2].decode("ascii", errors="replace")
    file_size = struct.unpack("<I", data[2:6])[0]
    data_offset = struct.unpack("<I", data[10:14])[0]

    # DIB 头 BITMAPINFOHEADER（40字节）
    dib_size = struct.unpack("<I", data[14:18])[0]
    width = struct.unpack("<i", data[18:22])[0]
    height = struct.unpack("<i", data[22:26])[0]
    planes = struct.unpack("<H", data[26:28])[0]
    bpp = struct.unpack("<H", data[28:30])[0]
    compression = struct.unpack("<I", data[30:34])[0]

    return {
        "signature": signature,
        "file_size": file_size,
        "data_offset": data_offset,
        "dib_size": dib_size,
        "width": width,
        "height": height,
        "planes": planes,
        "bpp": bpp,
        "compression": compression,
    }

files = {
    "installer-header.bmp": (150, 57),
    "installer-sidebar.bmp": (164, 314),
}

print("=== NSIS BMP 资源验证 ===\n")
for name, (exp_w, exp_h) in files.items():
    fp = build_dir / name
    if not fp.exists():
        print(f"[ERR] {name} 不存在")
        continue

    info = read_bmp_info(fp)
    actual_size = fp.stat().st_size

    width_ok = info["width"] == exp_w
    height_ok = info["height"] == exp_h
    bmp_ok = info["signature"] == "BM"
    bpp_ok = info["bpp"] == 24
    compression_ok = info["compression"] == 0  # BI_RGB (uncompressed)

    status = "PASS" if all([width_ok, height_ok, bmp_ok, bpp_ok, compression_ok]) else "FAIL"
    print(f"[{status}] {name}")
    print(f"  签名       : {info['signature']} (期望 BM) {'✓' if bmp_ok else '✗'}")
    print(f"  尺寸       : {info['width']}x{info['height']} (期望 {exp_w}x{exp_h}) {'✓' if width_ok and height_ok else '✗'}")
    print(f"  色深       : {info['bpp']} bpp (期望 24) {'✓' if bpp_ok else '✗'}")
    print(f"  压缩       : {info['compression']} (期望 0=BI_RGB) {'✓' if compression_ok else '✗'}")
    print(f"  文件大小   : {actual_size} bytes")
    print()

# icon.ico 验证
icon = build_dir / "icon.ico"
if icon.exists():
    with open(icon, "rb") as f:
        data = f.read(6)
        reserved = struct.unpack("<H", data[0:2])[0]
        img_type = struct.unpack("<H", data[2:4])[0]
        count = struct.unpack("<H", data[4:6])[0]
    print(f"[{'PASS' if reserved == 0 and img_type == 1 and count > 0 else 'FAIL'}] icon.ico")
    print(f"  保留字段   : {reserved} (期望 0)")
    print(f"  类型       : {img_type} (期望 1=ICO)")
    print(f"  图像数量   : {count}")
    print(f"  文件大小   : {icon.stat().st_size} bytes")

# license.txt BOM 验证
license = build_dir / "license.txt"
if license.exists():
    with open(license, "rb") as f:
        head = f.read(3)
    has_bom = head == b"\xef\xbb\xbf"
    content = license.read_text(encoding="utf-8-sig")
    print(f"\n[{'PASS' if has_bom else 'FAIL'}] license.txt")
    print(f"  UTF-8 BOM  : {'存在' if has_bom else '缺失'}")
    print(f"  文件大小   : {license.stat().st_size} bytes")
    print(f"  内容预览   : {content[:80]}...")

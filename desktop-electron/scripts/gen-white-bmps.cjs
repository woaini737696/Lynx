// 生成 NSIS 安装界面 BMP（白底 + 品牌色横条，豆包风格简洁设计）
// installer-header.bmp: 150×57（安装页顶部）
// installer-sidebar.bmp: 164×314（欢迎/完成页侧边）
// BMP 格式：24-bit BGR uncompressed（NSIS 3.x 要求），行 4 字节对齐
const fs = require('fs');
const path = require('path');

// 品牌色
const BRAND_BLUE = { r: 50, g: 120, b: 220 };   // 顶部品牌横条
const LIGHT_GRAY = { r: 240, g: 240, b: 240 };  // 底部装饰横条
const WHITE = { r: 255, g: 255, b: 255 };

/**
 * 写入 24-bit BGR uncompressed BMP
 * @param {string} filepath 输出路径
 * @param {number} width 宽度
 * @param {number} height 高度
 * @param {function} pixelFn (x, y) => {r, g, b}，y 为 top-down 坐标（y=0 在顶部）
 */
function writeBMP(filepath, width, height, pixelFn) {
  const rowSize = Math.floor((24 * width + 31) / 32) * 4;
  const pixelDataSize = rowSize * height;
  const fileSize = 14 + 40 + pixelDataSize;

  const buf = Buffer.alloc(fileSize, 0);
  let off = 0;

  // BITMAPFILEHEADER (14 bytes)
  buf.write('BM', off); off += 2;
  buf.writeUInt32LE(fileSize, off); off += 4;
  buf.writeUInt16LE(0, off); off += 2; // reserved
  buf.writeUInt16LE(0, off); off += 2; // reserved
  buf.writeUInt32LE(14 + 40, off); off += 4; // pixel data offset

  // BITMAPINFOHEADER (40 bytes)
  buf.writeUInt32LE(40, off); off += 4; // header size
  buf.writeInt32LE(width, off); off += 4;
  buf.writeInt32LE(height, off); off += 4; // positive = bottom-up
  buf.writeUInt16LE(1, off); off += 2; // planes
  buf.writeUInt16LE(24, off); off += 2; // bpp
  buf.writeUInt32LE(0, off); off += 4; // compression (BI_RGB)
  buf.writeUInt32LE(pixelDataSize, off); off += 4;
  buf.writeInt32LE(2835, off); off += 4; // x ppm (~72 DPI)
  buf.writeInt32LE(2835, off); off += 4; // y ppm
  buf.writeUInt32LE(0, off); off += 4; // colors
  buf.writeUInt32LE(0, off); off += 4; // important colors

  // Pixel data (BGR, bottom-up, row padded to 4 bytes)
  // BMP 是 bottom-up：文件中第一行是图像底部，所以 top-down 的 y 要翻转
  for (let fileRow = 0; fileRow < height; fileRow++) {
    const yTopDown = height - 1 - fileRow; // 翻转为 top-down 坐标
    const rowStart = off + fileRow * rowSize;
    for (let x = 0; x < width; x++) {
      const c = pixelFn(x, yTopDown);
      const i = rowStart + x * 3;
      buf[i] = c.b;     // B
      buf[i + 1] = c.g; // G
      buf[i + 2] = c.r; // R
    }
    // padding bytes already 0
  }

  fs.writeFileSync(filepath, buf);
  console.log(`[gen-bmp] ${path.basename(filepath)}: ${width}×${height} (${fileSize} bytes)`);
}

const buildDir = path.join(__dirname, '..', 'build');
fs.mkdirSync(buildDir, { recursive: true });

// installer-header.bmp: 150×57，白底 + 顶部 8px 品牌蓝横条
writeBMP(path.join(buildDir, 'installer-header.bmp'), 150, 57, (x, y) => {
  if (y < 8) return BRAND_BLUE; // 顶部品牌色横条
  return WHITE;
});

// installer-sidebar.bmp: 164×314，白底 + 顶部 30px 品牌蓝横条 + 底部 30px 浅灰横条
writeBMP(path.join(buildDir, 'installer-sidebar.bmp'), 164, 314, (x, y) => {
  if (y < 30) return BRAND_BLUE;   // 顶部品牌色横条
  if (y >= 314 - 30) return LIGHT_GRAY; // 底部浅灰横条
  return WHITE;
});

console.log('[gen-bmp] 完成！已生成带品牌色横条的 NSIS 安装界面 BMP');

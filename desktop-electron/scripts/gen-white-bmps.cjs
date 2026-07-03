// 生成纯白 BMP 文件用于 NSIS 安装界面（豆包风格简洁白底）
// installer-header.bmp: 150×57（安装页顶部）
// installer-sidebar.bmp: 164×314（欢迎/完成页侧边）
// installer-header-icon.bmp: 32×32（安装页左上角小图标占位，全白）
const fs = require('fs');
const path = require('path');

function writeBMP(filepath, width, height, fillR = 255, fillG = 255, fillB = 255) {
  // BMP 行需要 4 字节对齐
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
  for (let y = 0; y < height; y++) {
    const rowStart = off + y * rowSize;
    for (let x = 0; x < width; x++) {
      const i = rowStart + x * 3;
      buf[i] = fillB;     // B
      buf[i + 1] = fillG; // G
      buf[i + 2] = fillR; // R
    }
    // padding bytes already 0
  }

  fs.writeFileSync(filepath, buf);
  console.log(`[gen-bmp] ${path.basename(filepath)}: ${width}×${height} (${fileSize} bytes)`);
}

const buildDir = path.join(__dirname, '..', 'build');
fs.mkdirSync(buildDir, { recursive: true });

// NSIS Modern UI 标准尺寸
writeBMP(path.join(buildDir, 'installer-header.bmp'), 150, 57);
writeBMP(path.join(buildDir, 'installer-sidebar.bmp'), 164, 314);
writeBMP(path.join(buildDir, 'installer-header-icon.bmp'), 32, 32);

console.log('[gen-bmp] 完成！所有白色 BMP 已生成');

// 生成 build/license.txt（NSIS 安装包许可协议）
// 关键：UTF-8 with BOM 编码，NSIS 3.x 自动识别 BOM 才能正确显示中文，无 BOM 会乱码
const fs = require('fs');
const path = require('path');

const outPath = path.join(__dirname, '..', 'build', 'license.txt');

const content = `奇思 - AI工作台 用户许可协议

Copyright © 2026 Lynn. All rights reserved.

第一条 软件授权
本软件由 Lynn 免费提供，用户可自由安装、使用、复制本软件。

第二条 使用限制
1. 禁止反向工程、反编译、反汇编本软件。
2. 禁止将本软件用于任何违法用途。
3. 禁止二次分发未经授权的修改版本。

第三条 免责声明
本软件按"原样"提供，作者不承担因使用本软件造成的任何直接或间接损失。

第四条 隐私政策
本软件尊重用户隐私，所有用户数据存储在本地，不会上传到服务器（除用户主动同步功能外）。

第五条 其他
本协议的解释、效力及争议解决均适用中华人民共和国法律。
`;

fs.mkdirSync(path.dirname(outPath), { recursive: true });

// UTF-8 BOM = EF BB BF，写入 \uFEFF 字符（Node 会按 utf8 编码为 EF BB BF 三字节）
const BOM = '\uFEFF';
fs.writeFileSync(outPath, BOM + content, 'utf8');

// 验证首字节为 EF BB BF
const head = fs.readFileSync(outPath).slice(0, 3);
const isBom = head[0] === 0xef && head[1] === 0xbb && head[2] === 0xbf;
console.log(`[gen-license] 已生成: ${outPath}`);
console.log(`[gen-license] 首字节: ${head.toString('hex').toUpperCase()} (EF BB BF = UTF-8 BOM)`);
console.log(`[gen-license] BOM 校验: ${isBom ? 'PASS' : 'FAIL'}`);

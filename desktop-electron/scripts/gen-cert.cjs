// 一次性脚本：生成自签名代码签名证书 (CN=lynn) → build/lynn-code-sign.pfx
// 使用 node-forge（selfsigned 的依赖），不依赖 Windows 证书存储
// 用法：node scripts/gen-cert.cjs
const forge = require('node-forge');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'build', 'lynn-code-sign.pfx');
const PASSWORD = 'lynn-sign-2026';

console.log('[gen-cert] 开始生成自签名代码签名证书...');

// 1. 生成 RSA 密钥对
const keys = forge.pki.rsa.generateKeyPair(2048);
console.log('[gen-cert] RSA 2048 密钥对已生成');

// 2. 创建证书
const cert = forge.pki.createCertificate();
cert.publicKey = keys.publicKey;
cert.serialNumber = String(Date.now());

// 3. 设置 subject（CN=lynn 就是 Windows 属性里显示的发布者名称）
const subject = [
  { name: 'commonName', value: 'lynn' },
  { name: 'organizationName', value: 'lynn' },
  { name: 'countryName', value: 'CN' },
];
cert.setSubject(subject);
cert.setIssuer(subject); // 自签名，issuer = subject

// 4. 设置有效期 10 年
const notBefore = new Date();
notBefore.setDate(notBefore.getDate() - 1); // 防止时钟偏差
const notAfter = new Date();
notAfter.setFullYear(notAfter.getFullYear() + 10);
cert.validity.notBefore = notBefore;
cert.validity.notAfter = notAfter;

// 5. 设置扩展（代码签名用途）
cert.setExtensions([
  { name: 'basicConstraints', cA: false },
  { name: 'keyUsage', digitalSignature: true, keyEncipherment: false },
  { name: 'extKeyUsage', serverAuth: false, codeSigning: true },
  { name: 'subjectAltName', altNames: [{ type: 2, value: 'lynn' }] },
]);

// 6. 自签名
cert.sign(keys.privateKey, forge.md.sha256.create());
console.log('[gen-cert] 证书已自签名 (SHA-256)');
const subjectStr = cert.subject.attributes.map(a => `${a.shortName}=${a.value}`).join(', ');
console.log('[gen-cert] Subject:', subjectStr);

// 7. 导出 PFX
const asn1Cert = forge.pki.certificateToAsn1(cert);
const asn1Key = forge.pki.privateKeyToAsn1(keys.privateKey);
const pfxAsn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], PASSWORD, {
  friendlyName: 'lynn Code Signing',
});
const pfxBuffer = Buffer.from(forge.asn1.toDer(pfxAsn1).getBytes(), 'binary');

// 8. 写入文件
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, pfxBuffer);
console.log(`[gen-cert] PFX 证书已保存: ${OUT} (${pfxBuffer.length} 字节)`);
console.log(`[gen-cert] 证书密码: ${PASSWORD}`);
console.log('[gen-cert] 完成！在 package.json 中配置 certificateFile + certificatePassword 即可使用');

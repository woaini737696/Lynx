// AES-256-GCM 加密工具
//
// 用于加密数据库中存储的 API Key 等敏感字段。
// 密钥从环境变量 ENCRYPTION_KEY 读取（32 字节 base64 编码）。
// 生成命令：openssl rand -base64 32
//
// 加密格式：enc:<iv>:<ciphertext>:<tag>（均为 hex 编码）
// 未加密的值（不含 "enc:" 前缀）会被视为明文，解密时原样返回（向后兼容）

import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // GCM 推荐 12 字节 IV

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("ENCRYPTION_KEY 环境变量未配置，请运行 `openssl rand -base64 32` 生成");
    }
    // 开发环境使用默认 key（不安全但非空）
    return crypto.createHash("sha256").update("dev-encryption-key-not-for-production").digest();
  }
  // 支持 base64 编码的 key 或直接使用的 key（取 SHA-256 确保长度正确）
  try {
    const buf = Buffer.from(raw, "base64");
    if (buf.length === 32) return buf;
  } catch {
    // 非 base64，走 hash 路径
  }
  return crypto.createHash("sha256").update(raw).digest();
}

const CIPHER_PREFIX = "enc:";

/** 加密字符串，返回 "enc:<iv>:<ciphertext>:<tag>" 格式 */
export function encrypt(plaintext: string | null | undefined): string | null {
  if (plaintext == null || plaintext === "") return plaintext ?? null;
  // 已加密的值不重复加密
  if (plaintext.startsWith(CIPHER_PREFIX)) return plaintext;
  try {
    const key = getKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${CIPHER_PREFIX}${iv.toString("hex")}:${encrypted.toString("hex")}:${tag.toString("hex")}`;
  } catch (e) {
    console.error("[crypto] 加密失败:", (e as Error).message);
    return plaintext; // 加密失败返回明文（不阻断业务流程）
  }
}

/** 解密字符串，接受 "enc:..." 格式或明文（原样返回） */
export function decrypt(ciphertext: string | null | undefined): string | null {
  if (ciphertext == null || ciphertext === "") return ciphertext ?? null;
  if (!ciphertext.startsWith(CIPHER_PREFIX)) return ciphertext; // 明文，向后兼容
  try {
    const parts = ciphertext.slice(CIPHER_PREFIX.length).split(":");
    if (parts.length !== 3) return null;
    const [ivHex, dataHex, tagHex] = parts;
    const key = getKey();
    const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    const decrypted = Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]);
    return decrypted.toString("utf8");
  } catch {
    return null; // 解密失败返回 null（不泄露任何信息）
  }
}

/** 判断值是否已加密 */
export function isEncrypted(value: string | null | undefined): boolean {
  return !!value && value.startsWith(CIPHER_PREFIX);
}

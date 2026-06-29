// 认证配置工具：从数据库 SystemConfig 表读取万能验证码等配置
// 管理员可在设置页灵活配置和开关，无需改环境变量

import { prisma } from "@/lib/db";

const KEY_MASTER_CODE = "master_code";
const KEY_MASTER_CODE_ENABLED = "master_code_enabled";

/** 读取万能验证码（未配置返回 null） */
export async function getMasterCode(): Promise<string | null> {
  try {
    const row = await prisma.systemConfig.findUnique({
      where: { key: KEY_MASTER_CODE },
    });
    return row?.value?.trim() || null;
  } catch {
    return null;
  }
}

/** 万能验证码是否启用（默认关闭，需管理员显式开启） */
export async function isMasterCodeEnabled(): Promise<boolean> {
  try {
    const row = await prisma.systemConfig.findUnique({
      where: { key: KEY_MASTER_CODE_ENABLED },
    });
    return row?.value === "true";
  } catch {
    return false;
  }
}

/** 综合判断：返回当前生效的万能验证码（启用且已配置才返回，否则 null） */
export async function getEffectiveMasterCode(): Promise<string | null> {
  const enabled = await isMasterCodeEnabled();
  if (!enabled) return null;
  return getMasterCode();
}

/** 设置万能验证码（admin 调用） */
export async function setMasterCode(code: string, userId: string): Promise<void> {
  const value = code.trim();
  await prisma.systemConfig.upsert({
    where: { key: KEY_MASTER_CODE },
    create: { key: KEY_MASTER_CODE, value, updatedBy: userId },
    update: { value, updatedBy: userId },
  });
}

/** 启用/禁用万能验证码（admin 调用） */
export async function setMasterCodeEnabled(enabled: boolean, userId: string): Promise<void> {
  await prisma.systemConfig.upsert({
    where: { key: KEY_MASTER_CODE_ENABLED },
    create: {
      key: KEY_MASTER_CODE_ENABLED,
      value: enabled ? "true" : "false",
      updatedBy: userId,
    },
    update: {
      value: enabled ? "true" : "false",
      updatedBy: userId,
    },
  });
}

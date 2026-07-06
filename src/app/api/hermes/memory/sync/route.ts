import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import {
  syncHermesMemoryToLynx,
  exportMemoryToHermes,
} from "@/lib/hermes-client";
import { getLogger } from "@/lib/logger";

const logger = getLogger("hermes-api");

// POST /api/hermes/memory/sync - 双向同步 Hermes ↔ 奇思 记忆
// 1. 将 Hermes memory 目录的文件导入奇思 Memory 表（Hermes → 奇思）
// 2. 将奇思 Memory 表的记忆导出到 Hermes memory 目录（奇思 → Hermes）
export async function POST() {
  const auth = await requireAuth();
  if (auth.user === null) return auth.error;

  try {
    // 1. Hermes → 奇思：导入 Hermes memory 文件
    const importResult = await syncHermesMemoryToLynx(auth.user.id);

    // 2. 奇思 → Hermes：导出奇思 Memory 到 Hermes memory 目录
    const exportResult = await exportMemoryToHermes(auth.user.id);

    logger.info(
      {
        userId: auth.user.id,
        imported: importResult.synced,
        exported: exportResult.exported,
      },
      "Hermes 记忆双向同步完成"
    );

    return NextResponse.json({
      success: importResult.success && exportResult.success,
      imported: importResult.synced,
      exported: exportResult.exported,
      skipped: importResult.skipped,
      error: importResult.error || exportResult.error,
    });
  } catch (e) {
    logger.error({ err: e }, "Hermes 记忆双向同步失败");
    return NextResponse.json(
      { error: "服务器错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

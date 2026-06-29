// 管理员配置万能验证码：GET 读取 / PUT 保存
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-utils";
import {
  getMasterCode,
  isMasterCodeEnabled,
  setMasterCode,
  setMasterCodeEnabled,
} from "@/lib/auth-config";
import { getLogger } from "@/lib/logger";

const logger = getLogger("auth-config-api");

/** GET /api/settings/auth-config - 读取万能验证码配置（仅 admin） */
export async function GET() {
  const { error, user } = await requireAdmin();
  if (error) return error;

  try {
    const [code, enabled] = await Promise.all([getMasterCode(), isMasterCodeEnabled()]);
    return NextResponse.json({
      masterCode: code || "",
      enabled,
      // 是否已配置（避免泄露具体值给非 admin 场景，这里 admin 可见）
      configured: Boolean(code),
    });
  } catch (e) {
    logger.error({ err: e }, "读取万能码配置失败");
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

/** PUT /api/settings/auth-config - 保存万能验证码配置（仅 admin）
 * Body: { masterCode?: string, enabled?: boolean }
 */
export async function PUT(req: NextRequest) {
  const { error, user } = await requireAdmin();
  if (error) return error;

  try {
    const body = await req.json().catch(() => ({}));
    const { masterCode, enabled } = body as {
      masterCode?: string;
      enabled?: boolean;
    };

    if (masterCode !== undefined) {
      const code = String(masterCode).trim();
      if (code && code.length < 4) {
        return NextResponse.json(
          { error: "万能验证码至少 4 位" },
          { status: 400 }
        );
      }
      await setMasterCode(code, user!.id);
      logger.info({ userId: user!.id, codeLen: code.length }, "万能验证码已更新");
    }

    if (typeof enabled === "boolean") {
      await setMasterCodeEnabled(enabled, user!.id);
      logger.info({ userId: user!.id, enabled }, "万能验证码开关已更新");
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    logger.error({ err: e }, "保存万能码配置失败");
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

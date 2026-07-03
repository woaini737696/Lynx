import { NextRequest, NextResponse } from "next/server";
import {
  runSyncAsync,
  readSyncState,
  upsertTasksToDb,
  writeSyncState,
  type SyncState,
} from "@/lib/lark-sync";
import { getFeishuToken, fetchAllFeishuTasks } from "@/lib/feishu-api";
import { getCurrentUser } from "@/lib/auth-utils";
import { getLogger } from "@/lib/logger";

const logger = getLogger("lark-tasks-sync-api");

// POST /api/lark-tasks/sync - 触发一次飞书任务同步
// 优先用 OAuth 路径（每用户自己的飞书账号），失败时回退到 lark-cli 全局同步
export async function POST(_req: NextRequest) {
  try {
    // ===== OAuth 路径：用户已绑定飞书账号时，直接拉取并入库 =====
    const oauthUser = await getCurrentUser();
    if (oauthUser) {
      const accessToken = await getFeishuToken(oauthUser.id);
      if (accessToken) {
        try {
          const fetchRes = await fetchAllFeishuTasks(accessToken);
          if (fetchRes.ok && fetchRes.tasks) {
            // upsert 到数据库缓存（与 lark-sync.ts 中 runSyncAsync 行为一致）
            await upsertTasksToDb(fetchRes.tasks).catch((e) => {
              logger.error({ err: e }, "[lark-tasks/sync] OAuth 写入数据库失败");
            });
            // 更新同步状态文件（与 lark-cli 路径保持一致）
            const state: SyncState = {
              lastSyncAt: new Date().toISOString(),
              lastError: null,
              taskCount: fetchRes.tasks.length,
            };
            writeSyncState(state);
            return NextResponse.json({
              success: true,
              state,
              count: fetchRes.tasks.length,
              source: "feishu-oauth",
            });
          }
          // OAuth 拉取失败：记录日志，回退到 lark-cli 路径
          logger.warn({ err: fetchRes.error }, "[lark-tasks/sync] OAuth 同步失败，回退 lark-cli");
        } catch (e) {
          logger.warn({ err: e }, "[lark-tasks/sync] OAuth 同步异常，回退 lark-cli");
        }
      }
      // access_token 不可用：回退到 lark-cli 路径
    }

    // ===== lark-cli 回退路径（向后兼容）=====
    const result = await runSyncAsync();
    return NextResponse.json({
      success: result.ok,
      state: result.state,
      ...(result.error ? { error: result.error } : {}),
      source: "lark-cli",
    });
  } catch (e) {
    console.error("飞书任务同步失败:", e);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

// GET /api/lark-tasks/sync - 获取同步状态
export async function GET(_req: NextRequest) {
  try {
    const state = readSyncState();
    return NextResponse.json({ state });
  } catch (e) {
    console.error("获取同步状态失败:", e);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

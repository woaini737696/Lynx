import { NextRequest, NextResponse } from "next/server";
import { handleWebhookEvent } from "@/lib/lark-webhook-handler";

// POST /api/lark-webhook - 飞书事件订阅接收端
// 处理两类请求：
//   1. URL 验证：飞书首次配置时发送 { type: "url_verification", challenge, token }
//   2. 事件通知：schema 2.0 格式 { schema: "2.0", header: {...}, event: {...} }
export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "请求体不是合法的 JSON" },
      { status: 400 }
    );
  }

  try {
    const result = await handleWebhookEvent(body);

    // URL 验证：原样返回 challenge
    if (result.challenge !== undefined) {
      if (result.error) {
        return NextResponse.json(
          { error: result.error },
          { status: 401 }
        );
      }
      return NextResponse.json({ challenge: result.challenge });
    }

    if (result.error) {
      return NextResponse.json(
        { error: result.error, processed: result.processed },
        { status: 401 }
      );
    }

    return NextResponse.json({
      processed: result.processed,
      deduplicated: result.deduplicated || false,
    });
  } catch (e) {
    console.error("处理飞书 webhook 失败:", e);
    return NextResponse.json(
      { error: "服务器错误" },
      { status: 500 }
    );
  }
}

// GET /api/lark-webhook - 健康检查
export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "/api/lark-webhook",
    description: "飞书事件订阅接收端，请使用 POST 发送事件",
  });
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// 分享码机制（简化方案）：
// 分享码 = base64(skillId + ":" + timestamp)
// 解析后返回 Skill 数据
// 不依赖额外存储，无状态

// POST /api/skills/share-code - 生成分享码
// body: { skillId: string }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { skillId } = body as { skillId?: string };

    if (!skillId) {
      return NextResponse.json(
        { error: "skillId 不能为空" },
        { status: 400 }
      );
    }

    const skill = await prisma.skill.findUnique({ where: { id: skillId } });
    if (!skill) {
      return NextResponse.json(
        { error: "未找到 Skill" },
        { status: 404 }
      );
    }

    // 生成分享码：base64(skillId:timestamp)
    const timestamp = Date.now();
    const raw = `${skillId}:${timestamp}`;
    const code = Buffer.from(raw, "utf-8").toString("base64url");

    return NextResponse.json({
      code,
      skillName: skill.name,
      shareUrl: `/skills/market?code=${code}`,
      success: true,
    });
  } catch (e) {
    console.error("生成分享码失败:", e);
    return NextResponse.json(
      { error: "服务器错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

// GET /api/skills/share-code?code=XXX - 通过分享码获取 Skill 数据
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");

    if (!code) {
      return NextResponse.json(
        { error: "code 不能为空" },
        { status: 400 }
      );
    }

    // 解析分享码
    let raw: string;
    try {
      raw = Buffer.from(code, "base64url").toString("utf-8");
    } catch {
      return NextResponse.json(
        { error: "分享码格式无效" },
        { status: 400 }
      );
    }

    const parts = raw.split(":");
    if (parts.length < 2) {
      return NextResponse.json(
        { error: "分享码格式无效" },
        { status: 400 }
      );
    }

    const skillId = parts[0];
    if (!skillId) {
      return NextResponse.json(
        { error: "分享码无效" },
        { status: 400 }
      );
    }

    const skill = await prisma.skill.findUnique({ where: { id: skillId } });
    if (!skill) {
      return NextResponse.json(
        { error: "Skill 不存在或已删除" },
        { status: 404 }
      );
    }

    // 返回可导入的 Skill 数据（不含内部 id 等字段）
    return NextResponse.json({
      skill: {
        name: skill.name,
        description: skill.description,
        category: skill.category,
        content: skill.content,
        parameters: skill.parameters,
        promptTemplate: skill.promptTemplate,
        tags: skill.tags,
        source: skill.source,
      },
      success: true,
    });
  } catch (e) {
    console.error("解析分享码失败:", e);
    return NextResponse.json(
      { error: "服务器错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

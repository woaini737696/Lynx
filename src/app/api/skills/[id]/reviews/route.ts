import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// ============ 路由处理函数 ============

// GET /api/skills/[id]/reviews - 获取某 Skill 的所有评分和评论
// 返回 { reviews, average, count }
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // 查询该 Skill 的所有评论，按时间倒序
    const reviews = await prisma.skillReview.findMany({
      where: { skillId: id },
      orderBy: { createdAt: "desc" },
    });

    // 计算平均分和总数
    const count = reviews.length;
    const average =
      count === 0
        ? 0
        : Math.round(
            (reviews.reduce((acc, r) => acc + r.rating, 0) / count) * 10
          ) / 10;

    return NextResponse.json({
      reviews,
      average,
      count,
    });
  } catch (e) {
    console.error("获取评论失败:", e);
    return NextResponse.json(
      { error: "服务器错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

// POST /api/skills/[id]/reviews - 添加评分和评论
// body: { rating: number, comment: string, author: string }
// 返回 { success: true, review }
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await req.json();
    const { rating, comment, author } = body as {
      rating?: number;
      comment?: string;
      author?: string;
    };

    // 参数校验
    if (typeof rating !== "number" || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: "rating 必须为 1-5 之间的数字" },
        { status: 400 }
      );
    }
    if (!comment || !comment.trim()) {
      return NextResponse.json(
        { error: "comment 不能为空" },
        { status: 400 }
      );
    }
    if (!author || !author.trim()) {
      return NextResponse.json(
        { error: "author 不能为空" },
        { status: 400 }
      );
    }

    // 校验 Skill 是否存在
    const skill = await prisma.skill.findUnique({ where: { id } });
    if (!skill) {
      return NextResponse.json(
        { error: "未找到 Skill" },
        { status: 404 }
      );
    }

    // 创建评论
    const review = await prisma.skillReview.create({
      data: {
        skillId: id,
        rating: Math.round(rating),
        comment: comment.trim(),
        author: author.trim(),
      },
    });

    return NextResponse.json({
      success: true,
      review,
    });
  } catch (e) {
    console.error("添加评论失败:", e);
    return NextResponse.json(
      { error: "服务器错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-utils";

// ============ 路由处理函数 ============

// GET /api/skills/[id]/reviews - 获取某 Skill 的所有评分和评论
// id 可以是本地 skillId 或公共广场 publicId（以 "pub_" 前缀标识）
// 返回 { reviews, average, count }
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // 判断是 publicId 还是本地 skillId
    // publicId 通常以 "pub_" 前缀传入（前端约定），或长度为12的base62串
    const isPublicId = id.startsWith("pub_") || (id.length === 12 && !id.startsWith("c"));
    const where = isPublicId
      ? { publicId: id.replace(/^pub_/, "") }
      : { skillId: id };

    // 查询评论，按时间倒序
    const reviews = await prisma.skillReview.findMany({
      where,
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
// body: { rating: number, comment: string, author?: string }
// 返回 { success: true, review }
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAuth();
    if (auth.user === null) return auth.error;
    const user = auth.user;

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

    // 判断是 publicId 还是本地 skillId
    const isPublicId = id.startsWith("pub_") || (id.length === 12 && !id.startsWith("c"));
    const publicId = isPublicId ? id.replace(/^pub_/, "") : null;
    let skillId = id;

    if (isPublicId) {
      // 广场评论：通过 publicId 查找技能，写入 skillId 用于关联
      const skill = await prisma.skill.findFirst({ where: { publicId } });
      if (!skill) {
        return NextResponse.json({ error: "未找到公共技能" }, { status: 404 });
      }
      skillId = skill.id;
    } else {
      // 本地评论：校验 Skill 是否存在
      const skill = await prisma.skill.findUnique({ where: { id } });
      if (!skill) {
        return NextResponse.json({ error: "未找到 Skill" }, { status: 404 });
      }
    }

    // author 默认使用当前登录用户的 username
    const finalAuthor = (author && author.trim()) || user.username;

    // 创建评论，写入 userId 和 publicId 以便归属追踪和跨用户聚合
    const review = await prisma.skillReview.create({
      data: {
        skillId,
        publicId,
        rating: Math.round(rating),
        comment: comment.trim(),
        author: finalAuthor,
        userId: user.id,
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

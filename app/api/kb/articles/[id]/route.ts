import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth(request);

    if (user.role !== "ADMIN" && user.role !== "MANAGER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { title, slug, body, categoryId, status } = await request.json();

    const existing = await db.kbArticle.findUnique({
      where: { id: params.id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    if (slug && slug !== existing.slug) {
      const slugCollision = await db.kbArticle.findUnique({ where: { slug } });
      if (slugCollision) {
        return NextResponse.json({ error: "Slug must be unique." }, { status: 400 });
      }
    }

    // Transaction to update article and save new history version
    const updated = await db.$transaction(async (tx) => {
      const article = await tx.kbArticle.update({
        where: { id: params.id },
        data: {
          title: title ?? existing.title,
          slug: slug ?? existing.slug,
          body: body ?? existing.body,
          status: status ?? existing.status,
          categoryId: categoryId !== undefined ? categoryId : existing.categoryId,
        },
      });

      // If body changed, record version history
      if (body && body !== existing.body) {
        await tx.kbArticleVersion.create({
          data: {
            articleId: article.id,
            body,
            editedByUserId: user.id,
          },
        });
      }

      return article;
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update article:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

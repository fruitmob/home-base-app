import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);

    if (user.role !== "ADMIN" && user.role !== "MANAGER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { title, slug, body, categoryId, status } = await request.json();

    if (!title || !slug || !body) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Ensure slug uniqueness
    const existing = await db.kbArticle.findUnique({ where: { slug } });
    if (existing) {
      return NextResponse.json({ error: "Slug must be unique. Another article is using this slug." }, { status: 400 });
    }

    // Transaction to create article and initial version
    const article = await db.$transaction(async (tx) => {
      const created = await tx.kbArticle.create({
        data: {
          title,
          slug,
          body,
          status,
          categoryId: categoryId || null,
          authorId: user.id,
        },
      });

      await tx.kbArticleVersion.create({
        data: {
          articleId: created.id,
          body,
          editedByUserId: user.id,
        },
      });

      return created;
    });

    return NextResponse.json(article);
  } catch (error) {
    console.error("Failed to create article:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

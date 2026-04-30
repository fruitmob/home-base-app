import { GaugeRetrievalSourceType } from "@/generated/prisma/client";
import type { CurrentUser } from "@/lib/auth";
import { searchGaugeRetrievalSource } from "@/lib/gauge/retrieval";
import {
  asRecord,
  asString,
  noMatchesResult,
  readToolLimit,
  readToolQuery,
} from "@/lib/gauge/tools/shared";

export const searchKbArticlesTool = {
  type: "function" as const,
  function: {
    name: "search_kb_articles",
    description:
      "Search the Home Base knowledge base for procedures, training articles, and internal documentation.",
    parameters: {
      type: "object" as const,
      required: ["query"],
      properties: {
        query: {
          type: "string",
          description: "A procedure, article title, symptom, or knowledge-base phrase from the user's question.",
        },
        limit: {
          type: "number",
          description: "Optional result limit. Defaults to 5 and caps at 8.",
        },
      },
    },
  },
};

export async function searchKbArticles(
  input: Record<string, unknown>,
  user: CurrentUser,
) {
  const query = readToolQuery(input);

  if (!query) {
    return {
      found: false,
      message: "A knowledge-base search query is required.",
    };
  }

  const results = await searchGaugeRetrievalSource({
    sourceType: GaugeRetrievalSourceType.KB_ARTICLE,
    query,
    user,
    limit: readToolLimit(input),
  });

  if (results.length === 0) {
    return noMatchesResult(query, "knowledge-base articles");
  }

  return {
    found: true,
    query,
    results: results.map((result) => {
      const metadata = asRecord(result.metadata);

      return {
        id: result.sourceId,
        title: result.title,
        href: result.href,
        summary: result.summary,
        slug: asString(metadata.slug),
        status: asString(metadata.status),
        categoryName: asString(metadata.categoryName),
        authorEmail: asString(metadata.authorEmail),
        excerpt: asString(metadata.excerpt),
        updatedAt: asString(metadata.updatedAt),
      };
    }),
  };
}
